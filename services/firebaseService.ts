import { db } from '../utils/firebaseConfig';
import { onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { User, SessionConfig, Partner, SessionDuration } from '../types';

export const handleLogout = async () => {
  try {
    await signOut(getAuth());
  } catch (error) {
    console.error("Error signing out:", error);
  }
};

export const checkBanStatus = (user: User, onBanned: (reason: string) => void) => {
  if (!user?.id) return () => {};

  const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
    if (docSnap.exists() && docSnap.data().bannedUntil > Date.now()) {
      onBanned(docSnap.data().banReason || "Violation of Terms");
    }
  });

  return unsub;
};

export const createTestSession = async (
  user: User,
  config: SessionConfig
): Promise<{ partner: Partner; sessionId: string } | null> => {
  if (config.duration !== SessionDuration.TEST || (user?.role !== 'admin' && user?.role !== 'dev')) {
    return null;
  }

  const botId = 'bot-' + Date.now();
  const botPartner: Partner = { id: botId, name: 'Test Bot', type: config.type };
  const testSessionId = `TEST_${user.id}_${Date.now()}`;

  try {
    await setDoc(doc(db, 'sessions', testSessionId), {
      type: config.type,
      config,
      participants: [user.id, botId],
      participantInfo: [
        { userId: user.id, displayName: user.name, photoURL: user.avatar || '' },
        { userId: botId, displayName: 'Test Bot', photoURL: '' },
      ],
      createdAt: serverTimestamp(),
      started: true,
      phase: 'ICEBREAKER',
      status: 'active',
    });
    return { partner: botPartner, sessionId: testSessionId };
  } catch (e) {
    console.error("Failed to create test session:", e);
    return null;
  }
};
