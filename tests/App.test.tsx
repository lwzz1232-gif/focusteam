import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';
import { useAuth } from '../hooks/useAuth';
import { AppProvider } from '../context/AppContext';
import React from 'react';

// Mock the useAuth hook to prevent import.meta.env error
jest.mock('../hooks/useAuth');

// Mock the Splash screen to remove the timeout and handle scoping
jest.mock('../screens/Splash', () => ({
  Splash: ({ onComplete }: { onComplete: () => void }) => {
    const React = require('react');
    const { act } = require('@testing-library/react');

    React.useEffect(() => {
      act(() => {
        onComplete();
      });
    }, [onComplete]);

    return React.createElement('div', { 'data-testid': 'splash-screen' });
  },
}));

const mockUseAuth = useAuth as jest.Mock;

describe('App', () => {
  it('renders the landing screen when loading and not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, error: null });
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );
    expect(screen.getByText(/A new way to focus/i)).toBeInTheDocument();
  });

  it('renders the landing screen when not authenticated', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: null });
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );
    expect(screen.getByText(/A new way to focus/i)).toBeInTheDocument();
  });

  it('renders the dashboard when authenticated', () => {
    const mockUser = {
      id: '123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      emailVerified: true,
    };
    mockUseAuth.mockReturnValue({ user: mockUser, loading: false, error: null });
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );
    expect(screen.getByText(/Welcome back, Test User/i)).toBeInTheDocument();
  });

  it('renders an error message when auth fails', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: false, error: 'Authentication Failed' });
    render(
      <AppProvider>
        <App />
      </AppProvider>
    );
    expect(screen.getByText(/Critical Error/i)).toBeInTheDocument();
    expect(screen.getByText(/Authentication Failed/i)).toBeInTheDocument();
  });
});
