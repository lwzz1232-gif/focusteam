
import React, { useEffect, useRef, useState } from 'react';
import { Button } from './Button';
import { Send, MessageSquare, X, Minus, Maximize2 } from 'lucide-react';
import { ChatMessage } from '../types';

interface ChatWindowProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  partnerName: string;
  isPartnerTyping?: boolean;
  isOpen: boolean;
  onClose: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSendMessage, partnerName, isPartnerTyping, isOpen, onClose }) => {
  const [inputText, setInputText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (isOpen && !isMinimized) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isPartnerTyping, isMinimized]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText);
    setInputText('');
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
      // Calculate offset from top-left of the window
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && windowRef.current) {
        // Use requestAnimationFrame for smooth 60fps updates without lag
        animationFrameId = requestAnimationFrame(() => {
             const newLeft = e.clientX - dragOffset.x;
             const newTop = e.clientY - dragOffset.y;
             
             if (windowRef.current) {
                 windowRef.current.style.left = `${newLeft}px`;
                 windowRef.current.style.top = `${newTop}px`;
                 // Reset bottom/right to allow free movement
                 windowRef.current.style.bottom = 'auto';
                 windowRef.current.style.right = 'auto';
             }
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isDragging, dragOffset]);


  if (!isOpen) return null;

  return (
    <div 
      ref={windowRef}
      className={`fixed z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden 
      ${isDragging ? '' : 'transition-all duration-200'} 
      ${isMinimized ? 'h-14 w-64' : 'h-[400px] w-80 md:w-96'}`}
      style={{ 
        // Default Position if not dragged yet (CSS handles initial placement via class or style, JS takes over on drag)
        // If JS hasn't touched top/left yet, we fallback to bottom right
        bottom: windowRef.current?.style.top ? 'auto' : '6rem', 
        right: windowRef.current?.style.left ? 'auto' : '1rem',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      
      {/* Header (Draggable) */}
      <div 
        onMouseDown={handleMouseDown}
        className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center cursor-grab active:cursor-grabbing select-none"
      >
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <MessageSquare size={16} className="text-blue-400"/> 
          {isMinimized ? partnerName : `Chat with ${partnerName}`}
        </h3>
        <div className="flex items-center gap-1">
            <button 
                onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
                className="p-1 text-slate-500 hover:text-white transition-colors rounded hover:bg-slate-800"
            >
                {isMinimized ? <Maximize2 size={14} /> : <Minus size={14} />}
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded hover:bg-slate-800"
            >
                <X size={14} />
            </button>
        </div>
      </div>

      {/* Content */}
      {!isMinimized && (
          <>
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                <div className="text-center text-slate-500 text-sm mt-4">
                    Start the conversation...
                </div>
                )}
                
                {messages.map((msg) => {
                const isMe = msg.senderId === 'me';
                return (
                    <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div 
                        className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                        isMe 
                            ? 'bg-blue-600 text-white rounded-br-none' 
                            : 'bg-slate-800 text-slate-200 rounded-bl-none border border-slate-700'
                        }`}
                    >
                        {msg.text}
                        <div className={`text-[10px] mt-1 ${isMe ? 'text-blue-200' : 'text-slate-500'} text-right`}>
                        {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </div>
                    </div>
                    </div>
                );
                })}

                {isPartnerTyping && (
                <div className="flex justify-start">
                    <div className="bg-slate-800 border border-slate-700 px-3 py-2 rounded-2xl rounded-bl-none flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                        <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
                    </div>
                </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} className="p-3 bg-slate-950 border-t border-slate-800 flex gap-2">
                <input 
                type="text" 
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-slate-900 border border-slate-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors placeholder:text-slate-600"
                />
                <Button type="submit" className="rounded-full w-10 h-10 p-0 flex items-center justify-center">
                <Send size={16} />
                </Button>
            </form>
          </>
      )}
    </div>
  );
};