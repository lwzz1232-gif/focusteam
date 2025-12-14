import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionDuration, TodoItem } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Sparkles, LogOut, User as UserIcon, MessageSquare, ListChecks, Flag, X, AlertTriangle, HeartCrack, Flame, ThumbsUp, Hand } from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { TaskBoard } from '../components/TaskBoard';
import { SessionRecap } from '../components/SessionRecap';
import { useChat } from '../hooks/useChat'; 
import { useWebRTC } from '../hooks/useWebRTC'; 
import { db } from '../utils/firebaseConfig';
import { collection, query, where, updateDoc, doc, addDoc, onSnapshot, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import * as THREE from 'three';

// --- ULTRA-REALISTIC THREE.JS FIRE COMPONENT ---
const RealisticFire = ({ active }: { active: boolean }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active || !mountRef.current) return;
    
    // 1. Setup Scene
    const width = window.innerWidth;
    const height = window.innerHeight;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    
    // --- YOUR LOGIC STARTS HERE ---
    camera.position.z = 20;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    // Additive blending needs this to look "hot"
    renderer.setClearColor(0x000000, 0); 
    mountRef.current.appendChild(renderer.domElement);

    // 2. Generate "Glow" Texture Programmatically (No assets needed)
    const getFireTexture = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 32; canvas.height = 32;
        const ctx = canvas.getContext('2d');
        if(!ctx) return null;
        const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
        grad.addColorStop(0, 'rgba(255, 255, 255, 1)'); // White hot center
        grad.addColorStop(0.4, 'rgba(255, 200, 0, 1)'); // Yellow mid
        grad.addColorStop(1, 'rgba(255, 0, 0, 0)');     // Red/Transparent edge
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 32, 32);
        const texture = new THREE.CanvasTexture(canvas);
        return texture;
    };

    // 3. Create Particle System
    const particleCount = 2000;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);
    const life = new Float32Array(particleCount); // 0 to 1

    for (let i = 0; i < particleCount; i++) {
        // Start at bottom center
        positions[i * 3] = (Math.random() - 0.5) * 5; // X spread
        positions[i * 3 + 1] = -15;                   // Y (Bottom)
        positions[i * 3 + 2] = (Math.random() - 0.5) * 5; // Z depth

        // Upward Physics
        velocities[i * 3] = (Math.random() - 0.5) * 0.1; // X drift
        velocities[i * 3 + 1] = Math.random() * 0.3 + 0.1; // Y speed (fast)
        velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1; // Z drift
        
        life[i] = Math.random(); // Random start life
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
        color: 0xffaa00,
        size: 0.8,
        map: getFireTexture() || undefined,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending, // Key for "Fire" look
        depthWrite: false
    });

    const particles = new THREE.Points(geometry, material);
    scene.add(particles);

    // 4. Animation Loop
    let reqId: number;
    const animate = () => {
        reqId = requestAnimationFrame(animate);
        
        const positions = geometry.attributes.position.array as Float32Array;
        
        for (let i = 0; i < particleCount; i++) {
            // Apply Velocity
            positions[i * 3] += velocities[i * 3];
            positions[i * 3 + 1] += velocities[i * 3 + 1];
            positions[i * 3 + 2] += velocities[i * 3 + 2];

            // Add Turbulence (Sine wave heat wobble)
            positions[i * 3] += Math.sin(positions[i * 3 + 1] * 0.5) * 0.02;

            // Decay Life
            life[i] -= 0.01;

            // Reset if dead or off screen
            if (life[i] <= 0 || positions[i * 3 + 1] > 15) {
                life[i] = 1;
                positions[i * 3] = (Math.random() - 0.5) * 5;
                positions[i * 3 + 1] = -15;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
            }
        }
        geometry.attributes.position.needsUpdate = true;
        
        // Flicker effect
        material.opacity = 0.8 + Math.random() * 0.2;
        
        renderer.render(scene, camera);
    };

    animate();
    // --- YOUR LOGIC ENDS HERE ---

    // 5. Cleanup (Crucial to prevent crashes)
    const handleResize = () => {
        if(!mountRef.current) return;
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
        window.removeEventListener('resize', handleResize);
        cancelAnimationFrame(reqId);
        if (mountRef.current) mountRef.current.removeChild(renderer.domElement);
        geometry.dispose();
        material.dispose();
    };
  }, [active]);

  if (!active) return null;
  return <div ref={mountRef} className="absolute inset-0 z-50 pointer-events-none fade-in duration-500 mix-blend-screen" />;
};

