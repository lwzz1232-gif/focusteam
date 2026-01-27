import React from 'react';
import { AppRoutes } from './AppRoutes';
import { SessionProvider } from './context/SessionContext';

export const App: React.FC = () => {
  return (
    <SessionProvider>
      <AppRoutes />
    </SessionProvider>
  );
};

export default App;
