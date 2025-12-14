import React, { useEffect, useRef, useState, MouseEvent } from 'react';
import { Logo } from '../components/Logo';
import { 
  ArrowRight, Check, Clock, Users, Zap, Play, 
  ChevronDown, Star, Activity, Lock, MousePointer2, Globe 
} from 'lucide-react';

// --- 1. ADVANCED ANIMATION HOOKS ---

// Hook: Decodes text randomly (Matrix/Cipher effect)
const useScrambleText = (text: string, speed: number = 50) => {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  
  useEffect(() => {
    let i = 0;
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*()";
    const interval = setInterval(() => {
      setDisplayedText(
        text
          .split("")
          .map((char, index) => {
            if (index < i) return char;
            return characters[Math.floor(Math.random() * characters.length)];
          })
          .join("")
      );
      i += 1 / 3; // Slow down the reveal
      if (i >= text.length) {
        clearInterval(interval);
        setDisplayedText(text);
        setIsComplete(true);
      }
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return { text: displayedText, isComplete };
};

// Hook: Mouse Position relative to window
const useMousePosition = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const updateMousePosition = (ev: MouseEvent | any) => {
      setMousePosition({ x: ev.clientX, y: ev.clientY });
    };
    window.addEventListener('mousemove', updateMousePosition);
    return () => window.removeEventListener('mousemove', updateMousePosition);
  }, []);
  return mousePosition;
};

// --- 2. MICRO-COMPONENTS ---

// The "Cipher" Header Component
const CipherText: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
  const { text: decodedText, isComplete } = useScrambleText(text);
  return (
    <span className={`${className} ${isComplete ? 'text-white' : 'text-blue-400 font-mono'}`}>
      {decodedText}
    </span>
  );
};

// Magnetic Button with internal glow
const GlowButton: React.FC<{ children: React.ReactNode; onClick?: () => void; className?: string; variant?: 'primary' | 'secondary' }> = ({ children, onClick, className = "", variant = 'primary' }) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setCoords({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const baseStyles = "relative overflow-hidden rounded-full font-bold transition-all duration-300 hover:scale-[1.03] active:scale-[0.98]";
  const variantStyles = variant === 'primary' 
    ? "bg-slate-50 text-black shadow-[0_0_30px_-5px_rgba(255,255,255,0.4)]" 
    : "bg-transparent text-slate-300 border border-slate-700 hover:bg-slate-800 hover:text-white";

  return (
    <button 
      ref={ref}
      onClick={onClick}
      onMouseMove={handleMouseMove}
      className={`${baseStyles} ${variantStyles} ${className}`}
    >
      <div className="absolute inset-0 pointer-events-none transition-opacity duration-300"
           style={{
             background: `radial-gradient(100px circle at ${coords.x}px ${coords.y}px, rgba(255,255,255,0.15), transparent 50%)`
           }}
      />
      <div className="relative z-10 flex items-center justify-center gap-2 px-8 py-4">
        {children}
      </div>
    </button>
  );
};

// Reveal Animation Wrapper (Fixed Centering)
const Reveal: React.FC<{ children: React.ReactNode; delay?: number; width?: string; center?: boolean }> = ({ children, delay = 0, width = "fit-content", center = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.1 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} style={{ width }} className={`relative ${center ? 'mx-auto flex justify-center' : ''}`}>
      <div className={`transition-all duration-1000 ease-[cubic-bezier(0.25,1,0.5,1)] ${isVisible ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-12 blur-sm'} ${center ? 'w-full flex justify-center' : ''}`} style={{ transitionDelay: `${delay}ms` }}>
        {children}
      </div>
    </div>
  );
};

