import React, { useEffect, useState, useRef } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { Loader2, AlertTriangle, ExternalLink } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

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
  
  // NEW: Ref to track our public lobby document
  const lobbyTicketRef = useRef<string | null>(null);

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
      // NEW: Cleanup lobby ticket if it exists
      if (lobbyTicketRef.current) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
      }
    };
  }, [config, joinQueue, cancelSearch]);

  // --- NEW: LOBBY BROADCAST LOGIC ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Only start timer if we are actively searching and haven't found a session yet
    if (status === 'SEARCHING' && !sessionIdToWatch) {
        timeoutId = setTimeout(async () => {
            try {
                // Double check we are still searching before posting
                if (!sessionIdToWatch && !lobbyTicketRef.current) {
                    console.log("[MATCHING] 10s passed. Broadcasting to Live Lobby...");
                    
                    const lobbyRef = await addDoc(collection(db, 'waiting_room'), {
                        userId: user.id,
                        userName: user.name,
                        config: config,
                        createdAt: serverTimestamp()
                    });
                    
                    lobbyTicketRef.current = lobbyRef.id;
                    setStatusText("Broadcasted to Lobby. Waiting for joiner...");
                }
            } catch (e) {
                console.error("Lobby broadcast failed", e);
            }
        }, 10000); // 10 Seconds
    } else {
        // If status changes (e.g. MATCHED) or session found, remove from lobby
        if (lobbyTicketRef.current) {
            deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
            lobbyTicketRef.current = null;
        }
    }

    return () => clearTimeout(timeoutId);
  }, [status, sessionIdToWatch, user, config]);

  // Listen to session document once we have a session ID
  useEffect(() => {
    if (!sessionIdToWatch || hasCalledOnMatch) {
      return;
    }

    console.log('[MATCHING] Watching session:', sessionIdToWatch);

    const sessionsColl = collection(db, 'sessions');
    const sessionRef = doc(sessionsColl, sessionIdToWatch);

    const unsubscribe = onSnapshot(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          console.warn('[MATCHING] Session was deleted');
          return;
        }

        const sessionData = snap.data() as any;

        console.log('[MATCHING] Session update:', {
          participants: sessionData.participants?.length || 0,
          started: sessionData.started
        });

        // Check if already started
        if (sessionData.started === true && !hasCalledOnMatch) {
          console.log('[MATCHING] Session already started, joining immediately');
          setHasCalledOnMatch(true);
          
          const participantInfo: any[] = sessionData.participantInfo || [];
          const partnerInfo = participantInfo.find((p: any) => p.userId !== user.id);

          if (partnerInfo) {
            const partner: Partner = {
              id: partnerInfo.userId,
              name: partnerInfo.displayName || 'Partner',
              type: sessionData.config?.type || 'ANY',
            };

            onMatched(partner, sessionIdToWatch);
          }
          return;
        }

        // Wait for session to have 2 participants
        if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) {
          console.log('[MATCHING] Session has 2 participants, proceeding to negotiation');
          
          if (!hasCalledOnMatch) {
            setHasCalledOnMatch(true);
            
            const participantInfo: any[] = sessionData.participantInfo || [];
            const partnerInfo = participantInfo.find((p: any) => p.userId !== user.id);

            if (partnerInfo) {
              const partner: Partner = {
                id: partnerInfo.userId,
                name: partnerInfo.displayName || 'Partner',
                type: sessionData.config?.type || 'ANY',
              };

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
  }, [sessionIdToWatch, user.id, onMatched, hasCalledOnMatch]);

  // Update status text (Only if we haven't broadcasted to lobby yet)
  useEffect(() => {
    if (status === 'SEARCHING' && !lobbyTicketRef.current) {
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
      setStatusText("Match Found! Connecting...");
    }
  }, [status, config]);

  // Extract link from Firebase error if present
  const indexLink = error && error.includes('https://console.firebase.google.com') 
    ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] 
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
