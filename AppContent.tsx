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
import { Screen, SessionConfig, Partner, SessionType, SessionDuration, SessionMode, User } from './types';
import { db } from './utils/firebaseConfig';
import { onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import { useAppContext } from './context/AppContext';

interface AppContentProps {
  user: User | null;
  loading: boolean;
}

export const AppContent: React.FC<AppContentProps> = ({ user, loading }) => {
  const { state, dispatch } = useAppContext();
  const { currentScreen, sessionConfig, partner, sessionId } = state;

  useEffect(() => {
    dispatch({ type: 'SET_USER', payload: user });
  }, [user, dispatch]);

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.bannedUntil && data.bannedUntil > Date.now()) {
          const reason = data.banReason || 'Violation of Terms';
          alert(`You have been banned.\nReason: ${reason}`);
          handleLogout();
        }
      }
    });

    return () => unsub();
  }, [user?.id]);

  useEffect(() => {
    if (!loading) {
      if (user) {
        if (currentScreen === Screen.LOGIN || currentScreen === Screen.LANDING) {
          dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.DASHBOARD });
        }
      } else {
        if (
          currentScreen !== Screen.SPLASH &&
          currentScreen !== Screen.LOGIN &&
          currentScreen !== Screen.LANDING
        ) {
          dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.LOGIN });
        }
      }
    }
  }, [user, loading, currentScreen, dispatch]);

  const handleSplashComplete = () => {
    if (user) {
      dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.DASHBOARD });
    } else {
      dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.LANDING });
    }
  };

  const handleStartMatch = async (config: SessionConfig) => {
    dispatch({ type: 'SET_SESSION_CONFIG', payload: config });

    if (
      config.duration === SessionDuration.TEST &&
      (user?.role === 'admin' || user?.role === 'dev')
    ) {
      const botId = 'bot-' + Date.now();
      const botPartner: Partner = {
        id: botId,
        name: 'Test Bot',
        type: config.type,
      };

      const testSessionId = `TEST_${user.id}_${Date.now()}`;

      try {
        await setDoc(doc(db, 'sessions', testSessionId), {
          type: config.type,
          config,
          participants: [user.id, botId],
          participantInfo: [
            { userId: user.id, displayName: user.name, photoURL: user.avatar || '' },
            { userId: botId, displayName: 'Test Bot', photoURL: '' },
          ],
          createdAt: serverTimestamp(),
          started: true,
          phase: 'ICEBREAKER',
          status: 'active',
        });

        dispatch({ type: 'SET_PARTNER', payload: botPartner });
        dispatch({ type: 'SET_SESSION_ID', payload: testSessionId });
        dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.SESSION });
      } catch (e) {
        console.error('Failed to create test session:', e);
        alert('Error starting test mode. Check console.');
      }
    } else {
      dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.MATCHING });
    }
  };

  const handleMatched = (partner: Partner, sessionId: string) => {
    dispatch({ type: 'SET_PARTNER', payload: partner });
    dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
    dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.NEGOTIATION });
  };

  const handleNegotiationComplete = (finalConfig: SessionConfig) => {
    dispatch({ type: 'SET_SESSION_CONFIG', payload: finalConfig });
    dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.SESSION });
  };

  const handleCancelMatch = () => {
    dispatch({ type: 'SET_PARTNER', payload: null });
    dispatch({ type: 'SET_SESSION_ID', payload: null });
    dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.DASHBOARD });
  };

  const handleEndSession = () => {
    dispatch({ type: 'SET_PARTNER', payload: null });
    dispatch({ type: 'SET_SESSION_ID', payload: null });
    dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.DASHBOARD });
  };

  if (currentScreen === Screen.LANDING) {
    return (
      <Landing
        onGetStarted={() => dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.LOGIN })}
        onSignIn={() => dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.LOGIN })}
      />
    );
  }

  return (
    <Layout
      user={user}
      currentScreen={currentScreen}
      onLogout={handleLogout}
      onAdminClick={() => dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.ADMIN })}
    >
      {currentScreen === Screen.SPLASH && <Splash onComplete={handleSplashComplete} />}

      {currentScreen === Screen.LOGIN && (
        <Login
          onLogin={() => {}}
          onBack={() => dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.LANDING })}
        />
      )}

      {currentScreen === Screen.DASHBOARD && user && (
        <Dashboard user={user} onStartMatch={handleStartMatch} onLogout={handleLogout} />
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

      {currentScreen === Screen.ADMIN && (
        <Admin onBack={() => dispatch({ type: 'SET_CURRENT_SCREEN', payload: Screen.DASHBOARD })} />
      )}
    </Layout>
  );
};
