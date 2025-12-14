import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionDuration, TodoItem } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Sparkles, LogOut, User as UserIcon, MessageSquare, ListChecks, Flag, X, AlertTriangle, HeartCrack, CheckCircle2, Flame, ThumbsUp, Hand } from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { TaskBoard } from '../components/TaskBoard';
import { SessionRecap } from '../components/SessionRecap';
import { useChat } from '../hooks/useChat'; 
import { useWebRTC } from '../hooks/useWebRTC'; 
import { db } from '../utils/firebaseConfig';
import { collection, query, where, updateDoc, doc, addDoc, onSnapshot, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';

// --- NEW: REALISTIC FIRE ENGINE (Canvas) ---
const FireCanvas = ({ active }: { active: boolean }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!active || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles: any[] = [];
    const particleCount = 150; // Density of fire

    // Initialize Particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height + Math.random() * 100,
        vx: (Math.random() - 0.5) * 2, // Drift left/right
        vy: Math.random() * -5 - 2,    // Upward speed
        life: Math.random() * 100,
        size: Math.random() * 6 + 2,
        color: `hsl(${Math.random() * 40 + 10}, 100%, 50%)` // Orange/Yellow range
      });
    }

    let animationId: number;

    const animate = () => {
      // Create fade effect (trails)
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      ctx.globalCompositeOperation = 'lighter'; // Makes fire glow when particles overlap

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        
        // Physics
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 1.5;
        p.size *= 0.98; // Shrink as they rise

        // Reset dead particles if "active" is still true (continuous fire)
        // OR let them die out naturally if just a burst
        if (p.life <= 0) {
            // Respawn at bottom
            p.x = Math.random() * canvas.width;
            p.y = canvas.height + 20;
            p.life = 100;
            p.size = Math.random() * 6 + 2;
            p.vy = Math.random() * -5 - 2;
        }

        // Draw
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        
        // Dynamic Color: Yellow at bottom -> Red at top
        const hue = 10 + (p.y / canvas.height) * 40; 
        ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${p.life / 100})`;
        ctx.fill();
      }

      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} className="absolute inset-0 z-20 pointer-events-none fade-in duration-500" />;
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

  const phaseRef = useRef<SessionPhase>(SessionPhase.ICEBREAKER);
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
  
  // REPLACED: Simple Aura -> Realistic Fire State
  const [isFireActive, setIsFireActive] = useState(false);
  const [aura, setAura] = useState<'neutral' | 'power' | 'wave' | null>(null);

  const [floatingMessages, setFloatingMessages] = useState<{id: string, text: string, sender: string}[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);

  // EXIT MODAL STATE
  const [exitModalStep, setExitModalStep] = useState<0 | 1 | 2>(0); 

  // Report State
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
  const fireTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCount = useRef(0); 

  // --- POMODORO LOGIC START ---
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
  // --- POMODORO LOGIC END ---

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
                triggerVisuals(data.lastReaction.emoji);
            }
        }

        if ((data.status === 'completed' || data.status === 'aborted') && data.abortedBy && data.abortedBy !== user.id) {
            alert("Partner ended the session.");
            onEndSession();
        }
    });
    return () => unsub();
  }, [sessionId, user.id, config, isTest]);

  useEffect(() => {
      const handleMouseMove = () => {
          setShowUI(true);
          if (phase === SessionPhase.FOCUS) {
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
              if (!isInteracting) {
                  controlsTimeoutRef.current = setTimeout(() => setShowUI(false), 2000);
              }
          }
      };

      if (isInteracting) {
          setShowUI(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      } else {
          handleMouseMove();
      }

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('touchstart', handleMouseMove); 
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('touchstart', handleMouseMove);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
  }, [phase, isInteracting]); 

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
      if (now - lastReactionTime.current < 2000) return; // Slower cooldown for spam prevention
      lastReactionTime.current = now;

      triggerVisuals(emoji);
      
      await updateDoc(doc(db, 'sessions', sessionId), {
          lastReaction: { emoji, senderId: user.id, timestamp: Date.now() }
      }).catch(console.error);
  };

  const triggerVisuals = (emoji: string) => {
      if (emoji === '🔥') {
          setIsFireActive(true);
          if (fireTimeoutRef.current) clearTimeout(fireTimeoutRef.current);
          fireTimeoutRef.current = setTimeout(() => setIsFireActive(false), 4000); // 4s Fire duration
      } else {
          setAura(emoji === '💯' ? 'power' : 'wave');
          setTimeout(() => setAura(null), 2500);
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

  // --- UI HELPER: Dynamic Ambient Light based on State ---
  const getAmbientLight = () => {
      if (isPomodoroBreak) return 'shadow-[0_0_100px_rgba(16,185,129,0.3)] border-emerald-500/30'; // Green during break
      if (phase === SessionPhase.FOCUS) return 'shadow-[0_0_100px_rgba(59,130,246,0.15)] border-blue-500/10'; // Deep Blue during focus
      return 'shadow-[0_0_80px_rgba(255,255,255,0.1)] border-white/10'; // Neutral
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none font-sans">
      
      <style>{`
        @keyframes messageFloatUp {
          0% { transform: translateY(20px) scale(0.95); opacity: 0; }
          10% { transform: translateY(0) scale(1); opacity: 1; }
          90% { transform: translateY(-10px) scale(1); opacity: 1; }
          100% { transform: translateY(-20px) scale(0.95); opacity: 0; }
        }
      `}</style>
      
      {phase === SessionPhase.COMPLETED && (
          <div className="absolute inset-0 z-50">
            <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
          </div>
      )}

      {/* --- REALISTIC FIRE OVERLAY --- */}
      <FireCanvas active={isFireActive} />

      {/* --- PARTNER VIDEO (MAIN) --- */}
      <div className={`absolute inset-0 z-10 transition-all duration-[1500ms] ease-in-out border-2 ${getAmbientLight()} ${phase === SessionPhase.FOCUS ? 'scale-[0.98] rounded-3xl overflow-hidden' : ''}`}>
          {remoteStream ? (
              <video 
                ref={partnerVideoRef} 
                autoPlay 
                playsInline 
                onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play()}
                className="w-full h-full object-cover" 
              />
          ) : (
              <div className="flex flex-col items-center justify-center h-full gap-6 bg-slate-900">
                  <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse"></div>
                      <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center relative z-10 border border-slate-700">
                          <UserIcon size={40} className="text-slate-500" />
                      </div>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                      <span className="text-slate-400 font-medium tracking-widest text-sm uppercase">Connecting</span>
                      <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                  </div>
              </div>
          )}
          
          {/* Cinematic Gradient at bottom for legibility */}
          <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Simple reaction popups (Non-Fire) */}
          {aura && aura !== 'neutral' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                  <div className="text-8xl animate-[messageFloatUp_1s_ease-out_forwards]">
                      {aura === 'power' ? '💯' : '👋'}
                  </div>
              </div>
          )}

          {activePartnerTask && showUI && (
              <div className="absolute bottom-32 left-0 right-0 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2 z-30">
                   <div className="bg-black/30 backdrop-blur-md border border-white/5 px-4 py-2 rounded-full flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                        <span className="text-xs text-slate-300 font-medium tracking-wide">
                            {partner.name} is focusing on <span className="text-white font-bold">{activePartnerTask}</span>
                        </span>
                   </div>
              </div>
          )}
      </div>

      {/* --- SELF VIDEO (Draggable PIP Style) --- */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ transform: `translate3d(${selfPos.x}px, ${selfPos.y}px, 0)` }}
        className={`absolute top-0 left-0 w-28 md:w-40 aspect-[9/16] bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-40 cursor-grab active:cursor-grabbing transition-opacity duration-500 group ${showUI ? 'opacity-100' : 'opacity-40 hover:opacity-100'}`}
      >
          <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          {/* Mini Status Bar */}
          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-white tracking-wider">YOU</span>
                  {!micEnabled && <MicOff size={10} className="text-red-400"/>}
              </div>
          </div>
      </div>

      {/* --- FLOATING CHAT BUBBLES --- */}
      <div className="absolute bottom-32 left-8 z-30 flex flex-col items-start gap-2 pointer-events-none">
          {floatingMessages.map(msg => (
              <div key={msg.id} className="bg-black/50 backdrop-blur-xl border border-white/10 px-4 py-3 rounded-2xl rounded-bl-none shadow-lg animate-[messageFloatUp_6s_ease-out_forwards] max-w-xs">
                  <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-blue-400 uppercase">{msg.sender}</span>
                  </div>
                  <span className="text-white text-sm font-medium">{msg.text}</span>
              </div>
          ))}
      </div>

      {/* --- HUD INTERFACE --- */}
      <div className={`absolute inset-0 pointer-events-none z-50 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TIMER PILL (Dynamic Island Style) */}
        <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none">
            <div className={`backdrop-blur-2xl px-6 py-3 rounded-full flex items-center gap-4 shadow-2xl transition-all duration-700 border ${
                phase === SessionPhase.FOCUS 
                    ? (isPomodoroBreak ? 'bg-emerald-950/60 border-emerald-500/30' : 'bg-black/60 border-blue-500/20') 
                    : 'bg-slate-950/60 border-white/10'
            }`}>
                <div className="flex flex-col items-end leading-none">
                    <span className="font-mono text-2xl font-bold text-white tabular-nums tracking-tight">
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </span>
                </div>
                <div className="h-8 w-px bg-white/10"></div>
                <div className="flex flex-col justify-center">
                    <span className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                        phase === SessionPhase.FOCUS 
                            ? (isPomodoroBreak ? 'text-emerald-400' : 'text-blue-400') 
                            : 'text-slate-400'
                    }`}>
                        {phase === SessionPhase.ICEBREAKER ? 'WARM UP' :
                         phase === SessionPhase.DEBRIEF ? 'DEBRIEF' :
                         phaseLabel}
                    </span>
                    {phase === SessionPhase.FOCUS && !isPomodoroBreak && (
                        <span className="text-[9px] text-slate-500 font-medium">STAY IN ZONE</span>
                    )}
                </div>
            </div>
        </div>

        {/* UTILITY BUTTONS (Report / Exit) */}
        <div className="absolute top-6 right-6 pointer-events-auto flex gap-3">
             <button 
                onClick={() => setIsReportOpen(true)} 
                className="w-10 h-10 rounded-full bg-black/20 hover:bg-black/60 backdrop-blur-md border border-white/5 hover:border-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-all"
                title="Report"
            >
                <Flag size={16} />
            </button>
            <button 
                onClick={handleExitClick}
                className="w-10 h-10 rounded-full bg-red-500/10 hover:bg-red-500/20 backdrop-blur-md border border-red-500/20 hover:border-red-500/40 text-red-400 flex items-center justify-center transition-all"
                title="End Session"
            >
                <LogOut size={16} />
            </button>
        </div>

        {/* BOTTOM DOCK (Glassmorphism Controls) */}
        <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-auto">
             <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-3xl p-2 px-4 shadow-2xl flex items-center gap-3 md:gap-4 transition-transform hover:scale-[1.02]">
                
                {/* REACTION BUTTONS */}
                <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                    <button 
                        onClick={() => handleReaction('🔥')} 
                        className="p-3 rounded-xl hover:bg-white/10 transition-all group relative overflow-hidden"
                        title="Send Fire"
                    >
                        <Flame size={20} className={`text-orange-500 transition-transform group-hover:scale-110 ${isFireActive ? 'animate-bounce' : ''}`} />
                        {isFireActive && <div className="absolute inset-0 bg-orange-500/20 blur-md"></div>}
                    </button>
                    <button onClick={() => handleReaction('💯')} className="p-3 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"><ThumbsUp size={20} /></button>
                    <button onClick={() => handleReaction('👋')} className="p-3 rounded-xl hover:bg-white/10 transition-all text-slate-400 hover:text-white"><Hand size={20} /></button>
                </div>

                {/* MEDIA CONTROLS */}
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => { if (phase !== SessionPhase.FOCUS || isPomodoroBreak) { setMicEnabled(!micEnabled); setManualMicToggle(!micEnabled); }}} 
                        disabled={phase === SessionPhase.FOCUS && !isPomodoroBreak} 
                        className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                            (phase === SessionPhase.FOCUS && !isPomodoroBreak) 
                            ? 'opacity-30 cursor-not-allowed bg-white/5' 
                            : micEnabled 
                                ? 'bg-white/10 hover:bg-white/20 text-white shadow-inner' 
                                : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                    >
                        {micEnabled && (phase !== SessionPhase.FOCUS || isPomodoroBreak) ? <Mic size={20} /> : <MicOff size={20} />}
                    </button>

                    <button onClick={() => setCamEnabled(!camEnabled)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${camEnabled ? 'bg-white/10 hover:bg-white/20 text-white shadow-inner' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {camEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                    </button>
                </div>

                {/* TOOLS */}
                <div className="flex items-center gap-2 pl-4 border-l border-white/10">
                    {phase === SessionPhase.ICEBREAKER && (
                        <button onClick={async () => { setIsLoadingIcebreaker(true); setIcebreaker(await generateIcebreaker(partner.type)); setIsLoadingIcebreaker(false); }} className="w-12 h-12 rounded-2xl flex items-center justify-center bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 transition-all">
                            <Sparkles size={20} className={isLoadingIcebreaker ? 'animate-spin' : ''}/>
                        </button>
                    )}

                    <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadChatCount(0); }} className="w-12 h-12 rounded-2xl flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white relative transition-colors">
                        <MessageSquare size={20} />
                        {unreadChatCount > 0 && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-black"></span>}
                    </button>

                    <button onClick={() => setIsTaskBoardOpen(!isTaskBoardOpen)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${isTaskBoardOpen ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'hover:bg-white/10 text-slate-300 hover:text-white'}`}>
                        <ListChecks size={20} />
                    </button>
                </div>
             </div>
        </div>

        {/* FLOATING WINDOWS (Chat/Tasks) */}
        <div 
            className="pointer-events-auto"
            onMouseEnter={() => setIsInteracting(true)}
            onMouseLeave={() => setIsInteracting(false)}
        >
             <ChatWindow messages={chatMessages} onSendMessage={sendMessage} partnerName={partner.name} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
             <TaskBoard isOpen={isTaskBoardOpen} onClose={() => setIsTaskBoardOpen(false)} myTasks={myTasks} partnerTasks={partnerTasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} isRevealed={phase !== SessionPhase.FOCUS} canEdit={phase === SessionPhase.ICEBREAKER} partnerName={partner.name} />
        </div>

        {icebreaker && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-xl border border-yellow-500/30 text-yellow-100 px-8 py-6 rounded-3xl shadow-2xl max-w-lg text-center pointer-events-auto animate-in slide-in-from-top-4 w-[90%] z-50">
                <p className="text-lg font-medium leading-relaxed font-serif italic">"{icebreaker}"</p>
                <button onClick={() => setIcebreaker(null)} className="absolute -top-3 -right-3 bg-slate-800 rounded-full p-2 border border-slate-600 hover:bg-slate-700 shadow-lg"><X size={16}/></button>
            </div>
        )}

        {(isReportOpen || exitModalStep > 0) && (
            <div 
                className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                onMouseEnter={() => setIsInteracting(true)}
                onMouseLeave={() => setIsInteracting(false)}
            >
                {/* Same Modals as before, just kept for logic consistency */}
                {isReportOpen && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 pointer-events-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><Flag size={18} className="text-red-500"/> Report User</h3>
                            <button onClick={() => setIsReportOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 uppercase font-bold">Reason</label>
                            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white outline-none">
                                <option>Inappropriate Behavior</option>
                                <option>Abusive Language</option>
                                <option>Spam / Commercial</option>
                                <option>Camera Off / Not Working</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white min-h-[80px]" />
                        <div className="flex gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setIsReportOpen(false)} className="flex-1">Cancel</Button>
                            <Button variant="danger" onClick={handleReportSubmit} className="flex-1">Submit</Button>
                        </div>
                    </div>
                )}
                {exitModalStep > 0 && (
                    <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl text-center pointer-events-auto">
                        {exitModalStep === 1 ? (
                            <div className="space-y-4">
                                <HeartCrack size={40} className="text-blue-400 mx-auto" />
                                <h3 className="text-xl font-bold text-white">Wait, don't break the flow!</h3>
                                <p className="text-slate-400">Leaving now disrupts the session rhythm for <b>{partner.name}</b>.</p>
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <Button onClick={() => setExitModalStep(0)} variant="secondary">I'll Stay</Button>
                                    <Button onClick={() => setExitModalStep(2)} className="bg-transparent border border-red-900/50 text-red-400">I Must Leave</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <AlertTriangle size={40} className="text-red-500 mx-auto" />
                                <h3 className="text-xl font-bold text-white">Reliability Strike</h3>
                                <p className="text-slate-500 text-sm">Leaving early counts as a Strike. 3 Strikes = Timeout.</p>
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <Button onClick={() => setExitModalStep(0)} variant="secondary">Go Back</Button>
                                    <Button onClick={confirmExitWithStrike} variant="danger">Confirm Exit</Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
};
export default LiveSession;
