import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { User } from '../types';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface WithAuthProps {
  user: User | null;
  loading: boolean;
  error: Error | null;
}

export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P & WithAuthProps>
) => {
  const WithAuth: React.FC<P> = (props) => {
    const { user, loading, error } = useAuth();

    if (error) {
      return (
        <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={32} className="text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Critical Error</h3>
            <p className="text-slate-300 mb-4">
              Authentication system failed to load
            </p>
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

    return <WrappedComponent {...props} user={user} loading={loading} error={error} />;
  };

  return WithAuth;
};
