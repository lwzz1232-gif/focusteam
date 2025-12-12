import React, { useEffect, useState, useRef } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { Loader2, AlertTriangle, ExternalLink, Radio } from 'lucide-react';
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
  
  // CHANGED: Use State so the UI actually updates when broadcast happens
  const [isInLobby, setIsInLobby] = useState(false);
  const lobbyTicketRef = useRef<string | null>(null);

  // Use the matchmaking hook
  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, (partner, sessionId) => {
    console.log('[MATCHING] Received onMatch callback from hook:', partner, sessionId);
    setSessionIdToWatch(sessionId);
  });

  // Start the queue join on mount
  useEffect(() => {
    console.log('[MATCHING] Component mounted, starting search');
    joinQueue(config);
    
    return () => {
      console.log('[MATCHING] Component unmounting, canceling search');
      cancelSearch();
      // Cleanup lobby ticket if it exists
      if (lobbyTicketRef.current) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
      }
    };
  }, [config, joinQueue, cancelSearch]);

  // --- LOBBY BROADCAST LOGIC ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Only start timer if we are actively searching and NOT in lobby yet
    if (status === 'SEARCHING' && !sessionIdToWatch && !isInLobby) {
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
                    setIsInLobby(true); // <--- This triggers the UI update
                }
            } catch (e) {
                console.error("Lobby broadcast failed", e);
            }
        }, 10000); // 10 Seconds
    } 
    // If we match, remove from lobby
    else if (lobbyTicketRef.current && (sessionIdToWatch || status === 'MATCHED')) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
        lobbyTicketRef.current = null;
    }

    return () => clearTimeout(timeoutId);
  }, [status, sessionIdToWatch, user, config, isInLobby]);

  // Listen to session document
  useEffect(() => {
    if (!sessionIdToWatch || hasCalledOnMatch) return;

    const sessionRef = doc(collection(db, 'sessions'), sessionIdToWatch);

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const sessionData = snap.data() as any;

      if (sessionData.started === true && !hasCalledOnMatch) {
        setHasCalledOnMatch(true);
        const partnerInfo = sessionData.participantInfo?.find((p: any) => p.userId !== user.id);
        if (partnerInfo) {
          onMatched({
            id: partnerInfo.userId,
            name: partnerInfo.displayName || 'Partner',
            type: sessionData.config?.type || 'ANY',
          }, sessionIdToWatch);
        }
        return;
      }

      if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) {
        if (!hasCalledOnMatch) {
          setHasCalledOnMatch(true);
          const partnerInfo = sessionData.participantInfo?.find((p: any) => p.userId !== user.id);
          if (partnerInfo) {
            onMatched({
              id: partnerInfo.userId,
              name: partnerInfo.displayName || 'Partner',
              type: sessionData.config?.type || 'ANY',
            }, sessionIdToWatch);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [sessionIdToWatch, user.id, onMatched, hasCalledOnMatch]);

  // Update status text
  useEffect(() => {
    // STOP rotating text if we are in the lobby
    if (isInLobby) {
        setStatusText("Visible in Public Lobby. Waiting for someone to join you...");
        return;
    }

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
      setStatusText("Match Found! Connecting...");
    }
  }, [status, config, isInLobby]);

  const indexLink = error && error.includes('https://console.firebase.google.com') 
    ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] 
    : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 relative overflow-hidden">
      
      {/* Background Pulse Effect */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`w-96 h-96 rounded-full animate-ping opacity-20 ${isInLobby ? 'bg-emerald-500/10' : 'bg-blue-500/10'}`}></div>
      </div>

      {error ?  (
        <div className="max-w-md w-full bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center animate-in fade-in zoom-in">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connection Error</h3>
          <p className="text-slate-300 mb-4 text-sm">{error}</p>
          {indexLink && (
            <a href={indexLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors mb-4">
              <ExternalLink size={16} /> Create Missing Index
            </a>
          )}
          <button onClick={() => { cancelSearch(); onCancel(); }} className="text-slate-400 hover:text-white underline">Go Back</button>
        </div>
      ) : (
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="relative mb-12">
            <div className={`absolute inset-0 blur-3xl rounded-full animate-pulse ${isInLobby ? 'bg-emerald-500/20' : 'bg-blue-500/20'}`}></div>
            <div className={`relative w-32 h-32 rounded-full border-4 flex items-center justify-center ${isInLobby ? 'border-emerald-500/30' : 'border-blue-500/30'}`}>
              {isInLobby ? (
                  <Radio size={64} className="text-emerald-500 animate-pulse" />
              ) : (
                  <Loader2 size={64} className="text-blue-500 animate-spin" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-4">
              {isInLobby ? "Live in Lobby" : "Finding Your Partner"}
          </h2>
          
          {isInLobby && (
              <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="text-emerald-400 text-sm font-medium">Visible to everyone</span>
              </div>
          )}

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
        </div>
      )}
    </div>
  );
};
