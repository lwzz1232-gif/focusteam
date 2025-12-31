import React from 'react';
import { Screen } from '../types';
import { Splash } from '../screens/Splash';
import { Login } from '../screens/Login';
import { Landing } from '../screens/Landing';
import { Dashboard } from '../screens/Dashboard';
import { Matching } from '../screens/Matching';
import { Negotiation } from '../screens/Negotiation';
import { LiveSession } from '../screens/LiveSession';
import { Admin } from '../screens/Admin';
import { User, SessionConfig, Partner } from '../types';

interface AppRouterProps {
  currentScreen: Screen;
  user: User | null;
  sessionConfig: SessionConfig;
  partner: Partner | null;
  sessionId: string | null;
  handleSplashComplete: () => void;
  handleStartMatch: (config: SessionConfig) => Promise<void>;
  handleMatched: (partner: Partner, sessionId: string) => void;
  handleNegotiationComplete: (finalConfig: SessionConfig) => void;
  handleCancelMatch: () => void;
  handleEndSession: () => void;
  handleLogout: () => Promise<void>;
  handleGetStarted: () => void;
  handleSignIn: () => void;
  handleLogin: () => void;
  handleBackToLanding: () => void;
  handleBackToDashboard: () => void;
}

export const AppRouter: React.FC<AppRouterProps> = ({
  currentScreen,
  user,
  sessionConfig,
  partner,
  sessionId,
  handleSplashComplete,
  handleStartMatch,
  handleMatched,
  handleNegotiationComplete,
  handleCancelMatch,
  handleEndSession,
  handleLogout,
  handleGetStarted,
  handleSignIn,
  handleLogin,
  handleBackToLanding,
  handleBackToDashboard
}) => {
  switch (currentScreen) {
    case Screen.SPLASH:
      return <Splash onComplete={handleSplashComplete} />;
    case Screen.LANDING:
      return <Landing onGetStarted={handleGetStarted} onSignIn={handleSignIn} />;
    case Screen.LOGIN:
      return <Login onLogin={handleLogin} onBack={handleBackToLanding} />;
    case Screen.DASHBOARD:
      return <Dashboard user={user} onStartMatch={handleStartMatch} onLogout={handleLogout} />;
    case Screen.MATCHING:
      return <Matching user={user} config={sessionConfig} onMatched={handleMatched} onCancel={handleCancelMatch} />;
    case Screen.NEGOTIATION:
      return <Negotiation config={sessionConfig} partner={partner} sessionId={sessionId} userId={user!.id} onNegotiationComplete={handleNegotiationComplete} onSkipMatch={handleCancelMatch} />;
    case Screen.SESSION:
      return <LiveSession user={user} partner={partner} config={sessionConfig} sessionId={sessionId} onEndSession={handleEndSession} />;
    case Screen.ADMIN:
      return <Admin onBack={handleBackToDashboard} />;
    default:
      return null; // Or some fallback UI
  }
};
