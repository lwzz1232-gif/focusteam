import React, { useEffect, useState } from 'react';
import { Logo } from '../components/Logo';

interface SplashProps {
  onComplete: () => void;
}

const messages = [
  "Finding your focus partner...",
  "Syncing brainwaves...",
  "Calibrating productivity levels...",
  "Brewing virtual coffee...",
  "Assembling focus crystals...",
];

export const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [currentMessage, setCurrentMessage] = useState(0);
  const [show, setShow] = useState(true);

  useEffect(() => {
    const messageInterval = setInterval(() => {
      setCurrentMessage(prev => (prev + 1) % messages.length);
    }, 1500);

    const timeout = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 5500);

    return () => {
      clearInterval(messageInterval);
      clearTimeout(timeout);
    };
  }, [onComplete]);

  return (
    <div 
      className={`fixed inset-0 bg-slate-950 flex flex-col items-center justify-center transition-opacity duration-500 z-50 ${show ? 'opacity-100' : 'opacity-0'}`}
    >
      <div className="relative mb-8">
        <Logo animated className="w-24 h-24" />
      </div>
      <div className="text-center">
        <p className="text-slate-400 text-sm transition-opacity duration-300">
          {messages[currentMessage]}
        </p>
      </div>
    </div>
  );
};
