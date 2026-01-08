import React from 'react';
import { render, screen } from '@testing-library/react';
import { Login } from './Login';
import '@testing-library/jest-dom';

// Mock the firebase config
jest.mock('../utils/firebaseConfig');

// Mock firebase/auth and firestore
jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  updateProfile: jest.fn(),
  signInWithPopup: jest.fn(),
  sendEmailVerification: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  signOut: jest.fn(),
}));
jest.mock('firebase/firestore', () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
  getDoc: jest.fn(),
}));

// Mock the useMousePosition hook
jest.mock('../hooks/useMousePosition', () => ({
  useMousePosition: () => ({ x: 0, y: 0 }),
}));

describe('Login Component', () => {
  it('renders the login form by default', () => {
    // Arrange
    const handleLogin = jest.fn();
    const handleBack = jest.fn();

    // Act
    render(<Login onLogin={handleLogin} onBack={handleBack} />);

    // Assert
    expect(screen.getByText('Welcome Back')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });
});
