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
import type { User, Partner, SessionConfig, SessionType } from '../types';

const QUEUE_COLLECTION = 'matchmakingQueue';
const SESSIONS_COLLECTION = 'sessions';

// How old a non-started session must be before considered stale and removed (ms)
const STALE_SESSION_MS = 30 * 1000;

// Polling interval to cleanup stale sessions (ms)
const CLEANUP_INTERVAL_MS = 15 * 1000;

type UseMatchmakingReturn = {
  startSearch: (config: SessionConfig, onMatch?: (partner: Partner, sessionId: string) => void) => Promise<void>;
  cancelSearch: () => Promise<void>;
  isSearching: boolean;
  lastError?: string;
};

export function useMatchmaking(user: User): UseMatchmakingReturn {
  const db = getFirestore();
  const queueColl = collection(db, QUEUE_COLLECTION);
  const sessionsColl = collection(db, SESSIONS_COLLECTION);

  const [isSearching, setIsSearching] = useState(false);
  const [lastError, setLastError] = useState<string | undefined>(undefined);

  // Keep refs for cleanup and ensuring callbacks run once
  const onMatchRef = useRef<((partner: Partner, sessionId: string) => void) | undefined>(undefined);
  const sessionListenerUnsubRef = useRef<(() => void) | null>(null);
  const cleanupIntervalRef = useRef<number | null>(null);
  const matchedRef = useRef<boolean>(false);

  // Helper doc refs
  const userQueueDocRef = (uid = user.id) => doc(queueColl, uid);
  const sessionDocRef = (sessionId?: string) => (sessionId ? doc(sessionsColl, sessionId) : doc(sessionsColl));

  // Utility: check for truly active sessions (started === true)
  const hasActiveSession = useCallback(async (): Promise<boolean> => {
    try {
      const q = query(
        sessionsColl,
        where('participants', 'array-contains', user.id),
        where('started', '==', true),
        limit(1)
      );
      const snap = await getDocs(q);
      return !snap.empty;
    } catch (err: any) {
      console.error('hasActiveSession error', err);
      return false;
    }
  }, [sessionsColl, user.id]);

  // Cleanup stale sessions (started === false and older than threshold)
  const cleanupStaleSessions = useCallback(async () => {
    try {
      const threshold = Timestamp.fromDate(new Date(Date.now() - STALE_SESSION_MS));
      const q = query(sessionsColl, where('started', '==', false), where('createdAt', '<', threshold));
      const snap = await getDocs(q);
      const deletes: Promise<void>[] = [];
      snap.forEach((docSnap) => {
        deletes.push(
          (async () => {
            try {
              await deleteDoc(doc(sessionsColl, docSnap.id));
            } catch (err) {
              console.warn('Failed to delete stale session', docSnap.id, err);
            }
          })()
        );
      });
      await Promise.all(deletes);
    } catch (err) {
      console.error('cleanupStaleSessions error', err);
    }
  }, [sessionsColl]);

  // Clear any queue doc for this user and any non-started session where the user participates
  const forceCleanupUserPending = useCallback(async () => {
    try {
      // remove queue doc
      try {
        await deleteDoc(userQueueDocRef());
      } catch (e) {
        // ignore
      }

      // remove any sessions where this user participates and started === false
      const q = query(sessionsColl, where('participants', 'array-contains', user.id), where('started', '==', false));
      const snap = await getDocs(q);
      const deletes: Promise<void>[] = [];
      snap.forEach((sdoc) => deletes.push(deleteDoc(doc(sessionsColl, sdoc.id))));
      await Promise.all(deletes);
    } catch (err) {
      console.error('forceCleanupUserPending error', err);
    }
  }, [sessionsColl, user.id]);

  // Internal: set up listener for a given session doc. Ensures onMatch is fired once.
  const attachSessionListener = useCallback(
    (sessionId: string, localOnMatch?: (partner: Partner, sessionId: string) => void) => {
      // detach previous
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef.current();
        sessionListenerUnsubRef.current = null;
      }

      matchedRef.current = false;
      onMatchRef.current = localOnMatch;

      const sRef = sessionDocRef(sessionId);
      const unsub = onSnapshot(
        sRef,
        (snap) => {
          const data = snap.data?.() ?? snap.data();
          if (!data) return;

          // If session was deleted, nothing to do
          // data may be undefined when deleted; handled above

          // If session already started, trigger match callback (only once)
          if (data.started === true && !matchedRef.current) {
            matchedRef.current = true;
            try {
              // find partner info
              const participants: any[] = data.participants || [];
              const partnerObj: Partner | undefined = participants
                .map((p) => (p.userId === user.id ? null : p))
                .filter(Boolean)[0] as Partner | undefined;

              if (partnerObj && onMatchRef.current) {
                onMatchRef.current(partnerObj, snap.id);
              }
            } catch (err) {
              console.error('onSnapshot onMatch error', err);
            }
            return;
          }

          // If session not started but has two participants, try to mark started=true via transaction.
          if (data.started === false && Array.isArray(data.participants) && data.participants.length >= 2) {
            // fire-and-forget: attempt to set started=true if still false
            (async () => {
              try {
                await runTransaction(db, async (tx) => {
                  const sSnap = await tx.get(sRef);
                  if (!sSnap.exists()) return;
                  const sData: any = sSnap.data();
                  if (sData.started === true) return;
                  // Mark started
                  tx.update(sRef, { started: true });
                });
                // after transaction completes, onSnapshot will receive started === true and call onMatch
              } catch (err) {
                // ignore races or transaction failures
                console.warn('Failed to mark session started in transaction', err);
              }
            })();
          }
        },
        (error) => {
          console.error('session onSnapshot error', error);
        }
      );

      sessionListenerUnsubRef.current = unsub;
      return unsub;
    },
    [db, user.id]
  );

  // Start the periodic cleanup when searching / when hook mounts
  useEffect(() => {
    // always run cleanup on mount once
    cleanupStaleSessions().catch((e) => console.error(e));

    // schedule interval
    const id = window.setInterval(() => {
      cleanupStaleSessions().catch((e) => console.error(e));
    }, CLEANUP_INTERVAL_MS);
    cleanupIntervalRef.current = id;

    return () => {
      if (cleanupIntervalRef.current) {
        clearInterval(cleanupIntervalRef.current);
        cleanupIntervalRef.current = null;
      }
      // cleanup any attached listener
      if (sessionListenerUnsubRef.current) {
        sessionListenerUnsubRef.current();
        sessionListenerUnsubRef.current = null;
      }
      // best-effort cleanup of pending things for this user
      forceCleanupUserPending().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once

  const startSearch = useCallback(
    async (config: SessionConfig, onMatch?: (partner: Partner, sessionId: string) => void) => {
      setLastError(undefined);

      // Prevent starting if user already has a truly active session
      try {
        const active = await hasActiveSession();
        if (active) {
          setLastError("You're already in an active session!");
          return;
        }
      } catch (err) {
        // continue but warn
        console.warn('Error checking active sessions', err);
      }

      setIsSearching(true);
      onMatchRef.current = onMatch;
      matchedRef.current = false;

      try {
        // Force-clean any stale pending queue/session for this user to avoid being blocked
        await forceCleanupUserPending();

        // Create a queue doc for this user (use user.id as doc id so we can delete easily)
        const myQueueRef = userQueueDocRef();
        const queuePayload = {
          userId: user.id,
          userDisplayName: user.displayName ?? '',
          userPhotoURL: (user as any).photoURL ?? '',
          config,
          createdAt: serverTimestamp(),
        };
        await setDoc(myQueueRef, queuePayload);

        // Try to find a partner in queue that is not this user and matches config.
        // Keep the matching logic simple and consistent with original: oldest matching partner.
        // Note: adjust this query to add more matching criteria if required by original logic.
        const partnerQuery = query(
          queueColl,
          where('userId', '!=', user.id),
          orderBy('createdAt', 'asc'),
          limit(1)
        );
        const partnerSnap = await getDocs(partnerQuery);

        if (partnerSnap.empty) {
          // No partner found: remain in queue. Caller can cancelSearch or try again.
          return;
        }

        // We have a candidate partner
        const partnerDoc = partnerSnap.docs[0];
        const partnerData = partnerDoc.data() as any;
        const partnerId = partnerData.userId as string;

        // run transaction: confirm both queue docs exist, create session, delete both queue docs
        const sessionRef = sessionDocRef(); // auto id
        await runTransaction(db, async (tx) => {
          const myQueueSnap = await tx.get(myQueueRef);
          const partnerQueueRef = doc(queueColl, partnerId);
          const partnerQueueSnap = await tx.get(partnerQueueRef);

          // If partner or me is gone, abort the transaction and leave user's queue for retry
          if (!myQueueSnap.exists() || !partnerQueueSnap.exists()) {
            throw new Error('queue changed - aborting match');
          }

          const sessionPayload = {
            type: (config.type as SessionType) ?? 'default',
            config,
            participants: [
              {
                userId: user.id,
                displayName: user.displayName ?? '',
                photoURL: (user as any).photoURL ?? '',
              },
              {
                userId: partnerId,
                displayName: partnerData.userDisplayName ?? '',
                photoURL: partnerData.userPhotoURL ?? '',
              },
            ],
            createdAt: serverTimestamp(),
            started: false,
          };

          tx.set(sessionRef, sessionPayload);
          tx.delete(myQueueRef);
          tx.delete(partnerQueueRef);
        });

        // Attach listener so onMatch will be triggered when started flips to true
        attachSessionListener(sessionRef.id, onMatchRef.current);

        // If the created session doesn't become started within a short time, cleanup will remove it automatically.
        // Caller can re-queue after cancelSearch or after session is removed by cleanup.
      } catch (err: any) {
        // If transaction failed due to race, don't block re-queueing
        console.warn('startSearch error', err);
        setLastError(err?.message ?? String(err));
      } finally {
        // keep isSearching true until user cancels or matched (match will call onMatch via listener)
        // But if matchedRef was set synchronously by listener, we can clear searching.
        if (matchedRef.current) {
          setIsSearching(false);
        }
      }
    },
    [attachSessionListener, db, forceCleanupUserPending, hasActiveSession, queueColl, user.id, user.displayName]
  );

  const cancelSearch = useCallback(async () => {
    setLastError(undefined);
    setIsSearching(false);

    // detach session listener
    if (sessionListenerUnsubRef.current) {
      sessionListenerUnsubRef.current();
      sessionListenerUnsubRef.current = null;
    }

    try {
      // Remove queue doc for this user
      try {
        await deleteDoc(userQueueDocRef());
      } catch (e) {
        // ignore
      }

      // Find sessions where this user is a participant and started == false and delete them.
      const q = query(sessionsColl, where('participants', 'array-contains', user.id), where('started', '==', false));
      const snap = await getDocs(q);
      const deletes: Promise<void>[] = [];
      snap.forEach((sdoc) => {
        deletes.push(deleteDoc(doc(sessionsColl, sdoc.id)));
      });
      await Promise.all(deletes);
    } catch (err) {
      console.error('cancelSearch error', err);
      setLastError(String(err));
    }
  }, [sessionsColl, user.id]);

  return {
    startSearch,
    cancelSearch,
    isSearching,
    lastError,
  };
}
