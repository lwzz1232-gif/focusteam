import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useAppContext } from '../context/AppContext';
import { User } from '../types';
import { AlertTriangle, RefreshCw } from 'lucide-react';

// A Higher-Order Component to wrap the application and provide auth state
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>
): React.FC<P> => {
  const WithAuthComponent: React.FC<P> = (props) => {
    const { user, loading, error } = useAuth();
    const { dispatch } = useAppContext();

    useEffect(() => {
      // When auth state changes, update the global context
      dispatch({ type: 'SET_USER', payload: user as User | null });
    }, [user, dispatch]);

    if (loading) {
      // You can replace this with a more sophisticated loading spinner
      return (
        <div className="w-screen h-screen bg-slate-950 flex items-center justify-center">
          <p className="text-white">Loading...</p>
        </div>
      );
    }

    if (error) {
       return (
        <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Authentication Error</h3>
            <p className="text-slate-300 mb-4">{error}</p>
            <button
                onClick={() => window.location.reload()}
                className="w-full bg-white text-black font-bold py-3 rounded-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
            >
                <RefreshCw size={18} /> Reload App
            </button>
            </div>
        </div>
        );
    }

    return <WrappedComponent {...props} />;
  };

  return WithAuthComponent;
};
