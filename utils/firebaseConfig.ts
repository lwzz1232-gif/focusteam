
// @ts-ignore
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Helper to safely get env vars in Vite and TRIM whitespace
const getEnv = (key: string) => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key].trim();
  }
  return '';
};

const apiKey = getEnv('NEXT_PUBLIC_FIREBASE_API_KEY');

// Verify key exists to prevent crash
export let isFirebaseConfigured = !!apiKey && apiKey.length > 0;

let app: any = null;
let auth: any = null;
let db: any = null;
let googleProvider: any = null;

if (isFirebaseConfigured) {
  try {
    const firebaseConfig = {
      apiKey: apiKey,
      authDomain: getEnv('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN'),
      projectId: getEnv('NEXT_PUBLIC_FIREBASE_PROJECT_ID'),
      storageBucket: getEnv('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET'),
      messagingSenderId: getEnv('NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID'),
      appId: getEnv('NEXT_PUBLIC_FIREBASE_APP_ID')
    };

    // Initialize Firebase Singleton
    if (!getApps().length) {
       app = initializeApp(firebaseConfig);
    } else {
       app = getApp();
    }

    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
    console.log("Firebase initialized successfully");

  } catch (error) {
    console.error("Firebase Initialization Error:", error);
    isFirebaseConfigured = false;
  }
} else {
  console.warn("Firebase configuration missing. Check .env.local");
}

export { app, auth, db, googleProvider };
