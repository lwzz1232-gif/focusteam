import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '../../hooks/useAuth';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { getDoc, setDoc } from 'firebase/firestore';

// Mock Firebase utilities
jest.mock('../../utils/firebaseConfig', () => ({
  auth: {}, // auth is initialized in useAuth
  db: {},   // db is initialized in useAuth
  isFirebaseConfigured: true,
}));

// Mock Firebase auth functions
jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(() => Promise.resolve()),
  getAuth: jest.fn(),
}));

// Mock Firebase firestore functions
jest.mock('firebase/firestore', () => ({
  doc: jest.fn((...args) => ({ path: args.join('/') })), // Return a mock doc object
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(),
}));

const mockOnAuthStateChanged = onAuthStateChanged as jest.Mock;
const mockGetDoc = getDoc as jest.Mock;
const mockSetDoc = setDoc as jest.Mock;

describe('useAuth', () => {
  // Clear all mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
    // Provide a default implementation for onAuthStateChanged to prevent `unsubscribe` errors.
    // It returns a mock unsubscribe function.
    mockOnAuthStateChanged.mockImplementation(() => jest.fn());
  });

  it('should be in a loading state initially', () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should return a user when authentication is successful', async () => {
    const mockFbUser = { uid: '123', email: 'test@example.com', displayName: 'Test User', emailVerified: true };
    // Mock that the user's document already exists in Firestore
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'user', name: 'Test User' }) });

    const { result } = renderHook(() => useAuth());

    // Simulate Firebase firing onAuthStateChanged with a user
    act(() => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFbUser);
    });

    // Wait for the hook to finish processing
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toEqual({
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      emailVerified: true,
    });
    expect(result.current.error).toBeNull();
  });

  it('should create a user profile if one does not exist', async () => {
    const mockFbUser = { uid: 'new-user', email: 'new@example.com', displayName: 'New User', emailVerified: true };
    // Mock that the user's document does not exist
    mockGetDoc.mockResolvedValue({ exists: () => false });

    const { result } = renderHook(() => useAuth());

    act(() => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFbUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    // Check that setDoc was called to create the new profile
    expect(mockSetDoc).toHaveBeenCalled();
    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.id).toBe('new-user');
    expect(result.current.user?.role).toBe('user'); // Default role
  });


  it('should return null when user is not authenticated', async () => {
    const { result } = renderHook(() => useAuth());

    // Simulate Firebase firing onAuthStateChanged with null
    act(() => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(null);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle errors during user data fetching', async () => {
    const mockFbUser = { uid: '123', email: 'test@example.com', displayName: 'Test User', emailVerified: true };
    const authError = new Error('Firestore permission denied');
    // Mock getDoc to reject
    mockGetDoc.mockRejectedValue(authError);

    const { result } = renderHook(() => useAuth());

    act(() => {
      const callback = mockOnAuthStateChanged.mock.calls[0][1];
      callback(mockFbUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(authError.message);
  });

  it('should assign admin role to whitelisted admin emails', async () => {
    const mockAdminUser = { uid: 'admin-uid', email: 'benchoaib2@gmail.com', displayName: 'Admin User', emailVerified: true };
    // Mock existing user doc without admin role
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ role: 'user', name: 'Admin User' }) });

    const { result } = renderHook(() => useAuth());

    act(() => {
        const callback = mockOnAuthStateChanged.mock.calls[0][1];
        callback(mockAdminUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user?.role).toBe('admin');
    // Check that setDoc was called to update the role to 'admin'
    expect(mockSetDoc).toHaveBeenCalledWith(expect.any(Object), { role: 'admin' }, { merge: true });
  });

  it('should block banned users from logging in', async () => {
    const mockBannedUser = { uid: 'banned-uid', email: 'banned@example.com', displayName: 'Banned User', emailVerified: true };
    const banUntil = Date.now() + 1000 * 60 * 60; // Banned for one hour
    const banReason = `Account banned until ${new Date(banUntil).toLocaleString()}`;

    // Mock that the user's document shows they are banned
    mockGetDoc.mockResolvedValue({ exists: () => true, data: () => ({ bannedUntil: banUntil }) });

    const { result } = renderHook(() => useAuth());

    act(() => {
        const callback = mockOnAuthStateChanged.mock.calls[0][1];
        callback(mockBannedUser);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe(banReason);
    // Ensure signOut was called for the banned user
    expect(signOut).toHaveBeenCalled();
  });
});
