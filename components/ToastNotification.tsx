import React, { useState, useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
    
    // Timer to start sliding out
    const fadeTimer = setTimeout(() => {
      setVisible(false);
    }, 4000);

    // Timer to actually kill the component
    const removeTimer = setTimeout(() => {
      onClose();
    }, 4500);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [onClose]);

  // Premium Styles
  const isSuccess = type === 'success';
  
  // Dynamic styles based on type
  const borderColor = isSuccess ? 'border-green-500/50' : 'border-red-500/50';
  const glowColor = isSuccess ? 'shadow-green-500/20' : 'shadow-red-500/20';
  const iconColor = isSuccess ? 'text-green-400' : 'text-red-400';
  const progressColor = isSuccess ? 'bg-green-400' : 'bg-red-400';

  return (
    <div
      className={`fixed top-5 left-1/2 z-[1000] flex flex-col
        /* Centering Logic */
        transform -translate-x-1/2
        
        /* Glassmorphism & Borders */
        bg-gray-900/90 backdrop-blur-md border ${borderColor}
        
        /* Shape & Shadows */
        rounded-xl shadow-2xl ${glowColor}
        
        /* Layout */
        p-0 overflow-hidden min-w-[320px]
        
        /* Animation Classes */
        transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
        ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'}
      `}
    >
      <div className="flex items-center p-4">
        {/* SVG Icon */}
        <div className={`p-2 rounded-full bg-white/5 mr-3 ${iconColor}`}>
          {isSuccess ? (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
             </svg>
          ) : (
             <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
          )}
        </div>

        {/* Text */}
        <div className="flex-1">
          <h4 className={`text-sm font-bold ${iconColor}`}>
            {isSuccess ? 'Success' : 'Error'}
          </h4>
          <p className="text-sm text-gray-300 font-medium">{message}</p>
        </div>

        {/* Close Button */}
        <button 
          onClick={() => setVisible(false)} 
          className="text-gray-500 hover:text-white transition-colors ml-4"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress Bar Animation */}
      <div className="h-1 w-full bg-gray-700/50">
        <div 
          className={`h-full ${progressColor} transition-all ease-linear`}
          style={{ 
            width: visible ? '0%' : '100%', 
            transitionDuration: visible ? '4000ms' : '0ms' 
          }}
        />
      </div>
    </div>
  );
};
