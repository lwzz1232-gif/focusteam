import React from 'react';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../screens/Dashboard';
import { User } from '../types';

// Mock child components
jest.mock('../components/LiveRequests', () => ({
  LiveRequests: () => <div>Live Requests Mock</div>,
}));

// Mock Firebase config to avoid Vite-specific code issues
jest.mock('../utils/firebaseConfig', () => ({
  db: {}, // Provide a dummy db object
}));

// Mock Firestore functions to prevent errors in tests
jest.mock('firebase/firestore', () => ({
  ...jest.requireActual('firebase/firestore'),
  collection: jest.fn(),
  onSnapshot: jest.fn(() => {
    // onSnapshot returns an unsubscribe function, so we return a mock function
    return () => {};
  }),
}));

describe('Dashboard', () => {
  const mockUser: User = {
    id: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'user',
    emailVerified: true,
  };

  const mockOnStartMatch = jest.fn();
  const mockOnLogout = jest.fn();

  it('renders the main heading', () => {
    render(
      <Dashboard
        user={mockUser}
        onStartMatch={mockOnStartMatch}
        onLogout={mockOnLogout}
      />
    );
    expect(screen.getByText('Choose your focus area and time block to find a match.')).toBeInTheDocument();
  });
});
