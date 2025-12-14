import React, { useEffect, useRef, useState, MouseEvent } from 'react';
import { Logo } from '../components/Logo';
import { 
  ArrowRight, Check, Clock, Users, Zap, Play, 
  ChevronDown, Star, Activity, Lock, MousePointer2 
} from 'lucide-react';

// --- 1. CORE UTILITIES & ANIMATIONS ---

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

// IMPROVED REVEAL: Added 'center' prop to ensure wrappers align correctly
interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  width?: string;
  center?: boolean; // New prop to force centering
}

const Reveal: React.FC<RevealProps> = ({ children, delay = 0, width = "fit-content", center = false }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={ref} 
      style={{ width }} 
      className={`relative overflow-hidden ${center ? 'mx-auto flex justify-center' : ''}`}
    >
      <div 
        className={`transition-all duration-1000 cubic-bezier(0.17, 0.55, 0.55, 1) 
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'} 
        ${center ? 'w-full flex justify-center' : ''}`} 
        style={{ transitionDelay: `${delay}ms` }}
      >
        {children}
      </div>
    </div>
  );
};

// Spotlight Card Component
const SpotlightCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-xl border border-white/10 bg-white/5 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition duration-300"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(59, 130, 246, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  );
};

const StatBadge: React.FC<{ icon: React.ElementType; label: string; value: string }> = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-center gap-3 px-4 py-3 rounded-full bg-white/5 border border-white/10 backdrop-blur-md w-full">
    <Icon size={16} className="text-blue-400 shrink-0" />
    <div className="flex flex-col leading-none text-left">
      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</span>
      <span className="text-sm font-bold text-slate-100">{value}</span>
    </div>
  </div>
);

