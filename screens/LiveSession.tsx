import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionDuration, TodoItem } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Sparkles, LogOut, User as UserIcon, MessageSquare, ListChecks, Flag, X, AlertTriangle, HeartCrack, CheckCircle2, Gamepad2, Trophy, Zap, Circle } from 'lucide-react';
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

// --- GAME LOGIC TYPES ---
type GameType = 'TICTACTOE' | 'RPS' | 'PONG' | null;

interface GameState {
    type: GameType;
    // TicTacToe
    board?: (string | null)[]; 
    turn?: string; // userId
    // RPS
    moves?: Record<string, string>; 
    // Pong (Rally)
    ballOwner?: string; // Who has the ball?
    rallyCount?: number;
    // Common
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

  // --- GAME STATE ---
  const [isGameOpen, setIsGameOpen] = useState(false);
  const [gameInvite, setGameInvite] = useState(false); // Notification
  const [gameState, setGameState] = useState<GameState>({ type: null });
  // REPLACED: Floating Emojis -> Ripples & Aura
  const [ripples, setRipples] = useState<{id: number, x: number, y: number}[]>([]);
  const [aura, setAura] = useState<'neutral' | 'fire' | 'power' | 'wave' | null>(null);

  // Floating Messages State (Chat bubbles)
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

  // Anti-Spam Ref
  const lastReactionTime = useRef<number>(0);

  const [myTasks, setMyTasks] = useState<TodoItem[]>([]);
  const [partnerTasks, setPartnerTasks] = useState<TodoItem[]>([]);

  // Refs
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const auraTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMsgCount = useRef(0); 

  // ---------------------------------------------------------------------------
  // ADDED: POMODORO LOGIC START
  // ---------------------------------------------------------------------------
  
  // 1. Calculate total expected focus duration to determine cycles
  const calculatedFocusDuration = isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60;
  
  // 2. Check if mode is Pomodoro (handling potentially untyped config from props)
  const isPomodoroMode = (config as any).mode === 'POMODORO' || (config as any).mode === 1;

  // 3. Helper to determine current Pomodoro state based on timeLeft
  const getPomodoroState = () => {
      // Only apply during FOCUS phase and if enabled
      if (phase !== SessionPhase.FOCUS || !isPomodoroMode || isTest) {
          return { isPomodoroBreak: false, label: 'FOCUS' };
      }

      // Calculate elapsed time in Focus phase
      const elapsed = calculatedFocusDuration - timeLeft;
      
      // Standard Pomodoro: 25m Work + 5m Break = 30m (1800s) cycle
      const cycleDuration = 30 * 60; 
      const workDuration = 25 * 60;

      // Determine position in the current cycle
      const cyclePosition = elapsed % cycleDuration;
      
      // If we are past the work duration in this cycle, it's a break
      const isBreak = cyclePosition >= workDuration;

      return {
          isPomodoroBreak: isBreak,
          label: isBreak ? 'FOCUS • BREAK' : 'FOCUS • WORK'
      };
  };

  const { isPomodoroBreak, label: phaseLabel } = getPomodoroState();
  const prevPomodoroBreak = useRef(isPomodoroBreak);

  // 4. Sound Effect Helper (Soft Ding)
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
          osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5 (Soft Pitch)
          
