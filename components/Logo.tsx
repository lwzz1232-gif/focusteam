
import React from 'react';

interface LogoProps {
  className?: string;
  animated?: boolean;
}

export const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", animated = false }) => {
  return (
    <svg 
      data-testid="logo-svg"
      viewBox="0 0 100 100" 
      className={`${className} ${animated ? 'drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]' : ''}`}
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563eb" /> {/* Blue-600: Deep & Trustworthy */}
          <stop offset="100%" stopColor="#06b6d4" /> {/* Cyan-500: Electric & Modern */}
        </linearGradient>
      </defs>

      {/* 
        Concept: Two minds/paths (left and right brackets) syncing around a central focus point.
        It subtly forms an 'S' for Sync and a box for the digital workspace.
      */}

      {/* Left Bracket / User 1 */}
      <path 
        d="M35 25 C 20 25, 15 35, 15 50 C 15 65, 20 75, 35 75 L 45 75" 
        stroke="url(#logoGradient)" 
        strokeWidth="10" 
        strokeLinecap="round"
        className={animated ? "animate-[pulse_4s_ease-in-out_infinite]" : ""}
      />

      {/* Right Bracket / User 2 (Inverted) */}
      <path 
        d="M65 75 C 80 75, 85 65, 85 50 C 85 35, 80 25, 65 25 L 55 25" 
        stroke="url(#logoGradient)" 
        strokeWidth="10" 
        strokeLinecap="round"
        strokeOpacity="0.8"
        className={animated ? "animate-[pulse_4s_ease-in-out_infinite_2s]" : ""}
      />

      {/* Central Focus Node */}
      <circle 
        cx="50" 
        cy="50" 
        r="8" 
        fill="white"
        className={animated ? "animate-[pulse_3s_ease-in-out_infinite]" : ""}
      />
      <circle 
        cx="50" 
        cy="50" 
        r="5" 
        fill="url(#logoGradient)"
      />
    </svg>
  );
};
