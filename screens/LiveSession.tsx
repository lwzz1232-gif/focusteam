import React, { useState, useEffect, useRef } from 'react';
import { Partner, SessionPhase, User, SessionConfig, SessionMode, ChatMessage, TodoItem, SessionDuration } from '../types';
import { Button } from '../components/Button';
import { generateIcebreaker } from '../services/geminiService';
import { Mic, MicOff, Video, VideoOff, Flag, Sparkles, LogOut, AlertTriangle, Coffee, Lock, User as UserIcon, Check, MessageSquare, ListChecks } from 'lucide-react';
import { ChatWindow } from '../components/ChatWindow';
import { TaskBoard } from '../components/TaskBoard';
import { SessionRecap } from '../components/SessionRecap';
import { useChat } from '../hooks/useChat'; 
import { useWebRTC } from '../hooks/useWebRTC'; 
import { db } from '../utils/firebaseConfig';
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore';
import { collection, query, where, getDocs, updateDoc, doc, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
interface LiveSessionProps {
  user: User;
  partner: Partner;
  config: SessionConfig;
  onEndSession: () => void;
}

export const LiveSession: React.FC<LiveSessionProps> = ({ user, partner, config, onEndSession }) => {
  const isTest = config.duration === SessionDuration.TEST;
  const [phase, setPhase] = useState<SessionPhase>(SessionPhase.ICEBREAKER);
  const [timeLeft, setTimeLeft] = useState(isTest ? 30 : config.preTalkMinutes * 60); 
  const [startTime] = useState(Date.now());
  
  // WebRTC State
  const [sessionId, setSessionId] = useState<string>('');
  const [isInitiator, setIsInitiator] = useState(false);
  const [isReadyForWebRTC, setIsReadyForWebRTC] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  // Initialize Session: Get ID and determine who calls whom
  useEffect(() => {
    let mounted = true;
    
    const initSession = async () => {
        try {
            // Find the active session for this user
            const q = query(
                collection(db, 'sessions'),
                where('participants', 'array-contains', user.id),
                where('status', '==', 'active')
            );
            const snapshot = await getDocs(q);
            
            if (snapshot.empty) {
                console.error("Session not found!");
                return;
            }

            const docSnap = snapshot.docs[0];
            const data = docSnap.data();
            
            if (mounted) {
                setSessionId(docSnap.id);
                
                // DETERMINISTIC INITIATOR LOGIC
                // The user listed as 'user1' in the DB is ALWAYS the initiator.
                // This prevents race conditions where both try to call.
                if (data.user1 && data.user1.id === user.id) {
                    setIsInitiator(true);
                } else {
                    setIsInitiator(false);
                }
                
                setIsReadyForWebRTC(true);
setSessionReady(true); // Enable chat/tasks
            }
        } catch (e) {
            console.error("Error initializing session:", e);
        }
    };

    initSession();
    return () => { mounted = false; };
  }, [user.id]);

  // Hook handles the heavy lifting of P2P connection
  const { localStream, remoteStream } = useWebRTC(isReadyForWebRTC ? sessionId : '', user.id, isInitiator);

 // UI State
const [micEnabled, setMicEnabled] = useState(true);
const [camEnabled, setCamEnabled] = useState(true);
const [manualMicToggle, setManualMicToggle] = useState(true);
  
  const [icebreaker, setIcebreaker] = useState<string | null>(null);
  const [isLoadingIcebreaker, setIsLoadingIcebreaker] = useState(false);
  // Exit confirmation handler
const handleExitSession = () => {
    if (confirm("Are you sure you want to leave this session? This will end it for both participants.")) {
        finishSession(true);
    }
};
const { messages: chatMessages, sendMessage } = useChat(
    sessionReady ? sessionId : '', 
    user.id, 
    user.name
);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  
// Track chat messages for unread count
useEffect(() => {
    if (!isChatOpen && chatMessages.length > 0) {
        const lastMsg = chatMessages[chatMessages.length - 1];
        if (lastMsg.senderId !== 'me') {
            setUnreadChatCount(prev => prev + 1);
        }
    }
    if (isChatOpen) {
        setUnreadChatCount(0);
    }
}, [chatMessages, isChatOpen]);
  const [isTaskBoardOpen, setIsTaskBoardOpen] = useState(false);
  const [myTasks, setMyTasks] = useState<TodoItem[]>([]);
  const [partnerTasks, setPartnerTasks] = useState<TodoItem[]>([]);
// Sync tasks to Firestore
useEffect(() => {
    if (!sessionId || !isReadyForWebRTC) return;
    
    // Listen to partner's tasks
    const tasksRef = collection(db, 'sessions', sessionId, 'tasks');
    const q = query(tasksRef, where('ownerId', '!=', user.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const tasks: TodoItem[] = [];
        snapshot.forEach(doc => {
            tasks.push({ ...doc.data(), id: doc.id } as TodoItem);
        });
        setPartnerTasks(tasks);
    });
    
    return () => unsubscribe();
}, [sessionId, isReadyForWebRTC, user.id]);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const partnerVideoRef = useRef<HTMLVideoElement>(null);

  // Attach Streams to Video Elements
  useEffect(() => {
      if (myVideoRef.current && localStream) {
          myVideoRef.current.srcObject = localStream;
      }
      if (partnerVideoRef.current && remoteStream) {
          partnerVideoRef.current.srcObject = remoteStream;
      }
  }, [localStream, remoteStream]);

  // Media Toggle Handling - Force mute during Focus phase
useEffect(() => {
    if(localStream) {
        // During FOCUS phase, ALWAYS mute mic regardless of user preference
        const shouldMute = phase === SessionPhase.FOCUS ? false : micEnabled;
        localStream.getAudioTracks().forEach(track => track.enabled = shouldMute);
        localStream.getVideoTracks().forEach(track => track.enabled = camEnabled);
    }
}, [micEnabled, camEnabled, localStream, phase]);


  // Timer Logic
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) return handlePhaseTransition();
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, config.duration]);

 const handlePhaseTransition = () => {
  if (phase === SessionPhase.ICEBREAKER) {
      setPhase(SessionPhase.FOCUS);
      setMicEnabled(false); // Force mute
      setManualMicToggle(false); // Remember user preference
        return isTest ? 30 : (config.duration - config.preTalkMinutes - config.postTalkMinutes) * 60;
    }
  if (phase === SessionPhase.FOCUS) {
    setPhase(SessionPhase.DEBRIEF);
    setMicEnabled(manualMicToggle); // Restore user preference
        return isTest ? 30 : config.postTalkMinutes * 60;
    }
    if (phase === SessionPhase.DEBRIEF) {
        setPhase(SessionPhase.COMPLETED);
        finishSession(false);
        return 0;
    }
    return 0;
  };

  const handleGetIcebreaker = async () => {
    setIsLoadingIcebreaker(true);
    const text = await generateIcebreaker(partner.type);
    setIcebreaker(text);
    setIsLoadingIcebreaker(false);
  };

  const finishSession = async (isEarlyExit: boolean) => {
  console.log("Finishing session:", sessionId, "Early exit:", isEarlyExit);
  
  // Stop all media streams
  if (localStream) {
      localStream.getTracks().forEach(track => {
          track.stop();
          console.log("Stopped track:", track.kind);
      });
  }
  
  // Update database
  if (sessionId) {
      try {
          await updateDoc(doc(db, 'sessions', sessionId), {
              status: isEarlyExit ? 'aborted' : 'completed',
              endedAt: new Date(),
              abortedBy: isEarlyExit ? user.id : null
          });
          console.log("Session updated in database");
      } catch(e) { 
          console.error("Failed to update session:", e); 
      }
  }

  // Always exit if early, otherwise show recap
  if (isEarlyExit) {
      onEndSession();
  } else {
      setPhase(SessionPhase.COMPLETED);
  }
};

 const handleAddTask = async (text: string) => {
    const newTask: TodoItem = { 
        id: Math.random().toString(), 
        text, 
        completed: false, 
        ownerId: user.id 
    };
    
    setMyTasks([...myTasks, newTask]);
    
    // Save to Firestore
    if (sessionId) {
        try {
            await addDoc(collection(db, 'sessions', sessionId, 'tasks'), newTask);
        } catch (e) {
            console.error("Failed to save task:", e);
        }
    }
};
const handleToggleTask = async (taskId: string) => {
    const updatedTasks = myTasks.map(t => 
        t.id === taskId ? { ...t, completed: !t.completed } : t
    );
    setMyTasks(updatedTasks);
    
    // Update in Firestore
    if (sessionId) {
        const taskDoc = updatedTasks.find(t => t.id === taskId);
        if (taskDoc) {
            try {
                const tasksRef = collection(db, 'sessions', sessionId, 'tasks');
                const q = query(tasksRef, where('id', '==', taskId));
                const snapshot = await getDocs(q);
                if (!snapshot.empty) {
                    await updateDoc(snapshot.docs[0].ref, { completed: taskDoc.completed });
                }
            } catch (e) {
                console.error("Failed to update task:", e);
            }
        }
    }
};
  const handleDeleteTask = async (taskId: string) => {
    setMyTasks(myTasks.filter(t => t.id !== taskId));
    
    // Delete from Firestore
    if (sessionId) {
        try {
            const tasksRef = collection(db, 'sessions', sessionId, 'tasks');
            const q = query(tasksRef, where('id', '==', taskId));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                await deleteDoc(snapshot.docs[0].ref);
            }
        } catch (e) {
            console.error("Failed to delete task:", e);
        }
    }
};

  return (
    <div className="flex-1 relative bg-black overflow-hidden">
      {phase === SessionPhase.COMPLETED && (
          <SessionRecap user={user} partner={partner} duration={(Date.now() - startTime) / 60000} tasks={myTasks} onClose={onEndSession}/>
      )}

      {/* Background Video Layer */}
      <div className={`absolute inset-0 flex flex-col transition-all duration-1000 ${phase === SessionPhase.FOCUS ? 'grayscale-[40%] contrast-105' : ''}`}>
        <div className="flex-1 flex flex-col md:flex-row h-full">
            <div className="flex-1 bg-slate-900 flex items-center justify-center border-r border-slate-800 relative">
                {remoteStream ? (
                    <video ref={partnerVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                ) : (
                    <div className="flex flex-col items-center gap-2">
                        <UserIcon size={48} className="text-slate-700 animate-pulse" />
                        <span className="text-slate-500">Connecting to {partner.name}...</span>
                    </div>
                )}
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">{partner.name}</div>
            </div>
            <div className="flex-1 bg-slate-900 relative">
                <video ref={myVideoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded text-white text-sm">You</div>
            </div>
        </div>
      </div>

      {/* UI Controls Layer */}
      <div className="absolute inset-0 pointer-events-none z-20">
        <div className="absolute top-6 left-0 right-0 flex justify-center pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur border border-slate-700 rounded-full px-6 py-2 flex items-center gap-4">
                <span className="text-xs font-bold text-slate-400 uppercase">{phase}</span>
                <span className="font-mono text-xl text-white">{Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}</span>
            </div>
        </div>

        <div className="absolute top-6 right-6 pointer-events-auto flex gap-2">
            <Button variant="danger" onClick={handleExitSession} className="py-2 px-3 text-xs"><LogOut size={14} className="mr-2"/> Exit</Button>
        </div>

        <div className="pointer-events-auto">
             <ChatWindow 
                messages={chatMessages} 
                onSendMessage={sendMessage} 
                partnerName={partner.name}
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
             />
        </div>
        
        <div className="pointer-events-auto">
             <TaskBoard
                isOpen={isTaskBoardOpen}
                onClose={() => setIsTaskBoardOpen(false)}
                myTasks={myTasks}
                partnerTasks={partnerTasks}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                isRevealed={phase === SessionPhase.DEBRIEF || phase === SessionPhase.COMPLETED}
                canEdit={phase === SessionPhase.ICEBREAKER}
                partnerName={partner.name}
             />
        </div>

        <div className="absolute bottom-0 w-full bg-slate-900 p-6 flex justify-center gap-6 pointer-events-auto border-t border-slate-800">
             {phase === SessionPhase.ICEBREAKER && (
                 <div className="absolute bottom-24 bg-slate-900/90 border border-slate-700 p-4 rounded-xl flex items-center gap-3">
                     <p className="text-slate-300 text-sm">{icebreaker || "Need a topic?"}</p>
                     <Button onClick={handleGetIcebreaker} variant="secondary" isLoading={isLoadingIcebreaker} className="py-1 px-3 text-xs"><Sparkles size={14}/> Generate</Button>
                 </div>
             )}
             <button 
    onClick={() => {
        if (phase === SessionPhase.FOCUS) return; // Prevent toggle during focus
        setMicEnabled(!micEnabled);
        setManualMicToggle(!micEnabled);
    }} 
    disabled={phase === SessionPhase.FOCUS}
    className={`p-4 rounded-full ${
        phase === SessionPhase.FOCUS 
            ? 'bg-slate-900 text-slate-600 cursor-not-allowed' 
            : micEnabled 
                ? 'bg-slate-800 text-white hover:bg-slate-700' 
                : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'
    } transition-colors`}
    title={phase === SessionPhase.FOCUS ? "Muted during Focus phase" : "Toggle microphone"}
>
    {micEnabled && phase !== SessionPhase.FOCUS ? <Mic /> : <MicOff />}
    {phase === SessionPhase.FOCUS && <Lock size={12} className="absolute top-1 right-1" />}
</button>
             <button onClick={() => setCamEnabled(!camEnabled)} className={`p-4 rounded-full ${camEnabled ? 'bg-slate-800 text-white' : 'bg-red-500/20 text-red-500'}`}>{camEnabled ? <Video /> : <VideoOff />}</button>
             <button onClick={() => { setIsChatOpen(!isChatOpen); setUnreadChatCount(0); }} className="p-4 rounded-full bg-slate-800 text-white relative">
                <MessageSquare />
                {unreadChatCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">{unreadChatCount}</span>}
             </button>
             <button onClick={() => setIsTaskBoardOpen(!isTaskBoardOpen)} className="p-4 rounded-full bg-slate-800 text-white"><ListChecks /></button>
        </div>
      </div>
    </div>
  );
};
