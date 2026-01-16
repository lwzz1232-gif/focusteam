import React, { createContext, useState, useContext, ReactNode } from 'react';
import { SessionConfig, Partner, SessionType, SessionDuration, SessionMode } from '../types';

interface SessionContextType {
  sessionConfig: SessionConfig;
  setSessionConfig: (config: SessionConfig) => void;
  partner: Partner | null;
  setPartner: (partner: Partner | null) => void;
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    type: SessionType.STUDY,
    duration: SessionDuration.MIN_30,
    mode: SessionMode.DEEP_WORK,
    preTalkMinutes: 5,
    postTalkMinutes: 5,
  });
  const [partner, setPartner] = useState<Partner | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);

  return (
    <SessionContext.Provider
      value={{
        sessionConfig,
        setSessionConfig,
        partner,
        setPartner,
        sessionId,
        setSessionId,
      }}
    >
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
