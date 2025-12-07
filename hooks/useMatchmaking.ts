import { useState, useEffect, useRef } from 'react';
import { db } from '../utils/firebaseConfig';
import { 
  collection, doc, setDoc, deleteDoc, query, where, 
  onSnapshot, getDocs, writeBatch, serverTimestamp, getDoc, Timestamp
} from 'firebase/firestore';
import { SessionConfig, User, Partner, SessionType } from '../types';

const QUEUE_EXPIRATION_MS = 5 * 60 * 1000;

export const useMatchmaking = (user: User | null, onMatch: (partner: Partner) => void) => {
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'MATCHED'>('IDLE');
  const [error, setError] = useState<string | null>(null);
  
  const activeConfig = useRef<SessionConfig | null>(null);
  const isMounted = useRef(true);
  const hasMatched = useRef(false);
  const matchCheckInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMounted.current = true;
    hasMatched.current = false;
    return () => { 
      isMounted.current = false;
      hasMatched.current = false;
      if (matchCheckInterval.current) {
        clearInterval(matchCheckInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
        if (user && status === 'SEARCHING') {
            deleteDoc(doc(db, 'queue', user.id)).catch(console.error);
        }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [user, status]);

  const joinQueue = async (config: SessionConfig) => {
    if (!user) {
      console.error("No user provided to joinQueue");
      return;
    }
    
    console.log("[MATCH] Starting matchmaking for:", user.name);
    
    // Check if already in a session
    try {
      const existingSessionQuery = query(
        collection(db, 'sessions'),
        where('participants', 'array-contains', user.id),
        where('status', '==', 'active')
      );
      const existingSessions = await getDocs(existingSessionQuery);
      
      if (!existingSessions.empty) {
        setError("You're already in an active session!");
        return;
      }
    } catch (e) {
      console.error("Error checking existing sessions:", e);
    }
    
    setStatus('SEARCHING');
    setError(null);
    activeConfig.current = config;
    hasMatched.current = false;

    try {
      // Clean up any old queue entry first
      await deleteDoc(doc(db, 'queue', user.id)).catch(() => {});
      
      // Join queue with proper timestamp
      await setDoc(doc(db, 'queue', user.id), {
        userId: user.id,
        name: user.name,
        type: config.type,
        duration: config.duration,
        timestamp: serverTimestamp(),
        status: 'waiting'
      });

      console.log("[MATCH] Successfully joined queue");

      // Start listening for matches immediately
      startSessionListener();
      
      // Start periodic matching attempts
      attemptMatch(config);
      
      if (matchCheckInterval.current) {
        clearInterval(matchCheckInterval.current);
      }
      
      matchCheckInterval.current = setInterval(() => {
        if (!hasMatched.current && activeConfig.current) {
          attemptMatch(activeConfig.current);
        }
      }, 2000); // Check every 2 seconds

    } catch (error: any) {
      console.error("[MATCH] Queue Join Error:", error);
      setError(error.message);
      setStatus('IDLE');
      activeConfig.current = null;
    }
  };

  const cancelSearch = async () => {
    if (!user) return;
    
    console.log("[MATCH] Cancelling search");
    
    try {
      activeConfig.current = null;
      hasMatched.current = false;
      
      if (matchCheckInterval.current) {
        clearInterval(matchCheckInterval.current);
        matchCheckInterval.current = null;
      }
      
      await deleteDoc(doc(db, 'queue', user.id));
      
      if (isMounted.current) {
        setStatus('IDLE');
        setError(null);
      }
    } catch (e) { 
      console.error("Cancel Error", e); 
    }
  };

  const attemptMatch = async (config: SessionConfig) => {
    if (!user || !activeConfig.current || hasMatched.current) {
      return;
    }

    try {
      console.log("[MATCH] Attempting to find match...");

      // Query for compatible partners
      const q = query(
        collection(db, 'queue'),
        where('type', '==', config.type),
        where('duration', '==', config.duration),
        where('status', '==', 'waiting')
      );

      const snapshot = await getDocs(q);
      
      console.log(`[MATCH] Found ${snapshot.size} users in queue`);

      const now = Date.now();
      const validPartners = snapshot.docs.filter(d => {
        const data = d.data();
        
        // Skip self
        if (d.id === user.id) {
          return false;
        }
        
        // Check timestamp validity
        if (!data.timestamp) {
          return false;
        }
        
        const createdAt = (data.timestamp as Timestamp).toMillis();
        const age = now - createdAt;
        
        // Skip expired entries
        if (age > QUEUE_EXPIRATION_MS) {
          return false;
        }

        return true;
      });

      console.log(`[MATCH] ${validPartners.length} valid partners found`);

      if (validPartners.length === 0) {
        console.log("[MATCH] No partners available, waiting...");
        return;
      }

      // Sort by oldest first (FIFO)
      validPartners.sort((a, b) => {
        const tA = (a.data().timestamp as Timestamp).toMillis();
        const tB = (b.data().timestamp as Timestamp).toMillis();
        return tA - tB;
      });

      const potentialMatch = validPartners[0];
      const partnerData = potentialMatch.data();
      
      console.log("[MATCH] Attempting to match with:", partnerData.name);

      // Double-check both users still exist in queue
      const [myDoc, partnerDoc] = await Promise.all([
        getDoc(doc(db, 'queue', user.id)),
        getDoc(doc(db, 'queue', partnerData.userId))
      ]);
      
      if (!myDoc.exists()) {
        console.log("[MATCH] I'm no longer in queue");
        return;
      }
      
      if (!partnerDoc.exists()) {
        console.log("[MATCH] Partner no longer in queue");
        return;
      }

      // Check if partner is already in a session
      const partnerSessionCheck = query(
        collection(db, 'sessions'),
        where('participants', 'array-contains', partnerData.userId),
        where('status', '==', 'active')
      );
      const partnerSessions = await getDocs(partnerSessionCheck);
      
      if (!partnerSessions.empty) {
        console.log("[MATCH] Partner already in session");
        return;
      }

      // Check if I'm already in a session
      const mySessionCheck = query(
        collection(db, 'sessions'),
        where('participants', 'array-contains', user.id),
        where('status', '==', 'active')
      );
      const mySessions = await getDocs(mySessionCheck);
      
      if (!mySessions.empty) {
        console.log("[MATCH] I'm already in session");
        return;
      }

      console.log("[MATCH] Creating session...");

      // Create match atomically
      const batch = writeBatch(db);
      const newSessionRef = doc(collection(db, 'sessions'));
      
      batch.set(newSessionRef, {
        user1: { id: user.id, name: user.name },
        user2: { id: partnerData.userId, name: partnerData.name },
        participants: [user.id, partnerData.userId],
        config: config,
        status: 'active',
        createdAt: serverTimestamp()
      });

      batch.delete(doc(db, 'queue', user.id));
      batch.delete(doc(db, 'queue', partnerData.userId));

      await batch.commit();
      
      hasMatched.current = true;
      
      console.log("[MATCH] Match created! Session ID:", newSessionRef.id);
      
    } catch (e: any) {
      console.error("[MATCH] Error in attemptMatch:", e);
      
      if (e.code === 'failed-precondition' || e.toString().includes('index')) {
        console.error("[INDEX] Missing Firestore Index!");
        setError(`Missing Firestore Index. Please create the required index in Firebase Console.`);
        activeConfig.current = null;
        hasMatched.current = true; // Stop trying
      }
    }
  };

  const startSessionListener = () => {
    if (!user) return;

    const q = query(
      collection(db, 'sessions'),
      where('participants', 'array-contains', user.id),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !hasMatched.current) {
          const session = change.doc.data();
          
          console.log("[MATCH] Session detected!", change.doc.id);
          
          const partnerInfo = session.user1.id === user.id ? session.user2 : session.user1;
          
          hasMatched.current = true;
          activeConfig.current = null;
          
          if (matchCheckInterval.current) {
            clearInterval(matchCheckInterval.current);
            matchCheckInterval.current = null;
          }
          
          if (isMounted.current) {
            setStatus('MATCHED');
            
            onMatch({
              id: partnerInfo.id,
              name: partnerInfo.name,
              type: SessionType.ANY
            });
          }
        }
      });
    }, (error) => {
      console.error("Session listener error:", error);
    });

    // Store cleanup function
    return unsubscribe;
  };

  return { status, joinQueue, cancelSearch, error };
};
