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
import { db } from './utils/firebaseConfig';
import { collection, query, where, getDocs, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth'; 
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

  // --- NEW: HANDLE LOGOUT FUNCTION ---
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      setPartner(null); // Clear session state
      setSessionId(null);
      setCurrentScreen(Screen.LOGIN);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- NEW: INSTANT BAN CHECK ---
  // Listens to the user's document in real-time. If they get banned, kicks them out.
  useEffect(() => {
    if (!user?.id) return;

    const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Check if banned
            if (data.bannedUntil && data.bannedUntil > Date.now()) {
                const reason = data.banReason || "Violation of Terms";
                alert(`You have been banned.\nReason: ${reason}`);
                handleLogout(); // Force logout immediately
            }
        }
    });

    return () => unsub(); // Cleanup listener
  }, [user?.id]); // Re-run if user changes

  useEffect(() => {
    return () => {
      // Clean up any subscriptions
    };
  }, []);

 useEffect(() => {
  if (!loading) {
    if (user) {
      if (currentScreen === Screen.LOGIN || currentScreen === Screen.LANDING) {
        setCurrentScreen(Screen.DASHBOARD);
      }
    } else {
      if (currentScreen !== Screen.SPLASH && currentScreen !== Screen.LOGIN && currentScreen !== Screen.LANDING) {
        setCurrentScreen(Screen.LANDING); // Changed from LOGIN
      }
    }
  }
}, [user, loading, currentScreen]);

const handleSplashComplete = () => {
  if (user) {
    setCurrentScreen(Screen.DASHBOARD);
  } else {
    setCurrentScreen(Screen.LANDING);
  }
};
  // --- UPDATED: Async to handle Test Session Creation ---
  const handleStartMatch = async (config: SessionConfig) => {
    setSessionConfig(config);
    
    // TEST MODE: Skip matching for admins AND create a dummy session doc
    if (config.duration === SessionDuration.TEST && (user?.role === 'admin' || user?.role === 'dev')) {
      const botId = 'bot-' + Date.now();
      const botPartner: Partner = {
        id: botId,
        name: 'Test Bot',
        type: config.type
      };
      
      const testSessionId = `TEST_${user.id}_${Date.now()}`;
      
      try {
          // Create a real document so LiveSession listeners have something to sync with
          await setDoc(doc(db, 'sessions', testSessionId), {
              type: config.type,
              config,
              participants: [user.id, botId],
              participantInfo: [
                  { userId: user.id, displayName: user.name, photoURL: user.avatar || '' },
                  { userId: botId, displayName: 'Test Bot', photoURL: '' }
              ],
              createdAt: serverTimestamp(),
              started: true,
              phase: 'ICEBREAKER', // Initialize phase so timer starts
              status: 'active'
          });
          
          setPartner(botPartner);
          setSessionId(testSessionId);
          setCurrentScreen(Screen.SESSION); // Skip matching & negotiation
      } catch (e) {
          console.error("Failed to create test session:", e);
          alert("Error starting test mode. Check console.");
      }
    } else {
      // NORMAL USER FLOW (Unchanged)
      setCurrentScreen(Screen.MATCHING);
    }
  };

  const handleMatched = (partner: Partner, sessionId: string) => {
    console.log(`[APP] Match found! Partner:`, partner, 'SessionId:', sessionId);
    
    setPartner(partner);
    setSessionId(sessionId);
    
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
      onLogout={handleLogout} 
      onAdminClick={() => setCurrentScreen(Screen.ADMIN)}
    >
  {currentScreen === Screen.SPLASH && <Splash onComplete={handleSplashComplete} />}

{currentScreen === Screen.LANDING && (
  <Landing 
    onGetStarted={() => setCurrentScreen(Screen.LOGIN)}
    onSignIn={() => setCurrentScreen(Screen.LOGIN)}
  />
)}

{currentScreen === Screen.LOGIN && <Login onLogin={() => {}} />}

{currentScreen === Screen.DASHBOARD && user && (
  <Dashboard 
    user={user} 
    onStartMatch={handleStartMatch}
    onLogout={handleLogout} 
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
          sessionId={sessionId!} 
          userId={user.id}       
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
export default App;
