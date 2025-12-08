import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionDuration, TodoItem } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Sparkles, LogOut, Lock, User as UserIcon, MessageSquare, ListChecks, ThumbsUp, Heart, Zap, Smile } from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { TaskBoard } from '../components/TaskBoard';
import { SessionRecap } from '../components/SessionRecap';
import { useChat } from '../hooks/useChat'; 
import { useWebRTC } from '../hooks/useWebRTC'; 
import { db } from '../utils/firebaseConfig';
import { collection, query, where, updateDoc, doc, addDoc, onSnapshot, deleteDoc, serverTimestamp } from 'firebase/firestore';

interface LiveSessionProps {
  user: User;
  partner: Partner;
  config: SessionConfig;
  sessionId: string; 
  onEndSession: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ user, partner, config, sessionId, onEndSession }) => {
  const isTest = config.duration === SessionDuration.TEST;
  
  // LOGIC STATE
  const [phase, setPhase] = useState<SessionPhase>(SessionPhase.ICEBREAKER);
  const [timeLeft, setTimeLeft] = useState(isTest ? 30 : config.preTalkMinutes * 60); 
  const [startTime] = useState(Date.now());
  const [isInitiator, setIsInitiator] = useState(false);
  const [isReadyForWebRTC, setIsReadyForWebRTC] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // UI STATE
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [manualMicToggle, setManualMicToggle] = useState(true);
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [isLoadingIcebreaker, setIsLoadingIcebreaker] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isTaskBoardOpen, setIsTaskBoardOpen] = useState(false);
  const [showUI, setShowUI] = useState(true); // Zen Mode
  const [floatingEmojis, setFloatingEmojis] = useState<{id: number, emoji: string, left: number}[]>([]); // Reactions

  // Draggable Self-Video State
  const [selfPos, setSelfPos] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  const [myTasks, setMyTasks] = useState<TodoItem[]>([]);
  const [partnerTasks, setPartnerTasks] = useState<TodoItem[]>([]);

  // Refs
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- 1. SETUP & WEBRTC ---
  useEffect(() => {
    if (!sessionId || !user.id || !partner.id) return;
    const amICaller = user.id < partner.id;
    setIsInitiator(amICaller);
    setIsReadyForWebRTC(true);
    setSessionReady(true);
  }, [sessionId, user.id, partner.id]);

  const { localStream, remoteStream } = useWebRTC(isReadyForWebRTC ? sessionId : '', user.id, isInitiator);

  // --- 2. SYNC & REACTIONS ---
  useEffect(() => {
    if (!sessionId) return;

    const unsub = onSnapshot(doc(db, 'sessions', sessionId), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        // Phase Sync
        if (data.phase && data.phase !== phase) {
            setPhase(data.phase as SessionPhase);
            if (data.phase === SessionPhase.FOCUS) {
                setMicEnabled(false); 
                setManualMicToggle(false); 
                setTimeLeft(isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60);
            } else if (data.phase === SessionPhase.DEBRIEF) {
                setMicEnabled(true);
                setManualMicToggle(true);
                setTimeLeft(isTest ? 30 : config.postTalkMinutes * 60);
            } else if (data.phase === SessionPhase.COMPLETED) {
                finishSession(false);
            }
        }

        // Reaction Sync (Check for new reaction timestamp)
        if (data.lastReaction && data.lastReaction.senderId !== user.id) {
            // Only show if it's recent (within 2s) to avoid spam on reload
            if (Date.now() - data.lastReaction.timestamp < 2000) {
                triggerLocalReaction(data.lastReaction.emoji);
            }
        }

        // Status Check
        if ((data.status === 'completed' || data.status === 'aborted') && data.abortedBy && data.abortedBy !== user.id) {
            alert("Partner ended the session.");
            onEndSession();
        }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user.id, config, isTest]); 

  // --- 3. ZEN MODE LOGIC ---
  useEffect(() => {
      const handleMouseMove = () => {
          setShowUI(true);
          if (phase === SessionPhase.FOCUS) {
              if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
              controlsTimeoutRef.current = setTimeout(() => setShowUI(false), 3000);
          }
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
  }, [phase]);

  // --- 4. TIMER & ACTIONS ---
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
    if (phase === SessionPhase.ICEBREAKER) nextPhase = SessionPhase.FOCUS;
    else if (phase === SessionPhase.FOCUS) nextPhase = SessionPhase.DEBRIEF;
    else if (phase === SessionPhase.DEBRIEF) nextPhase = SessionPhase.COMPLETED;

    if (nextPhase) await updateDoc(doc(db, 'sessions', sessionId), { phase: nextPhase }).catch(console.error);
  };

  const handleReaction = async (emoji: string) => {
      triggerLocalReaction(emoji); // Show locally instantly
      await updateDoc(doc(db, 'sessions', sessionId), {
          lastReaction: { emoji, senderId: user.id, timestamp: Date.now() }
      }).catch(console.error);
  };

  const triggerLocalReaction = (emoji: string) => {
      const id = Date.now();
      const left = Math.random() * 80 + 10; // Random horizontal position
      setFloatingEmojis(prev => [...prev, { id, emoji, left }]);
      setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000);
  };

  // --- MEDIA ---
  useEffect(() => {
      if (myVideoRef.current && localStream) myVideoRef.current.srcObject = localStream;
      if (partnerVideoRef.current && remoteStream) partnerVideoRef.current.srcObject = remoteStream;
  }, [localStream, remoteStream]);

  useEffect(() => {
    if(localStream) {
        const shouldMute = phase === SessionPhase.FOCUS ? false : micEnabled;
        localStream.getAudioTracks().forEach(t => t.enabled = shouldMute);
        localStream.getVideoTracks().forEach(t => t.enabled = camEnabled);
    }
  }, [micEnabled, camEnabled, localStream, phase]);

  // --- CHAT/TASK SYNC ---
  const { messages: chatMessages, sendMessage } = useChat(sessionReady ? sessionId : '', user.id, user.name);
  useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0 && chatMessages[chatMessages.length-1].senderId !== 'me') {
        setUnreadChatCount(prev => prev + 1);
    }
    if (isChatOpen) setUnreadChatCount(0);
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    if (!sessionId) return;
    const q = query(collection(db, 'sessions', sessionId, 'tasks'), where('ownerId', '!=', user.id));
    const unsub = onSnapshot(q, snap => setPartnerTasks(snap.docs.map(d => ({ ...d.data(), id: d.id } as TodoItem))));
    return () => unsub();
  }, [sessionId, user.id]);

  // --- DRAG LOGIC (Custom implementation to avoid heavy libraries) ---
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      dragStart.current = { x: e.clientX - selfPos.x, y: e.clientY - selfPos.y };
  };
  
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!isDragging) return;
          setSelfPos({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
      };
      const handleMouseUp = () => setIsDragging(false);
      
      if (isDragging) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }
      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [isDragging]);

  // --- TASK HANDLERS ---
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

  const getPhaseColor = () => {
      if (phase === SessionPhase.ICEBREAKER) return 'from-cyan-500/20 via-blue-500/10 to-transparent';
      if (phase === SessionPhase.FOCUS) return 'from-purple-900/30 via-indigo-900/20 to-black'; // Darker for focus
      return 'from-orange-500/20 via-amber-500/10 to-transparent';
  };

  return (
    <div className="relative h-screen w-screen bg-black overflow-hidden select-none">
      {phase === SessionPhase.COMPLETED && (
          <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
      )}

      {/* --- LAYER 1: AMBIENT GLOW --- */}
      <div className={`absolute inset-0 bg-gradient-to-b ${getPhaseColor()} transition-colors duration-[2000ms] pointer-events-none z-0`}></div>

      {/* --- LAYER 2: PARTNER VIDEO (FULL SCREEN) --- */}
      <div className="absolute inset-0 z-0">
          {remoteStream ? (
              <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
          ) : (
              <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="relative">
                      <div className="absolute inset-0 bg-blue-500 blur-xl opacity-20 animate-pulse"></div>
                      <UserIcon size={64} className="text-slate-700 relative z-10" />
                  </div>
                  <span className="text-slate-500 font-medium animate-pulse">Establishing secure link...</span>
              </div>
          )}
          {/* Phase Overlay (Darken during Focus) */}
          <div className={`absolute inset-0 bg-black/40 transition-opacity duration-1000 ${phase === SessionPhase.FOCUS ? 'opacity-60 backdrop-grayscale-[30%]' : 'opacity-0'}`}></div>
      </div>

      {/* --- LAYER 3: FLOATING REACTIONS --- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {floatingEmojis.map(e => (
              <div 
                key={e.id} 
                className="absolute bottom-20 text-4xl animate-[floatUp_2s_ease-out_forwards]"
                style={{ left: `${e.left}%` }}
              >
                  {e.emoji}
              </div>
          ))}
      </div>

      {/* --- LAYER 4: SELF VIDEO (DRAGGABLE PIP) --- */}
      <div 
        onMouseDown={handleMouseDown}
        style={{ transform: `translate(${selfPos.x}px, ${selfPos.y}px)` }}
        className={`absolute top-0 left-0 w-32 md:w-48 aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 z-30 cursor-grab active:cursor-grabbing transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-30 hover:opacity-100'}`}
      >
          <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
          <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
              <div className="bg-black/60 backdrop-blur px-2 py-0.5 rounded text-[10px] text-white font-medium">You</div>
              {!micEnabled && <div className="bg-red-500/80 p-1 rounded-full"><MicOff size={10} className="text-white"/></div>}
          </div>
      </div>

      {/* --- LAYER 5: UI CONTROLS (FADE IN/OUT) --- */}
      <div className={`absolute inset-0 pointer-events-none z-40 transition-opacity duration-500 ${showUI ? 'opacity-100' : 'opacity-0'}`}>
        
        {/* Top Bar */}
        <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none">
            <div className={`backdrop-blur-md border rounded-full px-6 py-2 flex items-center gap-4 shadow-xl transition-all duration-500 ${phase === SessionPhase.FOCUS ? 'bg-black/60 border-red-500/30' : 'bg-slate-900/80 border-slate-700'}`}>
                <span className={`text-xs font-bold uppercase tracking-wider ${phase === SessionPhase.FOCUS ? 'text-red-400' : 'text-slate-400'}`}>{phase}</span>
                <div className="w-px h-4 bg-white/10"></div>
                <span className="font-mono text-xl text-white font-variant-numeric tabular-nums">
                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                </span>
            </div>
        </div>

        {/* Exit Button */}
        <div className="absolute top-6 right-6 pointer-events-auto">
            <Button variant="danger" onClick={() => confirm("Exit session?") && finishSession(true)} className="py-2 px-3 text-xs bg-red-500/20 hover:bg-red-500/30 border-red-500/50 backdrop-blur-md">
                <LogOut size={14} className="mr-2"/> Exit
            </Button>
        </div>

        {/* Floating Windows (Chat/Tasks) */}
        <div className="pointer-events-auto">
             <ChatWindow messages={chatMessages} onSendMessage={sendMessage} partnerName={partner.name} isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
             <TaskBoard isOpen={isTaskBoardOpen} onClose={() => setIsTaskBoardOpen(false)} myTasks={myTasks} partnerTasks={partnerTasks} onAddTask={handleAddTask} onToggleTask={handleToggleTask} onDeleteTask={handleDeleteTask} isRevealed={phase !== SessionPhase.FOCUS} canEdit={phase === SessionPhase.ICEBREAKER} partnerName={partner.name} />
        </div>

        {/* Bottom Control Bar */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 pointer-events-auto">
             
             {/* Reaction Bar (New) */}
             <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full px-4 py-2 flex items-center gap-2 mr-4 shadow-lg">
                 <button onClick={() => handleReaction('🔥')} className="hover:scale-125 transition-transform text-xl">🔥</button>
                 <button onClick={() => handleReaction('💯')} className="hover:scale-125 transition-transform text-xl">💯</button>
                 <button onClick={() => handleReaction('👋')} className="hover:scale-125 transition-transform text-xl">👋</button>
             </div>

             {/* Main Controls */}
             <div className="bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-full p-2 flex items-center gap-2 shadow-2xl">
                {phase === SessionPhase.ICEBREAKER && (
                    <Button onClick={async () => { setIsLoadingIcebreaker(true); setIcebreaker(await generateIcebreaker(partner.type)); setIsLoadingIcebreaker(false); }} variant="ghost" className="rounded-full w-10 h-10 p-0 text-yellow-400 hover:bg-yellow-400/10" title="Icebreaker">
                        <Sparkles size={20} className={isLoadingIcebreaker ? 'animate-spin' : ''}/>
                    </Button>
                )}

                <button onClick={() => { if(phase !== SessionPhase.FOCUS) { setMicEnabled(!micEnabled); setManualMicToggle(!micEnabled); }}} disabled={phase === SessionPhase.FOCUS} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${phase === SessionPhase.FOCUS ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : micEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}>
                    {micEnabled && phase !== SessionPhase.FOCUS ? <Mic size={20} /> : <MicOff size={20} />}
                </button>

                <button onClick={() => setCamEnabled(!camEnabled)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${camEnabled ? 'bg-slate-700 text-white hover:bg-slate-600' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}>
                    {camEnabled ? <Video size={20} /> : <VideoOff size={20} />}
                </button>

                <div className="w-px h-8 bg-slate-700 mx-1"></div>

                <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadChatCount(0); }} className="w-12 h-12 rounded-full flex items-center justify-center bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 relative">
                    <MessageSquare size={20} />
                    {unreadCount > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900"></span>}
                </button>

                <button onClick={() => setIsTaskBoardOpen(!isTaskBoardOpen)} className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isTaskBoardOpen ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}>
                    <ListChecks size={20} />
                </button>
             </div>
        </div>

        {/* Icebreaker Popup */}
        {icebreaker && (
            <div className="absolute bottom-32 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-yellow-500/30 text-yellow-100 px-6 py-4 rounded-2xl shadow-2xl max-w-md text-center pointer-events-auto animate-in slide-in-from-bottom-4">
                <p className="text-sm font-medium">✨ {icebreaker}</p>
                <button onClick={() => setIcebreaker(null)} className="absolute -top-2 -right-2 bg-slate-800 rounded-full p-1 border border-slate-700 hover:bg-slate-700"><LogOut size={12}/></button>
            </div>
        )}
      </div>
    </div>
  );
};
