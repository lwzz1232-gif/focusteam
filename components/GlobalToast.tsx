
import React, { useState, useEffect } from 'react';
import { getBroadcast } from '../services/mockBackend';
import { Radio, X } from 'lucide-react';

export const GlobalToast: React.FC = () => {
  const [message, setMessage] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [lastTimestamp, setLastTimestamp] = useState(0);

  useEffect(() => {
    // Poll for broadcast messages
    const interval = setInterval(() => {
        const broadcast = getBroadcast();
        if (broadcast && broadcast.timestamp > lastTimestamp) {
            setMessage(broadcast.message);
            setLastTimestamp(broadcast.timestamp);
            setIsVisible(true);

            // Auto-hide after 15s
            setTimeout(() => setIsVisible(false), 15000);
        }
    }, 3000);

    return () => clearInterval(interval);
  }, [lastTimestamp]);

  if (!isVisible || !message) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex justify-center pt-4 px-4 pointer-events-none">
        <div className="bg-red-600/90 text-white backdrop-blur-md px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(220,38,38,0.5)] border border-red-400/50 flex items-start gap-4 max-w-2xl w-full animate-in slide-in-from-top-4 pointer-events-auto">
             <div className="p-2 bg-white/20 rounded-full animate-pulse">
                 <Radio size={24} />
             </div>
             <div className="flex-1">
                 <h4 className="font-bold uppercase text-xs tracking-widest text-red-200 mb-1">System Broadcast</h4>
                 <p className="font-medium">{message}</p>
             </div>
             <button 
                onClick={() => setIsVisible(false)}
                className="text-white/70 hover:text-white transition-colors"
             >
                 <X size={20} />
             </button>
        </div>
    </div>
  );
};
