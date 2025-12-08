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

  // --- HELPERS ---

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
      // Only delete sessions that NEVER started. 
      // We do NOT delete 'started:true' here, or we lose history/chat logs if you want them.
      // But for matchmaking, we ignore them.
      const q = query(
        collection(db, SESSIONS_COLLECTION),
        where('participants', 'array-contains', userId),
        where('started', '==', false)
      );
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {}
  }, []);

  const findMySession = useCallback(async (userId: string) => {
    // FIX: Only look for sessions created in the last 60 seconds.
    // This prevents joining a session from 3 hours ago by accident.
    const recent = Timestamp.fromDate(new Date(Date.now() - 60000)); 
    
    const q = query(
      collection(db, SESSIONS_COLLECTION),
      where('participants', 'array-contains', userId),
      where('createdAt', '>', recent), // CRITICAL FIX
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0];
  }, []);

  // --- LISTENER ---

  const attachSessionListener = useCallback(
    (sessionId: string, userId: string, localOnMatch?: (partner: Partner, sessionId: string) => void) => {
      if (currentSessionIdRef.current === sessionId) return;

      console.log(`[LISTENER] Attaching: ${sessionId}`);
      if (sessionListenerUnsubRef.current) sessionListenerUnsubRef.current();

      matchedRef.current = false;
      currentSessionIdRef.current = sessionId;

      const unsub = onSnapshot(
        doc(db, SESSIONS_COLLECTION, sessionId),
        (snap) => {
          if (!snap.exists()) return;
          const data = snap.data() as any;

          if (data.started === true && !matchedRef.current) {
            matchedRef.current = true;
            stopAllListeners();

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

          // Failsafe: Start session if 2 people are there
          if (data.started === false && data.participants?.length >= 2) {
             runTransaction(db, async (tx) => {
                const sDoc = await tx.get(snap.ref);
                if (sDoc.exists() && !sDoc.data().started) tx.update(snap.ref, { started: true });
             }).catch(() => {});
          }
        }
      );
      sessionListenerUnsubRef.current = unsub;
    },
    [stopAllListeners]
  );

  // --- MATCHMAKING ---

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

        // Sort carefully to ensure A_B is always A_B
        const sortedIds = [userId, partnerId].sort((a, b) => a.localeCompare(b));
        const deterministicSessionId = `${sortedIds[0]}_${sortedIds[1]}`;

        await runTransaction(db, async (tx) => {
          const sessionRef = doc(db, SESSIONS_COLLECTION, deterministicSessionId);
          const sessionSnap = await tx.get(sessionRef);

          const myQueueRef = doc(db, QUEUE_COLLECTION, userId);
          const partnerQueueRef = doc(db, QUEUE_COLLECTION, partnerId);

          const sessionPayload = {
            type: config.type || 'ANY',
            config,
            participants: [userId, partnerId],
            participantInfo: [
              { userId: userId, displayName: 'User', photoURL: '' }, // Add real names if available
              { userId: partnerId, displayName: 'Partner', photoURL: '' },
            ],
            createdAt: serverTimestamp(),
            started: false,
          };

          // CRITICAL FIX: Handling "Zombie" sessions
          if (sessionSnap.exists()) {
            const existingData = sessionSnap.data();
            
            // If the session exists and is 'started', it's an OLD session.
            // We must OVERWRITE it to start a new game.
            if (existingData.started === true) {
               console.log('[MATCH] Overwriting old session...');
               tx.set(sessionRef, sessionPayload); // Force overwrite
               tx.delete(myQueueRef);
               tx.delete(partnerQueueRef);
               return;
            } else {
               // If it exists but started=false, someone else (the partner) just created it.
               // We don't overwrite, we just delete our queue and join.
               // Verify queue existence to be safe
               const myQ = await tx.get(myQueueRef);
               if (myQ.exists()) tx.delete(myQueueRef);
               return;
            }
          }

          // If session does not exist, check queues and create
          const [myQ, partnerQ] = await Promise.all([tx.get(myQueueRef), tx.get(partnerQueueRef)]);
          if (!myQ.exists() || !partnerQ.exists()) throw new Error('RETRY');

          // Add names/photos from queue data
          sessionPayload.participantInfo = [
            { userId: userId, displayName: myQ.data().userDisplayName, photoURL: myQ.data().userPhotoURL },
            { userId: partnerId, displayName: partnerQ.data().userDisplayName, photoURL: partnerQ.data().userPhotoURL },
          ];

          tx.set(sessionRef, sessionPayload);
          tx.delete(myQueueRef);
          tx.delete(partnerQueueRef);
        });

        attachSessionListener(deterministicSessionId, userId, onMatchRef.current);

      } catch (err: any) {
        if (err.message !== 'RETRY') console.warn('[MATCH] Error:', err);
      } finally {
        matchInProgressRef.current = false;
      }
    },
    [attachSessionListener]
  );

  const joinQueue = useCallback(
    async (config: SessionConfig) => {
      if (!user) return;
      setStatus('SEARCHING');
      setError(undefined);
      matchedRef.current = false;
      activeConfigRef.current = config;

      try {
        await forceCleanupUserPending(user.id);

        const myQueueRef = doc(db, QUEUE_COLLECTION, user.id);
        await setDoc(myQueueRef, {
          userId: user.id,
          userDisplayName: user.name ?? 'Anonymous',
          userPhotoURL: user.avatar ?? '',
          config,
          createdAt: serverTimestamp(),
        });

        if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();
        
        // Listen to own queue logic
        queueListenerUnsubRef.current = onSnapshot(myQueueRef, async (snap) => {
          if (!snap.exists() && isMountedRef.current && !matchedRef.current && status === 'SEARCHING') {
            console.log('[QUEUE] Removed! Finding FRESH session...');
            // Wait 500ms for Firestore consistency
            setTimeout(async () => {
                const sessionDoc = await findMySession(user.id);
                if (sessionDoc) {
                  attachSessionListener(sessionDoc.id, user.id, onMatchRef.current);
                } else {
                  console.warn('[QUEUE] Removed but no fresh session found. This is odd.');
                }
            }, 500);
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
    [user, attemptMatch, forceCleanupUserPending, findMySession, attachSessionListener, status]
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
