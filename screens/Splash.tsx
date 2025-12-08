import React, { useEffect, useState, useRef } from 'react';
import { Logo } from '../components/Logo';

interface SplashProps {
  onComplete: () => void;
}

export const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sequence of animations (Kept exactly the same)
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
        // Dampen the movement slightly for a smoother feel
        const x = clientX;
        const y = clientY;
        containerRef.current.style.setProperty('--mouse-x', `${x}px`);
        containerRef.current.style.setProperty('--mouse-y', `${y}px`);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div 
        ref={containerRef}
        className="flex-1 flex flex-col items-center justify-center bg-[#050505] relative overflow-hidden font-sans selection:bg-indigo-500/30"
    >
      {/* 1. Custom CSS for the Aesthetic Movement */}
      <style>{`
        @keyframes float-1 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          33% { transform: translate(30px, -50px) scale(1.1); opacity: 0.6; }
          66% { transform: translate(-20px, 20px) scale(0.9); opacity: 0.5; }
        }
        @keyframes float-2 {
          0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.4; }
          33% { transform: translate(-30px, 40px) scale(1.2); opacity: 0.6; }
          66% { transform: translate(30px, -30px) scale(0.9); opacity: 0.5; }
        }
        @keyframes grain {
            0%, 100% { transform: translate(0, 0); }
            10% { transform: translate(-5%, -10%); }
            20% { transform: translate(-15%, 5%); }
            30% { transform: translate(7%, -25%); }
            40% { transform: translate(-5%, 25%); }
            50% { transform: translate(-15%, 10%); }
            60% { transform: translate(15%, 0%); }
            70% { transform: translate(0%, 15%); }
            80% { transform: translate(3%, 35%); }
            90% { transform: translate(-10%, 10%); }
        }
        .animate-float-1 { animation: float-1 12s ease-in-out infinite; }
        .animate-float-2 { animation: float-2 15s ease-in-out infinite; }
        .animate-grain { animation: grain 8s steps(10) infinite; }
      `}</style>

      {/* 2. Background Base */}
      <div className="absolute inset-0 bg-[#030305]"></div>

      {/* 3. Aesthetic Aura Blobs (Replacing the spinning cones) */}
      
      {/* Top Left - Indigo/Purple Glow */}
      <div className="absolute top-[-10%] left-[-10%] w-[80vw] h-[80vw] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-float-1 pointer-events-none"></div>
      
      {/* Bottom Right - Cyan/Blue Glow */}
      <div className="absolute bottom-[-10%] right-[-10%] w-[80vw] h-[80vw] bg-blue-600/20 rounded-full blur-[120px] mix-blend-screen animate-float-2 pointer-events-none"></div>

      {/* Center Accent - Subtle Pink Hint */}
      <div className="absolute top-[30%] left-[40%] w-[40vw] h-[40vw] bg-fuchsia-600/10 rounded-full blur-[100px] mix-blend-screen animate-float-1 delay-1000 pointer-events-none"></div>


      {/* 4. Film Grain Overlay (The "Secret Sauce" for aesthetics) */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none z-0 mix-blend-overlay overflow-hidden">
        <div className="w-[300%] h-[300%] absolute top-[-100%] left-[-100%] animate-grain"
            style={{ 
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.6' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
                backgroundSize: '150px 150px'
            }}
        ></div>
      </div>

      {/* 5. Mouse Spotlight */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay z-0 transition-opacity duration-1000"
        style={{
            background: `radial-gradient(600px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.06), transparent 40%)`
        }}
      ></div>
      
      {/* --- CONTENT --- */}

      {/* Logo Container */}
      <div className={`relative z-10 transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) transform ${stage >= 1 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-8 blur-sm'}`}>
        <div className="mb-10 mx-auto">
           {/* Added drop shadow for depth */}
           <div className="drop-shadow-[0_0_15px_rgba(255,255,255,0.15)]">
             <Logo className="w-24 h-24 md:w-32 md:h-32" animated={true} />
           </div>
        </div>
      </div>

      {/* Quote */}
      <div className="relative z-10 text-center space-y-3 px-4">
        {/* Line 1: Clean, Metallic White */}
        <h1 className={`text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-slate-400 tracking-tighter transition-all duration-1000 ease-out ${stage >= 2 ? 'opacity-100 translate-y-0 blur-0' : 'opacity-0 translate-y-4 blur-sm'}`}>
          Get it done.
        </h1>
        
        {/* Line 2: Vibrant, Glowing Gradient (Cyan -> Purple) */}
        <h1 className={`text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-blue-400 to-purple-400 tracking-tighter transition-all duration-1000 ease-out delay-200 ${stage >= 3 ? 'opacity-100 translate-y-0 blur-0 scale-100' : 'opacity-0 translate-y-4 blur-sm scale-95'}`}>
          Make it fun.
        </h1>
      </div>
    </div>
  );
};
