import React, { createContext, useState, useContext, ReactNode } from 'react';
import { SessionConfig, Partner, SessionType, SessionDuration, SessionMode, User } from '../types';
import { db } from '../utils/firebaseConfig';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

interface SessionContextType {
  sessionConfig: SessionConfig;
  setSessionConfig: (config: SessionConfig) => void;
  partner: Partner | null;
  setPartner: (partner: Partner | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
  handleStartMatch: (config: SessionConfig, user: User | null) => void;
  handleMatched: (partner: Partner, sessionId: string) => void;
  handleNegotiationComplete: (finalConfig: SessionConfig) => void;
  handleCancelMatch: () => void;
  handleEndSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    type: SessionType.STUDY,
    duration: SessionDuration.MIN_30,
    mode: SessionMode.DEEP_WORK,
    preTalkMinutes: 5,
    postTalkMinutes: 5
  });
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleStartMatch = async (config: SessionConfig, user: User | null) => {
    setSessionConfig(config);

    if (config.duration === SessionDuration.TEST && user && (user.role === 'admin' || user.role === 'dev')) {
      const botId = 'bot-' + Date.now();
      const botPartner: Partner = {
        id: botId,
        name: 'Test Bot',
        type: config.type
      };

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

          setPartner(botPartner);
          setSessionId(testSessionId);
          navigate('/session');
      } catch (e) {
          console.error("Failed to create test session:", e);
          alert("Error starting test mode. Check console.");
      }
    } else {
      navigate('/matching');
    }
  };

  const handleMatched = (partner: Partner, sessionId: string) => {
    setPartner(partner);
    setSessionId(sessionId);
    navigate('/negotiation');
  };

  const handleNegotiationComplete = (finalConfig: SessionConfig) => {
    setSessionConfig(finalConfig);
    navigate('/session');
  };

  const handleCancelMatch = () => {
    setPartner(null);
    setSessionId(null);
    navigate('/dashboard');
  };

  const handleEndSession = () => {
    setPartner(null);
    setSessionId(null);
    navigate('/dashboard');
  };

  return (
    <SessionContext.Provider value={{
      sessionConfig,
      setSessionConfig,
      partner,
      setPartner,
      sessionId,
      setSessionId,
      handleStartMatch,
      handleMatched,
      handleNegotiationComplete,
      handleCancelMatch,
      handleEndSession
    }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
};
