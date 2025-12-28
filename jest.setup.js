import 'regenerator-runtime/runtime';
import { TextEncoder, TextDecoder } from 'util';

// Polyfills for Firebase
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock Firebase services
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(() => Promise.resolve({ docs: [] })), // Mock getDocs
  setDoc: jest.fn(),
  onSnapshot: jest.fn(() => jest.fn()), // Return a mock unsubscribe function
  serverTimestamp: jest.fn(),
  query: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  signInWithPopup: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

// Mock firebaseConfig utility
jest.mock('./utils/firebaseConfig', () => ({
  db: {},
  auth: {},
  googleProvider: {},
  isFirebaseConfigured: true,
}));

// Mock lucide-react icons as proper components
jest.mock('lucide-react', () => {
    const original = jest.requireActual('lucide-react');
    const MOCK_ICON = (props) => require('react').createElement('svg', props);
    return {
        ...original,
        AlertTriangle: MOCK_ICON,
        RefreshCw: MOCK_ICON,
        // Add other icons here if they cause issues
    };
});


// Mock react-globe.gl
jest.mock('react-globe.gl', () => 'Globe');

// Mock geminiService.ts
jest.mock('./services/geminiService', () => ({
  generateIcebreaker: jest.fn(),
}));
