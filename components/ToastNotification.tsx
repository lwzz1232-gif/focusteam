import React, { useState, useEffect } from 'react';

interface ToastNotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export const ToastNotification: React.FC<ToastNotificationProps> = ({ message, type, onClose }) => {
  const [visible, setVisible] = useState(false);

  // Function to handle the removal (animation -> wait -> unmount)
  const handleDismiss = () => {
    setVisible(false); // 1. Start fading out
    setTimeout(() => {
      onClose();       // 2. Actually remove from DOM after 500ms
    }, 500);
  };

  useEffect(() => {
    // 1. Animate in immediately
    setVisible(true);

    // 2. Set auto-dismiss timer (4 seconds)
    const autoDismissTimer = setTimeout(() => {
      handleDismiss();
    }, 4000);

    // CLEANUP
    return () => clearTimeout(autoDismissTimer);
    
    // IMPORTANT: The dependency array is empty []. 
    // This ignores updates from the parent (like mouse movements), 
    // preventing the toast from "resurrecting".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  const isSuccess = type === 'success';

  // Styles
  const borderColor = isSuccess ? 'border-emerald-500/50' : 'border-red-500/50';
  const glowColor = isSuccess ? 'shadow-emerald-500/20' : 'shadow-red-500/20';
  const iconColor = isSuccess ? 'text-emerald-400' : 'text-red-400';
  const progressColor = isSuccess ? 'bg-emerald-500' : 'bg-red-500';

  return (
    <div
      className={`fixed top-5 left-1/2 z-[9999] flex flex-col
        transform -translate-x-1/2
        bg-gray-900/90 backdrop-blur-md border ${borderColor}
        rounded-xl shadow-2xl ${glowColor}
        min-w-[320px] overflow-hidden
        transition-all duration-500 cubic-bezier(0.175, 0.885, 0.32, 1.275)
        ${visible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-full opacity-0 scale-95'}
      `}
    >
      <div className="flex items-center p-4">
        {/* Icon */}
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

        {/* Close Button - Now calls handleDismiss */}
        <button 
          onClick={handleDismiss} 
          className="text-gray-500 hover:text-white transition-colors ml-4 p-1 hover:bg-white/10 rounded-md"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
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
