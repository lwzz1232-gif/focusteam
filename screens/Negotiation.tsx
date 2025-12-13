import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { SessionConfig, Partner, SessionMode } from '../types';
import { Zap, Timer, CheckCircle2, User, Users, XCircle, Clock } from 'lucide-react';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

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

  // Partner choices (synced from DB)
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

  // 2. LISTEN TO FIRESTORE FOR PARTNER'S CHOICES
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

  // 3. CHECK IF BOTH HAVE SUBMITTED -> CALCULATE AGREEMENT
  useEffect(() => {
    if (step === 'WAITING' && partnerMode && partnerPreTalk !== null && partnerPostTalk !== null && partnerDuration !== null) {
        
        const agreedPre = Math.ceil((myPreTalk + partnerPreTalk) / 2);
        const agreedPost = Math.ceil((myPostTalk + partnerPostTalk) / 2);
        const agreedMode = (myMode === partnerMode) ? myMode : SessionMode.DEEP_WORK; 
        
        // SYNC LOGIC: Always pick the shortest duration
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
                duration: config.duration // Send my requested duration
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
      const timer = setTimeout(() => setStep('AGREED'), 4000); // Slightly longer to read the mismatch warning
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'AGREED' && finalConfig) {
      const timer = setTimeout(() => onNegotiationComplete(finalConfig), 3500); 
      return () => clearTimeout(timer);
    }
  }, [step, finalConfig, onNegotiationComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full">
      
      {step === 'INPUT' && (
        <div className="w-full max-w-lg animate-in fade-in slide-in-from-bottom-4 relative">
          <div className="absolute -top-12 right-0 bg-slate-800 text-white px-3 py-1 rounded-full text-sm font-mono border border-slate-700 flex items-center gap-2">
             <Timer size={14} className={inputTimer <= 5 ? 'text-red-400' : 'text-slate-400'} />
             <span className={inputTimer <= 5 ? 'text-red-400 font-bold' : ''}>{inputTimer}s</span>
          </div>

          <h2 className="text-2xl font-bold mb-2">Session Setup</h2>
          <p className="text-slate-400 mb-8">
            You matched with <span className="text-white font-medium">{partner.name}</span>! 
            Quickly propose your preferences.
          </p>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-8">
             {/* Mode Selection */}
             <div className="space-y-3">
                <label className="text-sm font-medium text-slate-400">Preferred Work Mode</label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setMyMode(SessionMode.DEEP_WORK)}
                    className={`flex-1 p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-1 transition-all ${
                       myMode === SessionMode.DEEP_WORK
                       ? 'bg-purple-600/10 border-purple-500 text-purple-300'
                       : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}
                  >
                    <Zap size={18} />
                    Deep Work
                    <span className="text-[10px] opacity-60 font-normal">No breaks</span>
                  </button>
                  
                  <button
                    onClick={() => setMyMode(SessionMode.POMODORO)}
                    disabled={config.duration < 60}
                    className={`flex-1 p-3 rounded-lg border text-sm font-medium flex flex-col items-center gap-1 transition-all ${
                       myMode === SessionMode.POMODORO
                       ? 'bg-purple-600/10 border-purple-500 text-purple-300'
                       : 'bg-slate-950 border-slate-800 text-slate-500'
                    } ${config.duration < 60 ? 'opacity-40 cursor-not-allowed' : ''}`}
                  >
                    <Timer size={18} />
                    Pomodoro
                    <span className="text-[10px] opacity-60 font-normal">25m/5m Intervals</span>
                  </button>
                </div>
              </div>

              {/* Sliders */}
              <div className="space-y-6">
                 <div>
                   <div className="flex justify-between text-sm mb-2">
                     <span className="text-slate-400">Icebreaker (Before work)</span>
                     <span className="text-blue-400 font-bold">{myPreTalk} min</span>
                   </div>
                   <input 
                     type="range" min="1" max="15" value={myPreTalk} 
                     onChange={(e) => setMyPreTalk(Number(e.target.value))}
                     className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                 </div>
                 <div>
                   <div className="flex justify-between text-sm mb-2">
                     <span className="text-slate-400">Debrief (After work)</span>
                     <span className="text-blue-400 font-bold">{myPostTalk} min</span>
                   </div>
                   <input 
                     type="range" min="0" max="15" value={myPostTalk} 
                     onChange={(e) => setMyPostTalk(Number(e.target.value))}
                     className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                   />
                 </div>
              </div>
          </div>

          <div className="flex gap-3 mt-6">
             <Button variant="secondary" onClick={onSkipMatch} className="flex-1 py-4 text-slate-400 hover:text-white border-slate-700 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400">
                <XCircle size={18} className="mr-2" />
                Skip Match
             </Button>
             <Button onClick={() => handleSubmit()} className="flex-[2] py-4 text-lg">
                Propose Settings
             </Button>
          </div>
        </div>
      )}

      {step === 'WAITING' && (
        <div className="flex flex-col items-center animate-pulse">
            <Users size={64} className="text-slate-600 mb-4" />
            <h3 className="text-xl font-medium text-slate-300">Negotiating...</h3>
            <p className="text-slate-500 text-sm mt-2">Waiting for {partner.name}...</p>
        </div>
      )}

      {step === 'REVIEW' && (
         <div className="w-full max-w-2xl animate-in zoom-in-95 duration-300">
             <h2 className="text-2xl font-bold text-center mb-6 text-white">Comparing Preferences</h2>
             <div className="grid grid-cols-2 gap-8">
                {/* My Side */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500"></div>
                    <div className="flex items-center gap-2 mb-2">
                        <User size={20} className="text-blue-400" />
                        <span className="font-bold text-slate-200">You</span>
                    </div>
                    {/* Highlighted Duration Row */}
                    <div className={`flex justify-between text-sm border-b border-slate-800 pb-2 ${config.duration !== partnerDuration ? 'text-amber-300 font-medium' : ''}`}>
                        <span className="text-slate-500">Duration</span>
                        <span>{config.duration}m</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Mode</span>
                        <span className="text-slate-300">{myMode}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Pre-Talk</span>
                        <span className="text-slate-300">{myPreTalk}m</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Post-Talk</span>
                        <span className="text-slate-300">{myPostTalk}m</span>
                    </div>
                </div>

                {/* Partner Side */}
                <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 flex flex-col gap-4 relative overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-emerald-500"></div>
                    <div className="flex items-center gap-2 mb-2">
                        <User size={20} className="text-emerald-400" />
                        <span className="font-bold text-slate-200">{partner.name}</span>
                    </div>
                    {/* Highlighted Duration Row */}
                    <div className={`flex justify-between text-sm border-b border-slate-800 pb-2 ${config.duration !== partnerDuration ? 'text-amber-300 font-medium' : ''}`}>
                        <span className="text-slate-500">Duration</span>
                        <span>{partnerDuration}m</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Mode</span>
                        <span className="text-slate-300">{partnerMode}</span>
                    </div>
                    <div className="flex justify-between text-sm border-b border-slate-800 pb-2">
                        <span className="text-slate-500">Pre-Talk</span>
                        <span className="text-slate-300">{partnerPreTalk}m</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Post-Talk</span>
                        <span className="text-slate-300">{partnerPostTalk}m</span>
                    </div>
                </div>
             </div>
             
             {/* ALERT: Explicit message about the sync */}
             {partnerDuration && partnerDuration !== config.duration && (
                 <div className="mt-8 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-center gap-3 animate-pulse">
                     <div className="p-2 bg-amber-500/20 rounded-full">
                         <Clock className="text-amber-400" size={24} />
                     </div>
                     <div className="text-left">
                         <h4 className="text-amber-400 font-bold text-sm">Session Time Synced</h4>
                         <p className="text-amber-200/70 text-xs">
                             You requested {Math.max(config.duration, partnerDuration)}m, but {config.duration > partnerDuration ? partner.name : 'you'} only had {Math.min(config.duration, partnerDuration)}m. 
                             We synced to the shorter time.
                         </p>
                     </div>
                 </div>
             )}
         </div>
      )}

      {step === 'AGREED' && finalConfig && (
         <div className="w-full max-w-lg bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
             <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                 <CheckCircle2 size={32} className="text-white" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Agreed Settings</h2>
             
             {/* ALERT: Updated Status Message */}
             <p className="text-slate-300 mb-6">
                 {config.duration !== finalConfig.duration 
                    ? <span className="text-amber-400 font-medium">Time adjusted to match partner.</span> 
                    : "We found a middle ground."}
             </p>

             <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Total Time</div>
                     {/* Final Duration */}
                     <div className={`font-bold text-lg ${config.duration !== finalConfig.duration ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {finalConfig.duration} min
                     </div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Mode</div>
                     <div className="font-bold text-emerald-400 text-lg">{finalConfig.mode === SessionMode.POMODORO ? 'Pomodoro' : 'Deep Work'}</div>
                 </div>
             </div>
             <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Icebreaker</div>
                     <div className="font-bold text-emerald-400">{finalConfig.preTalkMinutes} min</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Debrief</div>
                     <div className="font-bold text-emerald-400">{finalConfig.postTalkMinutes} min</div>
                 </div>
             </div>
             
             <p className="text-sm text-emerald-500/80 animate-pulse">Starting session in 3 seconds...</p>
         </div>
      )}

    </div>
  );
};
