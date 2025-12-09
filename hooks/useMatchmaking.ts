
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  runTransaction,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { User, Partner, SessionConfig } from '../types';

const QUEUE_COLLECTION = 'queue';
const SESSIONS_COLLECTION = 'sessions';

// 5 minutes expiration
const SESSION_EXPIRATION_MS = 5 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 10 * 1000;
const MATCH_RETRY_INTERVAL_MS = 2000;

type UseMatchmakingReturn = {
  status: 'IDLE' | 'SEARCHING' | 'MATCHED';
  joinQueue: (config: SessionConfig) => Promise<void>;
  cancelSearch: () => Promise<void>;
  error?: string;
};

export function useMatchmaking(
  user: User | null, 
  onMatch?: (partner: Partner, sessionId: string) => void
): UseMatchmakingReturn {
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'MATCHED'>('IDLE');
  const [error, setError] = useState<string | undefined>(undefined);

  // Refs
  const onMatchRef = useRef(onMatch);
  const sessionListenerUnsubRef = useRef<(() => void) | null>(null);
  const queueListenerUnsubRef = useRef<(() => void) | null>(null);
  
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchRetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const matchedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const currentSessionIdRef = useRef<string | null>(null);
  const activeConfigRef = useRef<SessionConfig | null>(null);
  const matchInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    isMountedRef.current = true;
    if (user) cleanupExpiredSessions().catch(() => {});
    
    cleanupIntervalRef.current = setInterval(() => {
      cleanupExpiredSessions().catch(() => {});
    }, CLEANUP_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      stopAllListeners();
      if (user) forceCleanupUserPending(user.id).catch(() => {});
    };
  }, [user]);

  const stopAllListeners = useCallback(() => {
    if (cleanupIntervalRef.current) clearInterval(cleanupIntervalRef.current);
    if (matchRetryIntervalRef.current) clearInterval(matchRetryIntervalRef.current);
    if (sessionListenerUnsubRef.current) sessionListenerUnsubRef.current();
    if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();
    
    cleanupIntervalRef.current = null;
    matchRetryIntervalRef.current = null;
    sessionListenerUnsubRef.current = null;
    queueListenerUnsubRef.current = null;
  }, []);

  const cleanupExpiredSessions = useCallback(async () => {
    try {
      const threshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      const q = query(collection(db, SESSIONS_COLLECTION), where('createdAt', '<', threshold));
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {}
  }, []);

  const forceCleanupUserPending = useCallback(async (userId: string) => {
    try {
      await deleteDoc(doc(db, QUEUE_COLLECTION, userId));
    } catch (err) {}
  }, []);

  const hasActiveSession = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const recentThreshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      const q = query(
        collection(db, SESSIONS_COLLECTION),
        where('participants', 'array-contains', userId),
        where('started', '==', true),
        where('createdAt', '>', recentThreshold),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) { return false; }
  }, []);

  // --- LISTENER LOGIC ---

  const attachSessionListener = useCallback(
    (sessionId: string, userId: string, localOnMatch?: (partner: Partner, sessionId: string) => void) => {
      if (currentSessionIdRef.current === sessionId) return;

      console.log(`[LISTENER] Joining session: ${sessionId}`);
      
      if (matchRetryIntervalRef.current) clearInterval(matchRetryIntervalRef.current);
      if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();

      matchedRef.current = false;
      currentSessionIdRef.current = sessionId;

      if (sessionListenerUnsubRef.current) sessionListenerUnsubRef.current();

      sessionListenerUnsubRef.current = onSnapshot(
        doc(db, SESSIONS_COLLECTION, sessionId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as any;

          if (data.started === true && !matchedRef.current) {
            matchedRef.current = true;
            
            if (isMountedRef.current) {
              const partnerInfo = data.participantInfo?.find((p: any) => p.userId !== userId);
              if (partnerInfo) {
                setStatus('MATCHED');
                if (localOnMatch) {
                  localOnMatch({
                    id: partnerInfo.userId,
                    name: partnerInfo.displayName || 'Partner',
                    type: data.config?.type || 'ANY',
                  }, sessionId);
                }
              }
            }
            return;
          }

          if (data.started === false && data.participants?.length >= 2) {
             runTransaction(db, async (tx) => {
                const sDoc = await tx.get(snap.ref);
                if (sDoc.exists() && !sDoc.data().started) {
                  tx.update(snap.ref, { started: true });
                }
             }).catch(() => {});
          }
        }
      );
    },
    []
  );

  // --- MATCHMAKING LOGIC ---

  const attemptMatch = useCallback(
    async (userId: string, config: SessionConfig) => {
      if (!isMountedRef.current || matchedRef.current || matchInProgressRef.current) return;
      matchInProgressRef.current = true;

      try {
        const q = query(collection(db, QUEUE_COLLECTION), orderBy('createdAt', 'asc'), limit(10));
        const snapshot = await getDocs(q);
        const partnerDoc = snapshot.docs.find(d => d.id !== userId);

        if (!partnerDoc) {
          matchInProgressRef.current = false;
          return;
        }

        const partnerId = partnerDoc.data().userId;

        // --- NEW FIX: UNIQUE ID GENERATION ---
        // We still sort IDs so we have a consistent base
        const sortedIds = [userId, partnerId].sort((a, b) => a.localeCompare(b));
        // BUT we append a timestamp to ensure a FRESH room every time
        const uniqueSessionId = `${sortedIds[0]}_${sortedIds[1]}_${Date.now()}`;

        await runTransaction(db, async (tx) => {
          const myQueueRef = doc(db, QUEUE_COLLECTION, userId);
          const partnerQueueRef = doc(db, QUEUE_COLLECTION, partnerId);
          
          const [myQ, partnerQ] = await Promise.all([tx.get(myQueueRef), tx.get(partnerQueueRef)]);
          
          if (!myQ.exists() || !partnerQ.exists()) throw new Error('RETRY');

          // Create the FRESH session
          const sessionRef = doc(db, SESSIONS_COLLECTION, uniqueSessionId);
          tx.set(sessionRef, {
            type: config.type || 'ANY',
            config,
            participants: [userId, partnerId],
            participantInfo: [
              { userId: userId, displayName: myQ.data().userDisplayName, photoURL: myQ.data().userPhotoURL },
              { userId: partnerId, displayName: partnerQ.data().userDisplayName, photoURL: partnerQ.data().userPhotoURL },
            ],
            createdAt: serverTimestamp(),
            started: false,
          });

          // Invite partner to this specific Unique ID
          tx.update(myQueueRef, { sessionId: uniqueSessionId });
          tx.update(partnerQueueRef, { sessionId: uniqueSessionId });
        });

      } catch (err: any) {
        if (err.message !== 'RETRY') console.warn('[MATCH] Error:', err);
      } finally {
        matchInProgressRef.current = false;
      }
    },
    []
  );

  // --- JOIN LOGIC ---

  const joinQueue = useCallback(
    async (config: SessionConfig) => {
      if (!user) return;
      setStatus('SEARCHING');
      setError(undefined);
      matchedRef.current = false;
      activeConfigRef.current = config;

      try {
        if (await hasActiveSession(user.id)) {
          setError("Already in an active session.");
          setStatus('IDLE');
          return;
        }

        await forceCleanupUserPending(user.id);

        const myQueueRef = doc(db, QUEUE_COLLECTION, user.id);
        
        await setDoc(myQueueRef, {
          userId: user.id,
          userDisplayName: user.name ?? 'Anonymous',
          userPhotoURL: user.avatar ?? '',
          config,
          createdAt: serverTimestamp(),
          sessionId: null
        });

        if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();
        
        // Listen for the INVITE (sessionId)
        queueListenerUnsubRef.current = onSnapshot(myQueueRef, (snap) => {
          if (!snap.exists()) return;
          
          const data = snap.data();
          
          if (data?.sessionId && !matchedRef.current) {
             console.log('[QUEUE] Received Invite to:', data.sessionId);
             
             // Join the room
             attachSessionListener(data.sessionId, user.id, onMatchRef.current);
             
             // Clean up queue ticket
             deleteDoc(myQueueRef).catch(console.error);
          }
        });

        await attemptMatch(user.id, config);
        
        if (matchRetryIntervalRef.current) clearInterval(matchRetryIntervalRef.current);
        matchRetryIntervalRef.current = setInterval(() => {
          if (!matchedRef.current && activeConfigRef.current) {
            attemptMatch(user.id, activeConfigRef.current);
          }
        }, MATCH_RETRY_INTERVAL_MS);

      } catch (err: any) {
        setError(err.message);
        setStatus('IDLE');
      }
    },
    [user, attemptMatch, hasActiveSession, forceCleanupUserPending, attachSessionListener]
  );

  const cancelSearch = useCallback(async () => {
    if (!user) return;
    setStatus('IDLE');
    matchedRef.current = false;
    stopAllListeners();
    try { await deleteDoc(doc(db, QUEUE_COLLECTION, user.id)); } catch (e) {}
  }, [user, stopAllListeners]);

  return { status, joinQueue, cancelSearch, error };
}
