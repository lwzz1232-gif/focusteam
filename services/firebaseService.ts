import { db } from '../utils/firebaseConfig';
import { collection, query, where, getDocs, onSnapshot, doc, setDoc, serverTimestamp, orderBy } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { User, SessionConfig, Partner, Notification } from '../types';

// --- Authentication ---
export const auth = getAuth();

export const onAuthStateChanged = (callback: (user: any) => void) => {
  return auth.onAuthStateChanged(callback);
};

export const signOutUser = async () => {
  await signOut(auth);
};

// --- User Management ---
export const getUserDoc = (userId: string) => {
  return doc(db, 'users', userId);
};

export const onUserDocSnapshot = (userId:string, callback: (doc: any) => void) => {
  return onSnapshot(doc(db, 'users', userId), callback)
}

// --- Session Management ---
export const createTestSession = async (user: User, config: SessionConfig, botPartner: Partner) => {
  const testSessionId = `TEST_${user.id}_${Date.now()}`;
  await setDoc(doc(db, 'sessions', testSessionId), {
    type: config.type,
    config,
    participants: [user.id, botPartner.id],
    participantInfo: [
      { userId: user.id, displayName: user.name, photoURL: user.avatar || '' },
      { userId: botPartner.id, displayName: 'Test Bot', photoURL: '' }
    ],
    createdAt: serverTimestamp(),
    started: true,
    phase: 'ICEBREAKER',
    status: 'active'
  });
  return testSessionId;
};

// --- Notifications ---
export const getNotifications = async (userId: string): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      orderBy('timestamp', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      ...d.data(),
      id: d.id
    } as Notification));
  } catch (e) {
    console.error("Failed to fetch notifications:", e);
    return [];
  }
};
