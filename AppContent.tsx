import React, { useEffect } from 'react';
import { useAppContext } from './context/AppContext';
import { Layout } from './components/Layout';
import { Splash } from './screens/Splash';
import { Login } from './screens/Login';
import { Landing } from './screens/Landing';
import { Dashboard } from './screens/Dashboard';
import { Matching } from './screens/Matching';
import { Negotiation } from './screens/Negotiation';
import { LiveSession } from './screens/LiveSession';
import { Admin } from './screens/Admin';
import { Screen } from './types';
import { getAuth, signOut } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from './utils/firebaseConfig';

export const AppContent: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { user, currentScreen, sessionConfig, partner, sessionId } = state;

  // Screen transition logic based on auth state
  useEffect(() => {
    if (user) {
      // If user is logged in, they shouldn't be on splash, landing, or login
      if (currentScreen === Screen.SPLASH || currentScreen === Screen.LANDING || currentScreen === Screen.LOGIN) {
        dispatch({ type: 'SET_SCREEN', payload: Screen.DASHBOARD });
      }
    } else {
      // If user is logged out, they should only be on public screens
      if (currentScreen !== Screen.SPLASH && currentScreen !== Screen.LANDING && currentScreen !== Screen.LOGIN) {
        dispatch({ type: 'SET_SCREEN', payload: Screen.LOGIN });
      }
    }
  }, [user, currentScreen, dispatch]);

  // Logout handler
  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      dispatch({ type: 'LOGOUT' });
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Instant ban check
  useEffect(() => {
    if (!user?.id) return;
    const unsub = onSnapshot(doc(db, 'users', user.id), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.bannedUntil && data.bannedUntil > Date.now()) {
                const reason = data.banReason || "Violation of Terms";
                alert(`You have been banned.\nReason: ${reason}`);
                handleLogout(); // Force logout
            }
        }
    });
    return () => unsub();
  }, [user?.id, handleLogout]);


  const handleSplashComplete = () => {
    if (user) {
        dispatch({ type: 'SET_SCREEN', payload: Screen.DASHBOARD });
    } else {
        dispatch({ type: 'SET_SCREEN', payload: Screen.LANDING });
    }
  };

  // Render splash/landing without Layout
  if (currentScreen === Screen.SPLASH) {
    return <Splash onComplete={handleSplashComplete} />;
  }

  if (currentScreen === Screen.LANDING) {
    return (
      <Landing
        onGetStarted={() => dispatch({ type: 'SET_SCREEN', payload: Screen.LOGIN })}
        onSignIn={() => dispatch({ type: 'SET_SCREEN', payload: Screen.LOGIN })}
      />
    );
  }

  return (
    <Layout
      user={user}
      currentScreen={currentScreen}
      onLogout={handleLogout}
      onAdminClick={() => dispatch({ type: 'SET_SCREEN', payload: Screen.ADMIN })}
    >
      {currentScreen === Screen.LOGIN && (
        <Login
          onLogin={() => {}} // onLogin is now handled by useAuth + useEffect
          onBack={() => dispatch({ type: 'SET_SCREEN', payload: Screen.LANDING })}
        />
      )}
      {currentScreen === Screen.DASHBOARD && user && <Dashboard user={user} />}
      {currentScreen === Screen.MATCHING && user && <Matching user={user} config={sessionConfig} />}
      {currentScreen === Screen.NEGOTIATION && partner && user && sessionId && (
        <Negotiation
          config={sessionConfig}
          partner={partner}
          sessionId={sessionId}
          userId={user.id}
        />
      )}
      {currentScreen === Screen.SESSION && user && partner && sessionId && (
        <LiveSession
          user={user}
          partner={partner}
          config={sessionConfig}
          sessionId={sessionId}
        />
      )}
      {currentScreen === Screen.ADMIN && <Admin onBack={() => dispatch({ type: 'SET_SCREEN', payload: Screen.DASHBOARD })} />}
    </Layout>
  );
};
