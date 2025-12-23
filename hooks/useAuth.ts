import { useState, useEffect } from 'react';
import { auth, db, isFirebaseConfigured } from '../utils/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { User } from '../types';

const ADMIN_EMAILS = ['benchoaib2@gmail.com', 'kirito63561@gmail.com'];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setError("Firebase is not configured correctly. Please check your .env file.");
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.bannedUntil && data.bannedUntil > Date.now()) {
              await signOut(auth);
              throw new Error(`Account banned until ${new Date(data.bannedUntil).toLocaleString()}`);
            }
          }

          let role: 'user' | 'admin' | 'dev' = 'user';
          let name = fbUser.displayName || 'User';

          if (userSnap.exists()) {
            const data = userSnap.data();
            role = data.role || 'user';
            name = data.name || name;
          } else {
            await setDoc(userRef, {
              email: fbUser.email,
              name: name,
              role: 'user',
              createdAt: new Date().toISOString(),
              bannedUntil: null
            });
          }

          if (fbUser.email && ADMIN_EMAILS.includes(fbUser.email)) {
            role = 'admin';
            await setDoc(userRef, { role: 'admin' }, { merge: true });
          }

          setUser({
            id: fbUser.uid,
            email: fbUser.email || '',
            name: name,
            role: role,
            emailVerified: fbUser.emailVerified
          });
        } else {
          setUser(null);
        }
      } catch (err: any) {
        console.error("Auth Error:", err);
        setError(err.message);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
};
