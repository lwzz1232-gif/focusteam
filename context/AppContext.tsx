import React, { createContext, useReducer, useContext, Dispatch } from 'react';
import { Screen, SessionConfig, Partner, User, SessionType, SessionDuration, SessionMode } from '../types';

// 1. Define State Shape
interface AppState {
  user: User | null;
  currentScreen: Screen;
  sessionConfig: SessionConfig;
  partner: Partner | null;
  sessionId: string | null;
}

// 2. Define Initial State
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

// 3. Define Actions
type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_SCREEN'; payload: Screen }
  | { type: 'START_MATCH'; payload: SessionConfig }
  | { type: 'MATCH_FOUND'; payload: { partner: Partner; sessionId: string } }
  | { type: 'NEGOTIATION_COMPLETE'; payload: SessionConfig }
  | { type: 'CANCEL_MATCH' }
  | { type: 'END_SESSION' }
  | { type: 'LOGOUT' };

// 4. Create the Reducer
const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.payload };
    case 'START_MATCH':
      return { ...state, sessionConfig: action.payload, currentScreen: Screen.MATCHING };
    case 'MATCH_FOUND':
      return { ...state, partner: action.payload.partner, sessionId: action.payload.sessionId, currentScreen: Screen.NEGOTIATION };
    case 'NEGOTIATION_COMPLETE':
      return { ...state, sessionConfig: action.payload, currentScreen: Screen.SESSION };
    case 'CANCEL_MATCH':
      return { ...state, partner: null, sessionId: null, currentScreen: Screen.DASHBOARD };
    case 'END_SESSION':
      return { ...state, partner: null, sessionId: null, currentScreen: Screen.DASHBOARD };
    case 'LOGOUT':
        return {
            ...initialState,
            currentScreen: Screen.LOGIN, // Redirect to login on logout
        };
    default:
      return state;
  }
};

// 5. Create the Context
interface AppContextProps {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AppContext = createContext<AppContextProps>({
  state: initialState,
  dispatch: () => null,
});

// 6. Create the Provider Component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

// 7. Create a custom hook for easy access
export const useAppContext = () => {
  return useContext(AppContext);
};