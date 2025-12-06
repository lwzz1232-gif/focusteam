
import React, { useEffect, useRef } from 'react';

interface AuthMascotProps {
  isHidden: boolean; // isHidden = Password Focused. triggers "Whistling/Look Away" mode.
}

export const AuthMascot: React.FC<AuthMascotProps> = ({ isHidden }) => {
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const leftShineRef = useRef<SVGCircleElement>(null);
  const rightShineRef = useRef<SVGCircleElement>(null);
  const leftShine2Ref = useRef<SVGCircleElement>(null);
  const rightShine2Ref = useRef<SVGCircleElement>(null);
  
  // Track isHidden inside the animation loop
  const isHiddenRef = useRef(isHidden);
  useEffect(() => {
    isHiddenRef.current = isHidden;
  }, [isHidden]);

  useEffect(() => {
    let animationFrameId: number;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (isHiddenRef.current) return; // Ignore mouse if whistling

      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2 - 150; 
      
      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;

      const angle = Math.atan2(deltaY, deltaX);
      const dist = Math.min(6, Math.hypot(deltaX, deltaY) / 12); // Slightly reduced range for cuter, smaller movements

      targetX = Math.cos(angle) * dist;
      targetY = Math.sin(angle) * dist;
    };

    const animate = () => {
      // If password focused, override target to "Look Up" (Roll eyes)
      if (isHiddenRef.current) {
         targetX = 0;
         targetY = -8; // Look up
      }

      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      
      if (leftPupilRef.current && rightPupilRef.current) {
        leftPupilRef.current.setAttribute('cx', currentX.toString());
        leftPupilRef.current.setAttribute('cy', currentY.toString());
        rightPupilRef.current.setAttribute('cx', currentX.toString());
        rightPupilRef.current.setAttribute('cy', currentY.toString());
      }
      
      // Main shine follows pupil slightly
      if (leftShineRef.current && rightShineRef.current) {
        leftShineRef.current.setAttribute('cx', (currentX + 4).toString());
        leftShineRef.current.setAttribute('cy', (currentY - 4).toString());
        rightShineRef.current.setAttribute('cx', (currentX + 4).toString());
        rightShineRef.current.setAttribute('cy', (currentY - 4).toString());
      }

      // Secondary shine follows pupil
      if (leftShine2Ref.current && rightShine2Ref.current) {
        leftShine2Ref.current.setAttribute('cx', (currentX - 2).toString());
        leftShine2Ref.current.setAttribute('cy', (currentY + 3).toString());
        rightShine2Ref.current.setAttribute('cx', (currentX - 2).toString());
        rightShine2Ref.current.setAttribute('cy', (currentY + 3).toString());
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameId = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <svg width="160" height="130" viewBox="0 0 140 110" className="mx-auto" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Vibrant Body Gradient - Matching Logo Gradient (Blue to Cyan) */}
        <linearGradient id="blobBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" /> {/* Blue-600 */}
          <stop offset="50%" stopColor="#06b6d4" /> {/* Cyan-500 */}
          <stop offset="100%" stopColor="#22d3ee" /> {/* Cyan-400 */}
        </linearGradient>

        {/* Gloss Highlight Gradient */}
        <linearGradient id="gloss" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.4" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>

        <clipPath id="eyeClip">
             <circle r="14" />
        </clipPath>

        <style>
            {`
                @keyframes floatNote {
                    0% { transform: translate(0, 0) rotate(0deg) scale(0.5); opacity: 0; }
                    20% { opacity: 1; transform: translate(5px, -12px) rotate(10deg) scale(1); }
                    100% { transform: translate(18px, -35px) rotate(25deg) scale(0.8); opacity: 0; }
                }
                @keyframes mouthPulse {
                    0%, 100% { rx: 2.5; ry: 2.5; stroke-width: 0; }
                    50% { rx: 3.5; ry: 3; stroke-width: 1; }
                }
                @keyframes bodyBreath {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.02); }
                }
            `}
        </style>
      </defs>

      {/* --- BODY --- */}
      <g style={{ transformOrigin: 'center center', animation: 'bodyBreath 4s ease-in-out infinite' }}>
        {/* Glow Shadow Behind - Lowered opacity for subtlety */}
        <path 
          d="M30 60 Q 30 25, 70 25 Q 110 25, 110 60 Q 110 95, 70 95 Q 30 95, 30 60 Z" 
          fill="#3b82f6"
          filter="blur(15px)"
          opacity="0.2" 
          transform="translate(0, 5)"
        />

        {/* Main Shape */}
        <path 
          d="M30 60 Q 30 25, 70 25 Q 110 25, 110 60 Q 110 95, 70 95 Q 30 95, 30 60 Z" 
          fill="url(#blobBody)"
          stroke="#7dd3fc"
          strokeWidth="1.5"
          strokeOpacity="0.3"
        />

        {/* 3D Gloss Highlight (Top Left) */}
        <path
          d="M40 50 Q 40 35, 60 32 Q 80 30, 90 40"
          fill="none"
          stroke="url(#gloss)"
          strokeWidth="6"
          strokeLinecap="round"
          opacity="0.9"
        />
        <circle cx="45" cy="40" r="3" fill="white" opacity="0.6" />
      </g>
      
      {/* --- EYES GROUP --- */}
      <g transform="translate(70, 60)">
        
        {/* Left Eye */}
        <g transform="translate(-24, -4)">
            <g clipPath="url(#eyeClip)">
                {/* White of eye */}
                <circle r="14" fill="white" />
                {/* Pupil - Larger for cuteness */}
                <circle ref={leftPupilRef} r="7" fill="#0f172a" />
                {/* Primary Shine */}
                <circle ref={leftShineRef} r="3" fill="white" opacity="0.95" />
                {/* Secondary Shine for extra cute */}
                <circle ref={leftShine2Ref} r="1.5" fill="white" opacity="0.8" />
            </g>
        </g>

        {/* Right Eye */}
        <g transform="translate(24, -4)">
            <g clipPath="url(#eyeClip)">
                <circle r="14" fill="white" />
                <circle ref={rightPupilRef} r="7" fill="#0f172a" />
                <circle ref={rightShineRef} r="3" fill="white" opacity="0.95" />
                <circle ref={rightShine2Ref} r="1.5" fill="white" opacity="0.8" />
            </g>
        </g>

        {/* --- MOUTH / WHISTLE --- */}
        {/* Smile (Visible when NOT hidden) - Smaller, higher up for cuteness */}
        <path 
          d="M-5 11 Q 0 14, 5 11" 
          stroke="#1e3a8a" 
          strokeWidth="2" 
          strokeLinecap="round" 
          fill="none" 
          className="transition-all duration-300"
          style={{ 
              opacity: isHidden ? 0 : 0.6,
              transform: isHidden ? 'scale(0.5)' : 'scale(1)'
          }}
        />

        {/* Whistle 'O' (Visible when hidden) */}
        <ellipse 
            cx="0" cy="12" rx="3" ry="3" 
            fill="#1e3a8a"
            stroke="#60a5fa"
            className="transition-all duration-300"
            style={{
                opacity: isHidden ? 1 : 0,
                transform: isHidden ? 'scale(1)' : 'scale(0)',
                animation: isHidden ? 'mouthPulse 0.8s infinite ease-in-out' : 'none'
            }}
        />

        {/* Music Notes (Visible when whistling) - GOLD COLOR */}
        <g transform="translate(6, -6)">
             {/* Note 1 - Beamed */}
             <g 
                style={{
                    opacity: 0,
                    animation: isHidden ? 'floatNote 2s infinite linear' : 'none',
                }}
             >
                 <path 
                    d="M0 0 L0 -8 L6 -10 L6 -2" 
                    stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none"
                    filter="drop-shadow(0 0 2px rgba(251,191,36,0.5))"
                 />
                 <circle cx="-1" cy="1" r="2.5" fill="#fbbf24" />
                 <circle cx="5" cy="-1" r="2.5" fill="#fbbf24" />
             </g>

             {/* Note 2 - Single (Delayed) */}
             <g 
                style={{
                    opacity: 0,
                    animation: isHidden ? 'floatNote 2s infinite linear 1s' : 'none',
                    transform: 'translate(-5px, 5px)'
                }}
             >
                 <path 
                    d="M4 4 L4 -4" 
                    stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" fill="none"
                    filter="drop-shadow(0 0 2px rgba(251,191,36,0.5))"
                 />
                 <circle cx="3" cy="5" r="2.5" fill="#fbbf24" />
             </g>
        </g>

        {/* Blush */}
        <circle cx="-30" cy="8" r="5" fill="#f43f5e" opacity="0.3" filter="blur(1px)" />
        <circle cx="30" cy="8" r="5" fill="#f43f5e" opacity="0.3" filter="blur(1px)" />

      </g>
    </svg>
  );
};
