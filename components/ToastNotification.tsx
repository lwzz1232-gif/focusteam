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
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500); // Wait for fade out animation
    }, 4000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  const icon = type === 'success' ? '✅' : '❌';

  return (
    <div
      className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white ${bgColor} transition-all duration-300 ease-in-out transform ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
      style={{ zIndex: 1000 }}
    >
      <div className="flex items-center">
        <span className="text-xl mr-3">{icon}</span>
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  );
};
