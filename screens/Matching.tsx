import React, { useEffect, useState } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection } from 'firebase/firestore';

interface MatchingProps {
  user: User;
  config: SessionConfig;
  onMatched: (partner: Partner, sessionId: string) => void;
  onCancel: () => void;
}

export const Matching: React.FC<MatchingProps> = ({ user, config, onMatched, onCancel }) => {
  const [statusText, setStatusText] = useState("Connecting to queue...");
  const [sessionIdToWatch, setSessionIdToWatch] = useState<string | null>(null);
  const [hasCalledOnMatch, setHasCalledOnMatch] = useState(false);

  // Use the matchmaking hook
  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, (partner, sessionId) => {
    console.log('[MATCHING] Received onMatch callback from hook:', partner, sessionId);
    setSessionIdToWatch(sessionId);
    // Don't call onMatched yet - wait for real-time listener
  });

  // Start the queue join on mount
  useEffect(() => {
    console.log('[MATCHING] Component mounted, starting search');
    joinQueue(config);
    
    return () => {
      console.log('[MATCHING] Component unmounting, canceling search');
      cancelSearch();
    };
  }, [config, joinQueue, cancelSearch]);

  // Listen to session document once we have a session ID
  // This ensures BOTH users are properly matched before proceeding
  useEffect(() => {
    if (! sessionIdToWatch || hasCalledOnMatch) {
      return;
    }

    console.log('[MATCHING] Watching session:', sessionIdToWatch);

    const sessionsColl = collection(db, 'sessions');
    const sessionRef = doc(sessionsColl, sessionIdToWatch);

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (! snap.exists()) {
          console.warn('[MATCHING] Session was deleted');
          return;
        }

        const sessionData = snap. data() as any;

        // Wait for session to have 2 participants (both users in)
        if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) {
          console. log('[MATCHING] Session has 2 participants, proceeding to negotiation');
          
          // Now we can safely call onMatched
          if (! hasCalledOnMatch) {
            setHasCalledOnMatch(true);
            
            // Get partner info
            const participantInfo: any[] = sessionData.participantInfo || [];
            const partnerInfo = participantInfo.find((p: any) => p.userId !== user.id);

            if (partnerInfo) {
              const partner: Partner = {
                id: partnerInfo.userId,
                name: partnerInfo.displayName || 'Partner',
                type: sessionData.config?. type || 'ANY',
              };

              console.log('[MATCHING] Calling onMatched with partner:', partner);
              onMatched(partner, sessionIdToWatch);
            }
          }
        }
      },
      (error) => {
        console.error('[MATCHING] Session listener error:', error);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [sessionIdToWatch, user. id, onMatched, hasCalledOnMatch]);

  // Update status text
  useEffect(() => {
    if (status === 'SEARCHING') {
      const msgs = [
        `Looking for ${config.type} sessions...`,
        `Finding ${config.duration}m duration partner...`,
        "Waiting for a match...",
      ];
      let i = 0;
      setStatusText(msgs[i]);
      const interval = setInterval(() => {
        i = (i + 1) % msgs.length;
        setStatusText(msgs[i]);
      }, 2000);
      return () => clearInterval(interval);
    } else if (status === 'MATCHED') {
      setStatusText("Match Found! Connecting.. .");
    }
  }, [status, config]);

  // Extract link from Firebase error if present
  const indexLink = error && error.includes('https://console.firebase.google.com') 
    ? error.match(/https:\/\/console\.firebase\.google\. com[^\s]*/)?.[0] 
    : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950">
      {error ?  (
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
              onClick={() => {
                cancelSearch();
                onCancel();
              }}
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
              <Loader2 size={64} className="text-blue-500 animate-spin" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">Finding Your Partner</h2>
          <p className="text-slate-300 mb-8 text-center max-w-sm">{statusText}</p>

          <button
            onClick={() => {
              cancelSearch();
              onCancel();
            }}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-semibold transition-colors"
          >
            Cancel Search
          </button>
        </>
      )}
    </div>
  );
};
