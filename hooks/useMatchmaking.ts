import { useState, useEffect, useRef } from 'react';
import { db } from '../utils/firebaseConfig';
import { 
  collection, doc, setDoc, deleteDoc, query, where, 
  onSnapshot, getDocs, runTransaction, serverTimestamp, Timestamp 
} from 'firebase/firestore';
import { SessionConfig, User, Partner, SessionType } from '../types';

// How long before a queue entry is considered "stale" (e.g. user crashed)
const QUEUE_EXPIRATION_MS = 5 * 60 * 1000; // 5 Minutes

export const useMatchmaking = (user: User | null, onMatch: (partner: Partner) => void) => {
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'MATCHED'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  
  // Store config to use in polling interval
  const activeConfig = useRef<SessionConfig | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // 1. CLEANUP ON WINDOW CLOSE
  useEffect(() => {
    const handleBeforeUnload = () => {
        if (user && status === 'SEARCHING') {
            // Attempt best-effort delete (navigator.sendBeacon logic usually required here, 
            // but for SPA we try synchronous-like async)
            deleteDoc(doc(db, 'queue', user.id)).catch(console.error);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, status]);

  const joinQueue = async (config: SessionConfig) => {
    if (!user) return;
    setStatus('SEARCHING');
    setError(null);
    activeConfig.current = config;

    try {
      // Create/Update Queue Entry
      await setDoc(doc(db, 'queue', user.id), {
        userId: user.id,
        name: user.name,
        type: config.type,
        duration: config.duration,
        mode: config.mode,
        timestamp: serverTimestamp(),
        // Add explicit fields for easier querying/debugging
        status: 'waiting' 
      });

      // Trigger immediate match attempt
      attemptMatch(config);
    } catch (error: any) {
      console.error("Queue Join Error:", error);
      setError(error.message);
      setStatus('IDLE');
      activeConfig.current = null;
    }
  };

  const cancelSearch = async () => {
    if (!user) return;
    try {
        activeConfig.current = null;
        await deleteDoc(doc(db, 'queue', user.id));
        if (isMounted.current) {
            setStatus('IDLE');
            setError(null);
        }
    } catch (e) { console.error("Cancel Error", e); }
  };

  const attemptMatch = async (config: SessionConfig) => {
    if (!user || !activeConfig.current) return;

    try {
        // Query for potential partners
        // We filter by config. We DO NOT filter by self ID here to simplify index usage, 
        // we filter self in memory.
        const q = query(
            collection(db, 'queue'),
            where('type', '==', config.type),
            where('duration', '==', config.duration),
            where('mode', '==', config.mode)
        );

        const snapshot = await getDocs(q);
        
        // Filter in memory:
        // 1. Not me
        // 2. Not stale (older than 5 mins)
        const now = Date.now();
        const validPartners = snapshot.docs.filter(d => {
            const data = d.data();
            if (d.id === user.id) return false;
            
            // Check timestamp
            const createdAt = data.timestamp instanceof Timestamp ? data.timestamp.toMillis() : now;
            if (now - createdAt > QUEUE_EXPIRATION_MS) return false; // Stale

            return true;
        });

        // Sort by oldest first (FIFO)
        validPartners.sort((a, b) => {
            const tA = a.data().timestamp?.toMillis() || 0;
            const tB = b.data().timestamp?.toMillis() || 0;
            return tA - tB;
        });

        const potentialMatch = validPartners[0];

        if (potentialMatch) {
            const partnerData = potentialMatch.data();
            console.log("Attempting to match with:", partnerData.name);

            // ATOMIC TRANSACTION
            await runTransaction(db, async (transaction) => {
                const myRef = doc(db, 'queue', user.id);
                const partnerRef = doc(db, 'queue', partnerData.userId);
                
                // Read both
                const myDoc = await transaction.get(myRef);
                const partnerDoc = await transaction.get(partnerRef);

                // Validation
                if (!myDoc.exists()) throw new Error("MY_GONE");
                if (!partnerDoc.exists()) throw new Error("PARTNER_GONE");

                // Create Session
                const newSessionRef = doc(collection(db, 'sessions'));
                transaction.set(newSessionRef, {
                    // User1 is strictly the one executing the transaction (Me)
                    // This creates a deterministic Initiator for WebRTC
                    user1: { id: user.id, name: user.name },
                    user2: { id: partnerData.userId, name: partnerData.name },
                    participants: [user.id, partnerData.userId],
                    config: config,
                    status: 'active',
                    createdAt: serverTimestamp()
                });

                // Cleanup Queue
                transaction.delete(myRef);
                transaction.delete(partnerRef);
            });
            
            // If successful, the onSnapshot listener below will trigger the UI update.
        }
    } catch (e: any) {
        // "PARTNER_GONE" is common in high concurrency, just retry next poll
        if (e.message !== "PARTNER_GONE" && e.message !== "MY_GONE") {
             // If it's a missing index error, alert the UI
             if (e.code === 'failed-precondition' || e.toString().includes('index')) {
                setError(e.message);
                activeConfig.current = null;
             } else {
                 console.log("Match attempt skipped:", e.message);
             }
        }
    }
  };

  // POLLING LOOP
  // Retry matching every 3 seconds if we are still searching
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'SEARCHING') {
        interval = setInterval(() => {
            if (activeConfig.current) {
                attemptMatch(activeConfig.current);
            }
        }, 3000);
    }
    return () => clearInterval(interval);
  }, [status]);

  // SESSION LISTENER
  // Waits for a session to be created where I am a participant
  useEffect(() => {
    if (!user || status === 'MATCHED') return;

    const q = query(
      collection(db, 'sessions'),
      where('participants', 'array-contains', user.id),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const session = change.doc.data();
          
          // Identify Partner
          const partnerInfo = session.user1.id === user.id ? session.user2 : session.user1;
          
          // Stop polling
          activeConfig.current = null;
          setStatus('MATCHED');
          
          // Trigger callback
          onMatch({
            id: partnerInfo.id,
            name: partnerInfo.name,
            type: SessionType.ANY
          });
        }
      });
    });

    return () => unsubscribe();
  }, [user, status]);

  return { status, joinQueue, cancelSearch, error };
};