import React, { useEffect, useState, useRef, useMemo } from 'react';
import { Partner, SessionConfig } from '../types';
import { AlertTriangle, ExternalLink, X, Wifi } from 'lucide-react';
import { useMatchmaking } from '../hooks/useMatchmaking';
import { db } from '../utils/firebaseConfig';
import { doc, onSnapshot, collection, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import Globe from 'react-globe.gl';
import { useAppContext } from '../context/AppContext';

// --- WARP SPEED COMPONENT (Lightweight Canvas) ---
const WarpSpeed = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);
    
    // Star properties
    const numStars = 500; // Safe for all PCs
    const stars: any[] = [];
    const centerX = width / 2;
    const centerY = height / 2;

    for (let i = 0; i < numStars; i++) {
      stars.push({
        x: Math.random() * width - centerX,
        y: Math.random() * height - centerY,
        z: Math.random() * width, // depth
        o: '0.' + Math.floor(Math.random() * 99) + 1 // opacity
      });
    }

    let animationFrameId: number;
    let speed = 2; // Starting speed

    const move = () => {
      // Accelerate the warp effect
      if(speed < 50) speed += 0.5;

      // Fill background (Black with slight transparency for trail effect)
      ctx.fillStyle = "rgba(0, 0, 0, 0.4)"; 
      ctx.fillRect(0, 0, width, height);

      for (let i = 0; i < numStars; i++) {
        const star = stars[i];
        
        // Move star closer
        star.z -= speed;

        // Reset star if it passes screen
        if (star.z <= 0) {
          star.z = width;
          star.x = Math.random() * width - centerX;
          star.y = Math.random() * height - centerY;
        }

        // Project 3D position to 2D
        const x = centerX + (star.x / star.z) * width;
        const y = centerY + (star.y / star.z) * height;
        
        // Calculate size based on proximity
        const size = (1 - star.z / width) * 4;

        // Draw Star/Streak
        ctx.beginPath();
        // Cyan and White mix for sci-fi look
        ctx.strokeStyle = Math.random() > 0.8 ? "#22d3ee" : "#ffffff"; 
        ctx.lineWidth = size;
        ctx.moveTo(x, y);
        // Create the trail (streak)
        const prevX = centerX + (star.x / (star.z + speed * 2)) * width;
        const prevY = centerY + (star.y / (star.z + speed * 2)) * height;
        ctx.lineTo(prevX, prevY);
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(move);
    };

    move();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-50 pointer-events-none" />;
};

// --- GLOBE HELPERS ---
const N_ARCS = 20;
const genRandomArcs = () => {
  return [...Array(N_ARCS).keys()].map(() => ({
    startLat: (Math.random() - 0.5) * 180,
    startLng: (Math.random() - 0.5) * 360,
    endLat: (Math.random() - 0.5) * 180,
    endLng: (Math.random() - 0.5) * 360,
    color: ['#22d3ee', '#f472b6'][Math.round(Math.random())] 
  }));
};

