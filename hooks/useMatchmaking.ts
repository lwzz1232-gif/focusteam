import { useState, useEffect, useRef } from 'react';
import { db } from '../utils/firebaseConfig';
import { 
  collection, doc, setDoc, deleteDoc, query, where, 
  onSnapshot, getDocs, writeBatch, serverTimestamp, getDoc, Timestamp,
  runTransaction
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
    
// Check if already in a session and handle stale sessions
try {
  const existingSessionQuery = query(
    collection(db, 'sessions'),
    where('participants', 'array-contains', user.id),
    where('status', '==', 'active')
  );
  const existingSessions = await getDocs(existingSessionQuery);

  if (!existingSessions.empty) {
    // End any expired sessions
    existingSessions.forEach(async (docSnap) => {
      const data = docSnap.data();
      const createdAt = (data.createdAt as Timestamp)?.toMillis() || 0;

      if (Date.now() - createdAt > config.duration * 60 * 1000) {
        await setDoc(doc(db, 'sessions', docSnap.id), { status: 'ended' }, { merge: true });
      }
    });

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
      }, 2000);

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

  // ✅ Add this line to clear any partial session
    await quitSession();
      
      if (isMounted.current) {
        setStatus('IDLE');
        setError(null);
      }
    } catch (e) { 
      console.error("Cancel Error", e); 
    }
  };
const quitSession = async (sessionId?: string) => {
  if (!user) return;

  try {
    if (sessionId) {
      const sessionRef = doc(db, 'sessions', sessionId);
      const sessionSnap = await getDoc(sessionRef);
      if (sessionSnap.exists()) {
        await setDoc(sessionRef, { status: 'ended' }, { merge: true });
      }
    }

    await deleteDoc(doc(db, 'queue', user.id)).catch(() => {});

    hasMatched.current = false;
    activeConfig.current = null;
    setStatus('IDLE');
    setError(null);

    if (matchCheckInterval.current) {
      clearInterval(matchCheckInterval.current);
      matchCheckInterval.current = null;
    }
  } catch (e) {
    console.error("Quit session error:", e);
  }
};

  const attemptMatch = async (config: SessionConfig) => {
    if (!user || !activeConfig.current || hasMatched.current) {
      return;
    }

    try {
      console.log("[MATCH] Attempting to find match...");
      console.log("[MATCH] Config:", { type: config.type, duration: config.duration });

      // Query for compatible partners (NOT in transaction - getDocs can't be in transaction)
      const q = query(
        collection(db, 'queue'),
        where('type', '==', config.type),
        where('duration', '==', config.duration),
        where('status', '==', 'waiting')
      );

      let snapshot;
      try {
        snapshot = await getDocs(q);
        console.log("[MATCH] Query successful");
      } catch (queryError: any) {
        console.error("[MATCH] Query failed:", queryError);
        if (queryError.code === 'failed-precondition') {
          throw new Error('Missing Firestore index. Please create an index for queue collection with fields: type, duration, status, timestamp');
        }
        throw queryError;
      }

      // Use transaction only for the write operations
      await runTransaction(db, async (transaction) => {
        
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

        // Transaction writes start here
        const myDocRef = doc(db, 'queue', user.id);
        const partnerDocRef = doc(db, 'queue', partnerData.userId);
        
        const myDoc = await transaction.get(myDocRef);
        const partnerDoc = await transaction.get(partnerDocRef);
        
        if (!myDoc.exists()) {
          console.log("[MATCH] I'm no longer in queue");
          return;
        }
        
        if (!partnerDoc.exists()) {
          console.log("[MATCH] Partner no longer in queue");
          return;
        }

        console.log("[MATCH] Creating session...");

        // Create match atomically within transaction
        const newSessionRef = doc(collection(db, 'sessions'));
        
        transaction.set(newSessionRef, {
          user1: { id: user.id, name: user.name },
          user2: { id: partnerData.userId, name: partnerData.name },
          participants: [user.id, partnerData.userId],
          config: config,
          status: 'active',
          createdAt: serverTimestamp()
        });

        transaction.delete(myDocRef);
        transaction.delete(partnerDocRef);

        hasMatched.current = true;
        
        console.log("[MATCH] Match created! Session ID:", newSessionRef.id);
      });
      
    } catch (e: any) {
      console.error("[MATCH] Error in attemptMatch:", e);
      console.error("[MATCH] Error code:", e.code);
      console.error("[MATCH] Error message:", e.message);
      
      if (e.code === 'permission-denied') {
        setError('Permission denied. Please check Firestore security rules.');
        activeConfig.current = null;
        hasMatched.current = true;
      } else if (e.code === 'failed-precondition' || e.message?.includes('index')) {
        setError('Missing Firestore Index. Please create an index for the queue collection.');
        activeConfig.current = null;
        hasMatched.current = true;
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
    snapshot.docs.forEach((doc) => {
      const session = doc.data();

      // Skip if already matched locally
      if (hasMatched.current) return;

      const partnerInfo = session.user1.id === user.id ? session.user2 : session.user1;

      console.log("[MATCH] Session detected!", doc.id);

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
          type: session.config.type
        });
      }
    });
  }, (error) => console.error("Session listener error:", error));

  return unsubscribe;
};


  return { status, joinQueue, cancelSearch, error };
};
