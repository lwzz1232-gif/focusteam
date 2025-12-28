import React from 'react';
import { withAuth } from './hocs/withAuth';
import AppContent from './AppContent';
import { User } from './types';

interface AppProps {
  user: User | null;
  loading: boolean;
}

const App: React.FC<AppProps> = ({ user, loading }) => {
  return <AppContent user={user} loading={loading} />;
};

export default withAuth(App);
