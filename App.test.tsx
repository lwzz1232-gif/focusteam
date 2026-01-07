import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { App } from './App';

// Mock the withAuth HOC
jest.mock('./hocs/withAuth', () => ({
  withAuth: (Component: React.ComponentType) => (props: any) => (
    <div data-testid="with-auth-mock">
      <Component {...props} />
    </div>
  ),
}));

// Mock the AppContent component
jest.mock('./AppContent', () => ({
  AppContent: () => <div data-testid="app-content-mock" />,
}));

describe('App', () => {
  it('renders the App component with the AppProvider and withAuth HOC', () => {
    render(<App />);
    expect(screen.getByTestId('with-auth-mock')).toBeInTheDocument();
    expect(screen.getByTestId('app-content-mock')).toBeInTheDocument();
  });
});