// --- 3. MAIN LANDING COMPONENT ---

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onSignIn }) => {
  const mouse = useMousePosition();

  const gridStyle = {
    backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)`,
    backgroundSize: '40px 40px',
    maskImage: 'radial-gradient(ellipse at center, black 40%, transparent 100%)',
  };

  return (
    <div className="min-h-screen bg-[#05050A] text-slate-200 font-sans selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- AMBIENT BACKGROUND --- */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0" style={gridStyle}></div>
        <div 
          className="absolute w-[800px] h-[800px] bg-blue-600/10 rounded-full blur-[120px] transition-transform duration-100 ease-out -translate-x-1/2 -translate-y-1/2"
          style={{ left: mouse.x, top: mouse.y }}
        />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-blue-900/10 via-transparent to-transparent blur-3xl" />
      </div>

      {/* --- NAVBAR --- */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-6 py-6 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex justify-between items-center bg-white/5 backdrop-blur-xl border border-white/5 rounded-full px-6 py-3 shadow-2xl shadow-black/50">
          <div className="flex items-center gap-2">
            <Logo className="w-8 h-8 text-white" />
            <span className="font-bold text-white tracking-tight hidden sm:block">FocusTwin</span>
          </div>
          
          <div className="flex items-center gap-6">
            <button onClick={onSignIn} className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Log in
            </button>
            <button 
              onClick={onGetStarted}
              className="px-5 py-2 rounded-full bg-white text-black text-sm font-bold hover:bg-blue-50 transition-colors shadow-[0_0_20px_-5px_rgba(255,255,255,0.4)]"
            >
              Start Session
            </button>
          </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <section className="relative z-10 pt-40 pb-20 px-6 min-h-screen flex flex-col items-center justify-center">
        
        {/* Status Badge - Centered */}
        <Reveal center width="100%">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-8 animate-pulse">
            <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_10px_currentColor]"></span>
            142 people focusing right now
          </div>
        </Reveal>

        {/* Main Title - Centered */}
        <div className="text-center w-full max-w-5xl mx-auto space-y-6 flex flex-col items-center">
          <Reveal delay={100} center width="100%">
            <h1 className="text-5xl md:text-8xl font-bold tracking-tight text-white leading-[1.1] text-center">
              Don't work alone. <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
                Work Together.
              </span>
            </h1>
          </Reveal>

          <Reveal delay={200} center width="100%">
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed text-center">
              Experience the quietest productivity community on earth. 
              We match you with a partner for 50 minutes of deep work. 
              <span className="text-slate-200"> Cameras on. Mics off. Zero distractions.</span>
            </p>
          </Reveal>

          <Reveal delay={300} center width="100%">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10 w-full">
              <button 
                onClick={onGetStarted}
                className="group relative h-14 px-8 rounded-full bg-blue-600 text-white font-bold text-lg overflow-hidden transition-all hover:scale-105 hover:shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)] w-full sm:w-auto flex justify-center items-center"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:animate-[shimmer_1.5s_infinite]"></div>
                <div className="flex items-center gap-2">
                  <span>Find a Partner</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform"/>
                </div>
              </button>
              
              <button 
                onClick={() => document.getElementById('how-it-works')?.scrollIntoView({behavior: 'smooth'})}
                className="h-14 px-8 rounded-full border border-slate-700 hover:bg-slate-800 text-slate-300 font-medium transition-all flex items-center justify-center gap-2 w-full sm:w-auto"
              >
                <Play size={16} fill="currentColor" /> See how it works
              </button>
            </div>
          </Reveal>
        </div>

        {/* Hero Visual Mockup - Centered */}
        <Reveal delay={500} width="100%" center>
          <div className="mt-20 relative max-w-4xl mx-auto w-full">
             {/* Glow behind mockups */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-blue-500/20 blur-[100px] rounded-full opacity-50"></div>
             
             {/* The Interface */}
             <div className="relative bg-slate-900 border border-slate-700/50 rounded-2xl p-2 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between px-4 py-3 bg-slate-950/50 rounded-t-xl border-b border-slate-800">
                   <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                      <div className="w-3 h-3 rounded-full bg-slate-700"></div>
                   </div>
                   <div className="text-xs font-mono text-slate-500 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div> LIVE SESSION
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2">
                   {/* User Video */}
                   <div className="aspect-video bg-slate-800 rounded-lg relative overflow-hidden group">
                      <img src="https://images.unsplash.com/photo-1598550874175-4d7112ee661c?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="You" />
                      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white">YOU</div>
                   </div>
                   {/* Partner Video */}
                   <div className="aspect-video bg-slate-800 rounded-lg relative overflow-hidden group border border-blue-500/30">
                      <img src="https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=800&auto=format&fit=crop" className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity" alt="Partner" />
                      <div className="absolute inset-0 flex items-center justify-center">
                         <div className="w-12 h-12 rounded-full bg-blue-600/20 flex items-center justify-center backdrop-blur-sm border border-blue-500/50">
                           <Activity size={20} className="text-blue-400" />
                         </div>
                      </div>
                      <div className="absolute bottom-3 left-3 bg-blue-600/80 backdrop-blur px-2 py-1 rounded text-[10px] font-mono text-white flex items-center gap-1">
                         <span className="w-1.5 h-1.5 bg-white rounded-full animate-bounce"></span> SARAH IS TYPING...
                      </div>
                   </div>
                </div>
                {/* Control Bar */}
                <div className="h-12 mt-2 bg-slate-950/50 rounded-lg flex items-center justify-center gap-6 border border-slate-800/50">
                   <div className="p-2 rounded-full bg-slate-800/50 text-slate-500"><MousePointer2 size={16}/></div>
                   <div className="p-2 rounded-full bg-red-500/20 text-red-400 border border-red-500/20"><Play size={16} fill="currentColor"/></div>
                   <div className="p-2 rounded-full bg-slate-800/50 text-slate-500"><Lock size={16}/></div>
                </div>
             </div>
          </div>
        </Reveal>
      </section>

      {/* --- STATS BAR --- */}
      <div className="border-y border-white/5 bg-white/[0.02] backdrop-blur-sm">
        <div className="max-w-6xl mx-auto py-8 grid grid-cols-2 md:grid-cols-4 gap-4 px-6">
           <StatBadge icon={Users} label="Community" value="25k+ Members" />
           <StatBadge icon={Clock} label="Focus Time" value="1.2M Hours" />
           <StatBadge icon={Zap} label="Average Session" value="50 Minutes" />
           <StatBadge icon={Star} label="Rating" value="4.9/5.0" />
        </div>
      </div>

      {/* --- THE RITUAL (HOW IT WORKS) --- */}
      <section id="how-it-works" className="py-32 px-6 relative overflow-hidden">
        <div className="max-w-6xl mx-auto relative z-10">
          <Reveal width="100%">
            <div className="mb-20 text-center md:text-left">
              <h2 className="text-4xl md:text-6xl font-bold text-white mb-6">The Ritual.</h2>
              <p className="text-xl text-slate-400 max-w-xl mx-auto md:mx-0">
                We've stripped away the noise. No scheduling, no calendars, no small talk. 
                Just pure flow state on demand.
              </p>
            </div>
          </Reveal>

          <div className="grid md:grid-cols-3 gap-8 relative">
             {/* Connecting Line (Desktop) */}
             <div className="hidden md:block absolute top-12 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-0"></div>

             {[
               {
                 step: "01",
                 title: "Set Your Intent",
                 desc: "Log in and define what you need to accomplish in the next 50 minutes. Writing it down makes it real.",
                 icon: MousePointer2
               },
               {
                 step: "02",
                 title: "Instant Match",
                 desc: "Our algorithm finds a partner anywhere in the world who is ready to start right now. No waiting.",
                 icon: Users
               },
               {
                 step: "03",
                 title: "Deep Work",
                 desc: "Greet your partner, mute your mic, and work. The presence of another human keeps you honest.",
                 icon: Lock
               }
             ].map((item, idx) => (
               <Reveal key={idx} delay={idx * 200}>
                 <SpotlightCard className="h-full p-8 bg-black/40 backdrop-blur-sm relative z-10 group">
                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:border-blue-500/50 transition-all duration-300">
                      <item.icon className="text-slate-200 group-hover:text-blue-400 transition-colors" size={24} />
                    </div>
                    <div className="text-xs font-mono text-blue-500 mb-2">STEP {item.step}</div>
                    <h3 className="text-2xl font-bold text-white mb-3">{item.title}</h3>
                    <p className="text-slate-400 leading-relaxed">
                      {item.desc}
                    </p>
                 </SpotlightCard>
               </Reveal>
             ))}
          </div>
        </div>
      </section>

      {/* --- PROBLEM/SOLUTION (Comparison) --- */}
      <section className="py-32 bg-slate-900/20 px-6 border-y border-white/5">
         <div className="max-w-5xl mx-auto">
            <Reveal center width="100%">
              <div className="text-center mb-16 w-full">
                 <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Why Body Doubling Works</h2>
                 <p className="text-slate-400">It's not magic. It's psychology.</p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-12">
               {/* The "Alone" State */}
               <Reveal delay={100} width="100%">
                 <div className="h-full p-8 rounded-2xl bg-red-950/10 border border-red-900/20 relative overflow-hidden hover:border-red-900/40 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><img src="https://cdn-icons-png.flaticon.com/512/564/564619.png" className="w-32 h-32 invert" alt="" /></div>
                    <h3 className="text-xl font-bold text-red-200 mb-4">Working Alone</h3>
                    <ul className="space-y-4 text-red-200/60">
                       <li className="flex gap-3"><span className="text-red-500">✕</span> Prone to phone distractions</li>
                       <li className="flex gap-3"><span className="text-red-500">✕</span> "I'll do it in 5 minutes" mentality</li>
                       <li className="flex gap-3"><span className="text-red-500">✕</span> Easy to quit when it gets hard</li>
                       <li className="flex gap-3"><span className="text-red-500">✕</span> Isolated and unmotivated</li>
                    </ul>
                 </div>
               </Reveal>

               {/* The "Together" State */}
               <Reveal delay={300} width="100%">
                 <div className="h-full p-8 rounded-2xl bg-blue-950/20 border border-blue-500/30 relative overflow-hidden hover:border-blue-500/50 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-10"><Users size={120} className="text-blue-400" /></div>
                    <h3 className="text-xl font-bold text-blue-200 mb-4 flex items-center gap-2">
                       With FocusTwin <Check size={18} className="text-blue-400" />
                    </h3>
                    <ul className="space-y-4 text-blue-100/80">
                       <li className="flex gap-3"><span className="text-blue-400">✓</span> Social pressure keeps you seated</li>
                       <li className="flex gap-3"><span className="text-blue-400">✓</span> Scheduled starts kill procrastination</li>
                       <li className="flex gap-3"><span className="text-blue-400">✓</span> Seeing others focus inspires you</li>
                       <li className="flex gap-3"><span className="text-blue-400">✓</span> 50-minute blocks maximize flow</li>
                    </ul>
                 </div>
               </Reveal>
            </div>
         </div>
      </section>

      {/* --- FAQ SECTION --- */}
      <section className="py-24 px-6 max-w-3xl mx-auto">
        <Reveal center width="100%">
          <div className="w-full">
            <h2 className="text-3xl font-bold text-white mb-10 text-center">Frequently Asked Questions</h2>
            <div className="space-y-4">
               {[
                 { q: "Do I have to talk to my partner?", a: "Barely. You say hello, state your goal, and mute. The goal is silence." },
                 { q: "Is video mandatory?", a: "Yes. Being seen is what creates the accountability. We do not record anything." },
                 { q: "Is it free?", a: "Yes, FocusTwin is currently 100% free for our beta community." },
                 { q: "What happens if my partner leaves?", a: "We'll notify you instantly and give you the option to re-match." }
               ].map((faq, i) => (
                 <div key={i} className="group border border-white/5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                   <details className="p-6 cursor-pointer">
                     <summary className="font-medium text-slate-200 flex justify-between items-center list-none select-none">
                       {faq.q}
                       <ChevronDown className="group-open:rotate-180 transition-transform text-slate-500" />
                     </summary>
                     <p className="mt-4 text-slate-400 leading-relaxed text-sm">{faq.a}</p>
                   </details>
                 </div>
               ))}
            </div>
          </div>
        </Reveal>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="py-32 relative text-center px-6 overflow-hidden">
         {/* Background Aurora */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-blue-600/20 to-purple-600/20 blur-[120px] rounded-full pointer-events-none"></div>

         <Reveal center width="100%">
            <div className="relative z-10 flex flex-col items-center justify-center">
               <h2 className="text-5xl md:text-7xl font-bold text-white mb-8 tracking-tight">
                 Your best work is <br/> 
                 <span className="italic font-serif text-blue-400">waiting for you.</span>
               </h2>
               <p className="text-slate-400 mb-10 text-lg">Join thousands of others who have reclaimed their attention.</p>
               <button 
                  onClick={onGetStarted}
                  className="px-12 py-5 bg-white text-black font-bold rounded-full text-xl hover:scale-105 transition-transform shadow-[0_0_50px_-10px_rgba(255,255,255,0.3)]"
               >
                 Start a Session Now
               </button>
            </div>
         </Reveal>
      </section>

      {/* --- FOOTER --- */}
      <footer className="py-12 px-6 border-t border-white/5 bg-black text-center md:text-left">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
           <div className="flex items-center gap-2 opacity-50 hover:opacity-100 transition-opacity">
              <Logo className="w-6 h-6" />
              <span className="font-bold text-slate-300">FocusTwin</span>
           </div>
           <div className="text-sm text-slate-600">
              © 2025 FocusTwin. Built for deep work.
           </div>
        </div>
      </footer>
    </div>
  );
};
