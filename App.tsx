
import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { Splash } from './screens/Splash';
import { Screen, User, SessionConfig, Partner, SessionType, SessionDuration, SessionMode } from './types';
import { useAuth } from './hooks/useAuth';
import { auth, isFirebaseConfigured } from './utils/firebaseConfig';
import { AlertTriangle, FileText, RefreshCw } from 'lucide-react';

export default function App() {
  // --- SAFETY CHECK START ---
  if (!isFirebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-inter text-slate-200">
        <div className="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
             <div className="p-3 bg-red-500/20 rounded-full text-red-400">
                <AlertTriangle size={32} />
             </div>
             <div>
                <h1 className="text-2xl font-bold text-white">Setup Required</h1>
                <p className="text-slate-400">Missing Firebase Configuration</p>
             </div>
          </div>
          
          <div className="space-y-4 mb-8">
             <p className="text-sm text-slate-300">
               The app cannot connect to the backend because the API keys are missing.
             </p>
             <div className="bg-black/50 p-4 rounded-lg border border-slate-800 font-mono text-xs text-slate-400 overflow-x-auto">
                <div className="flex items-center gap-2 text-yellow-400 mb-2 border-b border-slate-800 pb-2">
                   <FileText size={14} /> .env.local
                </div>
                NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...<br/>
                NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...<br/>
                NEXT_PUBLIC_FIREBASE_PROJECT_ID=...<br/>
             </div>
          </div>

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
  // --- SAFETY CHECK END ---

  const { user, loading } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.SPLASH);
  
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    type: SessionType.STUDY,
    duration: SessionDuration.MIN_30,
    mode: SessionMode.DEEP_WORK,
    preTalkMinutes: 5,
    postTalkMinutes: 5
  });
  const [partner, setPartner] = useState<Partner | null>(null);

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

  return (
    <Layout
      user={user} 
      currentScreen={currentScreen}
      onLogout={() => auth?.signOut()}
      onAdminClick={() => setCurrentScreen(Screen.ADMIN)}
    >
      {currentScreen === Screen.SPLASH && <Splash onComplete={handleSplashComplete} />}
      
      {currentScreen === Screen.LOGIN && <Login onLogin={() => {}} />}

     {currentScreen === Screen.DASHBOARD && user && (
    <Dashboard 
      user={user} 
      onStartMatch={(config) => { 
        setSessionConfig(config); 
        // TEST MODE: Skip matching for admins
        if (config.duration === SessionDuration.TEST && user.role === 'admin') {
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
      }} 
    />
)}

      {currentScreen === Screen.MATCHING && user && (
        <Matching 
          user={user}
          config={sessionConfig} 
          onMatched={(p) => { setPartner(p); setCurrentScreen(Screen.NEGOTIATION); }}
          onCancel={() => setCurrentScreen(Screen.DASHBOARD)}
        />
      )}

      {currentScreen === Screen.NEGOTIATION && partner && (
        <Negotiation
          config={sessionConfig}
          partner={partner}
          onNegotiationComplete={(cfg) => { setSessionConfig(cfg); setCurrentScreen(Screen.SESSION); }}
          onSkipMatch={() => setCurrentScreen(Screen.MATCHING)}
        />
      )}

      {currentScreen === Screen.SESSION && user && partner && (
        <LiveSession 
          user={user}
          partner={partner}
          config={sessionConfig}
          onEndSession={() => setCurrentScreen(Screen.DASHBOARD)}
        />
      )}

      {currentScreen === Screen.ADMIN && <Admin onBack={() => setCurrentScreen(Screen.DASHBOARD)} />}
    </Layout>
  );
}
