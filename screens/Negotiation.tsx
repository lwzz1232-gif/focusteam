
import React, { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import { SessionConfig, Partner, SessionMode, SessionDuration } from '../types';
import { Zap, Timer, CheckCircle2, User, Users, XCircle } from 'lucide-react';

interface NegotiationProps {
  config: SessionConfig;
  partner: Partner;
  onNegotiationComplete: (finalConfig: SessionConfig) => void;
  onSkipMatch: () => void;
}

export const Negotiation: React.FC<NegotiationProps> = ({ config, partner, onNegotiationComplete, onSkipMatch }) => {
  const [step, setStep] = useState<'INPUT' | 'WAITING' | 'REVIEW' | 'AGREED'>('INPUT');
  const [inputTimer, setInputTimer] = useState(15);
  
  // User choices
  const [myMode, setMyMode] = useState<SessionMode>(SessionMode.DEEP_WORK);
  const [myPreTalk, setMyPreTalk] = useState(5);
  const [myPostTalk, setMyPostTalk] = useState(5);

  // Partner choices (Simulated)
  const [partnerMode, setPartnerMode] = useState<SessionMode | null>(null);
  const [partnerPreTalk, setPartnerPreTalk] = useState<number | null>(null);
  const [partnerPostTalk, setPartnerPostTalk] = useState<number | null>(null);

  // Final Result
  const [finalConfig, setFinalConfig] = useState<SessionConfig | null>(null);

  // Timer for Input Phase
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

  const handleAutoSubmit = () => {
    // Randomize my preferences if time ran out
    const randomMode = Math.random() > 0.5 ? SessionMode.DEEP_WORK : SessionMode.POMODORO;
    const randomPre = Math.floor(Math.random() * 5) + 2;
    const randomPost = Math.floor(Math.random() * 5) + 2;
    
    // Only override if not interacting? For MVP we just enforce random to ensure progress
    setMyMode(randomMode);
    setMyPreTalk(randomPre);
    setMyPostTalk(randomPost);

    // Call submit with these new values
    handleSubmit(randomMode, randomPre, randomPost);
  };

  const handleSubmit = (overrideMode?: SessionMode, overridePre?: number, overridePost?: number) => {
    setStep('WAITING');

    // Use overrides if provided (from auto-submit), otherwise state
    const currentMode = overrideMode || myMode;
    const currentPre = overridePre || myPreTalk;
    const currentPost = overridePost || myPostTalk;

    // Simulate partner "thinking"
    setTimeout(() => {
      // Logic: Partner picks random logical values
      const pPre = Math.floor(Math.random() * 5) + 2; // 2-7 mins
      const pPost = Math.floor(Math.random() * 5) + 2; // 2-7 mins
      const pMode = config.duration >= 60 && Math.random() > 0.5 ? SessionMode.POMODORO : SessionMode.DEEP_WORK;

      setPartnerPreTalk(pPre);
      setPartnerPostTalk(pPost);
      setPartnerMode(pMode);

      // Calculate Agreement (Meet in the middle)
      const agreedPre = Math.ceil((currentPre + pPre) / 2);
      const agreedPost = Math.ceil((currentPost + pPost) / 2);
      const agreedMode = (currentMode === pMode) ? currentMode : SessionMode.DEEP_WORK; // Default to Deep Work on conflict

      setFinalConfig({
        ...config,
        mode: agreedMode,
        preTalkMinutes: agreedPre,
        postTalkMinutes: agreedPost
      });

      setStep('REVIEW');
    }, 1500); // Short wait
  };

  useEffect(() => {
    if (step === 'REVIEW') {
      const timer = setTimeout(() => {
        setStep('AGREED');
      }, 3500); // Show review for 3.5s
      return () => clearTimeout(timer);
    }
  }, [step]);

  useEffect(() => {
    if (step === 'AGREED' && finalConfig) {
      const timer = setTimeout(() => {
        onNegotiationComplete(finalConfig);
      }, 3000); // Show success for 3s
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
            <p className="text-slate-500 text-sm mt-2">Waiting for {partner.name}'s choices.</p>
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
             <p className="text-center text-slate-500 mt-8 animate-pulse">Calculating compromise...</p>
         </div>
      )}

      {step === 'AGREED' && finalConfig && (
         <div className="w-full max-w-lg bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center animate-in zoom-in-95 duration-300">
             <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                 <CheckCircle2 size={32} className="text-white" />
             </div>
             <h2 className="text-2xl font-bold text-white mb-2">Agreed Settings</h2>
             <p className="text-slate-300 mb-6">We found a middle ground.</p>

             <div className="grid grid-cols-3 gap-4 mb-8">
                 <div className="bg-slate-900/50 p-3 rounded-lg">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Mode</div>
                     <div className="font-bold text-emerald-400">{finalConfig.mode === SessionMode.POMODORO ? 'Pomodoro' : 'Deep Work'}</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded-lg">
                     <div className="text-xs text-slate-500 uppercase tracking-wide">Icebreaker</div>
                     <div className="font-bold text-emerald-400">{finalConfig.preTalkMinutes} min</div>
                 </div>
                 <div className="bg-slate-900/50 p-3 rounded-lg">
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
