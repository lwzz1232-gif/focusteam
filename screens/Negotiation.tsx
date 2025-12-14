import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/Button';
import { SessionConfig, Partner, SessionMode } from '../types';
import { Zap, Timer, CheckCircle2, User, Users, XCircle, Clock } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import * as THREE from 'three';

// --- VISUAL: CYBER NETWORK BACKGROUND ---
// This runs purely for aesthetics and does not interfere with logic.
const CyberBackground = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x000000, 0.002);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    mountRef.current.appendChild(renderer.domElement);

    // 2. Create "Data Particles"
    const geometry = new THREE.BufferGeometry();
    const count = 1000;
    const positions = new Float32Array(count * 3);
    
    for(let i=0; i<count*3; i++) {
        positions[i] = (Math.random() - 0.5) * 50;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.15,
        color: 0x22d3ee, // Cyan
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 3. Create Connecting Lines (The "Network")
    const lineGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(10, 2));
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.15 });
    const mesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(mesh);

    // 4. Animation Loop
    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      // Rotate the network
      mesh.rotation.y += 0.002;
      mesh.rotation.x += 0.001;
      
      // Floating particles
      particles.rotation.y -= 0.001;
      
      // Gentle pulsing zoom
      const time = Date.now() * 0.001;
      camera.position.z = 20 + Math.sin(time) * 2;

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    const handleResize = () => {
        const w = mountRef.current?.clientWidth || window.innerWidth;
        const h = mountRef.current?.clientHeight || window.innerHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(frameId);
      if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none opacity-60" />;
};

interface NegotiationProps {
  config: SessionConfig;
  partner: Partner;
  sessionId: string; 
  userId: string;    
  onNegotiationComplete: (finalConfig: SessionConfig) => void;
  onSkipMatch: () => void;
}

