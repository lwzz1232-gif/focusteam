import React, { useEffect, useState } from 'react';
import { Layout } from './components/Layout';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { useAuth } from './hooks/useAuth';
import { Screen, SessionConfig, Partner, SessionType, SessionDuration, SessionMode } from './types';
import { db } from './utils/firebaseConfig';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  // SAFETY CHECK - if auth hook fails
  let authHook = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    authHook = useAuth();
  } catch (e) {
    console.error("Auth hook failed:", e);
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Critical Error</h3>
          <p className="text-slate-300 mb-4">Authentication system failed to load</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <RefreshCw size={18} /> Reload App
          </button>
        </div>
      </div>
    );
  }

  const { user, loading } = authHook;
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SPLASH);
  
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    type: SessionType.STUDY,
    duration: SessionDuration.MIN_30,
    mode: SessionMode.DEEP_WORK,
    preTalkMinutes: 5,
    postTalkMinutes: 5
  });
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up any subscriptions
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      // Auto-redirect logic
      if (user) {
        if (currentScreen === Screen.LOGIN) {
          setCurrentScreen(Screen.DASHBOARD);
        }
      } else {
        if (currentScreen !== Screen.SPLASH && currentScreen !== Screen.LOGIN) {
          setCurrentScreen(Screen.LOGIN);
        }
      }
    }
  }, [user, loading]);

  const handleSplashComplete = () => {
    if (user) setCurrentScreen(Screen.DASHBOARD);
    else setCurrentScreen(Screen.LOGIN);
  };

  const handleStartMatch = (config: SessionConfig) => {
    setSessionConfig(config);
    
    // TEST MODE: Skip matching for admins
    if (config.duration === SessionDuration.TEST && user?.role === 'admin') {
      const botPartner: Partner = {
        id: 'bot-test-' + Date.now(),
        name: 'Test Bot',
        type: config.type
      };
      setPartner(botPartner);
      setCurrentScreen(Screen.SESSION); // Skip matching & negotiation
    } else {
      setCurrentScreen(Screen.MATCHING);
    }
  };

  const handleMatched = (partner: Partner, sessionId: string) => {
    console.log(`[APP] Match found! Partner:`, partner, 'SessionId:', sessionId);
    
    setPartner(partner);
    setSessionId(sessionId);
    
    // Listen to the session document to know when BOTH users have matched
    // The Matching component will handle the onMatched callback,
    // but we need to wait for the session to transition properly
    
    // Move to negotiation immediately after match
    setCurrentScreen(Screen.NEGOTIATION);
  };

  const handleNegotiationComplete = (finalConfig: SessionConfig) => {
    setSessionConfig(finalConfig);
    setCurrentScreen(Screen.SESSION);
  };

  const handleCancelMatch = () => {
    setPartner(null);
    setSessionId(null);
    setCurrentScreen(Screen.DASHBOARD);
  };

  const handleEndSession = () => {
    setPartner(null);
    setSessionId(null);
    setCurrentScreen(Screen.DASHBOARD);
  };

  return (
    <Layout
      user={user} 
      currentScreen={currentScreen}
      onLogout={() => {}}
      onAdminClick={() => setCurrentScreen(Screen.ADMIN)}
    >
      {currentScreen === Screen.SPLASH && <Splash onComplete={handleSplashComplete} />}
      
      {currentScreen === Screen.LOGIN && <Login onLogin={() => {}} />}

      {currentScreen === Screen.DASHBOARD && user && (
        <Dashboard 
          user={user} 
          onStartMatch={handleStartMatch}
        />
      )}

      {currentScreen === Screen.MATCHING && user && (
        <Matching 
          user={user}
          config={sessionConfig} 
          onMatched={handleMatched}
          onCancel={handleCancelMatch}
        />
      )}

      {currentScreen === Screen.NEGOTIATION && partner && user && (
        <Negotiation
          config={sessionConfig}
          partner={partner}
          onNegotiationComplete={handleNegotiationComplete}
          onSkipMatch={handleCancelMatch}
        />
      )}

      {currentScreen === Screen.SESSION && user && partner && sessionId && (
        <LiveSession 
          user={user}
          partner={partner}
          config={sessionConfig}
          sessionId={sessionId}
          onEndSession={handleEndSession}
        />
      )}

      {currentScreen === Screen.ADMIN && <Admin onBack={() => setCurrentScreen(Screen.DASHBOARD)} />}
    </Layout>
  );
};
