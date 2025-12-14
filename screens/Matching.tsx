import React, { useEffect, useState, useRef } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { Loader2, AlertTriangle, ExternalLink, Wifi, Globe, Users } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// --- SUB-COMPONENT: The "Heatmap" Dots ---
// This creates random "user signals" appearing on the radar
const ActiveNodes = () => {
  const [nodes, setNodes] = useState<{id: number, top: string, left: string, delay: string}[]>([]);

  useEffect(() => {
    // Generate 12 random "users" on the map
    const newNodes = Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      top: `${Math.random() * 80 + 10}%`,
      left: `${Math.random() * 80 + 10}%`,
      delay: `${Math.random() * 2}s`
    }));
    setNodes(newNodes);
  }, []);

  return (
    <div className="absolute inset-0 rounded-full overflow-hidden opacity-50 pointer-events-none">
      {nodes.map(n => (
        <div 
          key={n.id}
          className="absolute w-2 h-2 bg-blue-400 rounded-full animate-ping"
          style={{ top: n.top, left: n.left, animationDuration: '3s', animationDelay: n.delay }}
        />
      ))}
    </div>
  );
};

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
  
  const [isInLobby, setIsInLobby] = useState(false);
  const lobbyTicketRef = useRef<string | null>(null);

  // Use the matchmaking hook
  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, (partner, sessionId) => {
    setSessionIdToWatch(sessionId);
  });

  // Start the queue join on mount
  useEffect(() => {
    joinQueue(config);
    return () => {
      cancelSearch();
      if (lobbyTicketRef.current) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
      }
    };
  }, [config, joinQueue, cancelSearch]);

  // --- LOBBY BROADCAST LOGIC ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    if (status === 'SEARCHING' && !sessionIdToWatch && !isInLobby) {
        timeoutId = setTimeout(async () => {
            if (!isActive || sessionIdToWatch || lobbyTicketRef.current) return;
            try {
                const lobbyRef = await addDoc(collection(db, 'waiting_room'), {
                    userId: user.id,
                    userName: user.name,
                    config: config,
                    createdAt: serverTimestamp()
                });
                
                if (!isActive) {
                     deleteDoc(lobbyRef).catch(console.error);
                } else {
                    lobbyTicketRef.current = lobbyRef.id;
                    setIsInLobby(true); 
                }
            } catch (e) {
                console.error("Lobby broadcast failed", e);
            }
        }, 10000); // 10 Seconds
    } 
    else if (lobbyTicketRef.current && (sessionIdToWatch || status === 'MATCHED')) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
        lobbyTicketRef.current = null;
    }

    return () => {
        clearTimeout(timeoutId);
        isActive = false; 
    };
  }, [status, sessionIdToWatch, user, config, isInLobby]);

  // Listen to session document
  useEffect(() => {
    if (!sessionIdToWatch || hasCalledOnMatch) return;
    const sessionRef = doc(collection(db, 'sessions'), sessionIdToWatch);
    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const sessionData = snap.data() as any;

      const triggerMatch = () => {
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
      };

      if (sessionData.started === true) triggerMatch();
      if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) triggerMatch();
    });
    return () => unsubscribe();
  }, [sessionIdToWatch, user.id, onMatched, hasCalledOnMatch]);

  // Update status text
  useEffect(() => {
    if (isInLobby) {
        setStatusText("Visible in Global Lobby. Establishing uplink...");
        return;
    }
    if (status === 'SEARCHING') {
      const msgs = [
        `Scanning for ${config.type}...`,
        `Ping: ${Math.floor(Math.random() * 40 + 10)}ms [Region: Global]`,
        "Handshaking with peer network...",
      ];
      let i = 0;
      setStatusText(msgs[i]);
      const interval = setInterval(() => {
        i = (i + 1) % msgs.length;
        setStatusText(msgs[i]);
      }, 2500);
      return () => clearInterval(interval);
    } else if (status === 'MATCHED') {
      setStatusText("Signal Locked. Initializing Session.");
    }
  }, [status, config, isInLobby]);

  const indexLink = error && error.includes('https://console.firebase.google.com') 
    ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] 
    : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-black relative overflow-hidden h-full">
      
      {/* CSS For Radar Sweep */}
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .radar-sweep {
          background: conic-gradient(from 0deg, transparent 0deg, rgba(59, 130, 246, 0.4) 360deg);
          animation: spin 3s linear infinite;
        }
        .radar-sweep-green {
          background: conic-gradient(from 0deg, transparent 0deg, rgba(16, 185, 129, 0.4) 360deg);
          animation: spin 3s linear infinite;
        }
      `}</style>

      {/* ERROR STATE */}
      {error ?  (
        <div className="relative z-20 max-w-md w-full bg-red-950/40 border border-red-500/50 rounded-xl p-6 text-center animate-in fade-in zoom-in backdrop-blur-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Connection Severed</h3>
          <p className="text-red-200 mb-4 text-sm font-mono">{error}</p>
          {indexLink && (
            <a href={indexLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors mb-4">
              <ExternalLink size={16} /> Fix Database Index
            </a>
          )}
          <button onClick={() => { cancelSearch(); onCancel(); }} className="text-slate-400 hover:text-white underline text-xs uppercase tracking-wider">Return to Base</button>
        </div>
      ) : (
        // SCANNING STATE
        <div className="relative z-10 flex flex-col items-center w-full max-w-lg">
          
          {/* RADAR VISUAL CONTAINER */}
          <div className="relative w-80 h-80 mb-12 flex items-center justify-center">
            
            {/* Outer Rings */}
            <div className={`absolute inset-0 rounded-full border border-dashed animate-[spin_60s_linear_infinite] opacity-20 ${isInLobby ? 'border-emerald-500' : 'border-blue-500'}`}></div>
            <div className={`absolute inset-4 rounded-full border border-dashed animate-[spin_40s_linear_infinite_reverse] opacity-20 ${isInLobby ? 'border-emerald-500' : 'border-blue-500'}`}></div>
            <div className={`absolute inset-12 rounded-full border opacity-10 ${isInLobby ? 'border-emerald-500' : 'border-blue-500'}`}></div>

            {/* The Radar Sweep Gradient */}
            <div className={`absolute inset-0 rounded-full ${isInLobby ? 'radar-sweep-green' : 'radar-sweep'} opacity-20`}></div>

            {/* Center Icon */}
            <div className={`relative z-10 w-24 h-24 rounded-full bg-black flex items-center justify-center border-2 shadow-[0_0_30px_inset] ${isInLobby ? 'border-emerald-500 shadow-emerald-900/50' : 'border-blue-500 shadow-blue-900/50'}`}>
               {isInLobby ? (
                   <Wifi size={40} className="text-emerald-500 animate-pulse" />
               ) : (
                   <Globe size={40} className="text-blue-500 animate-pulse" />
               )}
            </div>

            {/* Random User "Dots" (The Heatmap) */}
            <ActiveNodes />

          </div>

          {/* STATUS TEXT & CONTROLS */}
          <div className="space-y-6 text-center w-full">
             <div className="space-y-2">
                <h2 className="text-3xl font-bold text-white tracking-tight">
                    {isInLobby ? "PUBLIC LOBBY" : "SEARCHING..."}
                </h2>
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded text-xs font-bold uppercase tracking-widest border ${isInLobby ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'}`}>
                    {isInLobby ? <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"/> : <Loader2 size={10} className="animate-spin"/>}
                    {statusText}
                </div>
             </div>

             {/* Stats Row */}
             <div className="grid grid-cols-2 gap-4 max-w-xs mx-auto text-xs text-slate-500 border-t border-slate-800 pt-6">
                <div>
                    <div className="flex items-center justify-center gap-1 mb-1"><Users size={12}/> ONLINE</div>
                    <span className="text-slate-300 font-bold text-lg">1,240</span>
                </div>
                <div>
                    <div className="flex items-center justify-center gap-1 mb-1"><Globe size={12}/> REGION</div>
                    <span className="text-slate-300 font-bold text-lg">GLOBAL</span>
                </div>
             </div>

             <button
                onClick={() => { cancelSearch(); onCancel(); }}
                className="mt-8 text-slate-500 hover:text-red-400 text-xs uppercase tracking-widest hover:underline transition-colors"
             >
                Abort Search
             </button>
          </div>
        </div>
      )}
    </div>
  );
};
