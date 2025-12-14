import React, { useEffect, useRef, useState } from 'react';
import { Logo } from '../components/Logo';
import { ArrowRight, CheckCircle2, Clock, Users, Zap, ShieldCheck, Play } from 'lucide-react';

// --- 1. UTILITY: FADE IN COMPONENT ---
// This handles the "opacity transition on scroll" magic you wanted.
const FadeIn: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.1 } // Trigger when 10% of the item is visible
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

interface LandingProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export const Landing: React.FC<LandingProps> = ({ onGetStarted, onSignIn }) => {
  return (
    <div className="min-h-screen bg-black text-slate-200 selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* --- BACKGROUND AMBIANCE --- */}
      <div className="fixed inset-0 pointer-events-none">
        {/* A deep spotlight effect from the top */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-blue-900/20 blur-[120px] rounded-full mix-blend-screen" />
        <div className="absolute bottom-[-10%] left-1/4 w-[800px] h-[600px] bg-indigo-900/10 blur-[120px] rounded-full mix-blend-screen" />
        {/* Grain overlay for texture (optional, makes it feel like film) */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]"></div>
      </div>

      {/* --- HERO SECTION --- */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center px-6 pt-20 pb-32">
        
        {/* Top Nav - Minimal & Floating */}
        <nav className="absolute top-0 w-full max-w-7xl mx-auto p-6 flex justify-between items-center z-50">
           {/* Empty div to balance flex if we want logo dead center, but here we keep "Sign In" right */}
           <div className="w-20"></div> 
           <button 
             onClick={onSignIn}
             className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
           >
             Login
           </button>
        </nav>

        <div className="text-center max-w-4xl mx-auto space-y-8 z-10">
          
          {/* Logo as the Crown Jewel */}
          <FadeIn>
            <div className="flex justify-center mb-8">
              <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 shadow-2xl shadow-blue-900/20 backdrop-blur-md">
                <Logo className="w-16 h-16 md:w-20 md:h-20" />
              </div>
            </div>
          </FadeIn>

          <FadeIn delay={200}>
            <h1 className="text-6xl md:text-8xl font-bold tracking-tight text-white mb-2">
              FocusTwin
            </h1>
            <p className="text-xl md:text-2xl text-slate-400 font-light tracking-wide">
              Don't work alone. Work together.
            </p>
          </FadeIn>

          <FadeIn delay={400}>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mt-8">
              <button 
                onClick={onGetStarted}
                className="group relative px-8 py-4 bg-white text-black font-bold rounded-full text-lg hover:bg-slate-200 transition-all flex items-center gap-2 overflow-hidden"
              >
                <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/50 to-transparent -translate-x-full group-hover:animate-shimmer" />
                <span>Start Session</span>
                <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button 
                onClick={onGetStarted} // Or a demo link
                className="px-8 py-4 rounded-full text-slate-300 hover:text-white hover:bg-white/5 transition-all flex items-center gap-2 font-medium border border-transparent hover:border-white/10"
              >
                <Play size={18} /> How it works
              </button>
            </div>
          </FadeIn>
          
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-10 animate-bounce text-slate-600">
           <div className="w-px h-12 bg-gradient-to-b from-slate-600 to-transparent mx-auto"></div>
        </div>
      </section>


      {/* --- THE PROBLEM & SOLUTION (Split Layout) --- */}
      <section className="relative z-10 py-32 px-6 border-t border-slate-900/50 bg-black/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <div className="grid md:grid-cols-2 gap-20 items-center">
              <div>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-6 text-white">
                  The silence of <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">
                    shared accountability.
                  </span>
                </h2>
                <p className="text-lg text-slate-400 leading-relaxed mb-8">
                  Procrastination feeds on isolation. When you're alone, it's easy to pick up your phone. 
                  But when someone is on the other side of the screen working with you, the dynamic changes.
                  You show up. You focus. You finish.
                </p>
                
                <div className="space-y-4">
                  {[
                    "No small talk. Just deep work.",
                    "50-minute matched sessions.",
                    "Strict community guidelines."
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3 text-slate-300">
                      <div className="p-1 rounded-full bg-blue-500/20 text-blue-400">
                        <CheckCircle2 size={16} />
                      </div>
                      {item}
                    </div>
                  ))}
                </div>
              </div>

              {/* Abstract Visual Representation */}
              <div className="relative h-96 w-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(59,130,246,0.1),transparent)]" />
                  
                  {/* Cards floating */}
                  <div className="relative z-10 flex gap-4">
                     {/* User Card */}
                     <div className="w-32 h-40 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-3 flex flex-col justify-between transform -rotate-6 shadow-2xl">
                        <div className="w-8 h-8 rounded-full bg-slate-600/50 animate-pulse" />
                        <div className="h-2 w-16 bg-slate-700 rounded" />
                     </div>
                     {/* Lightning Icon */}
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-black border border-slate-700 p-2 rounded-full text-yellow-400 shadow-[0_0_30px_rgba(250,204,21,0.2)]">
                        <Zap size={24} fill="currentColor" />
                     </div>
                     {/* Partner Card */}
                     <div className="w-32 h-40 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-xl p-3 flex flex-col justify-between transform rotate-6 shadow-2xl">
                        <div className="w-8 h-8 rounded-full bg-slate-600/50" />
                        <div className="h-2 w-16 bg-slate-700 rounded" />
                     </div>
                  </div>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>


      {/* --- HOW IT WORKS (Glass Cards) --- */}
      <section className="relative z-10 py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <FadeIn>
            <h2 className="text-sm font-bold tracking-widest text-blue-500 uppercase mb-12 text-center">
              The Workflow
            </h2>
          </FadeIn>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { 
                icon: Clock, 
                title: "Set Intentions", 
                desc: "Choose a time. Define your task. Commit to showing up." 
              },
              { 
                icon: Users, 
                title: "Pair Up", 
                desc: "Our algorithm matches you with a partner globally." 
              },
              { 
                icon: ShieldCheck, 
                title: "Deep Work", 
                desc: "Cameras on. Microphones off. 50 minutes of pure focus." 
              }
            ].map((step, idx) => (
              <FadeIn key={idx} delay={idx * 150}>
                <div className="group h-full p-8 rounded-2xl bg-slate-900/20 border border-slate-800 hover:bg-slate-900/40 hover:border-slate-700 transition-all duration-300">
                  <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg shadow-black/50">
                    <step.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* --- FINAL CTA --- */}
      <section className="relative py-32 flex items-center justify-center overflow-hidden">
        {/* Glow behind */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[100px] rounded-full" />
        
        <div className="relative z-10 text-center px-6">
          <FadeIn>
            <h2 className="text-5xl md:text-7xl font-bold text-white tracking-tight mb-8">
              Ready to <span className="italic font-serif text-slate-400">focus?</span>
            </h2>
            <button 
              onClick={onGetStarted}
              className="px-10 py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-full text-xl shadow-lg shadow-blue-900/40 hover:shadow-blue-900/60 hover:-translate-y-1 transition-all duration-300"
            >
              Get Matched Now
            </button>
            <p className="mt-6 text-sm text-slate-500">
              Free forever for core features. No credit card required.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer className="border-t border-slate-900 py-12 px-6 bg-black">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 opacity-60 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2">
            <Logo className="w-6 h-6 grayscale opacity-70" />
            <span className="font-bold text-slate-300">FocusTwin</span>
          </div>
          <div className="flex gap-8 text-sm text-slate-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
          <div className="text-xs text-slate-600">
            © 2025 FocusTwin Inc.
          </div>
        </div>
      </footer>

    </div>
  );
};
