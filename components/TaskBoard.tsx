
import React, { useState, useRef, useEffect } from 'react';
import { Button } from './Button';
import { CheckSquare, Square, Plus, Trash2, X, Lock, Eye, Minus, Maximize2, ListChecks } from 'lucide-react';
import { TodoItem } from '../types';

interface TaskBoardProps {
  myTasks: TodoItem[];
  partnerTasks: TodoItem[];
  onAddTask: (text: string) => void;
  onToggleTask: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  isOpen: boolean;
  onClose: () => void;
  isRevealed: boolean; // True during ICEBREAKER, DEBRIEF or COMPLETED phases
  canEdit: boolean; // True only during ICEBREAKER
  partnerName: string;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ 
    myTasks, partnerTasks, onAddTask, onToggleTask, onDeleteTask, isOpen, onClose, isRevealed, canEdit, partnerName 
}) => {
  const [activeTab, setActiveTab] = useState<'me' | 'partner'>('me');
  const [newTaskText, setNewTaskText] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [animatingTask, setAnimatingTask] = useState<string | null>(null);
  
  // Dragging State
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTaskText.trim()) {
      onAddTask(newTaskText);
      setNewTaskText('');
    }
  };

  const handleToggle = (taskId: string) => {
      setAnimatingTask(taskId);
      setTimeout(() => setAnimatingTask(null), 300); // Reset after animation
      onToggleTask(taskId);
  };

  // Drag Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (windowRef.current) {
      setIsDragging(true);
      const rect = windowRef.current.getBoundingClientRect();
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
        animationFrameId = requestAnimationFrame(() => {
             const newLeft = e.clientX - dragOffset.x;
             const newTop = e.clientY - dragOffset.y;
             if (windowRef.current) {
                 windowRef.current.style.left = `${newLeft}px`;
                 windowRef.current.style.top = `${newTop}px`;
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
      ${isMinimized ? 'h-14 w-64' : 'h-[450px] w-80 md:w-96'}`}
      style={{ 
        bottom: windowRef.current?.style.top ? 'auto' : '6rem', 
        left: windowRef.current?.style.left ? 'auto' : '1rem',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center cursor-grab active:cursor-grabbing select-none"
      >
        <h3 className="font-semibold text-slate-200 flex items-center gap-2 text-sm">
          <ListChecks size={16} className="text-emerald-400"/> 
          Mission Targets
        </h3>
        <div className="flex items-center gap-1">
            <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="p-1 hover:bg-slate-800 rounded text-slate-400">
                {isMinimized ? <Maximize2 size={14}/> : <Minus size={14}/>}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-red-400">
                <X size={14}/>
            </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex-1 flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-slate-800">
                <button 
                    onClick={() => setActiveTab('me')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'me' ? 'bg-slate-800 text-white border-b-2 border-emerald-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    My Targets
                </button>
                <button 
                    onClick={() => setActiveTab('partner')}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'partner' ? 'bg-slate-800 text-white border-b-2 border-blue-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {partnerName}'s Targets
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-900/50">
                
                {/* MY TASKS */}
                {activeTab === 'me' && (
                    <div className="space-y-3">
                        {myTasks.length === 0 && <p className="text-slate-500 text-sm text-center mt-4 italic">No targets set yet.</p>}
                        
                        {myTasks.map(task => (
                            <div key={task.id} className="flex items-start gap-3 bg-slate-800/50 p-3 rounded-lg group border border-transparent hover:border-slate-700 transition-colors">
                                <button 
                                    onClick={() => handleToggle(task.id)}
                                    className={`mt-0.5 transition-all duration-200 transform 
                                    ${task.completed ? 'text-emerald-400' : 'text-slate-500 hover:text-white'}
                                    ${animatingTask === task.id ? 'scale-125 text-emerald-300' : 'scale-100'}`}
                                >
                                    {task.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                </button>
                                <span className={`text-sm flex-1 break-words transition-all duration-300 ${task.completed ? 'text-slate-500 line-through decoration-slate-600' : 'text-slate-200'}`}>
                                    {task.text}
                                </span>
                                {canEdit && (
                                    <button onClick={() => onDeleteTask(task.id)} className="text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Trash2 size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* PARTNER TASKS (Logic: Hidden during FOCUS only) */}
                {activeTab === 'partner' && (
                    <div className="space-y-3 h-full">
                        {!isRevealed ? (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-80">
                                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                                    <Lock size={32} className="text-blue-400" />
                                </div>
                                <div>
                                    <h4 className="text-white font-bold">Classified</h4>
                                    <p className="text-slate-400 text-xs mt-1">
                                        Partner is working on {partnerTasks.length} target{partnerTasks.length !== 1 ? 's' : ''}.
                                        <br/>Details hidden during Deep Focus.
                                    </p>
                                </div>
                                <div className="w-full max-w-[200px] space-y-2 opacity-50">
                                    {/* Fake blurred lines */}
                                    <div className="h-4 bg-slate-700 rounded w-3/4 mx-auto animate-pulse"></div>
                                    <div className="h-4 bg-slate-700 rounded w-full mx-auto animate-pulse delay-75"></div>
                                    <div className="h-4 bg-slate-700 rounded w-5/6 mx-auto animate-pulse delay-150"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-3 animate-in fade-in zoom-in-95 duration-500">
                                <div className="text-center text-xs text-blue-400 mb-2 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                                    <Eye size={12}/> {canEdit ? "Planning Phase" : "Declassified"}
                                </div>
                                {partnerTasks.length === 0 && <p className="text-slate-500 text-sm text-center italic">No targets set by partner.</p>}
                                {partnerTasks.map(task => (
                                    <div key={task.id} className="flex items-start gap-3 bg-blue-900/10 border border-blue-500/20 p-3 rounded-lg">
                                        <span className={`mt-0.5 ${task.completed ? 'text-emerald-400' : 'text-slate-500'}`}>
                                            {task.completed ? <CheckSquare size={18} /> : <Square size={18} />}
                                        </span>
                                        <span className={`text-sm flex-1 ${task.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>
                                            {task.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Input (Only for 'me' tab AND when allowed to edit) */}
            {activeTab === 'me' && (
                <div className="p-3 bg-slate-950 border-t border-slate-800">
                    {canEdit ? (
                        <form onSubmit={handleAdd} className="flex gap-2">
                            <input 
                                type="text" 
                                value={newTaskText}
                                onChange={(e) => setNewTaskText(e.target.value)}
                                placeholder="Add a new target..."
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"
                            />
                            <Button type="submit" variant="secondary" className="p-2 w-10 h-10 flex items-center justify-center bg-emerald-600/10 text-emerald-500 hover:bg-emerald-600/20 border-emerald-500/50">
                                <Plus size={18} />
                            </Button>
                        </form>
                    ) : (
                         <div className="text-xs text-center text-slate-500 italic py-2">
                            Mission list locked during Deep Focus.
                        </div>
                    )}
                </div>
            )}
        </div>
      )}
    </div>
  );
};
