import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionDuration, TodoItem } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Sparkles, LogOut, User as UserIcon, MessageSquare, ListChecks, Flag, X, AlertTriangle, HeartCrack, CheckCircle2, Gamepad2, Square, Scissors, Wind } from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { TaskBoard } from '../components/TaskBoard';
import { SessionRecap } from '../components/SessionRecap';
import { useChat } from '../hooks/useChat'; 
import { useWebRTC } from '../hooks/useWebRTC'; 
import { db } from '../utils/firebaseConfig';
import { collection, query, where, updateDoc, doc, addDoc, onSnapshot, deleteDoc, serverTimestamp, increment } from 'firebase/firestore';

interface LiveSessionProps {
  user: User;
  partner: Partner;
  config: SessionConfig;
  sessionId: string; 
  onEndSession: () => void;
}

// --- GAME TYPES ---
type GameType = 'TICTACTOE' | 'RPS' | 'BREATH' | null;
interface GameState {
    type: GameType;
    board?: (string | null)[]; // For TicTacToe
    turn?: string; // userId
    moves?: Record<string, string>; // For RPS { userId: 'ROCK' }
    winner?: string | 'DRAW' | null;
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
  
  // --- GAME STATE ---
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [gameState, setGameState] = useState<GameState>({ type: null });

  const [ripples, setRipples] = useState<{id: number, x: number, y: number}[]>([]);
  const [aura, setAura] = useState<'neutral' | 'fire' | 'power' | 'wave' | null>(null);

  const [floatingMessages, setFloatingMessages] = useState<{id: string, text: string, sender: string}[]>([]);
  const [isInteracting, setIsInteracting] = useState(false);

  const [exitModalStep, setExitModalStep] = useState<0 | 1 | 2>(0); 
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('Inappropriate Behavior');
  const [reportDetails, setReportDetails] = useState('');

  const [selfPos, setSelfPos] = useState({ x: 20, y: 100 }); 
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const lastReactionTime = useRef<number>(0);

  const [myTasks, setMyTasks] = useState<TodoItem[]>([]);
  const [partnerTasks, setPartnerTasks] = useState<TodoItem[]>([]);

  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const auraTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCount = useRef(0); 

