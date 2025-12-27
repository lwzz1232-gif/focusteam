import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import { Screen, SessionConfig, Partner, SessionType, SessionDuration, SessionMode, User } from '../types';

interface AppState {
  user: User | null;
  currentScreen: Screen;
  sessionConfig: SessionConfig;
  partner: Partner | null;
  sessionId: string | null;
}

type AppAction =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_CURRENT_SCREEN'; payload: Screen }
  | { type: 'SET_SESSION_CONFIG'; payload: SessionConfig }
  | { type: 'SET_PARTNER'; payload: Partner | null }
  | { type: 'SET_SESSION_ID'; payload: string | null }
  | { type: 'LOGOUT' };

const initialState: AppState = {
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

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}>({
  state: initialState,
  dispatch: () => null,
});

const appReducer = (state: AppState, action: AppAction): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_CURRENT_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'SET_SESSION_CONFIG':
      return { ...state, sessionConfig: action.payload };
    case 'SET_PARTNER':
      return { ...state, partner: action.payload };
    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };
    case 'LOGOUT':
      return { ...initialState, currentScreen: Screen.LOGIN };
    default:
      return state;
  }
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => useContext(AppContext);
