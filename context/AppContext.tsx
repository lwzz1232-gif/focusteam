import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { Screen, SessionConfig, Partner, User, SessionType, SessionDuration, SessionMode } from '../types';

// 1. Define State and Action Types
interface State {
  user: User | null;
  currentScreen: Screen;
  sessionConfig: SessionConfig;
  partner: Partner | null;
  sessionId: string | null;
}

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SCREEN'; payload: Screen }
  | { type: 'START_MATCH'; payload: SessionConfig }
  | { type: 'START_TEST_SESSION'; payload: { partner: Partner, sessionId: string, config: SessionConfig } }
  | { type: 'MATCH_FOUND'; payload: { partner: Partner; sessionId: string } }
  | { type: 'NEGOTIATION_COMPLETE'; payload: SessionConfig }
  | { type: 'END_SESSION' }
  | { type: 'CANCEL_MATCH' }
  | { type: 'LOGOUT' };

// 2. Initial State
const initialState: State = {
  user: null,
  currentScreen: Screen.SPLASH,
  sessionConfig: {
    type: SessionType.STUDY,
    duration: SessionDuration.MIN_30,
    mode: SessionMode.DEEP_WORK,
    preTalkMinutes: 5,
    postTalkMinutes: 5,
  },
  partner: null,
  sessionId: null,
};

// 3. Reducer
const appReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'START_MATCH':
      return { ...state, sessionConfig: action.payload, currentScreen: Screen.MATCHING };
    case 'START_TEST_SESSION':
      return {
        ...state,
        partner: action.payload.partner,
        sessionId: action.payload.sessionId,
        sessionConfig: action.payload.config,
        currentScreen: Screen.SESSION
      };
    case 'MATCH_FOUND':
      return { ...state, partner: action.payload.partner, sessionId: action.payload.sessionId, currentScreen: Screen.NEGOTIATION };
    case 'NEGOTIATION_COMPLETE':
        return { ...state, sessionConfig: action.payload, currentScreen: Screen.SESSION };
    case 'END_SESSION':
    case 'CANCEL_MATCH':
      return { ...state, partner: null, sessionId: null, currentScreen: Screen.DASHBOARD };
    case 'LOGOUT':
        return {
            ...initialState,
            currentScreen: Screen.LOGIN,
        }
    default:
      return state;
  }
};

// 4. Create Context
interface AppContextProps {
  state: State;
  dispatch: React.Dispatch<Action>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// 5. AppProvider Component
interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// 6. Custom Hook
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
