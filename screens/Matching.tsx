import React, { useEffect, useState, useRef, useMemo } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { AlertTriangle, ExternalLink, X, Wifi } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Globe from 'react-globe.gl';

// --- DATA GENERATOR FOR THE GLOBE ---
// Generates random connection arcs to make the globe look alive
const N_ARCS = 20;
const genRandomArcs = () => {
  return [...Array(N_ARCS).keys()].map(() => ({
    startLat: (Math.random() - 0.5) * 180,
    startLng: (Math.random() - 0.5) * 360,
    endLat: (Math.random() - 0.5) * 180,
    endLng: (Math.random() - 0.5) * 360,
    color: ['#06b6d4', '#3b82f6'][Math.round(Math.random())] // Cyan or Blue
  }));
};

interface MatchingProps {
  user: User;
  config: SessionConfig;
  onMatched: (partner: Partner, sessionId: string) => void;
  onCancel: () => void;
}

export const Matching: React.FC<MatchingProps> = ({ user, config, onMatched, onCancel }) => {
  const [statusText, setStatusText] = useState("Initializing Global Mesh...");
  const [sessionIdToWatch, setSessionIdToWatch] = useState<string | null>(null);
  const [hasCalledOnMatch, setHasCalledOnMatch] = useState(false);
  const [isInLobby, setIsInLobby] = useState(false);
  const lobbyTicketRef = useRef<string | null>(null);
  const globeEl = useRef<any>();

  // GLOBE DATA
  const arcsData = useMemo(() => genRandomArcs(), []);
  const [windowSize, setWindowSize] = useState({ w: window.innerWidth, h: window.innerHeight });

  // Handle Resize for the 3D Canvas
  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Use the matchmaking hook
  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, (partner, sessionId) => {
    setSessionIdToWatch(sessionId);
  });

  // Start the queue join on mount
  useEffect(() => {
    joinQueue(config);
    return () => {
      cancelSearch();
      if (lobbyTicketRef.current) deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
    };
  }, [config, joinQueue, cancelSearch]);

  // --- LOBBY LOGIC ---
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    if (status === 'SEARCHING' && !sessionIdToWatch && !isInLobby) {
        timeoutId = setTimeout(async () => {
            if (!isActive || sessionIdToWatch || lobbyTicketRef.current) return;
            try {
                const lobbyRef = await addDoc(collection(db, 'waiting_room'), {
                    userId: user.id, userName: user.name, config, createdAt: serverTimestamp()
                });
                if (!isActive) deleteDoc(lobbyRef).catch(console.error);
                else {
                    lobbyTicketRef.current = lobbyRef.id;
                    setIsInLobby(true); 
                }
            } catch (e) { console.error("Lobby broadcast failed", e); }
        }, 10000); 
    } 
    else if (lobbyTicketRef.current && (sessionIdToWatch || status === 'MATCHED')) {
        deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
        lobbyTicketRef.current = null;
    }
    return () => { clearTimeout(timeoutId); isActive = false; };
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
          const p = sessionData.participantInfo?.find((p: any) => p.userId !== user.id);
          if (p) onMatched({ id: p.userId, name: p.displayName || 'Partner', type: sessionData.config?.type || 'ANY' }, sessionIdToWatch);
        }
      };
      if (sessionData.started === true) triggerMatch();
      if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) triggerMatch();
    });
    return () => unsubscribe();
  }, [sessionIdToWatch, user.id, onMatched, hasCalledOnMatch]);

  // Status Text Rotation
  useEffect(() => {
    if (isInLobby) { setStatusText("Broadcasting to Public Lobby..."); return; }
    if (status === 'SEARCHING') {
      const msgs = [`Scanning for ${config.type}...`, "Triangulating signal...", "Handshaking with peer network..."];
      let i = 0;
      const interval = setInterval(() => { i = (i + 1) % msgs.length; setStatusText(msgs[i]); }, 3000);
      return () => clearInterval(interval);
    } else if (status === 'MATCHED') { setStatusText("Connection Locked."); }
  }, [status, config, isInLobby]);

  // Auto-rotate the globe
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 1.2;
    }
  }, []);

  const indexLink = error && error.includes('https://console.firebase.google.com') ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden h-full">
      
      {/* --- THE 3D GLOBE BACKGROUND --- */}
      <div className="absolute inset-0 z-0 opacity-80">
        <Globe
          ref={globeEl}
          width={windowSize.w}
          height={windowSize.h}
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="#000000"
          atmosphereColor="#3b82f6"
          atmosphereAltitude={0.25}
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.4}
          arcDashGap={4}
          arcDashInitialGap={() => Math.random() * 5}
          arcDashAnimateTime={1000}
          arcStroke={0.5}
        />
        {/* Vignette Overlay to fade edges to black */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_10%,black_90%)]"></div>
      </div>

      {/* --- FOREGROUND UI --- */}
      {error ? (
        <div className="relative z-20 max-w-md w-full bg-red-950/80 border border-red-500/50 rounded-xl p-6 text-center backdrop-blur-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4"><AlertTriangle size={32} className="text-red-500" /></div>
          <h3 className="text-xl font-bold text-white mb-2">Signal Lost</h3>
          <p className="text-red-200 mb-4 text-sm font-mono">{error}</p>
          {indexLink && <a href={indexLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-bold mb-4"><ExternalLink size={16} /> Fix Index</a>}
          <button onClick={() => { cancelSearch(); onCancel(); }} className="text-slate-400 hover:text-white underline text-xs uppercase">Abort</button>
        </div>
      ) : (
        <div className="relative z-20 flex flex-col items-center w-full max-w-xl pointer-events-none select-none mt-32">
          
          <div className="text-center space-y-4">
             {/* Mode Badge */}
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md">
                {isInLobby ? <Wifi size={14} className="text-emerald-400 animate-pulse"/> : <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"/>}
                <span className={`text-xs font-bold uppercase tracking-widest ${isInLobby ? 'text-emerald-400' : 'text-blue-400'}`}>
                    {isInLobby ? "Lobby Active" : "Scanning"}
                </span>
             </div>

             <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tighter drop-shadow-2xl">
                {isInLobby ? "WAITING..." : "SEARCHING"}
             </h2>

             <p className="text-blue-200/80 font-mono text-sm uppercase tracking-widest animate-pulse">
                {statusText}
             </p>
          </div>

          {/* Cancel Button */}
          <div className="mt-20 pointer-events-auto">
            <button
                onClick={() => { cancelSearch(); onCancel(); }}
                className="group flex items-center gap-3 px-8 py-3 bg-black/40 hover:bg-red-900/20 text-slate-400 hover:text-red-400 border border-white/10 hover:border-red-500/50 rounded-full transition-all duration-300 backdrop-blur-md"
            >
                <span className="text-xs font-bold uppercase tracking-widest group-hover:line-through">Cancel Search</span>
                <X size={14} />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
