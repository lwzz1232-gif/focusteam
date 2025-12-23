import React, { createContext, useReducer, useContext, Dispatch } from 'react';
import { Screen, SessionConfig, Partner, User, SessionType, SessionDuration, SessionMode } from '../types';

// 1. STATE
interface AppState {
  user: User | null;
  currentScreen: Screen;
  sessionConfig: SessionConfig;
  partner: Partner | null;
  sessionId: string | null;
}

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

// 2. ACTIONS
export enum ActionType {
  SET_USER = 'SET_USER',
  SET_SCREEN = 'SET_SCREEN',
  START_MATCH = 'START_MATCH',
  MATCH_FOUND = 'MATCH_FOUND',
  NEGOTIATION_COMPLETE = 'NEGOTIATION_COMPLETE',
  CANCEL_MATCH = 'CANCEL_MATCH',
  END_SESSION = 'END_SESSION',
  LOGOUT = 'LOGOUT',
}

type Action =
  | { type: ActionType.SET_USER; payload: User | null }
  | { type: ActionType.SET_SCREEN; payload: Screen }
  | { type: ActionType.START_MATCH; payload: SessionConfig }
  | { type: ActionType.MATCH_FOUND; payload: { partner: Partner; sessionId: string } }
  | { type: ActionType.NEGOTIATION_COMPLETE; payload: SessionConfig }
  | { type: ActionType.CANCEL_MATCH }
  | { type: ActionType.END_SESSION }
  | { type: ActionType.LOGOUT };

// 3. REDUCER
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case ActionType.SET_USER:
      return { ...state, user: action.payload };
    case ActionType.SET_SCREEN:
      return { ...state, currentScreen: action.payload };
    case ActionType.START_MATCH:
      return { ...state, sessionConfig: action.payload, currentScreen: Screen.MATCHING };
    case ActionType.MATCH_FOUND:
      return { ...state, partner: action.payload.partner, sessionId: action.payload.sessionId, currentScreen: Screen.NEGOTIATION };
    case ActionType.NEGOTIATION_COMPLETE:
        return { ...state, sessionConfig: action.payload, currentScreen: Screen.SESSION };
    case ActionType.CANCEL_MATCH:
    case ActionType.END_SESSION:
        return { ...state, partner: null, sessionId: null, currentScreen: Screen.DASHBOARD };
    case ActionType.LOGOUT:
        return { ...initialState, currentScreen: Screen.LOGIN };
    default:
      return state;
  }
};

// 4. CONTEXT & PROVIDER
const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
