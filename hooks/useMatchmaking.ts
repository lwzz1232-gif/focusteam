import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFirestore,
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
  updateDoc,
} from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import type { User, Partner, SessionConfig, SessionType } from '../types';

const QUEUE_COLLECTION = 'queue';
const SESSIONS_COLLECTION = 'sessions';

// How old a session must be before auto-cleanup (ms) - 5 minutes
const SESSION_EXPIRATION_MS = 5 * 60 * 1000;

// Polling interval to cleanup expired sessions (ms)
const CLEANUP_INTERVAL_MS = 10 * 1000;

// How long to wait before retrying a match (ms)
const MATCH_RETRY_INTERVAL_MS = 2000;

type UseMatchmakingReturn = {
  status: 'IDLE' | 'SEARCHING' | 'MATCHED';
  joinQueue: (config: SessionConfig) => Promise<void>;
  cancelSearch: () => Promise<void>;
  error?: string;
};

export function useMatchmaking(user: User | null, onMatch?: (partner: Partner, sessionId: string) => void): UseMatchmakingReturn {
  const [status, setStatus] = useState<'IDLE' | 'SEARCHING' | 'MATCHED'>('IDLE');
  const [error, setError] = useState<string | undefined>(undefined);

  // Keep refs for cleanup and ensuring callbacks run once
  const onMatchRef = useRef<((partner: Partner, sessionId: string) => void) | undefined>(onMatch);
  const sessionListenerUnsubRef = useRef<(() => void) | null>(null);
  const cleanupIntervalRef = useRef<NodeJS.Timeout | null>(null);
const matchRetryIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchedRef = useRef<boolean>(false);
  const isMountedRef = useRef<boolean>(true);
  const currentSessionIdRef = useRef<string | null>(null);
  const activeConfigRef = useRef<SessionConfig | null>(null);

  // Update callback ref when onMatch changes
  useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);

  // Cleanup on unmount and mount
  useEffect(() => {
    isMountedRef.current = true;

    // Always run cleanup on mount once
    if (user) {
      cleanupExpiredSessions(). catch((e) => console.error('[STARTUP] Initial cleanup error:', e));
    }

    // Schedule periodic cleanup
    const cleanupId = setInterval(() => {
      cleanupExpiredSessions().catch((e) => console.error('[CLEANUP] Scheduled cleanup error:', e));
    }, CLEANUP_INTERVAL_MS);
    cleanupIntervalRef.current = cleanupId;

    return () => {
      isMountedRef.current = false;

      // Cleanup intervals
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      if (matchRetryIntervalRef. current) {
        clearInterval(matchRetryIntervalRef.current);
        matchRetryIntervalRef.current = null;
      }

      // Detach session listener
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef. current();
        sessionListenerUnsubRef.current = null;
      }

      // Best-effort cleanup of pending things for this user
      if (user) {
        forceCleanupUserPending(user.id). catch(() => {});
      }
    };
  }, [user]);

  // Cleanup expired sessions (both started and not started)
  const cleanupExpiredSessions = useCallback(async () => {
    try {
      const sessionsColl = collection(db, SESSIONS_COLLECTION);
      const threshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      
      // Delete ANY session older than threshold (regardless of started status)
      const q = query(
        sessionsColl,
        where('createdAt', '<', threshold)
      );
      const snap = await getDocs(q);

      const deletes: Promise<void>[] = [];
      snap.forEach((docSnap) => {
        deletes.push(
          (async () => {
            try {
              await deleteDoc(doc(sessionsColl, docSnap.id));
              console.log(`[CLEANUP] Deleted expired session: ${docSnap.id}`);
            } catch (err) {
              console.warn(`[CLEANUP] Failed to delete expired session ${docSnap.id}`, err);
            }
          })()
        );
      });
      await Promise.all(deletes);
    } catch (err) {
      console.error('[CLEANUP] cleanupExpiredSessions error', err);
    }
  }, []);

  // Check if user has an ACTIVELY ONGOING session (started within last 5 minutes)
  const hasActiveSession = useCallback(async (userId: string): Promise<boolean> => {
    try {
      const sessionsColl = collection(db, SESSIONS_COLLECTION);
      // Only consider sessions that started AND are not expired
      const recentThreshold = Timestamp.fromDate(new Date(Date.now() - SESSION_EXPIRATION_MS));
      
      const q = query(
        sessionsColl,
        where('participants', 'array-contains', userId),
        where('started', '==', true),
        where('createdAt', '>', recentThreshold),
        limit(1)
      );
      const snap = await getDocs(q);
      
      if (! snap.empty) {
        console.warn(`[ACTIVE-CHECK] User ${userId} has active session: ${snap.docs[0].id}`);
        return true;
      }
      
      return false;
    } catch (err: any) {
      console.error('[ACTIVE-CHECK] hasActiveSession error', err);
      return false;
    }
  }, []);

  // Clear any queue doc for this user and any non-started session where the user participates
  const forceCleanupUserPending = useCallback(async (userId: string) => {
    try {
      const queueColl = collection(db, QUEUE_COLLECTION);
      const sessionsColl = collection(db, SESSIONS_COLLECTION);

      // Remove queue doc
      try {
        await deleteDoc(doc(queueColl, userId));
        console.log(`[CLEANUP] Deleted queue entry for user: ${userId}`);
      } catch (e) {
        // Ignore if doesn't exist
      }

      // Remove any sessions where this user participates and started === false
      const q = query(
        sessionsColl,
        where('participants', 'array-contains', userId),
        where('started', '==', false)
      );
      const snap = await getDocs(q);
      const deletes: Promise<void>[] = [];
      snap.forEach((sdoc) => {
        deletes.push(
          (async () => {
            try {
              await deleteDoc(doc(sessionsColl, sdoc.id));
              console.log(`[CLEANUP] Deleted pending session: ${sdoc.id}`);
            } catch (err) {
              console.warn(`[CLEANUP] Failed to delete pending session ${sdoc.id}`, err);
            }
          })()
        );
      });
      await Promise.all(deletes);
    } catch (err) {
      console.error('[CLEANUP] forceCleanupUserPending error', err);
    }
  }, []);

  // Internal: set up listener for a given session doc.  Ensures onMatch is fired once. 
  const attachSessionListener = useCallback(
    (sessionId: string, userId: string, localOnMatch?: (partner: Partner, sessionId: string) => void) => {
      // Detach previous listener
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef.current();
        sessionListenerUnsubRef.current = null;
      }

      matchedRef.current = false;
      currentSessionIdRef.current = sessionId;

      const sessionsColl = collection(db, SESSIONS_COLLECTION);
      const sRef = doc(sessionsColl, sessionId);

      const unsub = onSnapshot(
        sRef,
        (snap) => {
          // Session was deleted
          if (!snap.exists()) {
            console.log(`[LISTENER] Session ${sessionId} was deleted`);
            return;
          }

          const data = snap.data() as any;

          // If session already started, trigger match callback (only once)
          if (data. started === true && ! matchedRef.current) {
            matchedRef.current = true;
            console.log(`[LISTENER] Session ${sessionId} started! `);

            if (! isMountedRef.current) {
              console.warn('[LISTENER] Component unmounted, skipping match callback');
              return;
            }

            try {
              // Find partner info from participantInfo array
              const participantInfo: any[] = data.participantInfo || [];
              const partnerInfo = participantInfo.find((p: any) => p.userId !== userId);

              if (partnerInfo) {
                console.log(`[LISTENER] Found partner:`, partnerInfo);
                if (isMountedRef.current) {
                  setStatus('MATCHED');
                  if (localOnMatch) {
                    localOnMatch(
                      {
                        id: partnerInfo.userId,
                        name: partnerInfo.displayName || 'Partner',
                        type: data.config?. type || 'ANY',
                      } as Partner,
                      snap.id
                    );
                  }
                }
              }
            } catch (err) {
              console.error('[LISTENER] onMatch error', err);
            }
            return;
          }

          // If session not started but has two participants, try to mark started=true via transaction
          if (data.started === false && Array.isArray(data.participants) && data.participants.length >= 2) {
            console.log(`[LISTENER] Session ${sessionId} has 2 participants, attempting to start... `);

            // Fire-and-forget: attempt to set started=true if still false
            (async () => {
              try {
                await runTransaction(db, async (tx) => {
                  const sSnap = await tx.get(sRef);
                  if (!sSnap.exists()) {
                    console.warn('[TRANSACTION] Session no longer exists');
                    return;
                  }
                  const sData: any = sSnap.data();
                  if (sData.started === true) {
                    console.log('[TRANSACTION] Session already started');
                    return;
                  }
                  // Mark started
                  tx.update(sRef, { started: true });
                  console.log('[TRANSACTION] Marked session as started');
                });
              } catch (err) {
                console. warn('[TRANSACTION] Failed to mark session started', err);
              }
            })();
          }
        },
        (error) => {
          console.error('[LISTENER] onSnapshot error', error);
          if (isMountedRef. current) {
            setError(`Session listener error: ${error.message}`);
          }
        }
      );

      sessionListenerUnsubRef.current = unsub;
      return unsub;
    },
    []
  );

  // Attempt to find and match with a partner
  const attemptMatch = useCallback(
  async (userId: string, config: SessionConfig) => {
    if (!isMountedRef.current || matchedRef.current) return; // ADD THIS LINE
    
    try {
      const queueColl = collection(db, QUEUE_COLLECTION);
        const sessionsColl = collection(db, SESSIONS_COLLECTION);

        // Try to find a partner in queue that is not this user
        const partnerQuery = query(
          queueColl,
          where('userId', '!=', userId),
          orderBy('createdAt', 'asc'),
          limit(1)
        );
        const partnerSnap = await getDocs(partnerQuery);

        if (partnerSnap.empty) {
          console.log(`[MATCH] No partner found in queue yet for user ${userId}`);
          return;
        }

        // We have a candidate partner
        const partnerDoc = partnerSnap.docs[0];
        const partnerData = partnerDoc.data() as any;
        const partnerId = partnerData.userId as string;

        console.log(`[MATCH] Found potential partner: ${partnerId}`);

        // Run transaction: confirm both queue docs exist, create session, delete both queue docs
        const myQueueRef = doc(queueColl, userId);
        const partnerQueueRef = doc(queueColl, partnerId);
        const sessionRef = doc(sessionsColl); // Auto-generated ID

        await runTransaction(db, async (tx) => {
          const myQueueSnap = await tx.get(myQueueRef);
          const partnerQueueSnap = await tx.get(partnerQueueRef);

          // If partner or me is gone, abort the transaction
          if (!myQueueSnap.exists()) {
            console.warn('[TRANSACTION] My queue entry is gone, aborting match');
            throw new Error('My queue entry disappeared - another match may have occurred');
          }

          if (! partnerQueueSnap.exists()) {
            console.warn('[TRANSACTION] Partner queue entry is gone, aborting match');
            throw new Error('Partner queue entry disappeared - they may have matched already');
          }

          const myData = myQueueSnap.data() as any;
          const currentUserName = myData.userDisplayName;

          const sessionPayload = {
            type: (config.type as SessionType) ??  'ANY',
            config,
            participants: [userId, partnerId], // Just the IDs for Firestore rules
            participantInfo: [ // Full info stored separately
              {
                userId: userId,
                displayName: currentUserName || 'User',
                photoURL: myData.userPhotoURL ??  '',
              },
              {
                userId: partnerId,
                displayName: partnerData.userDisplayName ??  'Partner',
                photoURL: partnerData.userPhotoURL ?? '',
              },
            ],
            createdAt: serverTimestamp(),
            started: false,
          };

          // All checks passed, create session and delete both queue entries atomically
          tx.set(sessionRef, sessionPayload);
          tx.delete(myQueueRef);
          tx.delete(partnerQueueRef);

          console.log(`[TRANSACTION] Created session ${sessionRef.id} between ${userId} and ${partnerId}`);
        });

        // Attach listener so onMatch will be triggered when started flips to true
        attachSessionListener(sessionRef.id, userId, onMatchRef.current);

        console.log(`[MATCH] Successfully matched!  Session: ${sessionRef.id}`);
      // Stop retry interval since match succeeded
if (matchRetryIntervalRef.current) {
  clearInterval(matchRetryIntervalRef.current);
  matchRetryIntervalRef.current = null;
  console.log('[MATCH] Stopped retry interval - match successful');
}
matchedRef.current = true;
setStatus('MATCHED');
      } catch (err: any) {
  console.warn('[MATCH] Match attempt failed', err);
  
  // If our queue entry is gone, we might have been matched by someone else
  // Check if we have a session before retrying
  const mySessions = await getDocs(
    query(
      collection(db, SESSIONS_COLLECTION),
      where('participants', 'array-contains', userId),
      where('started', '==', false),
      limit(1)
    )
  );
  
  if (!mySessions.empty) {
    console.log('[MATCH] Found existing session, attaching listener');
    const sessionDoc = mySessions.docs[0];
    attachSessionListener(sessionDoc.id, userId, onMatchRef.current);
    
    if (matchRetryIntervalRef.current) {
      clearInterval(matchRetryIntervalRef.current);
      matchRetryIntervalRef.current = null;
    }
    matchedRef.current = true;
    setStatus('MATCHED');
  }
}
    },
    [attachSessionListener]
  );

  const joinQueue = useCallback(
    async (config: SessionConfig) => {
      if (!user) {
        setError('No user provided');
        console.error('[JOIN] No user provided to joinQueue');
        return;
      }

      if (! isMountedRef.current) {
        console.warn('[JOIN] Component not mounted, aborting joinQueue');
        return;
      }

      setError(undefined);
      setStatus('SEARCHING');

      try {
        console.log(`[JOIN] Starting matchmaking for user: ${user.id}`);

        // Check if user already has a TRULY active session
        const hasActive = await hasActiveSession(user. id);
        if (hasActive) {
          setError("You're already in an active session!  Please wait for it to expire or complete it first.");
          setStatus('IDLE');
          console.warn('[JOIN] User already has active session');
          return;
        }

        // Force-clean any stale pending queue/session for this user to avoid being blocked
        await forceCleanupUserPending(user.id);

        // Create a queue doc for this user
        const queueColl = collection(db, QUEUE_COLLECTION);
        const myQueueRef = doc(queueColl, user.id);
        const queuePayload = {
          userId: user.id,
          userDisplayName: user.name ??  '',
          userPhotoURL: user.avatar ?? '',
          config,
          createdAt: serverTimestamp(),
        };

        await setDoc(myQueueRef, queuePayload);
        console.log(`[JOIN] Added user to queue: ${user.id}`);

        activeConfigRef.current = config;
        matchedRef.current = false;

        // Start matching attempts
      matchRetryIntervalRef.current = setInterval(() => {
  if (isMountedRef.current && status === 'SEARCHING' && activeConfigRef.current && !matchedRef.current) {
    console.log('[RETRY] Attempting match again...');
    attemptMatch(user.id, activeConfigRef.current).catch((err) =>
      console.error('[RETRY] Match attempt error', err)
    );
  } else if (matchedRef.current) {
    // Stop retrying once matched
    if (matchRetryIntervalRef.current) {
      clearInterval(matchRetryIntervalRef.current);
      matchRetryIntervalRef.current = null;
    }
  }
}, MATCH_RETRY_INTERVAL_MS);
      } catch (err: any) {
        console.error('[JOIN] joinQueue error', err);
        if (isMountedRef.current) {
          setError(err?. message ??  String(err));
          setStatus('IDLE');
        }
      }
    },
    [user, attemptMatch, hasActiveSession, forceCleanupUserPending, status]
  );

  const cancelSearch = useCallback(async () => {
    if (! user) return;

    console.log(`[CANCEL] Canceling search for user: ${user.id}`);
    setError(undefined);
    setStatus('IDLE');

    // Stop retry interval
    if (matchRetryIntervalRef.current) {
      clearInterval(matchRetryIntervalRef.current);
      matchRetryIntervalRef.current = null;
    }

    // Detach session listener
    if (sessionListenerUnsubRef.current) {
      sessionListenerUnsubRef.current();
      sessionListenerUnsubRef.current = null;
    }

    try {
      await forceCleanupUserPending(user.id);
      console.log(`[CANCEL] Successfully cleaned up user pending state`);
    } catch (err) {
      console.error('[CANCEL] cancelSearch error', err);
      if (isMountedRef.current) {
        setError(String(err));
      }
    }

    matchedRef.current = false;
    activeConfigRef.current = null;
    currentSessionIdRef.current = null;
  }, [user, forceCleanupUserPending]);

  return {
    status,
    joinQueue,
    cancelSearch,
    error,
  };
}
