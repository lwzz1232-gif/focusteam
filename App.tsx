import React from 'react';
import { AppProvider } from './context/AppContext';
import { withAuth } from './hocs/withAuth';
import { AppContent } from './AppContent';

// The AppContent component now holds the main logic and is wrapped by withAuth
const AuthenticatedApp = withAuth(AppContent);

export const App: React.FC = () => {
  return (
    // The AppProvider wraps everything, making the context available to all components
    <AppProvider>
      {/* The AuthenticatedApp component handles auth state and renders the correct screen */}
      <AuthenticatedApp />
    </AppProvider>
  );
};

export default App;
