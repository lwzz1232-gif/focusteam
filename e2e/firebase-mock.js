// This script is injected into the browser before the app loads.
// It mocks the Firebase SDK functions to simulate a successful login.

window.__FIREBASE_MOCKED__ = true;

// Mock user data
const mockUser = {
  uid: 'fake-local-id',
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  // Add any other properties your app might use
};

const mockUserDoc = {
  role: 'user',
  name: 'Test User',
  // Add other fields from your Firestore user document
};

// Replace the actual Firebase modules with our mocks
window.__MOCK_FIREBASE__ = {
  // --- Auth Mocks ---
  getAuth: () => ({
    // Mock instance, can be empty if not used directly
  }),
  signInWithEmailAndPassword: (auth, email, password) => {
    if (email === 'test@example.com' && password === 'password') {
      // Find the onAuthStateChanged callback and trigger it
      const callback = window.__onAuthStateChangedCallback;
      if (callback) {
        callback(mockUser);
      }
      return Promise.resolve({ user: mockUser });
    }
    return Promise.reject(new Error('Invalid credentials'));
  },
  onAuthStateChanged: (auth, callback) => {
    // Store the callback so signIn can trigger it
    window.__onAuthStateChangedCallback = callback;
    // Return an unsubscribe function
    return () => {
      window.__onAuthStateChangedCallback = null;
    };
  },

  // --- Firestore Mocks ---
  getFirestore: () => ({
    // Mock instance
  }),
  doc: (firestore, path, ...pathSegments) => ({
    // Return a mock doc reference, can be simple object
    path: [path, ...pathSegments].join('/'),
  }),
  getDoc: (docRef) => {
    // Check if we're fetching the user document
    if (docRef.path.includes('users/fake-local-id')) {
      return Promise.resolve({
        exists: () => true,
        data: () => mockUserDoc,
      });
    }
    // Handle other doc gets if necessary, or return empty
    return Promise.resolve({ exists: () => false });
  },
};
