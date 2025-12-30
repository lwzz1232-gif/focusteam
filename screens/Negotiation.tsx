import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../components/Button';
import { SessionConfig, Partner, SessionMode } from '../types';
import { Zap, Timer, CheckCircle2, User, Users, Clock } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';
import * as THREE from 'three';
import { useAppContext } from '../context/AppContext';

// --- VISUAL: STARDUST & CONNECTION BACKGROUND ---
const StardustBackground = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050505, 0.001);
    
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 50;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    mountRef.current.appendChild(renderer.domElement);

    const geometry = new THREE.BufferGeometry();
    const count = 2000;
    const positions = new Float32Array(count * 3);
    
    for(let i=0; i<count*3; i++) {
        positions[i] = (Math.random() - 0.5) * 150;
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        size: 0.2,
        color: 0xffffff,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true
    });
    
    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      
      particles.rotation.y += 0.0003;
      particles.rotation.x += 0.0001;
      
      const time = Date.now() * 0.0005;
      camera.position.z = 50 + Math.sin(time) * 2;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
        if (!mountRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
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

  return <div ref={mountRef} className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-slate-950 via-black to-slate-950" />;
};


export const Negotiation: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { sessionConfig, partner, sessionId, user } = state;
  const config = sessionConfig;

  const [step, setStep] = useState<'INPUT' | 'WAITING' | 'REVIEW' | 'AGREED'>('INPUT');
  const [inputTimer, setInputTimer] = useState(15);
  
  const [myMode, setMyMode] = useState<SessionMode>(SessionMode.DEEP_WORK);
  const [myPreTalk, setMyPreTalk] = useState(5);
  const [myPostTalk, setMyPostTalk] = useState(5);

  const [partnerMode, setPartnerMode] = useState<SessionMode | null>(null);
  const [partnerPreTalk, setPartnerPreTalk] = useState<number | null>(null);
  const [partnerPostTalk, setPartnerPostTalk] = useState<number | null>(null);
  const [partnerDuration, setPartnerDuration] = useState<number | null>(null); 

  const [finalConfig, setFinalConfig] = useState<SessionConfig | null>(null);

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

  useEffect(() => {
    if (!sessionId || !user) return;
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const negotiation = data.negotiation || {};
        const partnerKey = Object.keys(negotiation).find(k => k !== user.id);
        
        if (partnerKey && negotiation[partnerKey]) {
            const pData = negotiation[partnerKey];
            setPartnerMode(pData.mode);
            setPartnerPreTalk(pData.preTalk);
            setPartnerPostTalk(pData.postTalk);
            setPartnerDuration(pData.duration); 
        }
    });
    return () => unsub();
  }, [sessionId, user]);

  useEffect(() => {
    if (step === 'WAITING' && partnerMode && partnerPreTalk !== null && partnerPostTalk !== null && partnerDuration !== null && config) {
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

  const handleSubmit = async (overrideMode?: SessionMode, overridePre?: number, overridePost?: number) => {
    if (!user || !sessionId || !config) return;
    setStep('WAITING');
    const currentMode = overrideMode || myMode;
    const currentPre = overridePre || myPreTalk;
    const currentPost = overridePost || myPostTalk;

    try {
        await updateDoc(doc(db, 'sessions', sessionId), {
            [`negotiation.${user.id}`]: {
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

  const onNegotiationComplete = (finalConfig: SessionConfig) => {
    dispatch({ type: 'NEGOTIATION_COMPLETE', payload: finalConfig });
  };

  const onSkipMatch = () => {
    dispatch({ type: 'CANCEL_MATCH' });
  };

  useEffect(() => {
    if (step === 'REVIEW') {
      const timer = setTimeout(() => setStep('AGREED'), 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'AGREED' && finalConfig) {
      const timer = setTimeout(() => onNegotiationComplete(finalConfig), 2000);
      return () => clearTimeout(timer);
    }
  }, [step, finalConfig, onNegotiationComplete]);

  if (!config || !partner || !user) {
    return null; // Or some loading/error state
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden h-full w-full">
      
      <StardustBackground />
      
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none z-0" />

      <div className="relative z-10 w-full max-w-4xl p-6 mx-auto">

        {step === 'INPUT' && (
          <div className="w-full max-w-lg mx-auto animate-in fade-in slide-in-from-bottom-8 duration-500 bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/10 p-1 shadow-2xl">
            <div className="absolute -top-10 right-4 flex items-center gap-2">
                <div className={`text-sm font-bold font-mono px-3 py-1 rounded-full border backdrop-blur-md transition-colors ${
                    inputTimer <= 5 ? 'bg-red-500/20 border-red-500 text-red-400' : 'bg-white/10 border-white/20 text-slate-300'
                }`}>
                    {inputTimer}s remaining
                </div>
            </div>

            <div className="p-8">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center gap-2 mb-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium uppercase tracking-widest">
                        Match Found
                    </div>
                    <h2 className="text-3xl font-bold text-white tracking-tight">Setup with {partner.name}</h2>
                    <p className="text-slate-400 text-sm mt-1">Customize your joint session</p>
                </div>

                <div className="space-y-8">
                   <div className="grid grid-cols-2 gap-4">
                        <button
                          onClick={() => setMyMode(SessionMode.DEEP_WORK)}
                          className={`p-4 rounded-2xl border text-sm font-medium flex flex-col items-center gap-2 transition-all duration-300 ${
                             myMode === SessionMode.DEEP_WORK
                             ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                             : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          }`}
                        >
                          <Zap size={20} className={myMode === SessionMode.DEEP_WORK ? "text-blue-400" : "text-slate-500"} />
                          <span>Deep Work</span>
                        </button>
                        
                        <button
                          onClick={() => setMyMode(SessionMode.POMODORO)}
                          disabled={config.duration < 60}
                          className={`p-4 rounded-2xl border text-sm font-medium flex flex-col items-center gap-2 transition-all duration-300 ${
                             myMode === SessionMode.POMODORO
                             ? 'bg-blue-600/20 border-blue-500/50 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                             : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10'
                          } ${config.duration < 60 ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <Timer size={20} className={myMode === SessionMode.POMODORO ? "text-blue-400" : "text-slate-500"} />
                          <span>Pomodoro</span>
                        </button>
                   </div>

                   <div className="space-y-6 px-2">
                       <div className="space-y-3">
                         <div className="flex justify-between items-end">
                           <span className="text-sm text-slate-400 font-medium">Icebreaker</span>
                           <span className="text-2xl font-light text-white">{myPreTalk}<span className="text-sm text-slate-500 ml-1">min</span></span>
                         </div>
                         <input 
                           type="range" min="1" max="15" value={myPreTalk} 
                           onChange={(e) => setMyPreTalk(Number(e.target.value))}
                           className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
                         />
                       </div>
                       <div className="space-y-3">
                         <div className="flex justify-between items-end">
                           <span className="text-sm text-slate-400 font-medium">Debrief</span>
                           <span className="text-2xl font-light text-white">{myPostTalk}<span className="text-sm text-slate-500 ml-1">min</span></span>
                         </div>
                         <input 
                           type="range" min="0" max="15" value={myPostTalk} 
                           onChange={(e) => setMyPostTalk(Number(e.target.value))}
                           className="w-full h-1.5 bg-slate-700/50 rounded-lg appearance-none cursor-pointer accent-blue-500"
                         />
                       </div>
                   </div>
                </div>

                <div className="flex gap-4 mt-8">
                   <button onClick={onSkipMatch} className="px-6 py-4 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-sm font-medium transition-colors">
                      Skip
                   </button>
                   <button onClick={() => handleSubmit()} className="flex-1 bg-white text-black hover:bg-blue-50 font-bold rounded-xl py-4 shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all transform hover:scale-[1.02]">
                      Send Proposal
                   </button>
                </div>
            </div>
          </div>
        )}

        {step === 'WAITING' && (
          <div className="flex flex-col items-center justify-center h-64 animate-in fade-in zoom-in-95 duration-700">
              <div className="relative">
                  <div className="absolute inset-0 bg-blue-500/30 blur-2xl rounded-full animate-ping opacity-50"></div>
                  <div className="w-20 h-20 bg-gradient-to-tr from-slate-800 to-slate-700 rounded-full flex items-center justify-center relative z-10 border border-white/10 shadow-xl">
                      <Users size={32} className="text-blue-200" />
                  </div>
              </div>
              <h3 className="text-xl font-medium text-white mt-8 tracking-wide">Connecting with {partner.name}...</h3>
              <p className="text-slate-500 text-sm mt-2">Syncing preferences</p>
          </div>
        )}

        {step === 'REVIEW' && (
           <div className="w-full max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               
               <div className="flex items-center justify-center gap-4 mb-8 opacity-80">
                   <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-slate-500"></div>
                   <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Harmonizing</span>
                   <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-slate-500"></div>
               </div>

               <div className="grid grid-cols-2 gap-1 bg-white/5 backdrop-blur-xl rounded-3xl p-1 border border-white/10">
                  <div className="bg-black/20 rounded-l-2xl p-6 flex flex-col gap-4 text-center">
                      <div className="w-10 h-10 mx-auto bg-slate-800 rounded-full flex items-center justify-center text-slate-300">
                          <User size={18} />
                      </div>
                      <div className="space-y-2">
                          <div className="text-xs text-slate-500 uppercase">Duration</div>
                          <div className={`text-xl font-light ${config.duration !== partnerDuration ? 'text-amber-300' : 'text-white'}`}>{config.duration}m</div>
                      </div>
                      <div className="space-y-1">
                          <div className="text-xs text-slate-500 uppercase">Mode</div>
                          <div className="text-sm text-slate-300">{myMode === SessionMode.POMODORO ? 'Pomodoro' : 'Deep Work'}</div>
                      </div>
                  </div>

                  <div className="bg-black/20 rounded-r-2xl p-6 flex flex-col gap-4 text-center border-l border-white/5">
                      <div className="w-10 h-10 mx-auto bg-blue-900/30 rounded-full flex items-center justify-center text-blue-300">
                          <User size={18} />
                      </div>
                      <div className="space-y-2">
                          <div className="text-xs text-slate-500 uppercase">Duration</div>
                          <div className={`text-xl font-light ${config.duration !== partnerDuration ? 'text-amber-300' : 'text-white'}`}>{partnerDuration}m</div>
                      </div>
                      <div className="space-y-1">
                          <div className="text-xs text-slate-500 uppercase">Mode</div>
                          <div className="text-sm text-slate-300">{partnerMode === SessionMode.POMODORO ? 'Pomodoro' : 'Deep Work'}</div>
                      </div>
                  </div>
               </div>
               
               {partnerDuration && partnerDuration !== config.duration && (
                   <div className="mt-6 flex items-center justify-center gap-2 text-amber-200/80 text-sm animate-pulse">
                       <Clock size={14} />
                       <span>Times synced to shorter duration</span>
                   </div>
               )}
           </div>
        )}

        {step === 'AGREED' && finalConfig && (
           <div className="text-center animate-in zoom-in-95 fade-in duration-700">
               <div className="relative mb-8 inline-block">
                   <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full"></div>
                   <div className="flex items-center gap-4 relative z-10">
                       <div className="w-16 h-16 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center">
                           <User className="text-slate-400" />
                       </div>
                       <div className="h-1 w-16 bg-gradient-to-r from-slate-700 via-emerald-500 to-blue-900 rounded-full"></div>
                       <div className="w-16 h-16 rounded-full bg-blue-900/30 border-2 border-blue-500/30 flex items-center justify-center">
                           <User className="text-blue-200" />
                       </div>
                   </div>
                   <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
                       <div className="bg-emerald-500 rounded-full p-1 border-4 border-black">
                           <CheckCircle2 size={16} className="text-white" />
                       </div>
                   </div>
               </div>

               <h2 className="text-4xl font-light text-white mb-2">You're Set</h2>
               <p className="text-slate-400 mb-8">Session configured. Entering workspace...</p>

               <div className="inline-flex gap-8 text-left bg-white/5 backdrop-blur-md px-8 py-4 rounded-2xl border border-white/10">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total Time</div>
                        <div className="text-2xl font-light text-white">{finalConfig.duration}m</div>
                    </div>
                    <div className="w-px bg-white/10"></div>
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Mode</div>
                        <div className="text-2xl font-light text-white">{finalConfig.mode === SessionMode.POMODORO ? 'Pomo' : 'Deep'}</div>
                    </div>
               </div>
           </div>
        )}

      </div>
    </div>
  );
};
