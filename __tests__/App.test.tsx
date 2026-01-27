import React from 'react';
import { render } from '@testing-library/react';
import App from '../App';

// Mock child components
jest.mock('../AppRoutes', () => ({
  AppRoutes: () => <div data-testid="app-routes">AppRoutes</div>,
}));

jest.mock('../context/SessionContext', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="session-provider">{children}</div>
  ),
}));

describe('App', () => {
  it('renders without crashing', () => {
    const { getByTestId } = render(<App />);
    expect(getByTestId('session-provider')).toBeInTheDocument();
  });
});
