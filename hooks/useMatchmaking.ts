import { useCallback, useEffect, useRef, useState } from 'react';
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
import type { User, Partner, SessionConfig, SessionType } from '../types';

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
      // On unmount, if we were searching, clean up.
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
      
      // Stop queue listeners and retries immediately
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

          // 1. MATCH SUCCESS
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

          // 2. FAILSAFE: If 2 people are here but it hasn't started, START IT.
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
        // 1. Find a candidate
        const q = query(collection(db, QUEUE_COLLECTION), orderBy('createdAt', 'asc'), limit(10));
        const snapshot = await getDocs(q);
        const partnerDoc = snapshot.docs.find(d => d.id !== userId);

        if (!partnerDoc) {
          matchInProgressRef.current = false;
          return;
        }

        const partnerId = partnerDoc.data().userId;

        // 2. Deterministic ID (Alphabetical)
        const sortedIds = [userId, partnerId].sort((a, b) => a.localeCompare(b));
        const deterministicSessionId = `${sortedIds[0]}_${sortedIds[1]}`;

        await runTransaction(db, async (tx) => {
          const sessionRef = doc(db, SESSIONS_COLLECTION, deterministicSessionId);
          const sessionSnap = await tx.get(sessionRef);

          // ZOMBIE CHECK: If session exists and is OLD/STARTED, we overwrite it.
          // If it exists and is NEW/NOT-STARTED, we join it.
          let shouldOverwrite = true;
          if (sessionSnap.exists()) {
             const existing = sessionSnap.data();
             if (existing.started === false) {
               shouldOverwrite = false; // Join existing fresh session
             }
             // If started===true, we assume it's a zombie from yesterday and overwrite
          }

          const myQueueRef = doc(db, QUEUE_COLLECTION, userId);
          const partnerQueueRef = doc(db, QUEUE_COLLECTION, partnerId);
          
          const [myQ, partnerQ] = await Promise.all([tx.get(myQueueRef), tx.get(partnerQueueRef)]);
          
          // Verify both users are still in queue
          if (!myQ.exists() || !partnerQ.exists()) throw new Error('RETRY');

          // CREATE/UPDATE SESSION
          if (shouldOverwrite) {
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
          }

          // SIGNAL: UPDATE QUEUES instead of deleting them
          // This tells both clients "Here is your ID, go join it"
          tx.update(myQueueRef, { sessionId: deterministicSessionId });
          tx.update(partnerQueueRef, { sessionId: deterministicSessionId });
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
        
        // 1. Create Queue Ticket
        await setDoc(myQueueRef, {
          userId: user.id,
          userDisplayName: user.name ?? 'Anonymous',
          userPhotoURL: user.avatar ?? '',
          config,
          createdAt: serverTimestamp(),
          sessionId: null // Initial state
        });

        // 2. LISTEN TO OWN TICKET (The Fix)
        if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();
        
        queueListenerUnsubRef.current = onSnapshot(myQueueRef, (snap) => {
          if (!snap.exists()) return; // Should not happen unless cancelled
          
          const data = snap.data();
          
          // IF WE HAVE BEEN ASSIGNED A SESSION ID
          if (data?.sessionId && !matchedRef.current) {
             console.log('[QUEUE] Match signal received!', data.sessionId);
             
             // 1. Attach to session
             attachSessionListener(data.sessionId, user.id, onMatchRef.current);
             
             // 2. Clean up my queue ticket
             deleteDoc(myQueueRef).catch(console.error);
          }
        });

        // 3. Start Search Loop
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