export const Matching: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { user, sessionConfig } = state;
  const config = sessionConfig; // for convenience

  const [statusText, setStatusText] = useState("Initializing Global Mesh...");
  const [sessionIdToWatch, setSessionIdToWatch] = useState<string | null>(null);
  const [hasCalledOnMatch, setHasCalledOnMatch] = useState(false);
  const [isInLobby, setIsInLobby] = useState(false);
  const [isWarping, setIsWarping] = useState(false);

  const lobbyTicketRef = useRef<string | null>(null);
  const globeEl = useRef<any>();
  const arcsData = useMemo(() => genRandomArcs(), []);
  
  const [windowSize, setWindowSize] = useState({ 
    w: typeof window !== 'undefined' ? window.innerWidth : 800, 
    h: typeof window !== 'undefined' ? window.innerHeight : 600 
  });

  useEffect(() => {
    const handleResize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const onMatched = (partner: Partner, sessionId: string) => {
    dispatch({ type: 'MATCH_FOUND', payload: { partner, sessionId } });
  };

  const onCancel = () => {
      dispatch({ type: 'CANCEL_MATCH' });
  };

  const { status, joinQueue, cancelSearch, error } = useMatchmaking(user!, (partner, sessionId) => {
    setSessionIdToWatch(sessionId);
  });

 useEffect(() => {
    if (!user || !config) return;
    joinQueue(config);
    
    const handleTabClose = () => {
       if (lobbyTicketRef.current) {
         deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current));
       }
    };
    window.addEventListener('beforeunload', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      cancelSearch();
      if (lobbyTicketRef.current) deleteDoc(doc(db, 'waiting_room', lobbyTicketRef.current)).catch(console.error);
    };
  }, [config, joinQueue, cancelSearch, user]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isActive = true;

    if (status === 'SEARCHING' && !sessionIdToWatch && !isInLobby) {
        timeoutId = setTimeout(async () => {
            if (!isActive || sessionIdToWatch || lobbyTicketRef.current || !user || !config) return;
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

  useEffect(() => {
    if (!sessionIdToWatch || hasCalledOnMatch || !user) return;
    const sessionRef = doc(collection(db, 'sessions'), sessionIdToWatch);
    
    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const sessionData = snap.data() as any;
      
      const triggerMatch = () => {
        if (!hasCalledOnMatch) {
          setHasCalledOnMatch(true);
          
          const p = sessionData.participantInfo?.find((p: any) => p.userId !== user.id);
          
          if (p) {
            setIsWarping(true);
            setStatusText("JUMPING TO HYPERSPACE...");

            setTimeout(() => {
                onMatched({ 
                    id: p.userId, 
                    name: p.displayName || 'Partner', 
                    type: sessionData.config?.type || 'ANY' 
                }, sessionIdToWatch);
            }, 2500);
          }
        }
      };

      if (sessionData.started === true) triggerMatch();
      if (Array.isArray(sessionData.participants) && sessionData.participants.length >= 2) triggerMatch();
    });
    return () => unsubscribe();
  }, [sessionIdToWatch, user, onMatched, hasCalledOnMatch]);

  useEffect(() => {
    if(isWarping) return;
    if (isInLobby) { setStatusText("Broadcasting to Public Lobby..."); return; }
    if (status === 'SEARCHING' && config) {
      const msgs = [`Scanning for ${config.type}...`, "Triangulating signal...", "Handshaking with peer network..."];
      let i = 0;
      const interval = setInterval(() => { i = (i + 1) % msgs.length; setStatusText(msgs[i]); }, 3000);
      return () => clearInterval(interval);
    } 
  }, [status, config, isInLobby, isWarping]);

  useEffect(() => {
    if (globeEl.current) {
      setTimeout(() => {
        if (!globeEl.current) return;
        globeEl.current.controls().autoRotate = true;
        globeEl.current.controls().autoRotateSpeed = 0.8; 
        globeEl.current.pointOfView({ lat: 20, lng: 0, altitude: 2.0 }); 
      }, 100);
    }
  }, []);

  if (!user || !config) {
      return null;
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden h-screen w-full">
      
      {isWarping && <WarpSpeed />}

      <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${isWarping ? 'opacity-20' : 'opacity-100'}`}>
        <Globe
          ref={globeEl}
          width={windowSize.w}
          height={windowSize.h}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-night.jpg"
          backgroundImageUrl="https://unpkg.com/three-globe/example/img/night-sky.png"
          backgroundColor="rgba(0,0,0,0)"
          showAtmosphere={true}
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.2}
          arcsData={arcsData}
          arcColor="color"
          arcDashLength={0.5}
          arcDashGap={2}
          arcDashAnimateTime={1500}
          arcStroke={0.8}
        />
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_30%,black_100%)]"></div>
      </div>

      {error ? (
        <div className="relative z-20 max-w-md w-full bg-red-950/80 border border-red-500/50 rounded-xl p-6 text-center backdrop-blur-md">
          <div className="text-white">Error: {error}</div>
          <button onClick={() => { cancelSearch(); onCancel(); }} className="text-slate-400 mt-4 underline">Cancel</button>
        </div>
      ) : (
        <div className={`relative z-20 flex flex-col items-center w-full max-w-xl pointer-events-none select-none mt-32 transition-all duration-500 ${isWarping ? 'scale-110 opacity-0' : 'opacity-100'}`}>
          
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