          // Soft attack and decay
          gain.gain.setValueAtTime(0, ctx.currentTime);
          gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.1); // Low volume (0.1)
          gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 2); // Slow fade
          
          osc.start();
          osc.stop(ctx.currentTime + 2);
      } catch (e) {
          // Fallback or silence
      }
  };

  // 5. Effect: Handle Work/Break Transitions (Audio & Mic)
  useEffect(() => {
      if (phase !== SessionPhase.FOCUS) return;

      if (isPomodoroBreak !== prevPomodoroBreak.current) {
          // Transition detected
          playSoftDing();
          
          if (isPomodoroBreak) {
              // Entering Break: Enable Mic
              setMicEnabled(true);
              setManualMicToggle(true);
          } else {
              // Entering Work: Disable Mic
              setMicEnabled(false);
              setManualMicToggle(false);
          }
          
          prevPomodoroBreak.current = isPomodoroBreak;
      }
  }, [isPomodoroBreak, phase]);

  // ---------------------------------------------------------------------------
  // ADDED: POMODORO LOGIC END
  // ---------------------------------------------------------------------------

  // --- 1. SETUP & WEBRTC ---
  useEffect(() => {
    if (!sessionId || !user.id || !partner.id) return;
    const amICaller = user.id < partner.id;
    setIsInitiator(amICaller);
    setIsReadyForWebRTC(true);
    setSessionReady(true);
  }, [sessionId, user.id, partner.id]);

  const { localStream, remoteStream } = useWebRTC(isReadyForWebRTC ? sessionId : '', user.id, isInitiator);

  // --- 2. SYNC & REACTIONS & GAMES ---
  useEffect(() => {
    if (!sessionId) return;

    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        // Sync Time
        if (data.phaseStartTime) {
            phaseStartTimeRef.current = data.phaseStartTime;
        }

        // Sync Phase
        if (data.phase && data.phase !== phaseRef.current) {
            setPhase(data.phase as SessionPhase);
            phaseRef.current = data.phase as SessionPhase;

            // Handle Phase Changes
            if (data.phase === SessionPhase.FOCUS) {
                setMicEnabled(false); 
                setManualMicToggle(false); 
                setIsGameOpen(false); // FORCE CLOSE GAME ON WORK START
                setGameInvite(false);
            } else if (data.phase === SessionPhase.DEBRIEF) {
                setMicEnabled(true);
                setManualMicToggle(true);
            } else if (data.phase === SessionPhase.COMPLETED) {
                finishSession(false);
            }
        }

        // --- GAME SYNC ---
        if (data.gameState) {
             setGameState(data.gameState);
             
             // Logic: If partner started a game, and I don't have it open, show invite
             if (data.gameState.type && !isGameOpen && phase !== SessionPhase.FOCUS) {
                 setGameInvite(true);
             } else if (!data.gameState.type) {
                 setGameInvite(false); // Clear invite if game ended
             }
        }

        // Timer Correction
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

        // Reactions
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
  }, [sessionId, user.id, config, isTest, isGameOpen]);

        // --- FIXED SYNC LOGIC ---
        // Calculate remaining time based on Server Start Time
        if (data.phaseStartTime) {
            const now = Date.now();
            const elapsedSeconds = Math.floor((now - data.phaseStartTime) / 1000);
            
            let totalDurationForPhase = 0;
            if (data.phase === SessionPhase.ICEBREAKER) totalDurationForPhase = isTest ? 30 : config.preTalkMinutes * 60;
            else if (data.phase === SessionPhase.FOCUS) totalDurationForPhase = isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60;
            else if (data.phase === SessionPhase.DEBRIEF) totalDurationForPhase = isTest ? 30 : config.postTalkMinutes * 60;
            
            const exactTimeLeft = Math.max(0, totalDurationForPhase - elapsedSeconds);
            
            // Only update if difference is significant (drift > 2 seconds) to avoid jitter
            // OR if we are initializing (timeLeft matches default)
            setTimeLeft(prev => {
                if (Math.abs(prev - exactTimeLeft) > 2) return exactTimeLeft;
                return prev;
            });
        }

        // Reactions
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
      setGameInvite(false); // Clear notification
      if (type === 'TICTACTOE') {
          // Initiator is always X, Partner is O
          updateGame({ type, board: Array(9).fill(null), turn: isInitiator ? user.id : partner.id, winner: null });
      } else if (type === 'RPS') {
          updateGame({ type, moves: {}, winner: null });
      } else if (type === 'PONG') {
          // Rally Pong: Ball starts with whoever clicked start
          updateGame({ type, ballOwner: user.id, rallyCount: 0, winner: null });
      }
  };

  // 1. TIC TAC TOE
  const handleTicTacToeMove = (index: number) => {
      if (!gameState.board || gameState.board[index] || gameState.winner || gameState.turn !== user.id) return;
      
      const newBoard = [...gameState.board];
      newBoard[index] = user.id; 
      
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

  // 2. ROCK PAPER SCISSORS
  const handleRPSMove = (move: string) => {
      if (gameState.moves?.[user.id]) return; 
      const newMoves = { ...gameState.moves, [user.id]: move };
      let winner = null;
      
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

  // 3. RALLY PONG (Lag-Free Version)
  const handlePongHit = () => {
      if (gameState.ballOwner !== user.id || gameState.winner) return;
      // Hit ball to partner
      updateGame({ ballOwner: partner.id, rallyCount: (gameState.rallyCount || 0) + 1 });
  };
  
  const handlePongMiss = () => {
      // I missed the ball, partner wins
      updateGame({ winner: partner.id });
  };
  // --- 3. ZEN MODE / MOUSE HANDLING ---
  useEffect(() => {
      const handleMouseMove = () => {
          setShowUI(true);
          
          // In focus mode, hide UI faster (2s) to encourage work
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

  // --- 4. TIMER (With Local Countdown) ---
  useEffect(() => {
    if (phase === SessionPhase.COMPLETED) return;
    
    // We still keep local interval for smooth seconds, 
    // but the onSnapshot above corrects it if it drifts.
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { handlePhaseTimeout(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // --- FIXED: PHASE TRANSITION ---
  const handlePhaseTimeout = async () => {
    let nextPhase: SessionPhase | null = null;
    const currentP = phaseRef.current; 
    
    // Double check we haven't already moved (prevent double triggers)
    // In a real app we might use a transition flag, but checking timeLeft or phase is decent
    
    if (currentP === SessionPhase.ICEBREAKER) nextPhase = SessionPhase.FOCUS;
    else if (currentP === SessionPhase.FOCUS) nextPhase = SessionPhase.DEBRIEF;
    else if (currentP === SessionPhase.DEBRIEF) nextPhase = SessionPhase.COMPLETED;

    if (nextPhase) {
        // IMPORTANT: Write the Timestamp! This fixes the sync issue.
        await updateDoc(doc(db, 'sessions', sessionId), { 
            phase: nextPhase,
            phaseStartTime: Date.now() 
        }).catch(console.error);
    }
  };

  // --- REACTION LOGIC ---
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

  // --- 5. REPORT ---
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
      } catch (e) {
          console.error("Report error:", e);
      }
  };

  // --- MEDIA ---
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

  // --- CHAT & TASK SYNC ---
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

  // --- DRAG ---
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

  // --- HANDLERS ---
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
        .vignette {
            background: radial-gradient(circle, transparent 40%, rgba(0,0,0,0.9) 100%);
        }
      `}</style>
      
      {phase === SessionPhase.COMPLETED && (
          <div className="absolute inset-0 z-50">
            <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
          </div>
      )}

      {/* --- PARTNER VIDEO CONTAINER --- */}
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

          {/* Ripples Layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
              {ripples.map(r => (
                  <div 
                    key={r.id}
                    className="absolute border border-white/50 rounded-full bg-white/10"
                    style={{
                        left: r.x,
                        top: r.y,
                        width: '50px',
                        height: '50px',
                        marginLeft: '-25px',
                        marginTop: '-25px',
                        animation: 'ripple-effect 1s ease-out forwards'
                    }}
                  />
              ))}
          </div>

          {/* Partner Task HUD */}
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

      {/* --- FLOATING CHAT MESSAGES --- */}
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
{/* --- AESTHETIC GAME OVERLAY --- */}
      {isGameOpen && (
          <div className="absolute inset-0 z-[45] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
              <div className="bg-[#0f172a] border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden max-w-sm w-full relative transition-all">
                  
                  {/* Header */}
                  <div className="bg-slate-900/50 p-5 border-b border-white/5 flex justify-between items-center backdrop-blur-md">
                      <h3 className="font-bold text-slate-200 flex items-center gap-2 text-sm tracking-wide uppercase">
                          <Gamepad2 size={16} className="text-emerald-400"/> Game Center
                      </h3>
                      <button onClick={() => { setIsGameOpen(false); setGameInvite(false); }} className="text-slate-500 hover:text-white transition-colors">
                          <X size={20}/>
                      </button>
                  </div>
                  
                  <div className="p-8">
                      {!gameState.type ? (
                          /* MENU */
                          <div className="grid grid-cols-3 gap-4">
                              <button onClick={() => initGame('TICTACTOE')} className="group flex flex-col items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors"><X size={20} className="text-blue-400"/></div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TicTacToe</span>
                              </button>
                              <button onClick={() => initGame('RPS')} className="group flex flex-col items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                                  <div className="w-10 h-10 rounded-full bg-pink-500/10 flex items-center justify-center group-hover:bg-pink-500/20 transition-colors"><Zap size={20} className="text-pink-400"/></div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">R.P.S.</span>
                              </button>
                              <button onClick={() => initGame('PONG')} className="group flex flex-col items-center gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                                  <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors"><Trophy size={20} className="text-emerald-400"/></div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Rally</span>
                              </button>
                          </div>
                      ) : (
                          /* GAME BOARD */
                          <div className="flex flex-col items-center gap-6 animate-in slide-in-from-bottom-4 duration-500">
                              
                              {/* --- TICTACTOE --- */}
                              {gameState.type === 'TICTACTOE' && (
                                  <>
                                    <div className="grid grid-cols-3 gap-2 bg-slate-800/50 p-2 rounded-2xl border border-white/5">
                                        {gameState.board?.map((cell, i) => (
                                            <button 
                                                key={i} 
                                                onClick={() => handleTicTacToeMove(i)}
                                                disabled={!!cell || gameState.winner !== null}
                                                className="w-16 h-16 bg-[#0f172a] rounded-xl flex items-center justify-center text-3xl font-bold border border-slate-700/50 hover:bg-slate-800 disabled:hover:bg-[#0f172a] transition-all"
                                            >
                                                {cell === user.id ? <span className="text-blue-400">×</span> : cell ? <span className="text-pink-400">○</span> : ''}
                                            </button>
                                        ))}
                                    </div>
                                    <div className={`text-sm font-bold tracking-wide px-4 py-2 rounded-full ${gameState.winner ? (gameState.winner === user.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400') : 'bg-slate-800 text-slate-400'}`}>
                                        {gameState.winner 
                                            ? (gameState.winner === 'DRAW' ? "It's a Draw!" : (gameState.winner === user.id ? "You Won! 🎉" : "You Lost 😔"))
                                            : (gameState.turn === user.id ? "Your Turn" : "Opponent's Turn")}
                                    </div>
                                  </>
                              )}

                              {/* --- RPS --- */}
                              {gameState.type === 'RPS' && (
                                  <>
                                    <div className="flex justify-center gap-4">
                                        {['ROCK', 'PAPER', 'SCISSORS'].map(move => (
                                            <button 
                                                key={move}
                                                onClick={() => handleRPSMove(move)} 
                                                disabled={!!gameState.moves?.[user.id]} 
                                                className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl bg-slate-800 border border-slate-700 hover:scale-110 hover:border-slate-500 transition-all ${gameState.moves?.[user.id] === move ? 'bg-blue-500/20 border-blue-500' : ''}`}
                                            >
                                                {move === 'ROCK' ? '🪨' : move === 'PAPER' ? '📄' : '✂️'}
                                            </button>
                                        ))}
                                    </div>
                                    <div className={`text-sm font-bold tracking-wide px-4 py-2 rounded-full ${gameState.winner ? (gameState.winner === user.id ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400') : 'bg-slate-800 text-slate-400'}`}>
                                        {gameState.winner 
                                            ? (gameState.winner === 'DRAW' ? "Draw! Try again." : (gameState.winner === user.id ? "You Won! 🎉" : "You Lost 😔"))
                                            : (gameState.moves?.[user.id] ? "Waiting for opponent..." : "Choose your weapon")}
                                    </div>
                                  </>
                              )}

                              {/* --- RALLY PONG --- */}
                              {gameState.type === 'PONG' && (
                                  <div className="flex flex-col items-center w-full">
                                      <div className="text-4xl font-black text-slate-700 mb-6 font-mono">
                                          {gameState.rallyCount || 0}
                                      </div>
                                      
                                      {gameState.winner ? (
                                          <div className={`text-center p-4 rounded-xl w-full mb-4 ${gameState.winner === user.id ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border border-red-500/30 text-red-400'}`}>
                                              <h2 className="text-xl font-bold">{gameState.winner === user.id ? 'VICTORY' : 'DEFEAT'}</h2>
                                              <p className="text-xs opacity-70 mt-1">Rally reached {gameState.rallyCount}</p>
                                          </div>
                                      ) : (
                                          <button
                                              onClick={handlePongHit}
                                              disabled={gameState.ballOwner !== user.id}
                                              className={`w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-2xl ${
                                                  gameState.ballOwner === user.id 
                                                  ? 'bg-emerald-500 hover:bg-emerald-400 scale-110 cursor-pointer shadow-emerald-500/50' 
                                                  : 'bg-slate-800 opacity-50 scale-90 cursor-not-allowed'
                                              }`}
                                          >
                                              {gameState.ballOwner === user.id ? (
                                                  <>
                                                    <Circle size={32} className="text-white fill-white animate-ping absolute opacity-20"/>
                                                    <span className="text-white font-black text-lg z-10">HIT!</span>
                                                  </>
                                              ) : (
                                                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Wait</span>
                                              )}
                                          </button>
                                      )}
                                      
                                      <p className="text-xs text-slate-500 mt-8 text-center max-w-[200px]">
                                          {gameState.winner ? "Game Over" : "Click HIT when the ball is yours. Don't drop the rally!"}
                                      </p>
                                  </div>
                              )}

                              {/* Back Button */}
                              <button 
                                  onClick={() => updateGame({ type: null, moves: {}, board: [], winner: null })} 
                                  className="text-xs text-slate-500 hover:text-white mt-2 border-t border-white/5 pt-4 w-full"
                              >
                                  Back to Menu
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      {/* --- MAIN UI LAYER --- */}
      <div className={`absolute inset-0 pointer-events-none z-40 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* TOP BAR: TIMER & PHASE */}
        <div className="absolute top-4 md:top-6 left-0 right-0 flex justify-center pointer-events-none px-14 md:px-0">
            <div className={`backdrop-blur-xl border rounded-full px-5 py-2 flex items-center gap-3 shadow-2xl transition-all duration-700 ${phase === SessionPhase.FOCUS ? 'bg-black/80 border-red-500/20 text-red-50' : 'bg-slate-900/80 border-slate-700'}`}>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                    phase === SessionPhase.FOCUS 
                        ? (isPomodoroBreak ? 'text-emerald-400' : 'text-red-400') 
                        : 'text-slate-400'
                }`}>
                    {phaseLabel}
                </span>
                <div className="w-px h-3 bg-white/10"></div>
                <span className="font-mono text-lg font-variant-numeric tabular-nums text-white">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
            </div>
        </div>

        {/* TOP BUTTONS */}
        <div className="absolute top-4 md:top-6 left-4 md:left-6 pointer-events-auto">
            <button 
                onClick={() => setIsReportOpen(true)} 
                onMouseEnter={() => setIsInteracting(true)}
                onMouseLeave={() => setIsInteracting(false)}
                className="p-3 rounded-full bg-black/40 text-slate-400 hover:text-white border border-white/5 hover:bg-slate-800 transition-all"
            >
                <Flag size={16} />
            </button>
        </div>
        <div className="absolute top-4 md:top-6 right-4 md:right-6 pointer-events-auto">
            <Button 
                variant="danger" 
                onClick={handleExitClick} 
                onMouseEnter={() => setIsInteracting(true)}
                onMouseLeave={() => setIsInteracting(false)}
                className="py-2 px-3 text-xs bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400 backdrop-blur-md"
            >
                <LogOut size={14} className="mr-2"/> <span className="hidden md:inline">Exit</span>
            </Button>
        </div>

        {/* CHAT & TASKS */}
        <div 
            className="pointer-events-auto"
            onMouseEnter={() => setIsInteracting(true)}
            onMouseLeave={() => setIsInteracting(false)}
            onTouchStart={() => setIsInteracting(true)}
        >
             <ChatWindow messages={chatMessages} onSendMessage={sendMessage} partnerName={partner.name} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
             <TaskBoard isOpen={isTaskBoardOpen} onClose={() => setIsTaskBoardOpen(false)} myTasks={myTasks} partnerTasks={partnerTasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} isRevealed={phase !== SessionPhase.FOCUS} canEdit={phase === SessionPhase.ICEBREAKER} partnerName={partner.name} />
        </div>

        {/* BOTTOM CONTROLS */}
        <div className="absolute bottom-8 left-0 right-0 px-4 flex flex-col md:flex-row items-center justify-center gap-4 pointer-events-auto">
             
             {/* Reactions */}
             <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-full px-4 py-2 flex items-center gap-4 shadow-2xl order-1 md:order-none">
                 <button onClick={() => handleReaction('🔥')} className="hover:scale-110 active:scale-95 transition-all text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100" title="Send Motivation">🔥</button>
                 <button onClick={() => handleReaction('💯')} className="hover:scale-110 active:scale-95 transition-all text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100" title="Respect">💯</button>
                 <button onClick={() => handleReaction('👋')} className="hover:scale-110 active:scale-95 transition-all text-xl grayscale hover:grayscale-0 opacity-80 hover:opacity-100" title="Wave">👋</button>
             </div>

             {/* Main Controls */}
             <div className="bg-black/80 backdrop-blur-md border border-white/10 rounded-full p-2 flex items-center gap-2 shadow-2xl order-2 md:order-none">
                {phase === SessionPhase.ICEBREAKER && (
                    <Button onClick={async () => { setIsLoadingIcebreaker(true); setIcebreaker(await generateIcebreaker(partner.type)); setIsLoadingIcebreaker(false); }} variant="ghost" className="rounded-full w-10 h-10 p-0 text-yellow-400 hover:bg-yellow-400/10">
                        <Sparkles size={18} className={isLoadingIcebreaker ? 'animate-spin' : ''}/>
                    </Button>
                )}

                <button 
                    onClick={() => { 
                        if (phase !== SessionPhase.FOCUS || isPomodoroBreak) { 
                            setMicEnabled(!micEnabled); 
                            setManualMicToggle(!micEnabled); 
                        }
                    }} 
                    disabled={phase === SessionPhase.FOCUS && !isPomodoroBreak} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                        (phase === SessionPhase.FOCUS && !isPomodoroBreak) 
                        ? 'opacity-30 cursor-not-allowed' 
                        : micEnabled 
                            ? 'bg-white/10 hover:bg-white/20 text-white' 
                            : 'bg-red-500/20 text-red-400'
                    }`}
                >
                    {micEnabled && (phase !== SessionPhase.FOCUS || isPomodoroBreak) ? <Mic size={18} /> : <MicOff size={18} />}
                </button>

                <button onClick={() => setCamEnabled(!camEnabled)} className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${camEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/20 text-red-400'}`}>
                    {camEnabled ? <Video size={18} /> : <VideoOff size={18} />}
                </button>

<div className="w-px h-6 bg-white/10 mx-1"></div>

                {/* GAME BUTTON */}
                <button 
                    onClick={() => { setIsGameOpen(!isGameOpen); setGameInvite(false); }} 
                    disabled={phase === SessionPhase.FOCUS && !isPomodoroBreak}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all relative ${
                        isGameOpen ? 'bg-slate-700 text-white' : 
                        (phase === SessionPhase.FOCUS && !isPomodoroBreak ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 text-slate-400 hover:text-white')
                    }`}
                >
                    <Gamepad2 size={18} />
                    {/* Invite Notification Dot */}
                    {gameInvite && !isGameOpen && (
                        <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-black animate-bounce"></span>
                    )}
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
            <div 
                className="absolute inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
                onMouseEnter={() => setIsInteracting(true)}
                onMouseLeave={() => setIsInteracting(false)}
            >
                {/* Reports and Exit Modal content remains unchanged */}
                {isReportOpen && (
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 pointer-events-auto">
                        <div className="flex justify-between items-center">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <Flag size={18} className="text-red-500"/> Report User
                            </h3>
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
