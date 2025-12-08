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

// 5 minutes expiration (matches your original setting)
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
  const queueListenerUnsubRef = useRef<(() => void) | null>(null); // NEW: Fixes "One user still looking"
  
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

  // Lifecycle Management
  useEffect(() => {
    isMountedRef.current = true;

    if (user) {
      cleanupExpiredSessions().catch((e) => console.error('[STARTUP] Cleanup error:', e));
    }

    const cleanupId = setInterval(() => {
      cleanupExpiredSessions().catch((e) => console.error('[CLEANUP] Scheduled error:', e));
    }, CLEANUP_INTERVAL_MS);
    cleanupIntervalRef.current = cleanupId;

    return () => {
      isMountedRef.current = false;
      stopAllListeners();
      
      // Best-effort cleanup on unmount
      if (user) {
        forceCleanupUserPending(user.id).catch(() => {});
      }
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

  // --- CLEANUP FUNCTIONS ---

  const cleanupExpiredSessions = useCallback(async () => {
    try {
      const sessionsColl = collection(db, SESSIONS_COLLECTION);
      const threshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      
      const q = query(sessionsColl, where('createdAt', '<', threshold));
      const snap = await getDocs(q);

      // Using map + Promise.all is cleaner than forEach
      await Promise.all(snap.docs.map(docSnap => deleteDoc(doc(sessionsColl, docSnap.id))));
    } catch (err) {
      console.error('[CLEANUP] cleanupExpiredSessions error', err);
    }
  }, []);

  const forceCleanupUserPending = useCallback(async (userId: string) => {
    try {
      // 1. Delete my queue entry
      await deleteDoc(doc(db, QUEUE_COLLECTION, userId));

      // 2. Delete any session I am in that hasn't started yet
      const q = query(
        collection(db, SESSIONS_COLLECTION),
        where('participants', 'array-contains', userId),
        where('started', '==', false)
      );
      const snap = await getDocs(q);
      await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    } catch (err) {
      console.error('[CLEANUP] forceCleanupUserPending error', err);
    }
  }, []);

  // Restored: Check if user is in an active (started) session
  const hasActiveSession = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const sessionsColl = collection(db, SESSIONS_COLLECTION);
      const recentThreshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      
      const q = query(
        sessionsColl,
        where('participants', 'array-contains', userId),
        where('started', '==', true), // Only checking STARTED sessions
        where('createdAt', '>', recentThreshold),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err) {
      console.error('[ACTIVE-CHECK] Error', err);
      return false;
    }
  }, []);

  // Helper: Find any session the user is currently in (Started or Not)
  const findMySession = useCallback(async (userId: string) => {
    const q = query(
      collection(db, SESSIONS_COLLECTION),
      where('participants', 'array-contains', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    const snap = await getDocs(q);
    return snap.empty ? null : snap.docs[0];
  }, []);

  // --- LISTENER LOGIC ---

  const attachSessionListener = useCallback(
    (sessionId: string, userId: string, localOnMatch?: (partner: Partner, sessionId: string) => void) => {
      // Don't re-attach if we are already listening to this ID
      if (currentSessionIdRef.current === sessionId) return;

      console.log(`[LISTENER] Attaching to session: ${sessionId}`);
      
      if (sessionListenerUnsubRef.current) sessionListenerUnsubRef.current();

      matchedRef.current = false;
      currentSessionIdRef.current = sessionId;

      const unsub = onSnapshot(
        doc(db, SESSIONS_COLLECTION, sessionId),
        (snap) => {
          if (!snap.exists()) {
             console.log('[LISTENER] Session deleted');
             return;
          }

          const data = snap.data() as any;

          // 1. MATCH SUCCESS
          if (data.started === true && !matchedRef.current) {
            console.log('[LISTENER] Session started!');
            matchedRef.current = true;
            
            // Stop polling immediately
            if (matchRetryIntervalRef.current) clearInterval(matchRetryIntervalRef.current);
            if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();

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

          // 2. FAILSAFE: 2 Participants present, but started=false? Force start.
          if (data.started === false && Array.isArray(data.participants) && data.participants.length >= 2) {
             console.log('[LISTENER] Force starting session...');
             runTransaction(db, async (tx) => {
                const sRef = doc(db, SESSIONS_COLLECTION, sessionId);
                const sDoc = await tx.get(sRef);
                if (sDoc.exists() && !sDoc.data().started) {
                  tx.update(sRef, { started: true });
                }
             }).catch(e => console.warn('[LISTENER] Force start failed', e));
          }
        },
        (error) => {
          console.error('[LISTENER] Snapshot error', error);
          if (isMountedRef.current) setError(error.message);
        }
      );

      sessionListenerUnsubRef.current = unsub;
    },
    []
  );

  // --- MATCHMAKING LOGIC ---

  const attemptMatch = useCallback(
    async (userId: string, config: SessionConfig) => {
      if (!isMountedRef.current || matchedRef.current || matchInProgressRef.current) return;
      
      matchInProgressRef.current = true;

      try {
        const queueColl = collection(db, QUEUE_COLLECTION);
        
        // 1. Get queue (limit to prevent downloading massive lists)
        const q = query(queueColl, orderBy('createdAt', 'asc'), limit(20));
        const snapshot = await getDocs(q);
        
        // Find someone who is NOT me
        const partnerDoc = snapshot.docs.find(d => d.id !== userId);

        if (!partnerDoc) {
          // No one found, just wait for next poll
          matchInProgressRef.current = false;
          return;
        }

        const partnerData = partnerDoc.data();
        const partnerId = partnerData.userId;

        console.log(`[MATCH] Candidate found: ${partnerId}`);

        // 2. DETERMINISTIC ID GENERATION (Crucial Fix)
        // Sort IDs so UserA and UserB always generate the exact same Session ID.
        // This solves the "Different Rooms" bug.
        const sortedIds = [userId, partnerId].sort();
        const deterministicSessionId = `${sortedIds[0]}_${sortedIds[1]}`;

        await runTransaction(db, async (tx) => {
          const sessionRef = doc(db, SESSIONS_COLLECTION, deterministicSessionId);
          const sessionSnap = await tx.get(sessionRef);

          // If session already exists, we don't need to overwrite it, just join logic later
          if (sessionSnap.exists()) {
             return;
          }

          const myQueueRef = doc(db, QUEUE_COLLECTION, userId);
          const partnerQueueRef = doc(db, QUEUE_COLLECTION, partnerId);
          
          // Verify both users are still in queue (Race Condition check)
          const myQ = await tx.get(myQueueRef);
          const partnerQ = await tx.get(partnerQueueRef);

          if (!myQ.exists() || !partnerQ.exists()) {
             throw new Error('RETRY_NEEDED'); // Abort transaction
          }

          // Create the session
          const sessionPayload = {
            type: config.type || 'ANY',
            config,
            participants: [userId, partnerId],
            participantInfo: [
              { userId: userId, displayName: myQ.data().userDisplayName || 'User', photoURL: myQ.data().userPhotoURL || '' },
              { userId: partnerId, displayName: partnerQ.data().userDisplayName || 'Partner', photoURL: partnerQ.data().userPhotoURL || '' },
            ],
            createdAt: serverTimestamp(),
            started: false,
          };

          tx.set(sessionRef, sessionPayload);
          tx.delete(myQueueRef);
          tx.delete(partnerQueueRef);
        });

        // If we got here, we either created the session OR it already existed. 
        // Either way, attach listener.
        attachSessionListener(deterministicSessionId, userId, onMatchRef.current);

      } catch (err: any) {
        if (err.message !== 'RETRY_NEEDED') {
           console.warn('[MATCH] Attempt error:', err);
        }
      } finally {
        matchInProgressRef.current = false;
      }
    },
    [attachSessionListener]
  );

  // --- JOIN / CANCEL ---

  const joinQueue = useCallback(
    async (config: SessionConfig) => {
      if (!user) {
        setError('No user');
        return;
      }

      console.log(`[JOIN] User ${user.id} starting...`);
      setStatus('SEARCHING');
      setError(undefined);
      matchedRef.current = false;
      activeConfigRef.current = config;

      try {
        // 1. Check for Active Session (Restored Safety Check)
        const hasActive = await hasActiveSession(user.id);
        if (hasActive) {
          setError("You are already in an active session.");
          setStatus('IDLE');
          return;
        }

        // 2. Clean pending state
        await forceCleanupUserPending(user.id);

        // 3. Add to Queue
        const myQueueRef = doc(db, QUEUE_COLLECTION, user.id);
        await setDoc(myQueueRef, {
          userId: user.id,
          userDisplayName: user.name ?? 'Anonymous',
          userPhotoURL: user.avatar ?? '',
          config,
          createdAt: serverTimestamp(),
        });

        // 4. WATCH OWN QUEUE (Crucial Fix for "One Enters Match, Other stuck")
        // If my queue doc disappears, it means someone else matched me.
        if (queueListenerUnsubRef.current) queueListenerUnsubRef.current();
        
        queueListenerUnsubRef.current = onSnapshot(myQueueRef, async (snap) => {
          // If doc is gone, but we haven't matched yet...
          if (!snap.exists() && isMountedRef.current && !matchedRef.current && status === 'SEARCHING') {
            console.log('[QUEUE] Entry removed! Checking for session...');
            // Someone matched us. Find the session immediately.
            const sessionDoc = await findMySession(user.id);
            if (sessionDoc) {
              attachSessionListener(sessionDoc.id, user.id, onMatchRef.current);
            }
          }
        });

        // 5. Try to match immediately
        await attemptMatch(user.id, config);

        // 6. Start polling
        if (matchRetryIntervalRef.current) clearInterval(matchRetryIntervalRef.current);
        matchRetryIntervalRef.current = setInterval(() => {
          if (!matchedRef.current && activeConfigRef.current) {
            attemptMatch(user.id, activeConfigRef.current);
          }
        }, MATCH_RETRY_INTERVAL_MS);

      } catch (err: any) {
        console.error('[JOIN] Error', err);
        setError(err.message);
        setStatus('IDLE');
      }
    },
    [user, attemptMatch, hasActiveSession, forceCleanupUserPending, findMySession, attachSessionListener, status]
  );

  const cancelSearch = useCallback(async () => {
    if (!user) return;
    
    console.log('[CANCEL] Stopping search');
    setStatus('IDLE');
    matchedRef.current = false;
    activeConfigRef.current = null;
    
    stopAllListeners();

    try {
      await forceCleanupUserPending(user.id);
    } catch (e) {
      console.warn('[CANCEL] cleanup warning', e);
    }
  }, [user, stopAllListeners, forceCleanupUserPending]);

  return {
    status,
    joinQueue,
    cancelSearch,
    error,
  };
}