  // --- POMODORO LOGIC ---
  const calculatedFocusDuration = isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60;
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
          label: isBreak ? 'FOCUS • BREAK' : 'FOCUS • WORK'
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
              // FORCE STOP GAME IF WORK STARTS
              setIsGameOpen(false);
          }
          prevPomodoroBreak.current = isPomodoroBreak;
      }
  }, [isPomodoroBreak, phase]);

  // --- SETUP ---
  useEffect(() => {
    if (!sessionId || !user.id || !partner.id) return;
    const amICaller = user.id < partner.id;
    setIsInitiator(amICaller);
    setIsReadyForWebRTC(true);
    setSessionReady(true);
  }, [sessionId, user.id, partner.id]);

  const { localStream, remoteStream } = useWebRTC(isReadyForWebRTC ? sessionId : '', user.id, isInitiator);

  // --- SYNC & REACTIONS ---
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
                setIsGameOpen(false); // Force close game on Focus start
            } else if (data.phase === SessionPhase.DEBRIEF) {
                setMicEnabled(true);
                setManualMicToggle(true);
            } else if (data.phase === SessionPhase.COMPLETED) {
                finishSession(false);
            }
        }

        // --- GAME STATE SYNC ---
        if (data.gameState) {
             setGameState(data.gameState);
             // If partner started a game, open the window for me too
             if (data.gameState.type && !isGameOpen && phase !== SessionPhase.FOCUS) {
                 setIsGameOpen(true);
             }
        }

        if (data.phaseStartTime) {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - data.phaseStartTime) / 1000);
            let totalDurationForPhase = 0;
            if (data.phase === SessionPhase.ICEBREAKER) totalDurationForPhase = isTest ? 30 : config.preTalkMinutes * 60;
            else if (data.phase === SessionPhase.FOCUS) totalDurationForPhase = isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60;
            else if (data.phase === SessionPhase.DEBRIEF) totalDurationForPhase = isTest ? 30 : config.postTalkMinutes * 60;
            
            const exactTimeLeft = Math.max(0, totalDurationForPhase - elapsedSeconds);
            setTimeLeft(prev => {
                if (Math.abs(prev - exactTimeLeft) > 2) return exactTimeLeft;
                return prev;
            });
        }

        if (data.lastReaction && data.lastReaction.senderId !== user.id) {
            if (Date.now() - data.lastReaction.timestamp < 2000) {
                triggerAura(data.lastReaction.emoji);
            }
        }

        if ((data.status === 'completed' || data.status === 'aborted') && data.abortedBy && data.abortedBy !== user.id) {
            alert("Partner ended the session.");
            onEndSession();
        }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user.id, config, isTest]);

  // --- GAME LOGIC ---
  const updateGame = async (newState: Partial<GameState>) => {
      await updateDoc(doc(db, 'sessions', sessionId), {
          gameState: { ...gameState, ...newState }
      });
  };

  const initGame = (type: GameType) => {
      if (type === 'TICTACTOE') {
          updateGame({ type, board: Array(9).fill(null), turn: isInitiator ? user.id : partner.id, winner: null });
      } else if (type === 'RPS') {
          updateGame({ type, moves: {}, winner: null });
      } else if (type === 'BREATH') {
          updateGame({ type, winner: null });
      }
  };

  const handleTicTacToeMove = (index: number) => {
      if (!gameState.board || gameState.board[index] || gameState.winner || gameState.turn !== user.id) return;
      
      const newBoard = [...gameState.board];
      newBoard[index] = user.id; // Mark with my ID
      
      // Check Winner
      const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      let winner = null;
      for (let i = 0; i < lines.length; i++) {
          const [a,b,c] = lines[i];
          if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) {
              winner = newBoard[a];
          }
      }
      if (!winner && !newBoard.includes(null)) winner = 'DRAW';

      updateGame({ board: newBoard, turn: partner.id, winner });
  };

  const handleRPSMove = (move: string) => {
      if (gameState.moves?.[user.id]) return; // Already moved
      
      const newMoves = { ...gameState.moves, [user.id]: move };
      let winner = null;
      
      // If both moved, decide winner
      if (Object.keys(newMoves).length === 2) {
          const myMove = newMoves[user.id];
          const theirMove = newMoves[partner.id];
          
          if (myMove === theirMove) winner = 'DRAW';
          else if (
              (myMove === 'ROCK' && theirMove === 'SCISSORS') ||
              (myMove === 'PAPER' && theirMove === 'ROCK') ||
              (myMove === 'SCISSORS' && theirMove === 'PAPER')
          ) winner = user.id;
          else winner = partner.id;
      }
      
      updateGame({ moves: newMoves, winner });
  };

  // --- STANDARD EFFECTS ---
  useEffect(() => {
      const handleMouseMove = () => {
          setShowUI(true);
          if (phase === SessionPhase.FOCUS) {
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
              if (!isInteracting && !isGameOpen) { // Keep UI open if game is open
                  controlsTimeoutRef.current = setTimeout(() => setShowUI(false), 2000);
              }
          }
      };

      if (isInteracting || isGameOpen) {
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
  }, [phase, isInteracting, isGameOpen]); 

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
            phaseStartTime: Date.now(),
            gameState: { type: null } // Reset game on phase change
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
      let type: 'fire' | 'power' | 'wave' = 'wave';
      if (emoji === '🔥') type = 'fire';
      if (emoji === '💯') type = 'power';
      setAura(type);
      if (auraTimeoutRef.current) clearTimeout(auraTimeoutRef.current);
      auraTimeoutRef.current = setTimeout(() => setAura(null), 2500);
  };

  const handlePartnerClick = (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = Date.now();
      setRipples(prev => [...prev, { id, x, y }]);
      setTimeout(() => setRipples(prev => prev.filter(r => r.id !== id)), 1000);
      handleReaction('👋'); 
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
          alert("Report submitted successfully.");
      } catch (e) { console.error("Report error:", e); }
  };

  useEffect(() => {
      if (myVideoRef.current && localStream) myVideoRef.current.srcObject = localStream;
      if (partnerVideoRef.current && remoteStream) {
          partnerVideoRef.current.srcObject = remoteStream;
          partnerVideoRef.current.play().catch(e => console.error("Autoplay failed", e));
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

  const getAuraClass = () => {
      if (isPomodoroBreak) return 'border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.4)]';
      if (!aura) return 'border-white/5'; 
      if (aura === 'fire') return 'border-orange-500/60 shadow-[0_0_50px_rgba(249,115,22,0.4)]';
      if (aura === 'power') return 'border-emerald-500/60 shadow-[0_0_50px_rgba(16,185,129,0.4)]';
      return 'border-blue-400/60 shadow-[0_0_50px_rgba(96,165,250,0.4)]';
  };

  return (
    <div className="absolute inset-0 bg-black overflow-hidden select-none font-sans">
      
      <style>{`
        @keyframes ripple-effect {
          0% { transform: scale(0); opacity: 0.8; }
          100% { transform: scale(4); opacity: 0; }
        }
        @keyframes messageFloatUp {
          0% { transform: translateY(20px) scale(0.95); opacity: 0; }
          10% { transform: translateY(0) scale(1); opacity: 1; }
          90% { transform: translateY(-10px) scale(1); opacity: 1; }
          100% { transform: translateY(-20px) scale(0.95); opacity: 0; }
        }
        @keyframes breath {
            0%, 100% { transform: scale(0.8); opacity: 0.5; }
            50% { transform: scale(1.5); opacity: 0.9; }
        }
        .vignette {
            background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.9) 100%);
        }
      `}</style>
      
      {phase === SessionPhase.COMPLETED && (
          <div className="absolute inset-0 z-50">
            <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
          </div>
      )}

      {/* --- PARTNER VIDEO --- */}
      <div 
        className={`absolute inset-0 z-10 transition-all duration-[1500ms] ease-in-out border-4 ${getAuraClass()} ${phase === SessionPhase.FOCUS ? 'scale-[0.98] rounded-2xl overflow-hidden' : ''}`}
        onClick={handlePartnerClick} 
      >
          {remoteStream ? (
              <video 
                ref={partnerVideoRef} 
                autoPlay 
                playsInline 
                onLoadedMetadata={(e) => (e.target as HTMLVideoElement).play()}
                className="w-full h-full object-cover" 
              />
          ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-900/50">
                  <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse"></div>
                      <UserIcon size={64} className="text-slate-700 relative z-10" />
                  </div>
                  <span className="text-slate-500 font-medium animate-pulse">Syncing...</span>
              </div>
          )}

          <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {ripples.map(r => (
                  <div 
                    key={r.id}
                    className="absolute border border-white/50 rounded-full bg-white/10"
                    style={{ left: r.x, top: r.y, width: '50px', height: '50px', marginLeft: '-25px', marginTop: '-25px', animation: 'ripple-effect 1s ease-out forwards' }}
                  />
              ))}
          </div>

          {activePartnerTask && showUI && (
              <div className="absolute bottom-8 left-0 right-0 flex justify-center pointer-events-none animate-in fade-in slide-in-from-bottom-2">
                   <div className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2 max-w-[80%] shadow-2xl">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs text-slate-300 font-medium truncate">{partner.name} is working on: <span className="text-white">{activePartnerTask}</span></span>
                   </div>
              </div>
          )}
      </div>

      <div className={`absolute inset-0 z-20 pointer-events-none transition-opacity duration-[2000ms] ${phase === SessionPhase.FOCUS ? 'opacity-100 vignette' : 'opacity-0'}`} />

      {/* --- FLOATING MESSAGES --- */}
      <div className="absolute bottom-32 left-0 right-0 z-30 flex flex-col items-center gap-2 pointer-events-none">
          {floatingMessages.map(msg => (
              <div key={msg.id} className="bg-black/60 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full shadow-xl flex items-center gap-2 animate-[messageFloatUp_5s_ease-out_forwards]">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-[10px] font-bold text-white uppercase">{msg.sender.substring(0,1)}</div>
                  <span className="text-slate-200 text-sm font-medium">{msg.text}</span>
              </div>
          ))}
      </div>

      {/* --- SELF VIDEO --- */}
      <div 
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        style={{ transform: `translate3d(${selfPos.x}px, ${selfPos.y}px, 0)` }}
        className={`absolute top-0 left-0 w-28 md:w-44 aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-30 cursor-grab active:cursor-grabbing transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
      >
          <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
              <div className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-medium">You</div>
              {!micEnabled && <div className="bg-red-500/80 p-1 rounded-full"><MicOff size={10} className="text-white"/></div>}
          </div>
      </div>

      {/* --- GAME OVERLAY --- */}
      {isGameOpen && (
          <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden max-w-sm w-full relative">
                  <div className="bg-slate-800/50 p-4 border-b border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-white flex items-center gap-2"><Gamepad2 size={18}/> Mini Games</h3>
                      <button onClick={() => setIsGameOpen(false)} className="text-slate-400 hover:text-white"><X size={18}/></button>
                  </div>
                  
                  <div className="p-6">
                      {!gameState.type ? (
                          <div className="grid grid-cols-3 gap-3">
                              <button onClick={() => initGame('TICTACTOE')} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                                  <Square size={24} className="text-blue-400"/> <span className="text-xs text-slate-300">TicTacToe</span>
                              </button>
                              <button onClick={() => initGame('RPS')} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                                  <Scissors size={24} className="text-pink-400"/> <span className="text-xs text-slate-300">R.P.S.</span>
                              </button>
                              <button onClick={() => initGame('BREATH')} className="flex flex-col items-center gap-2 p-4 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
                                  <Wind size={24} className="text-emerald-400"/> <span className="text-xs text-slate-300">Breathe</span>
                              </button>
                          </div>
                      ) : (
                          <div className="flex flex-col items-center gap-4">
                              
                              {/* --- TICTACTOE --- */}
                              {gameState.type === 'TICTACTOE' && (
                                  <>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-800 p-2 rounded-xl">
                                        {gameState.board?.map((cell, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleTicTacToeMove(i)}
                                                disabled={!!cell || gameState.winner !== null}
                                                className="w-16 h-16 bg-slate-900 rounded-lg flex items-center justify-center text-2xl font-bold border border-slate-700 hover:bg-slate-800 disabled:hover:bg-slate-900"
                                            >
                                                {cell === user.id ? '❌' : cell ? '⭕' : ''}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="text-sm text-slate-300">
                                        {gameState.winner 
                                            ? (gameState.winner === 'DRAW' ? "It's a Draw!" : (gameState.winner === user.id ? "You Won! 🎉" : `${partner.name} Won!`))
                                            : (gameState.turn === user.id ? "Your Turn (❌)" : `${partner.name}'s Turn (⭕)`)}
                                    </div>
                                  </>
                              )}

                              {/* --- RPS --- */}
                              {gameState.type === 'RPS' && (
                                  <>
                                    <div className="flex gap-4">
                                        <button onClick={() => handleRPSMove('ROCK')} disabled={!!gameState.moves?.[user.id]} className="p-4 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-50 text-2xl">🪨</button>
                                        <button onClick={() => handleRPSMove('PAPER')} disabled={!!gameState.moves?.[user.id]} className="p-4 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-50 text-2xl">📄</button>
                                        <button onClick={() => handleRPSMove('SCISSORS')} disabled={!!gameState.moves?.[user.id]} className="p-4 bg-slate-800 rounded-full hover:bg-slate-700 disabled:opacity-50 text-2xl">✂️</button>
                                    </div>
                                    <div className="text-sm text-slate-300 mt-2">
                                        {gameState.winner 
                                            ? (gameState.winner === 'DRAW' ? "Draw! try again." : (gameState.winner === user.id ? "You Won! 🎉" : `${partner.name} Won!`))
                                            : (gameState.moves?.[user.id] ? "Waiting for partner..." : "Choose your weapon!")}
                                    </div>
                                  </>
                              )}

                              {/* --- BREATH --- */}
                              {gameState.type === 'BREATH' && (
                                  <>
                                    <div className="w-24 h-24 bg-emerald-500/20 rounded-full border border-emerald-500/50 flex items-center justify-center animate-[breath_4s_ease-in-out_infinite]">
                                        <span className="text-xs text-emerald-200">Breathe</span>
                                    </div>
                                    <p className="text-xs text-slate-400">Sync your breath...</p>
                                  </>
                              )}

                              <button onClick={() => updateGame({ type: null, moves: {}, board: [], winner: null })} className="text-xs text-slate-500 hover:text-white mt-4 underline">Back to Menu</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* --- MAIN UI LAYER --- */}
      <div className={`absolute inset-0 pointer-events-none z-40 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TOP BAR */}
        <div className="absolute top-4 md:top-6 left-0 right-0 flex justify-center pointer-events-none px-14 md:px-0">
            <div className={`backdrop-blur-xl border rounded-full px-5 py-2 flex items-center gap-3 shadow-2xl transition-all duration-700 ${phase === SessionPhase.FOCUS ? 'bg-black/80 border-red-500/20 text-red-50' : 'bg-slate-900/80 border-slate-700'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${phase === SessionPhase.FOCUS ? (isPomodoroBreak ? 'text-emerald-400' : 'text-red-400') : 'text-slate-400'}`}>{phaseLabel}</span>
                <div className="w-px h-3 bg-white/10"></div>
                <span className="font-mono text-lg font-variant-numeric tabular-nums text-white">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
            </div>
        </div>

        {/* CONTROLS */}
        <div className="absolute bottom-8 left-0 right-0 px-4 flex flex-col md:flex-row items-center justify-center gap-4 pointer-events-auto">
             
             {/* Reactions */}
             <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl order-1 md:order-none">
                 <button onClick={() => handleReaction('🔥')} className="hover:scale-110 text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100">🔥</button>
                 <button onClick={() => handleReaction('💯')} className="hover:scale-110 text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100">💯</button>
                 <button onClick={() => handleReaction('👋')} className="hover:scale-110 text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100">👋</button>
             </div>

             {/* Main Controls */}
             <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-2 shadow-2xl order-2 md:order-none">
                {phase === SessionPhase.ICEBREAKER && (
                    <Button onClick={async () => { setIsLoadingIcebreaker(true); setIcebreaker(await generateIcebreaker(partner.type)); setIsLoadingIcebreaker(false); }} variant="ghost" className="rounded-full w-10 h-10 p-0 text-yellow-400 hover:bg-yellow-400/10">
                        <Sparkles size={18} className={isLoadingIcebreaker ? 'animate-spin' : ''}/>
                    </Button>
                )}

                <button 
                    onClick={() => { if (phase !== SessionPhase.FOCUS || isPomodoroBreak) { setMicEnabled(!micEnabled); setManualMicToggle(!micEnabled); }}} 
                    disabled={phase === SessionPhase.FOCUS && !isPomodoroBreak} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${(phase === SessionPhase.FOCUS && !isPomodoroBreak) ? 'opacity-30 cursor-not-allowed' : micEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}
                >
                    {micEnabled && (phase !== SessionPhase.FOCUS || isPomodoroBreak) ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button onClick={() => setCamEnabled(!camEnabled)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${camEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                    {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

                <div className="w-px h-6 bg-white/10 mx-1"></div>

                {/* GAME BUTTON - DISABLED DURING DEEP WORK */}
                <button 
                    onClick={() => setIsGameOpen(!isGameOpen)} 
                    disabled={phase === SessionPhase.FOCUS && !isPomodoroBreak}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isGameOpen ? 'bg-pink-500 text-white' : (phase === SessionPhase.FOCUS && !isPomodoroBreak ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-pink-400 hover:text-white')}`}
                >
                    <Gamepad2 size={18} />
                </button>

                <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadChatCount(0); }} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 text-slate-300 hover:text-white relative transition-colors">
                    <MessageSquare size={18} />
                    {unreadChatCount > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full ring-2 ring-black"></span>}
                </button>

                <button onClick={() => setIsTaskBoardOpen(!isTaskBoardOpen)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isTaskBoardOpen ? 'bg-emerald-500 text-white' : 'hover:bg-white/10 text-slate-300 hover:text-white'}`}>
                    <ListChecks size={18} />
                </button>
             </div>
        </div>

        {icebreaker && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-yellow-500/30 text-yellow-100 px-6 py-4 rounded-2xl shadow-2xl max-w-md text-center pointer-events-auto animate-in slide-in-from-bottom-4 w-[90%] md:w-auto z-50">
                <p className="text-sm font-medium leading-relaxed">✨ {icebreaker}</p>
                <button onClick={() => setIcebreaker(null)} className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 border border-slate-700 hover:bg-slate-700"><X size={12}/></button>
            </div>
        )}

        {(isReportOpen || exitModalStep > 0) && (
            <div className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in" onMouseEnter={() => setIsInteracting(true)} onMouseLeave={() => setIsInteracting(false)}>
                {isReportOpen && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 pointer-events-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2"><Flag size={18} className="text-red-500"/> Report User</h3>
                            <button onClick={() => setIsReportOpen(false)} className="text-slate-500 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 uppercase font-bold">Reason</label>
                            <select value={reportReason} onChange={(e) => setReportReason(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white focus:ring-1 focus:ring-blue-500 outline-none">
                                <option>Inappropriate Behavior</option>
                                <option>Abusive Language</option>
                                <option>Spam / Commercial</option>
                                <option>Camera Off / Not Working</option>
                                <option>Other</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs text-slate-400 uppercase font-bold">Details</label>
                            <textarea value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-white min-h-[80px] resize-none focus:ring-1 focus:ring-blue-500 outline-none" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button variant="secondary" onClick={() => setIsReportOpen(false)} className="flex-1">Cancel</Button>
                            <Button variant="danger" onClick={handleReportSubmit} className="flex-1">Submit</Button>
                        </div>
                    </div>
                )}
                {exitModalStep > 0 && (
                    <div className="max-w-md w-full bg-slate-900 border border-white/10 rounded-2xl p-6 shadow-2xl relative overflow-hidden pointer-events-auto">
                        {exitModalStep === 1 ? (
                            <div className="space-y-4 text-center">
                                <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-2"><HeartCrack size={32} className="text-blue-400" /></div>
                                <h3 className="text-xl font-bold text-white">Wait, don't break the flow!</h3>
                                <p className="text-slate-400 text-sm">Leaving now disrupts the session rhythm for <b>{partner.name}</b>.</p>
                                <div className="grid grid-cols-2 gap-3 mt-6">
                                    <Button onClick={() => setExitModalStep(0)} variant="secondary" className="border-slate-700 hover:bg-slate-800">I'll Stay</Button>
                                    <Button onClick={() => setExitModalStep(2)} className="bg-transparent border border-red-900/50 text-red-400 hover:bg-red-950">I Must Leave</Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4 text-center animate-in slide-in-from-right-8">
                                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-500/20"><AlertTriangle size={32} className="text-red-500" /></div>
                                <h3 className="text-xl font-bold text-white">Warning: Reliability Strike</h3>
                                <p className="text-slate-500 text-xs">Leaving early counts as a Strike. 3 Strikes = Timeout.</p>
                                <div className="grid grid-cols-2 gap-3 mt-6">
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
