import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { SessionType, SessionDuration, SessionConfig, SessionMode, User } from '../types';
import { Briefcase, BookOpen, Code, Clock, Coffee, Play, FlaskConical, LogOut, ArrowDown, ShieldCheck } from 'lucide-react'; // Added ShieldCheck icon
import { LiveRequests } from '../components/LiveRequests';
import { db } from '../utils/firebaseConfig';
import { collection, onSnapshot } from 'firebase/firestore';

interface DashboardProps {
    user: User;
    onStartMatch: (config: SessionConfig) => void;
    onLogout: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onStartMatch, onLogout }) => {
  const [selectedType, setSelectedType] = useState<SessionType>(SessionType.STUDY);
  const [selectedDuration, setSelectedDuration] = useState<SessionDuration>(SessionDuration.MIN_30);
  
  // 1. TRACK LOBBY COUNT
  const [lobbyCount, setLobbyCount] = useState(0);

  // 2. LISTEN TO DATABASE
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'waiting_room'), (snap) => {
      // Count everyone except myself
      const count = snap.docs.filter(d => d.data().userId !== user.id).length;
      setLobbyCount(count);
    });
    return () => unsub();
  }, [user.id]);

  // 3. SCROLL HELPER
  const scrollToLobby = () => {
    const element = document.getElementById('live-lobby-section');
    if (element) element.scrollIntoView({ behavior: 'smooth' });
  };

  const categories = [
    { type: SessionType.STUDY, icon: BookOpen, desc: 'Academic focus' },
    { type: SessionType.WORK, icon: Briefcase, desc: 'Professional tasks' },
    { type: SessionType.CODING, icon: Code, desc: 'Programming blocks' },
    { type: SessionType.READING, icon: Coffee, desc: 'Quiet reading' },
  ];

  const durations = [
    { val: SessionDuration.MIN_30, label: '30 Min', desc: 'Quick sprint' },
    { val: SessionDuration.HOUR_1, label: '1 Hour', desc: 'Standard session' },
    { val: SessionDuration.HOUR_2, label: '2 Hours', desc: 'Deep work' },
  ];

  const handleStart = () => {
    onStartMatch({
      type: selectedType,
      duration: selectedDuration,
      mode: SessionMode.DEEP_WORK,
      preTalkMinutes: selectedDuration === SessionDuration.TEST ? 0.5 : 5,
      postTalkMinutes: selectedDuration === SessionDuration.TEST ? 0.5 : 5
    });
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-start p-4 max-w-5xl mx-auto w-full overflow-y-auto relative">
      
      {/* --- NEW: DYNAMIC LOBBY NOTIFICATION --- */}
      {lobbyCount > 0 && (
          <div 
            onClick={scrollToLobby}
            className="w-full max-w-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-xl mb-4 flex items-center justify-between cursor-pointer hover:bg-emerald-500/20 transition-all animate-in slide-in-from-top-4 mt-8"
          >
              <div className="flex items-center gap-3">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                  </span>
                  <span className="font-bold text-sm">
                      {lobbyCount} {lobbyCount === 1 ? 'Person' : 'People'} waiting in Lobby
                  </span>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                  View <ArrowDown size={14} />
              </div>
          </div>
      )}

      {/* Header */}
      <div className={`w-full mb-6 text-center md:text-left ${lobbyCount > 0 ? '' : 'pt-8'}`}>
        <h1 className="text-3xl font-bold mb-2">Configure Session</h1>
        <p className="text-slate-400">Choose your focus area and time block to find a match.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 w-full mb-8">
        {/* Session Type */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs">1</span>
            What are you working on?
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.type}
                onClick={() => setSelectedType(cat.type)}
                className={`p-4 rounded-xl border text-left transition-all ${
                  selectedType === cat.type
                    ? 'bg-blue-600/10 border-blue-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <cat.icon className={`mb-2 ${selectedType === cat.type ? 'text-blue-400' : 'text-slate-500'}`} />
                <div className="font-medium">{cat.type}</div>
                <div className="text-xs opacity-60">{cat.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Duration */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">2</span>
            How long?
          </h3>
          <div className="space-y-3">
            {durations.map((dur) => (
              <button
                key={dur.val}
                onClick={() => setSelectedDuration(dur.val)}
                className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all ${
                  selectedDuration === dur.val
                    ? 'bg-emerald-600/10 border-emerald-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Clock size={18} className={selectedDuration === dur.val ? 'text-emerald-400' : 'text-slate-500'} />
                  <div className="font-medium">{dur.label}</div>
                </div>
                <div className="text-xs opacity-60">{dur.desc}</div>
              </button>
            ))}

            {/* Test Mode Button */}
            {(user.role === 'admin' || user.role === 'dev') && (
               <button
                  onClick={() => setSelectedDuration(SessionDuration.TEST)}
                  className={`w-full p-4 rounded-xl border flex items-center justify-between transition-all border-dashed ${
                    selectedDuration === SessionDuration.TEST
                      ? 'bg-amber-600/10 border-amber-500 text-amber-200'
                      : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:border-slate-600 hover:text-slate-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FlaskConical size={18} className={selectedDuration === SessionDuration.TEST ? 'text-amber-400' : 'text-slate-500'} />
                    <div className="font-medium">Test Mode (Dev)</div>
                  </div>
                  <div className="text-xs opacity-60">30s Phases</div>
                </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-md mb-10 text-center">
        <Button 
          onClick={handleStart}
          className="w-full py-4 text-lg shadow-blue-500/25 shadow-xl mb-3"
        >
          <Play size={20} className="fill-current" />
          {/* Dynamic Button Text */}
          {lobbyCount > 0 ? 'Join Queue (Fast Match)' : 'Find Partner'}
        </Button>
        
        {/* --- ADDED: EXPLANATION TEXT --- */}
        <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
           <ShieldCheck size={12} className="text-slate-600"/>
           If no exact match, we'll auto-connect you with the closest duration.
        </p>
      </div>

      {/* --- LIVE REQUESTS LOBBY (With ID for scrolling) --- */}
      <div id="live-lobby-section" className="w-full border-t border-white/5 pt-8 pb-8">
         <LiveRequests 
            currentUser={user} 
            onJoinSession={(partnerId, config) => onStartMatch(config)} 
         />
      </div>

    </div>
  );
};