interface LiveSessionProps {
  user: User;
  partner: Partner;
  config: SessionConfig;
  sessionId: string; 
  onEndSession: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ user, partner, config, sessionId, onEndSession }) => {
  const isTest = config.duration === SessionDuration.TEST;
  
  // --- LOGIC STATE ---
  const [phase, setPhase] = useState<SessionPhase>(SessionPhase.ICEBREAKER);
  const [timeLeft, setTimeLeft] = useState(isTest ? 30 : config.preTalkMinutes * 60); 
  const [startTime] = useState(Date.now());
  const [isInitiator, setIsInitiator] = useState(false);
  const [isReadyForWebRTC, setIsReadyForWebRTC] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Ref to track phase inside Firebase listeners
  const phaseRef = useRef<SessionPhase>(SessionPhase.ICEBREAKER);
  
  // ADDED: Track the server-side start time of the current phase
  const phaseStartTimeRef = useRef<number | null>(null);

  // --- UI STATE ---
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [manualMicToggle, setManualMicToggle] = useState(true);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [isLoadingIcebreaker, setIsLoadingIcebreaker] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isTaskBoardOpen, setIsTaskBoardOpen] = useState(false);
  const [showUI, setShowUI] = useState(true);
  const [showControls, setShowControls] = useState(true);

  // FIRE STATE
  const [isFireActive, setIsFireActive] = useState(false);
  const fireTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Floating Messages State
  const [floatingMessages, setFloatingMessages] = useState<{id: string, text: string, sender: string}[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);

  // EXIT MODAL STATE
  const [exitModalStep, setExitModalStep] = useState<0 | 1 | 2>(0); 
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate Behavior');
  const [reportDetails, setReportDetails] = useState('');

  // Draggable Self-Video State
  const [selfPos, setSelfPos] = useState({ x: 20, y: 100 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const lastReactionTime = useRef<number>(0);
  const [myTasks, setMyTasks] = useState<TodoItem[]>([]);
  const [partnerTasks, setPartnerTasks] = useState<TodoItem[]>([]);

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCount = useRef(0); 

  // --- POMODORO LOGIC ---
  const calculatedFocusDuration = isTest ? 30 : config.duration * 60;
  const isPomodoroMode = (config as any).mode === 'POMODORO' || (config as any).mode === 1;

  const getPomodoroState = () => {
      if (phase !== SessionPhase.FOCUS || !isPomodoroMode || isTest) {
          return { isPomodoroBreak: false, label: 'FOCUS' };
      }
      const elapsed = calculatedFocusDuration - timeLeft;
      const cycleDuration = 30 * 60; 
      const workDuration = 25 * 60;
      const cyclePosition = elapsed % cycleDuration;
      const isBreak = cyclePosition >= workDuration;
      return {
          isPomodoroBreak: isBreak,
          label: isBreak ? 'BREAK' : 'FOCUS'
      };
  };

  const { isPomodoroBreak, label: phaseLabel } = getPomodoroState();
  const prevPomodoroBreak = useRef(isPomodoroBreak);

  const playSoftDing = () => {
      try {
          const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioContext) return;
          const ctx = new AudioContext();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.setValueAtTime(523.25, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1);
          gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 2);
          osc.start();
          osc.stop(ctx.currentTime + 2);
      } catch (e) {}
  };

  useEffect(() => {
      if (phase !== SessionPhase.FOCUS) return;
      if (isPomodoroBreak !== prevPomodoroBreak.current) {
          playSoftDing();
          if (isPomodoroBreak) {
              setMicEnabled(true);
              setManualMicToggle(true);
          } else {
              setMicEnabled(false);
              setManualMicToggle(false);
          }
          prevPomodoroBreak.current = isPomodoroBreak;
      }
  }, [isPomodoroBreak, phase]);

  useEffect(() => {
    if (!sessionId || !user.id || !partner.id) return;
    const amICaller = user.id < partner.id;
    setIsInitiator(amICaller);
    setIsReadyForWebRTC(true);
    setSessionReady(true);
  }, [sessionId, user.id, partner.id]);

  const { localStream, remoteStream } = useWebRTC(isReadyForWebRTC ? sessionId : '', user.id, isInitiator);

  useEffect(() => {
    if (!sessionId) return;
    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.phaseStartTime) {
            phaseStartTimeRef.current = data.phaseStartTime;
        }

        if (data.phase && data.phase !== phaseRef.current) {
            setPhase(data.phase as SessionPhase);
            phaseRef.current = data.phase as SessionPhase;
            if (data.phase === SessionPhase.FOCUS) {
                setMicEnabled(false); 
                setManualMicToggle(false); 
            } else if (data.phase === SessionPhase.DEBRIEF) {
                setMicEnabled(true);
                setManualMicToggle(true);
            } else if (data.phase === SessionPhase.COMPLETED) {
                finishSession(false);
            }
        }

        if (data.phaseStartTime) {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - data.phaseStartTime) / 1000);
            let totalDurationForPhase = 0;
            if (data.phase === SessionPhase.ICEBREAKER) totalDurationForPhase = isTest ? 30 : config.preTalkMinutes * 60;
            else if (data.phase === SessionPhase.FOCUS) totalDurationForPhase = isTest ? 30 : config.duration * 60;
            else if (data.phase === SessionPhase.DEBRIEF) totalDurationForPhase = isTest ? 30 : config.postTalkMinutes * 60;
            const exactTimeLeft = Math.max(0, totalDurationForPhase - elapsedSeconds);
            setTimeLeft(prev => {
                if (Math.abs(prev - exactTimeLeft) > 2) return exactTimeLeft;
                return prev;
            });
        }

        if (data.lastReaction && data.lastReaction.senderId !== user.id) {
            if (Date.now() - data.lastReaction.timestamp < 3000) {
                triggerAura(data.lastReaction.emoji);
            }
        }

        if ((data.status === 'completed' || data.status === 'aborted') && data.abortedBy && data.abortedBy !== user.id) {
            alert("Partner ended the session.");
            onEndSession();
        }
    });
    return () => unsub();
  }, [sessionId, user.id, config, isTest]);

  // MOUSE CONTROLS
  useEffect(() => {
      const handleMouseMove = () => {
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          if (!isInteracting) {
              controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 2500);
          }
      };
      if (isInteracting) {
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      } else {
          handleMouseMove();
      }
      window.addEventListener('mousemove', handleMouseMove);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
  }, [isInteracting]);

  useEffect(() => {
    if (phase === SessionPhase.COMPLETED) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { handlePhaseTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const handlePhaseTimeout = async () => {
    let nextPhase: SessionPhase | null = null;
    const currentP = phaseRef.current; 
    if (currentP === SessionPhase.ICEBREAKER) nextPhase = SessionPhase.FOCUS;
    else if (currentP === SessionPhase.FOCUS) nextPhase = SessionPhase.DEBRIEF;
    else if (currentP === SessionPhase.DEBRIEF) nextPhase = SessionPhase.COMPLETED;

    if (nextPhase) {
        await updateDoc(doc(db, 'sessions', sessionId), { 
            phase: nextPhase,
            phaseStartTime: Date.now() 
        }).catch(console.error);
    }
  };

  const handleReaction = async (emoji: string) => {
      const now = Date.now();
      if (now - lastReactionTime.current < 800) return; 
      lastReactionTime.current = now;
      triggerAura(emoji);
      await updateDoc(doc(db, 'sessions', sessionId), {
          lastReaction: { emoji, senderId: user.id, timestamp: Date.now() }
      }).catch(console.error);
  };

  const triggerAura = (emoji: string) => {
      if (emoji === '🔥') {
          setIsFireActive(true);
          if (fireTimeoutRef.current) clearTimeout(fireTimeoutRef.current);
          fireTimeoutRef.current = setTimeout(() => setIsFireActive(false), 4000);
      }
  };

  const handleReportSubmit = async () => {
      if (!reportReason) return;
      try {
          await addDoc(collection(db, 'reports'), {
              reporterId: user.id,
              reportedId: partner.id,
              sessionId,
              reason: reportReason,
              details: reportDetails,
              timestamp: serverTimestamp(),
              status: 'pending'
          });
          setIsReportOpen(false);
          setReportDetails('');
          alert("Report submitted.");
      } catch (e) {}
  };

  useEffect(() => {
      if (myVideoRef.current && localStream) myVideoRef.current.srcObject = localStream;
      if (partnerVideoRef.current && remoteStream) {
          partnerVideoRef.current.srcObject = remoteStream;
          partnerVideoRef.current.play().catch(e => console.error(e));
      }
  }, [localStream, remoteStream]);

  useEffect(() => {
    if(localStream) {
        let trackEnabled = false;
        if (phase === SessionPhase.FOCUS) {
             trackEnabled = isPomodoroBreak ? micEnabled : false;
        } else {
             trackEnabled = micEnabled;
        }
        localStream.getAudioTracks().forEach(t => t.enabled = trackEnabled);
        localStream.getVideoTracks().forEach(t => t.enabled = camEnabled);
    }
  }, [micEnabled, camEnabled, localStream, phase, isPomodoroBreak]); 

  const { messages: chatMessages, sendMessage } = useChat(sessionReady ? sessionId : '', user.id, user.name);
  
 useEffect(() => {
    if (chatMessages.length > lastMsgCount.current) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg.senderId !== 'me' && !isChatOpen) {
            setUnreadChatCount(prev => prev + 1);
            const id = Date.now().toString();
            setFloatingMessages(prev => [...prev, { id, text: lastMsg.text, sender: partner.name }]);
            setTimeout(() => setFloatingMessages(prev => prev.filter(m => m.id !== id)), 6000);
        }
        lastMsgCount.current = chatMessages.length;
    }
    if (isChatOpen) {
        setUnreadChatCount(0);
        lastMsgCount.current = chatMessages.length;
    }
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (!sessionId) return;
    const q = query(collection(db, 'sessions', sessionId, 'tasks'), where('ownerId', '!=', user.id));
    const unsub = onSnapshot(q, snap => setPartnerTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as TodoItem))));
    return () => unsub();
  }, [sessionId, user.id]);

  const activePartnerTask = partnerTasks.find(t => !t.completed)?.text;

  // --- DRAG LOGIC ---
  const handleStartDrag = (clientX: number, clientY: number) => {
      setIsDragging(true);
      dragStart.current = { x: clientX - selfPos.x, y: clientY - selfPos.y };
  };
  const handleMouseDown = (e: React.MouseEvent) => handleStartDrag(e.clientX, e.clientY);
  const handleTouchStart = (e: React.TouchEvent) => handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
  
  useEffect(() => {
      const handleMove = (clientX: number, clientY: number) => {
          if (!isDragging) return;
          setSelfPos({ x: clientX - dragStart.current.x, y: clientY - dragStart.current.y });
      };
      const handleMouseUp = () => setIsDragging(false);
      const onMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
      const onTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);
      if (isDragging) {
          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
          window.addEventListener('touchmove', onTouchMove);
          window.addEventListener('touchend', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', onMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
          window.removeEventListener('touchmove', onTouchMove);
          window.removeEventListener('touchend', handleMouseUp);
      };
  }, [isDragging]);

  const handleAddTask = async (text: string) => {
    const newTask = { text, completed: false, ownerId: user.id, createdAt: serverTimestamp() };
    const docRef = await addDoc(collection(db, 'sessions', sessionId, 'tasks'), newTask);
    setMyTasks([...myTasks, { ...newTask, id: docRef.id } as any]);
  };
  const handleToggleTask = async (id: string) => {
    const updated = myTasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setMyTasks(updated);
    const task = updated.find(t => t.id === id);
    if (task) await updateDoc(doc(db, 'sessions', sessionId, 'tasks', id), { completed: task.completed }).catch(()=>{});
  };
  const handleDeleteTask = async (id: string) => {
    setMyTasks(myTasks.filter(t => t.id !== id));
    await deleteDoc(doc(db, 'sessions', sessionId, 'tasks', id)).catch(()=>{});
  };
  
  const finishSession = async (early: boolean) => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (early && sessionId) await updateDoc(doc(db, 'sessions', sessionId), { status: 'aborted', abortedBy: user.id }).catch(()=>{});
    if (early) onEndSession();
    else setPhase(SessionPhase.COMPLETED);
  };

  const handleExitClick = () => {
    if (phase === SessionPhase.FOCUS) setExitModalStep(1); 
    else if (confirm("Exit session?")) finishSession(true);
  };

  const confirmExitWithStrike = async () => {
      try {
          await updateDoc(doc(db, 'users', user.id), { strikes: increment(1), lastStrikeAt: Date.now() });
      } catch (e) { console.error(e); }
      finishSession(true);
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none font-sans text-white">
      
      {phase === SessionPhase.COMPLETED && (
          <div className="absolute inset-0 z-50">
            <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
          </div>
      )}

      {/* --- REALISTIC FIRE OVERLAY --- */}
      <RealisticFire active={isFireActive} />

      {/* --- PARTNER VIDEO (MAIN BACKGROUND) --- */}
      <div className="absolute inset-0 z-0 bg-slate-900">
          {remoteStream ? (
              <video 
                ref={partnerVideoRef} 
                autoPlay 
                playsInline 
                onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play()}
                className={`w-full h-full object-cover transition-all duration-1000 ${isFireActive ? 'brightness-125 contrast-125 sepia-[0.2]' : 'brightness-90'}`}
              />
          ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                  <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center animate-pulse">
                      <UserIcon className="text-white/50" />
                  </div>
                  <span className="text-xs uppercase tracking-[0.3em] text-white/50">Establishing Link</span>
              </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80 pointer-events-none" />
      </div>

      {/* --- SELF VIDEO --- */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ transform: `translate3d(${selfPos.x}px, ${selfPos.y}px, 0)` }}
        className={`absolute w-32 md:w-48 aspect-[9/16] bg-black shadow-2xl z-40 cursor-grab active:cursor-grabbing group overflow-hidden transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
      >
          <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1] opacity-90 group-hover:opacity-100 transition-opacity" />
          {!micEnabled && (
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center backdrop-blur-md">
                  <MicOff size={12} className="text-white" />
              </div>
          )}
      </div>

      {/* --- TOP LEFT STATUS --- */}
      <div className={`absolute top-6 left-6 z-30 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
          <div className="flex flex-col">
              <span className="text-4xl font-light tracking-tighter tabular-nums font-mono leading-none">
                  {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
              </span>
              <span className={`text-[10px] uppercase tracking-[0.3em] font-bold mt-1 ${
                  phase === SessionPhase.FOCUS 
                      ? (isPomodoroBreak ? 'text-emerald-400' : 'text-blue-400') 
                      : 'text-slate-400'
              }`}>
                  {phase === SessionPhase.ICEBREAKER ? 'WARM UP' : phaseLabel}
              </span>
          </div>
      </div>

      {/* --- TOP RIGHT TOOLS --- */}
      <div className={`absolute top-6 right-6 z-30 flex gap-4 transition-opacity duration-500 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
           <button onClick={() => setIsReportOpen(true)} className="opacity-50 hover:opacity-100 transition-opacity text-white"><Flag size={20} /></button>
           <button onClick={handleExitClick} className="opacity-50 hover:opacity-100 hover:text-red-500 transition-all text-white"><LogOut size={20} /></button>
      </div>

      {/* --- BOTTOM CONTROLS --- */}
      <div 
        className={`absolute bottom-8 left-0 right-0 flex justify-center z-50 transition-all duration-500 transform ${showControls ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'}`}
        onMouseEnter={() => setIsInteracting(true)}
        onMouseLeave={() => setIsInteracting(false)}
      >
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 px-6 py-3 rounded-full flex items-center gap-6 shadow-2xl">
              <div className="flex items-center gap-3">
                  <button onClick={() => { if (phase !== SessionPhase.FOCUS || isPomodoroBreak) { setMicEnabled(!micEnabled); setManualMicToggle(!micEnabled); }}} className={`p-3 rounded-full transition-all ${!micEnabled ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                      {micEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button onClick={() => setCamEnabled(!camEnabled)} className={`p-3 rounded-full transition-all ${!camEnabled ? 'bg-red-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                      {camEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              <div className="flex items-center gap-3">
                  <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadChatCount(0); }} className="p-3 rounded-full hover:bg-white/10 text-slate-300 hover:text-white relative">
                      <MessageSquare size={20} />
                      {unreadChatCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></span>}
                  </button>
                  <button onClick={() => setIsTaskBoardOpen(!isTaskBoardOpen)} className={`p-3 rounded-full transition-all ${isTaskBoardOpen ? 'text-emerald-400 bg-emerald-500/10' : 'hover:bg-white/10 text-slate-300 hover:text-white'}`}>
                      <ListChecks size={20} />
                  </button>
                  {phase === SessionPhase.ICEBREAKER && (
                     <button onClick={async () => { setIsLoadingIcebreaker(true); setIcebreaker(await generateIcebreaker(partner.type)); setIsLoadingIcebreaker(false); }} className="p-3 rounded-full hover:bg-white/10 text-yellow-400 hover:text-yellow-200">
                        <Sparkles size={20} className={isLoadingIcebreaker ? 'animate-spin' : ''} />
                     </button>
                  )}
              </div>
              <div className="w-px h-8 bg-white/10"></div>
              
              {/* FIRE BUTTON */}
              <button 
                  onClick={() => handleReaction('🔥')}
                  className={`p-3 rounded-full transition-all hover:bg-orange-500/20 hover:text-orange-400 ${isFireActive ? 'text-orange-500 scale-125' : 'text-slate-400'}`}
              >
                  <Flame size={20} fill={isFireActive ? "currentColor" : "none"} />
              </button>
          </div>
      </div>

      {/* --- OVERLAYS --- */}
      <div className="absolute bottom-32 left-8 z-30 flex flex-col items-start gap-3 pointer-events-none">
          {floatingMessages.map(msg => (
              <div key={msg.id} className="bg-black/60 backdrop-blur-md px-4 py-2 rounded-2xl rounded-bl-none border-l-2 border-blue-500 animate-in slide-in-from-left-4 fade-in duration-300 max-w-sm">
                  <p className="text-white text-sm">{msg.text}</p>
              </div>
          ))}
      </div>

      <div className="pointer-events-auto" onMouseEnter={() => setIsInteracting(true)} onMouseLeave={() => setIsInteracting(false)}>
           <ChatWindow messages={chatMessages} onSendMessage={sendMessage} partnerName={partner.name} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
           <TaskBoard isOpen={isTaskBoardOpen} onClose={() => setIsTaskBoardOpen(false)} myTasks={myTasks} partnerTasks={partnerTasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} isRevealed={phase !== SessionPhase.FOCUS} canEdit={phase === SessionPhase.ICEBREAKER} partnerName={partner.name} />
      </div>

      {icebreaker && (
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-white/10 text-white px-8 py-6 rounded-2xl shadow-2xl max-w-lg text-center pointer-events-auto animate-in fade-in zoom-in-95 z-50">
              <p className="text-xl font-light font-serif italic">"{icebreaker}"</p>
              <button onClick={() => setIcebreaker(null)} className="mt-6 text-xs text-slate-500 hover:text-white uppercase tracking-widest">Dismiss</button>
          </div>
      )}

      {(isReportOpen || exitModalStep > 0) && (
          <div className="absolute inset-0 z-[60] bg-black/90 flex items-center justify-center p-4">
              {isReportOpen && (
                  <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-lg w-full max-w-sm space-y-4">
                      <h3 className="text-white font-bold">Report User</h3>
                      <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white outline-none">
                          <option>Inappropriate Behavior</option>
                          <option>Abusive Language</option>
                      </select>
                      <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-black border border-zinc-700 rounded p-2 text-white h-24" placeholder="Details..." />
                      <div className="flex gap-2">
                          <Button variant="secondary" onClick={() => setIsReportOpen(false)} className="flex-1">Cancel</Button>
                          <Button variant="danger" onClick={handleReportSubmit} className="flex-1">Submit</Button>
                      </div>
                  </div>
              )}
              {exitModalStep > 0 && (
                  <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 p-8 rounded-lg text-center">
                      <h3 className="text-2xl font-bold text-white mb-2">Leave Session?</h3>
                      <p className="text-zinc-400 mb-6">{exitModalStep === 1 ? "Leaving now breaks the flow for your partner." : "Leaving early results in a reliability strike."}</p>
                      <div className="flex gap-4 justify-center">
                          <button onClick={() => setExitModalStep(0)} className="px-6 py-2 rounded bg-white text-black font-medium hover:bg-zinc-200">Stay</button>
                          <button onClick={exitModalStep === 1 ? () => setExitModalStep(2) : confirmExitWithStrike} className="px-6 py-2 rounded text-red-500 hover:bg-red-500/10">Leave</button>
                      </div>
                  </div>
              )}
          </div>
      )}

    </div>
  );
};
export default LiveSession;
