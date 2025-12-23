import React, { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Landing } from './screens/Landing';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { Screen, SessionConfig, Partner, SessionDuration, User } from './types';
import { db } from './utils/firebaseConfig';
import { doc, setDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { useAppContext, ActionType } from './context/AppContext';
import withAuth from '../hocs/withAuth';

interface AppProps {
  user: User | null;
}

const App: React.FC<AppProps> = ({ user }) => {
  const { state, dispatch } = useAppContext();
  const { currentScreen, sessionConfig, partner, sessionId } = state;

  useEffect(() => {
    dispatch({ type: ActionType.SET_USER, payload: user });
  }, [user, dispatch]);

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      dispatch({ type: ActionType.LOGOUT });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bannedUntil && data.bannedUntil > Date.now()) {
                const reason = data.banReason || "Violation of Terms";
                alert(`You have been banned.\nReason: ${reason}`);
                handleLogout();
            }
        }
    });

    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      if (currentScreen === Screen.LOGIN || currentScreen === Screen.LANDING) {
        dispatch({ type: ActionType.SET_SCREEN, payload: Screen.DASHBOARD });
      }
    } else {
      if (currentScreen !== Screen.SPLASH && currentScreen !== Screen.LOGIN && currentScreen !== Screen.LANDING) {
        dispatch({ type: ActionType.SET_SCREEN, payload: Screen.LOGIN });
      }
    }
  }, [user, currentScreen, dispatch]);

  const handleSplashComplete = () => {
    if (user) {
      dispatch({ type: ActionType.SET_SCREEN, payload: Screen.DASHBOARD });
    } else {
      dispatch({ type: ActionType.SET_SCREEN, payload: Screen.LANDING });
    }
  };

  const handleStartMatch = async (config: SessionConfig) => {
    if (config.duration === SessionDuration.TEST && (user?.role === 'admin' || user?.role === 'dev')) {
      const botId = 'bot-' + Date.now();
      const botPartner: Partner = { id: botId, name: 'Test Bot', type: config.type };
      const testSessionId = `TEST_${user.id}_${Date.now()}`;
      try {
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
              phase: 'ICEBREAKER',
              status: 'active'
          });
          dispatch({ type: ActionType.MATCH_FOUND, payload: { partner: botPartner, sessionId: testSessionId } });
      } catch (e) {
          console.error("Failed to create test session:", e);
          alert("Error starting test mode. Check console.");
      }
    } else {
      dispatch({ type: ActionType.START_MATCH, payload: config });
    }
  };

  if (currentScreen === Screen.LANDING) {
    return <Landing onGetStarted={() => dispatch({ type: ActionType.SET_SCREEN, payload: Screen.LOGIN })} onSignIn={() => dispatch({ type: ActionType.SET_SCREEN, payload: Screen.LOGIN })} />;
  }

  return (
    <Layout
      user={user}
      currentScreen={currentScreen}
      onLogout={handleLogout}
      onAdminClick={() => dispatch({ type: ActionType.SET_SCREEN, payload: Screen.ADMIN })}
    >
      {currentScreen === Screen.SPLASH && <Splash onComplete={handleSplashComplete} />}
      {currentScreen === Screen.LOGIN && <Login onBack={() => dispatch({ type: ActionType.SET_SCREEN, payload: Screen.LANDING })} />}
      {currentScreen === Screen.DASHBOARD && user && <Dashboard user={user} onStartMatch={handleStartMatch} onLogout={handleLogout} />}
      {currentScreen === Screen.MATCHING && user && (
        <Matching
          user={user}
          config={sessionConfig}
          onMatched={(partner, sessionId) => dispatch({ type: ActionType.MATCH_FOUND, payload: { partner, sessionId } })}
          onCancel={() => dispatch({ type: ActionType.CANCEL_MATCH })}
        />
      )}
      {currentScreen === Screen.NEGOTIATION && partner && user && (
        <Negotiation
          config={sessionConfig}
          partner={partner}
          sessionId={sessionId!}
          userId={user.id}
          onNegotiationComplete={(finalConfig) => dispatch({ type: ActionType.NEGOTIATION_COMPLETE, payload: finalConfig })}
          onSkipMatch={() => dispatch({ type: ActionType.CANCEL_MATCH })}
        />
      )}
      {currentScreen === Screen.SESSION && user && partner && sessionId && (
        <LiveSession
          user={user}
          partner={partner}
          config={sessionConfig}
          sessionId={sessionId}
          onEndSession={() => dispatch({ type: ActionType.END_SESSION })}
        />
      )}
      {currentScreen === Screen.ADMIN && <Admin onBack={() => dispatch({ type: ActionType.SET_SCREEN, payload: Screen.DASHBOARD })} />}
    </Layout>
  );
};

export default withAuth(App);
