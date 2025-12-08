
import React, { useEffect, useState, useRef } from 'react';
import { Logo } from '../components/Logo';

interface SplashProps {
  onComplete: () => void;
}

export const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Sequence of animations
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
        className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden"
    >
      {/* Background Base */}
      <div className="absolute inset-0 bg-slate-950"></div>

      {/* Cinematic Light Leaks */}
      {/* Leak 1: Rotating warm hue */}
      <div className="absolute top-[-50%] left-[-50%] w-[100vw] h-[100vw] rounded-full mix-blend-screen opacity-30 animate-[spin_20s_linear_infinite]"
           style={{ background: 'conic-gradient(from 0deg, transparent 0%, #4f46e5 20%, transparent 40%)' }}>
      </div>

      {/* Leak 2: Rotating cool hue opposite */}
      <div className="absolute bottom-[-50%] right-[-50%] w-[100vw] h-[100vw] rounded-full mix-blend-screen opacity-30 animate-[spin_25s_linear_infinite_reverse]"
           style={{ background: 'conic-gradient(from 180deg, transparent 0%, #06b6d4 20%, transparent 40%)' }}>
      </div>

      {/* Ambient Glows */}
      <div className="absolute top-[20%] left-[20%] w-[600px] h-[600px] bg-blue-900/20 blur-[120px] rounded-full animate-pulse"></div>
      <div className="absolute bottom-[20%] right-[20%] w-[500px] h-[500px] bg-indigo-900/20 blur-[100px] rounded-full animate-pulse delay-1000"></div>

      {/* Mouse Spotlight */}
      <div 
        className="absolute inset-0 pointer-events-none mix-blend-overlay"
        style={{
            background: `radial-gradient(800px circle at var(--mouse-x, 50%) var(--mouse-y, 50%), rgba(255, 255, 255, 0.08), transparent 40%)`
        }}
      ></div>
      
      {/* Logo Container */}
      <div className={`relative z-10 transition-all duration-1000 transform ${stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'}`}>
        <div className="mb-8 mx-auto">
           <Logo className="w-24 h-24 md:w-32 md:h-32" animated={true} />
        </div>
      </div>

      {/* Quote */}
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
