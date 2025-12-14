import React, { useEffect, useState, useRef, useMemo } from 'react';
import { SessionConfig, Partner, User } from '../types';
import { AlertTriangle, ExternalLink, X, Wifi } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Globe from 'react-globe.gl';

// --- UPGRADE: BRIGHTER NEON ARCS ---
const N_ARCS = 20;
const genRandomArcs = () => {
  return [...Array(N_ARCS).keys()].map(() => ({
    startLat: (Math.random() - 0.5) * 180,
    startLng: (Math.random() - 0.5) * 360,
    endLat: (Math.random() - 0.5) * 180,
    endLng: (Math.random() - 0.5) * 360,
    // Brighter Colors: Cyan and Hot Pink
    color: ['#22d3ee', '#f472b6'][Math.round(Math.random())] 
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

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user, (partner, sessionId) => {
    setSessionIdToWatch(sessionId);
  });

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

  // Session Listener
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

  // Text Rotation
  useEffect(() => {
    if (isInLobby) { setStatusText("Broadcasting to Public Lobby..."); return; }
    if (status === 'SEARCHING') {
      const msgs = [`Scanning for ${config.type}...`, "Triangulating signal...", "Handshaking with peer network..."];
      let i = 0;
      const interval = setInterval(() => { i = (i + 1) % msgs.length; setStatusText(msgs[i]); }, 3000);
      return () => clearInterval(interval);
    } else if (status === 'MATCHED') { setStatusText("Connection Locked."); }
  }, [status, config, isInLobby]);

  // --- UPGRADE: FASTER ROTATION & ZOOM ---
  useEffect(() => {
    if (globeEl.current) {
      globeEl.current.controls().autoRotate = true;
      globeEl.current.controls().autoRotateSpeed = 0.8; // Slightly slower for grandeur
      // Set initial zoom level (lower Y = closer)
      globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.0 }); 
    }
  }, []);

  const indexLink = error && error.includes('https://console.firebase.google.com') ? error.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] : null;

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden h-full">
      
      {/* --- 3D GLOBE (UPGRADED) --- */}
      <div className="absolute inset-0 z-0 opacity-100 transition-opacity duration-1000">
        <Globe
          ref={globeEl}
          width={windowSize.w}
          height={windowSize.h}
          // Night Texture (City Lights)
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          // Background Stars (Adds depth!)
          backgroundImageUrl="//unpkg.com/three-globe/example/img/night-sky.png"
          backgroundColor="#000000"
          
          // ATMOSPHERE (The "Electric" Glow)
          showAtmosphere={true}
          atmosphereColor="#7dd3fc" // Bright Sky Blue
          atmosphereAltitude={0.2}  // Thicker glow
          
          // BEAMS (Lasers)
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.5}
          arcDashGap={2}
          arcDashAnimateTime={1500}
          arcStroke={0.8} // Thicker lines
        />
        
        {/* Subtle vignette to blend edges */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,black_100%)]"></div>
      </div>

      {/* --- UI --- */}
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
             <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 backdrop-blur-md shadow-[0_0_15px_rgba(59,130,246,0.5)]">
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
