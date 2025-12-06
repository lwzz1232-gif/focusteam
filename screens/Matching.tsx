import React, { useEffect, useState } from 'react';
import { SessionConfig, Partner, SessionMode, User } from '../types';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';

interface MatchingProps {
  user: User;
  config: SessionConfig;
  onMatched: (partner: Partner) => void;
  onCancel: () => void;
}

export const Matching: React.FC<MatchingProps> = ({ user, config, onMatched, onCancel }) => {
  const [statusText, setStatusText] = useState("Connecting to queue...");

  // Use the real Hook
  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, onMatched);

  useEffect(() => {
    joinQueue(config);
    return () => { cancelSearch(); };
  }, []);

  useEffect(() => {
    if (status === 'SEARCHING') {
        const msgs = [
            `Filtering for ${config.type} sessions...`,
            `Looking for ${config.duration}m duration...`,
            "Waiting for a partner..."
        ];
        let i = 0;
        const interval = setInterval(() => {
            setStatusText(msgs[i % msgs.length]);
            i++;
        }, 2000);
        return () => clearInterval(interval);
    } else if (status === 'MATCHED') {
        setStatusText("Match Found! Connecting...");
    }
  }, [status, config]);

  // Extract link from Firebase error if present
  const indexLink = error && error.includes('https://console.firebase.google.com') 
    ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] 
    : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
      
      {error ? (
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center animate-in fade-in zoom-in">
             <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                 <AlertTriangle size={32} className="text-red-500" />
             </div>
             <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
             <p className="text-slate-300 mb-4 text-sm">{error}</p>
             
             {indexLink && (
                 <a 
                    href={indexLink} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors mb-4"
                 >
                    <ExternalLink size={16} /> Create Missing Index
                 </a>
             )}

             <div>
                <button 
                    onClick={() => { cancelSearch(); onCancel(); }}
                    className="text-slate-400 hover:text-white underline"
                >
                    Go Back
                </button>
             </div>
        </div>
      ) : (
        <>
            <div className="relative mb-12">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full animate-pulse"></div>
                <div className="relative w-32 h-32 rounded-full border-4 border-blue-500/30 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-blue-500 flex items-center justify-center animate-ping opacity-20 absolute"></div>
                <Loader2 size={48} className="text-blue-400 animate-spin" />
                </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2">Finding Partner</h2>
            <p className="text-slate-400 mb-8">{statusText}</p>

            <div className="flex gap-4 text-sm text-slate-500 bg-slate-900/50 p-4 rounded-lg">
                <div className="flex flex-col items-center px-4 border-r border-slate-800">
                <span className="font-medium text-slate-300">{config.type}</span>
                <span>Focus</span>
                </div>
                <div className="flex flex-col items-center px-4 border-r border-slate-800">
                <span className="font-medium text-slate-300">{config.duration}m</span>
                <span>Duration</span>
                </div>
                <div className="flex flex-col items-center px-4">
                <span className="font-medium text-slate-300">
                    {config.mode === SessionMode.POMODORO ? '25/5' : 'Deep'}
                </span>
                <span>Mode</span>
                </div>
            </div>

            <button 
                onClick={() => { cancelSearch(); onCancel(); }}
                className="mt-12 text-slate-500 hover:text-white transition-colors underline decoration-slate-700 underline-offset-4"
            >
                Cancel Search
            </button>
        </>
      )}
    </div>
  );
};