// --- 3. MAIN LANDING COMPONENT ---

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onSignIn }) => {
  const mouse = useMousePosition();
  const [timeLeft, setTimeLeft] = useState(3000); // 50:00 minutes in seconds

  // Timer logic for the mockup
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => (prev > 0 ? prev - 1 : 3000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-[#030305] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- DYNAMIC BACKGROUND --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {/* Grid with perspective */}
        <div 
          className="absolute inset-0 opacity-20" 
          style={{
            backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px',
            transform: 'perspective(1000px) rotateX(20deg) scale(1.2)',
            transformOrigin: 'top center',
            maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)'
          }}
        ></div>
        
        {/* Moving Laser Beam on Grid */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="w-[200%] h-[2px] bg-blue-500/50 blur-sm absolute top-[40%] animate-[scan_8s_linear_infinite] shadow-[0_0_20px_rgba(59,130,246,0.5)]"></div>
        </div>

        {/* Mouse Glow */}
        <div 
          className="absolute w-[600px] h-[600px] bg-indigo-600/15 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
          style={{ left: mouse.x, top: mouse.y }}
        />
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 w-full z-50 px-4 py-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center bg-black/40 backdrop-blur-xl border border-white/5 rounded-2xl px-6 py-3">
          <div className="flex items-center gap-2 group cursor-default">
            <div className="group-hover:rotate-180 transition-transform duration-700">
               <Logo className="w-8 h-8 text-white" />
            </div>
            <span className="font-bold text-white tracking-tight">FocusTwin</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={onSignIn} className="text-sm font-medium text-slate-400 hover:text-white transition-colors hidden sm:block">Log in</button>
            <button onClick={onGetStarted} className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/10 transition-all">
              Start Session
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 pt-32 pb-20 px-6 min-h-screen flex flex-col items-center justify-center">
        
        {/* Live Status Pill */}
        <Reveal center width="100%">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700 backdrop-blur-md mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-mono text-slate-300">SYSTEM OPERATIONAL: <span className="text-white font-bold">1,204 ONLINE</span></span>
          </div>
        </Reveal>

        {/* Main Title with Cipher Effect */}
        <div className="text-center w-full max-w-5xl mx-auto space-y-8">
          <Reveal delay={100} center width="100%">
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight text-white leading-[1.1] mb-2">
              <CipherText text="ELIMINATE" className="" /> <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-blue-300 via-white to-slate-400">
                DISTRACTION.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={200} center width="100%">
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              The world's first <span className="text-white font-medium">high-fidelity body doubling platform</span>. 
              Pair up with a partner for 50 minutes of deep work. 
              No talk. Just focus.
            </p>
          </Reveal>

          <Reveal delay={300} center width="100%">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full">
              <GlowButton onClick={onGetStarted} className="w-full sm:w-auto">
                <span>Initiate Session</span>
                <ArrowRight size={18} />
              </GlowButton>
              <GlowButton variant="secondary" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({behavior: 'smooth'})} className="w-full sm:w-auto">
                <Play size={16} className="fill-current" />
                <span>Observe Protocol</span>
              </GlowButton>
            </div>
          </Reveal>
        </div>

        {/* INTERACTIVE MOCKUP - The "Live" Element */}
        <Reveal delay={500} width="100%" center>
          <div className="mt-20 relative max-w-4xl mx-auto w-full group perspective-container">
             {/* Glow behind */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[110%] h-[120%] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
             
             {/* The Interface Frame */}
             <div className="relative bg-[#0A0A0F] border border-white/10 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 ring-1 ring-white/5 transition-transform duration-500 group-hover:scale-[1.01]">
                
                {/* Header Bar */}
                <div className="flex items-center justify-between px-6 py-4 bg-[#0F0F16] border-b border-white/5">
                   <div className="flex gap-4 items-center">
                      <div className="flex gap-1.5">
                         <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                         <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
                         <div className="w-2.5 h-2.5 rounded-full bg-green-500/20 border border-green-500/50"></div>
                      </div>
                      <div className="h-4 w-[1px] bg-white/10"></div>
                      <div className="flex items-center gap-2 px-3 py-1 rounded bg-blue-500/10 border border-blue-500/20">
                         <Clock size={12} className="text-blue-400" />
                         <span className="text-xs font-mono font-bold text-blue-100">{formatTime(timeLeft)}</span>
                      </div>
                   </div>
                   <div className="text-[10px] font-mono text-slate-500 flex items-center gap-2">
                      ENCRYPTED CONNECTION <Lock size={10} />
                   </div>
                </div>

                {/* Video Grid */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-black">
                   {/* User A */}
                   <div className="aspect-[4/3] bg-slate-900 relative overflow-hidden group/video">
                      <img src="https://images.unsplash.com/photo-1598550874175-4d7112ee661c?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 mix-blend-overlay" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-xs font-mono text-white">YOU (MUTED)</span>
                      </div>
                      {/* Audio Viz */}
                      <div className="absolute bottom-4 right-4 flex gap-0.5 items-end h-4">
                        {[1,2,3,4].map(i => <div key={i} className="w-1 bg-white/20 animate-pulse" style={{ height: '4px' }}></div>)}
                      </div>
                   </div>

                   {/* User B (Partner) */}
                   <div className="aspect-[4/3] bg-slate-900 relative overflow-hidden">
                      <img src="https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 mix-blend-overlay" alt="" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent"></div>
                      <div className="absolute bottom-4 left-4 flex items-center gap-2">
                        <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981]"></div>
                        <span className="text-xs font-mono text-white">SARAH (PARTNER)</span>
                      </div>
                      <div className="absolute top-4 right-4 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] text-slate-300 border border-white/10">
                        Task: Writing SQL Query
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </Reveal>
      </section>

      {/* --- INFINITE MARQUEE (Social Proof) --- */}
      <div className="border-y border-white/5 bg-black/50 overflow-hidden py-6">
        <div className="flex gap-12 whitespace-nowrap animate-[scroll_30s_linear_infinite] hover:[animation-play-state:paused]">
           {[...Array(10)].map((_, i) => (
             <React.Fragment key={i}>
                <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
                   <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500"></div>
                   <span className="text-sm font-mono text-slate-300">Alex just started a session</span>
                </div>
                <div className="flex items-center gap-3 opacity-50 hover:opacity-100 transition-opacity">
                   <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500"></div>
                   <span className="text-sm font-mono text-slate-300">Jordan completed 3h Deep Work</span>
                </div>
             </React.Fragment>
           ))}
        </div>
      </div>

      {/* --- HOW IT WORKS (THE PROTOCOL) --- */}
      <section id="how-it-works" className="py-32 px-6 relative">
        <div className="max-w-6xl mx-auto">
          <Reveal center width="100%">
             <div className="text-center mb-24">
               <h2 className="text-xs font-bold text-blue-500 tracking-[0.3em] uppercase mb-4">The Protocol</h2>
               <h3 className="text-4xl md:text-5xl font-bold text-white">Systematic Productivity.</h3>
             </div>
          </Reveal>
          
          <div className="grid md:grid-cols-3 gap-6">
             {[
               { icon: MousePointer2, title: "Initialize", text: "Set your objective. Be specific. The clearer the goal, the deeper the focus." },
               { icon: Globe, title: "Connect", text: "Our global mesh network finds you a partner instantly. No scheduling required." },
               { icon: Zap, title: "Execute", text: "50 minutes of high-intensity execution. Peer pressure ensures you do not fold." }
             ].map((card, i) => (
               <Reveal key={i} delay={i * 150}>
                 <div className="group relative p-8 h-full bg-[#0A0A0F] border border-white/5 hover:border-blue-500/30 rounded-2xl transition-all duration-500 hover:-translate-y-2">
                    <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"></div>
                    <card.icon size={32} className="text-slate-500 group-hover:text-blue-400 transition-colors mb-6" />
                    <h4 className="text-xl font-bold text-white mb-3">{card.title}</h4>
                    <p className="text-slate-400 leading-relaxed text-sm">{card.text}</p>
                 </div>
               </Reveal>
             ))}
          </div>
        </div>
      </section>

      {/* --- COMPARISON (Grid Layout) --- */}
      <section className="py-20 px-6 border-t border-white/5 bg-white/[0.01]">
         <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
               <Reveal width="100%">
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
                    Isolation is the enemy of <br/>
                    <span className="text-blue-500">consistency.</span>
                  </h2>
                  <p className="text-slate-400 text-lg leading-relaxed mb-8">
                     Willpower is a finite resource. When you rely solely on yourself, you burn out. 
                     FocusTwin outsources your discipline to the social environment.
                  </p>
                  <div className="space-y-4">
                     {['Scientific accountability', 'Dopamine management', 'Flow state triggers'].map((item, i) => (
                       <div key={i} className="flex items-center gap-3 text-slate-300">
                          <Check size={16} className="text-blue-500" /> {item}
                       </div>
                     ))}
                  </div>
               </Reveal>
               <Reveal width="100%" delay={200}>
                  <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900 to-black p-8 flex items-center justify-center">
                     <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20"></div>
                     {/* Abstract Visual */}
                     <div className="relative z-10 grid grid-cols-2 gap-4">
                        <div className="w-24 h-32 bg-slate-800 rounded-lg animate-pulse"></div>
                        <div className="w-24 h-32 bg-blue-900/40 rounded-lg border border-blue-500/30 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]"></div>
                        <div className="w-24 h-32 bg-blue-900/40 rounded-lg border border-blue-500/30 shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]"></div>
                        <div className="w-24 h-32 bg-slate-800 rounded-lg animate-pulse delay-75"></div>
                     </div>
                  </div>
               </Reveal>
            </div>
         </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-32 relative flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-blue-600/5"></div>
        <div className="relative z-10 text-center px-6">
           <Reveal center width="100%">
             <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tighter">
               Ready to go <span className="text-blue-500">dark?</span>
             </h2>
             <p className="text-slate-400 mb-10 max-w-lg mx-auto">
               Join the quietest community on the internet. 
               Free for early adopters.
             </p>
             <GlowButton onClick={onGetStarted} className="mx-auto">
               Start Session
             </GlowButton>
           </Reveal>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-white/5 py-12 px-6 bg-[#020203]">
        <div className="max-w-6xl mx-auto flex justify-between items-center text-xs text-slate-600">
           <div className="flex gap-4">
             <span>© 2025 FOCUSTWIN</span>
             <span className="hidden md:inline"> // </span>
             <a href="#" className="hover:text-white transition-colors">PRIVACY</a>
             <a href="#" className="hover:text-white transition-colors">TERMS</a>
           </div>
           <div className="flex gap-2 items-center">
              <div className="w-2 h-2 bg-green-900 rounded-full"></div>
              <span>ALL SYSTEMS NORMAL</span>
           </div>
        </div>
      </footer>
      
      {/* Global CSS for custom animations (marquee, scan) */}
      <style>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes scan {
          0% { top: 0%; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};
