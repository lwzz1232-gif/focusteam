import { useState, useEffect } from 'react';
import { auth, db, isFirebaseConfigured } from '../utils/firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { User } from '../types';

// Strict Dev/Admin Whitelist
// These accounts will automatically get 'dev' role upon login/signup
const DEV_EMAILS = ['benchoaib2@gmail.com', 'kirito63561@gmail.com'];

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Safety check: If no config, stop here to prevent crash
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      try {
        if (fbUser) {
          // 1. Strict Email Verification Check
          // Allow Devs to bypass, otherwise force logout
          if (!fbUser.emailVerified && !DEV_EMAILS.includes(fbUser.email || '')) {
              await signOut(auth);
              throw new Error("Please verify your email address to log in.");
          }

          const userRef = doc(db, 'users', fbUser.uid);
          const userSnap = await getDoc(userRef);

          // 2. Check if Banned
          if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.bannedUntil && data.bannedUntil > Date.now()) {
              await signOut(auth);
              throw new Error(`Account banned until ${new Date(data.bannedUntil).toLocaleString()}`);
            }
          }

          // 3. Role Assignment
          let role: 'user' | 'admin' | 'dev' = 'user';
          let name = fbUser.displayName || 'User';

          if (userSnap.exists()) {
            const data = userSnap.data();
            role = data.role || 'user';
            name = data.name || name;
          } else {
            // Create Profile if missing (e.g. Google Login first time)
            await setDoc(userRef, {
              email: fbUser.email,
              name: name,
              role: 'user',
              createdAt: new Date().toISOString(),
              bannedUntil: null
            });
          }

          // Force Dev Role for specific emails
          if (fbUser.email && DEV_EMAILS.includes(fbUser.email)) {
            role = 'dev';
            // Optionally update DB to reflect this power immediately
             await setDoc(userRef, { role: 'dev' }, { merge: true });
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
        setUser(null); // Ensure no partial user state
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return { user, loading, error };
};