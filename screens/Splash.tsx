import React, { useEffect, useState, useRef } from 'react';
import { Logo } from '../components/Logo';

interface SplashProps {
  onComplete: () => void;
}

export const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sequence of animations (Unchanged)
    const t1 = setTimeout(() => setStage(1), 500); // Fade in logo
    const t2 = setTimeout(() => setStage(2), 2000); // Fade in quote part 1
    const t3 = setTimeout(() => setStage(3), 3500); // Fade in quote part 2
    const t4 = setTimeout(() => onComplete(), 5500); // Transition to login

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [onComplete]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
        if (!containerRef.current) return;
        const { clientX, clientY } = e;
        containerRef.current.style.setProperty('--mouse-x', `${clientX}px`);
        containerRef.current.style.setProperty('--mouse-y', `${clientY}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
        ref={containerRef}
        data-testid="splash-screen"
        className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden"
    >
      {/* 1. Custom Animation for the leaks to drift slowly */}
      <style>{`
        @keyframes drift {
          0%, 100% { transform: scale(1) translate(0, 0); opacity: 0.5; }
          50% { transform: scale(1.1) translate(2%, -1%); opacity: 0.8; }
        }
        @keyframes burn {
          0% { opacity: 0.3; transform: scaleX(1); }
          50% { opacity: 0.6; transform: scaleX(1.2); }
          100% { opacity: 0.3; transform: scaleX(1); }
        }
        .animate-drift { animation: drift 10s ease-in-out infinite; }
        .animate-burn { animation: burn 8s ease-in-out infinite; }
      `}</style>

      {/* Background Base */}
      <div className="absolute inset-0 bg-slate-950"></div>

      {/* --- NEW: Cinematic Film Burns & Light Leaks --- */}

      {/* Leak 1: Left Side (Warm/Orange Film Burn) */}
      <div className="absolute top-0 left-[-10%] w-[40%] h-full bg-gradient-to-r from-orange-600/30 via-red-500/10 to-transparent blur-[80px] mix-blend-screen animate-burn pointer-events-none"></div>

      {/* Leak 2: Right Side (Cool/Blue Light Leak) */}
      <div className="absolute bottom-0 right-[-10%] w-[50%] h-full bg-gradient-to-l from-blue-600/30 via-indigo-500/10 to-transparent blur-[100px] mix-blend-screen animate-drift pointer-events-none"></div>
      
      {/* Leak 3: Top Center (Subtle Purple Haze) */}
      <div className="absolute top-[-20%] left-[30%] w-[40%] h-[50%] bg-purple-900/40 blur-[120px] mix-blend-screen animate-pulse pointer-events-none"></div>

      {/* Film Grain Texture (Adds the "Aesthetic" look) */}
      <div className="absolute inset-0 opacity-[0.07] pointer-events-none mix-blend-overlay" 
           style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")` }}>
      </div>
      
      {/* --- End New Effects --- */}


      {/* Ambient Glows (Kept from your code) */}
      <div className="absolute top-[20%] left-[20%] w-[600px] h-[600px] bg-blue-900/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] bg-indigo-900/20 blur-[100px] rounded-full animate-pulse delay-1000"></div>

      {/* Mouse Spotlight (Kept from your code) */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
            background: `radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.08), transparent 40%)`
        }}
      ></div>
      
      {/* Logo Container (Unchanged) */}
      <div className={`relative z-10 transition-all duration-1000 transform ${stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'}`}>
        <div className="mb-8 mx-auto">
           <Logo className="w-24 h-24 md:w-32 md:h-32" animated={true} />
        </div>
      </div>

      {/* Quote (Unchanged) */}
      <div className="relative z-10 text-center space-y-4 px-4">
        <h1 className={`text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-400 tracking-tight transition-all duration-1000 ${stage >= 2 ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}>
          Get it done.
        </h1>
        <h1 className={`text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 tracking-tight transition-all duration-1000 delay-200 ${stage >= 3 ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-95'}`}>
          Make it fun.
        </h1>
      </div>
    </div>
  );
};
