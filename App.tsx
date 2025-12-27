import React from 'react';
import { AppProvider } from './context/AppContext';
import { withAuth } from './hocs/withAuth';
import { AppContent } from './AppContent';

const AuthenticatedApp = withAuth(AppContent);

export const App: React.FC = () => {
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
};

export default App;