export const Negotiation: React.FC<NegotiationProps> = ({ config, partner, sessionId, userId, onNegotiationComplete, onSkipMatch }) => {
  const [step, setStep] = useState<'INPUT' | 'WAITING' | 'REVIEW' | 'AGREED'>('INPUT');
  const [inputTimer, setInputTimer] = useState(15);
  
  // My choices
  const [myMode, setMyMode] = useState<SessionMode>(SessionMode.DEEP_WORK);
  const [myPreTalk, setMyPreTalk] = useState(5);
  const [myPostTalk, setMyPostTalk] = useState(5);

  // Partner choices
  const [partnerMode, setPartnerMode] = useState<SessionMode | null>(null);
  const [partnerPreTalk, setPartnerPreTalk] = useState<number | null>(null);
  const [partnerPostTalk, setPartnerPostTalk] = useState<number | null>(null);
  const [partnerDuration, setPartnerDuration] = useState<number | null>(null); 

  // Final Result
  const [finalConfig, setFinalConfig] = useState<SessionConfig | null>(null);

  // 1. Timer for Input Phase
  useEffect(() => {
    if (step === 'INPUT') {
      const timer = setInterval(() => {
        setInputTimer(prev => {
          if (prev <= 1) {
            handleAutoSubmit(); 
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step]);

  // 2. LISTEN TO FIRESTORE
  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const negotiation = data.negotiation || {};
        const partnerKey = Object.keys(negotiation).find(k => k !== userId);
        
        if (partnerKey && negotiation[partnerKey]) {
            const pData = negotiation[partnerKey];
            setPartnerMode(pData.mode);
            setPartnerPreTalk(pData.preTalk);
            setPartnerPostTalk(pData.postTalk);
            setPartnerDuration(pData.duration); 
        }
    });
    return () => unsub();
  }, [sessionId, userId]);

  // 3. CHECK IF BOTH HAVE SUBMITTED
  useEffect(() => {
    if (step === 'WAITING' && partnerMode && partnerPreTalk !== null && partnerPostTalk !== null && partnerDuration !== null) {
        const agreedPre = Math.ceil((myPreTalk + partnerPreTalk) / 2);
        const agreedPost = Math.ceil((myPostTalk + partnerPostTalk) / 2);
        const agreedMode = (myMode === partnerMode) ? myMode : SessionMode.DEEP_WORK; 
        const agreedDuration = Math.min(config.duration, partnerDuration);

        const agreedConfig = {
            ...config,
            mode: agreedMode,
            duration: agreedDuration,
            preTalkMinutes: agreedPre,
            postTalkMinutes: agreedPost
        };

        setFinalConfig(agreedConfig);
        setStep('REVIEW');
    }
  }, [step, partnerMode, partnerPreTalk, partnerPostTalk, partnerDuration, myMode, myPreTalk, myPostTalk, config]);

  // 4. Submit to Firestore
  const handleSubmit = async (overrideMode?: SessionMode, overridePre?: number, overridePost?: number) => {
    setStep('WAITING');
    const currentMode = overrideMode || myMode;
    const currentPre = overridePre || myPreTalk;
    const currentPost = overridePost || myPostTalk;

    try {
        await updateDoc(doc(db, 'sessions', sessionId), {
            [`negotiation.${userId}`]: {
                mode: currentMode,
                preTalk: currentPre,
                postTalk: currentPost,
                duration: config.duration 
            }
        });
    } catch (err) {
        console.error("Failed to submit negotiation:", err);
    }
  };

  const handleAutoSubmit = () => {
    const randomMode = Math.random() > 0.5 ? SessionMode.DEEP_WORK : SessionMode.POMODORO;
    const randomPre = Math.floor(Math.random() * 5) + 2;
    const randomPost = Math.floor(Math.random() * 5) + 2;
    setMyMode(randomMode);
    setMyPreTalk(randomPre);
    setMyPostTalk(randomPost);
    handleSubmit(randomMode, randomPre, randomPost);
  };

  // 5. Timers for transitioning UI
  useEffect(() => {
    if (step === 'REVIEW') {
      const timer = setTimeout(() => setStep('AGREED'), 4000); 
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'AGREED' && finalConfig) {
      const timer = setTimeout(() => onNegotiationComplete(finalConfig), 3500); 
      return () => clearTimeout(timer);
    }
  }, [step, finalConfig, onNegotiationComplete]);

  // --- RENDER ---
  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-full w-full">
      
      {/* 3D BACKGROUND LAYER */}
      <CyberBackground />
      
      {/* VIGNETTE OVERLAY (Darkens edges for focus) */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_100%)] pointer-events-none z-0" />

      {/* CONTENT LAYER */}
      <div className="relative z-10 w-full max-w-4xl p-6 mx-auto">

        {step === 'INPUT' && (
          // Added 'backdrop-blur' and better border styling
          <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-8 duration-700 relative bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-1">
            <div className="absolute -top-12 right-0 bg-slate-800 text-white px-3 py-1 rounded-full text-sm font-mono border border-slate-700 flex items-center gap-2 shadow-lg shadow-black/50">
               <Timer size={14} className={inputTimer <= 5 ? 'text-red-400 animate-pulse' : 'text-slate-400'} />
               <span className={inputTimer <= 5 ? 'text-red-400 font-bold' : ''}>{inputTimer}s</span>
            </div>

            <div className="p-6">
                <h2 className="text-2xl font-bold mb-2 text-white tracking-tight">Session Setup</h2>
                <p className="text-slate-400 mb-8 text-sm">
                  You matched with <span className="text-cyan-400 font-bold">{partner.name}</span>. 
                  Propose your terms.
                </p>

                <div className="space-y-8">
                   {/* Mode Selection */}
                   <div className="space-y-3">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Preferred Mode</label>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setMyMode(SessionMode.DEEP_WORK)}
                          className={`flex-1 p-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-1 transition-all duration-300 ${
                             myMode === SessionMode.DEEP_WORK
                             ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                             : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                          }`}
                        >
                          <Zap size={18} />
                          Deep Work
                        </button>
                        
                        <button
                          onClick={() => setMyMode(SessionMode.POMODORO)}
                          disabled={config.duration < 60}
                          className={`flex-1 p-3 rounded-xl border text-sm font-medium flex flex-col items-center gap-1 transition-all duration-300 ${
                             myMode === SessionMode.POMODORO
                             ? 'bg-purple-600/20 border-purple-500 text-purple-200 shadow-[0_0_15px_rgba(168,85,247,0.3)]'
                             : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10'
                          } ${config.duration < 60 ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <Timer size={18} />
                          Pomodoro
                        </button>
                      </div>
                    </div>

                    {/* Sliders */}
                    <div className="space-y-6">
                       <div>
                         <div className="flex justify-between text-sm mb-2">
                           <span className="text-slate-400">Icebreaker</span>
                           <span className="text-cyan-400 font-bold">{myPreTalk} min</span>
                         </div>
                         <input 
                           type="range" min="1" max="15" value={myPreTalk} 
                           onChange={(e) => setMyPreTalk(Number(e.target.value))}
                           className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                         />
                       </div>
                       <div>
                         <div className="flex justify-between text-sm mb-2">
                           <span className="text-slate-400">Debrief</span>
                           <span className="text-cyan-400 font-bold">{myPostTalk} min</span>
                         </div>
                         <input 
                           type="range" min="0" max="15" value={myPostTalk} 
                           onChange={(e) => setMyPostTalk(Number(e.target.value))}
                           className="w-full h-2 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                         />
                       </div>
                    </div>
                </div>

                <div className="flex gap-3 mt-8">
                   <Button variant="secondary" onClick={onSkipMatch} className="flex-1 py-4 text-slate-400 hover:text-white border-white/10 hover:bg-red-500/10 hover:border-red-500/30">
                      Skip
                   </Button>
                   <Button onClick={() => handleSubmit()} className="flex-[2] py-4 text-lg bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)] border-none">
                      Submit Proposal
                   </Button>
                </div>
            </div>
          </div>
        )}

        {step === 'WAITING' && (
          <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700">
              <div className="relative">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-xl rounded-full animate-pulse"></div>
                  <Users size={64} className="text-cyan-200 relative z-10" />
              </div>
              <h3 className="text-2xl font-bold text-white mt-6 tracking-tight">Syncing Neural Link...</h3>
              <p className="text-slate-400 text-sm mt-2 font-mono">Waiting for {partner.name} to confirm</p>
          </div>
        )}

        {step === 'REVIEW' && (
           <div className="w-full max-w-2xl mx-auto animate-in slide-in-from-bottom-10 fade-in duration-500">
               <h2 className="text-2xl font-bold text-center mb-8 text-white tracking-tight drop-shadow-md">
                   Comparing Preferences
               </h2>
               <div className="grid grid-cols-2 gap-8">
                  {/* My Side */}
                  <div className="bg-black/40 backdrop-blur-md border border-blue-500/30 rounded-xl p-6 relative overflow-hidden transition-transform hover:scale-[1.02] duration-300">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500 shadow-[0_0_10px_#3b82f6]"></div>
                      <div className="flex items-center gap-2 mb-4">
                          <User size={20} className="text-blue-400" />
                          <span className="font-bold text-white">You</span>
                      </div>
                      <div className="space-y-3">
                          <div className={`flex justify-between text-sm ${config.duration !== partnerDuration ? 'text-amber-300' : 'text-slate-400'}`}>
                              <span>Duration</span>
                              <span className="font-mono">{config.duration}m</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Mode</span>
                              <span className="text-slate-200">{myMode}</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Pre-Talk</span>
                              <span className="text-slate-200">{myPreTalk}m</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Post-Talk</span>
                              <span className="text-slate-200">{myPostTalk}m</span>
                          </div>
                      </div>
                  </div>

                  {/* Partner Side */}
                  <div className="bg-black/40 backdrop-blur-md border border-emerald-500/30 rounded-xl p-6 relative overflow-hidden transition-transform hover:scale-[1.02] duration-300">
                      <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                      <div className="flex items-center gap-2 mb-4">
                          <User size={20} className="text-emerald-400" />
                          <span className="font-bold text-white">{partner.name}</span>
                      </div>
                      <div className="space-y-3">
                          <div className={`flex justify-between text-sm ${config.duration !== partnerDuration ? 'text-amber-300' : 'text-slate-400'}`}>
                              <span>Duration</span>
                              <span className="font-mono">{partnerDuration}m</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Mode</span>
                              <span className="text-slate-200">{partnerMode}</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Pre-Talk</span>
                              <span className="text-slate-200">{partnerPreTalk}m</span>
                          </div>
                          <div className="flex justify-between text-sm text-slate-400">
                              <span>Post-Talk</span>
                              <span className="text-slate-200">{partnerPostTalk}m</span>
                          </div>
                      </div>
                  </div>
               </div>
               
               {/* ALERT */}
               {partnerDuration && partnerDuration !== config.duration && (
                   <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
                       <div className="p-3 bg-amber-500/20 rounded-full">
                           <Clock className="text-amber-400" size={24} />
                       </div>
                       <div>
                           <h4 className="text-amber-400 font-bold text-sm">Time Synchronized</h4>
                           <p className="text-amber-200/70 text-xs">
                               Requests differed. Adjusted to the shorter duration to ensure compatibility.
                           </p>
                       </div>
                   </div>
               )}
           </div>
        )}

        {step === 'AGREED' && finalConfig && (
           <div className="w-full max-w-lg mx-auto bg-black/60 backdrop-blur-xl border border-emerald-500/30 rounded-2xl p-8 text-center animate-in zoom-in-90 duration-500 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
               <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 ring-1 ring-emerald-500/50">
                   <CheckCircle2 size={40} className="text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
               </div>
               <h2 className="text-3xl font-bold text-white mb-2 tracking-tight">Protocol Accepted</h2>
               
               <p className="text-slate-400 mb-8 text-sm">
                   {config.duration !== finalConfig.duration 
                      ? <span className="text-amber-400">Duration modified for synchronization.</span> 
                      : "Parameters locked. Initializing workspace."}
               </p>

               <div className="grid grid-cols-2 gap-4 mb-8">
                   <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                       <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Time</div>
                       <div className={`font-mono font-bold text-2xl ${config.duration !== finalConfig.duration ? 'text-amber-400' : 'text-white'}`}>
                          {finalConfig.duration}m
                       </div>
                   </div>
                   <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                       <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mode</div>
                       <div className="font-bold text-white text-lg">{finalConfig.mode === SessionMode.POMODORO ? 'Pomodoro' : 'Deep Work'}</div>
                   </div>
               </div>
               
               <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-[width_3s_ease-out_forwards] w-0"></div>
               </div>
               <p className="text-xs text-emerald-500/80 mt-2 font-mono uppercase tracking-widest">Launching environment...</p>
           </div>
        )}

      </div>
    </div>
  );
};
