import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Landing } from './screens/Landing';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { useAuth } from './hooks/useAuth';
import { Screen, SessionConfig, Partner, SessionType, SessionDuration, SessionMode } from './types';
import * as firebaseService from './services/firebaseService';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { AppRoutes } from './AppRoutes';

export const App: React.FC = () => {
  return <AppRoutes />;
};

export default App;
