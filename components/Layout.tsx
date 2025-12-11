import React, { useState, useEffect } from 'react';
import { User, Screen, Notification } from '../types';
import { LogOut, ShieldAlert, Instagram, Facebook, Music2, Bell, Inbox, CheckCircle2 } from 'lucide-react';
import { Logo } from './Logo';
import { getNotifications } from '../services/mockBackend';
import { updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../utils/firebaseConfig';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentScreen: Screen;
  onLogout: () => void;
  onAdminClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentScreen, onLogout, onAdminClick }) => {
  const showLogout = currentScreen === Screen.DASHBOARD;
  // Allow both 'admin' and 'dev' roles to access admin features
  const showAdmin = (user?.role === 'admin' || user?.role === 'dev') && currentScreen === Screen.DASHBOARD;
  const showFooter = currentScreen !== Screen.SPLASH && currentScreen !== Screen.SESSION;
  const showNotifications = user && currentScreen !== Screen.SPLASH && currentScreen !== Screen.SESSION;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  
  // Calculate unread count purely from state
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (user) {
        const fetchNotes = async () => {
            try {
                const notes = await getNotifications(user.id);
                const now = Date.now();
                
                // 1. Separate valid notes from expired ones
                const validNotes: Notification[] = [];
                
                for (const n of notes) {
                    const noteData = n as any;
                    // If marked for deletion and time has passed, delete from DB
                    if (noteData.deleteAt && noteData.deleteAt < now) {
                        deleteDoc(doc(db, 'users', user.id, 'notifications', n.id)).catch(console.error);
                    } else {
                        validNotes.push(n);
                    }
                }
                
                // 2. Sort by timestamp (newest first)
                validNotes.sort((a, b) => b.timestamp - a.timestamp);
                setNotifications(validNotes);
            } catch (error) {
                console.error("Failed to fetch notifications:", error);
            }
        };

        // Initial fetch
        fetchNotes();
        
        // Poll every 5 seconds
        const interval = setInterval(fetchNotes, 5000);
        return () => clearInterval(interval);
    }
  }, [user]);

  const handleNotificationClick = async (id: string) => {
    if (!user) return;
    
    // Optimistic UI Update: Mark read immediately
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    
    try {
        const readAt = Date.now();
        const deleteAt = readAt + (12 * 60 * 60 * 1000); // 12 hours from now
        
        // Update Firestore
        await updateDoc(doc(db, 'users', user.id, 'notifications', id), {
            read: true,
            readAt: readAt,
            deleteAt: deleteAt
        });
    } catch (error) {
        console.error("Failed to mark notification read:", error);
        // Revert UI if failed
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: false } : n));
    }
  };

  const getGreeting = () => {
      if (!user) return "";
      if (user.role === 'admin' || user.role === 'dev') return `Welcome, Admin ${user.name}`;

      const hour = new Date().getHours();
      if (hour < 12) return `Good Morning, ${user.name}`;
      if (hour < 18) return `Good Afternoon, ${user.name}`;
      return `Good Evening, ${user.name}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-inter">
      {currentScreen !== Screen.SPLASH && (
        <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50 transition-all duration-300">
          <div className="flex items-center gap-3 group cursor-default">
            <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Logo className="w-8 h-8 relative z-10" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-cyan-400 hidden md:block">
              FocusTwin
            </span>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-sm font-medium text-slate-300">
                {getGreeting()}
              </div>

              {showNotifications && (
                  <div className="relative">
                      <button 
                        onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                        className={`p-2 rounded-full transition-all duration-300 relative group ${showNotifDropdown ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
                      >
                          <Bell size={20} className={unreadCount > 0 ? 'animate-[wiggle_1s_ease-in-out_infinite]' : ''} />
                          
                          {/* Pulsing Dot */}
                          {unreadCount > 0 && (
                              <>
                                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full z-20 border-2 border-slate-950"></span>
                                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping z-10 opacity-75"></span>
                              </>
                          )}
                      </button>

                      {showNotifDropdown && (
                          <>
                            {/* Invisible backdrop to close on click outside */}
                            <div className="fixed inset-0 z-40" onClick={() => setShowNotifDropdown(false)}></div>
                            
                            {/* Dropdown Container */}
                            <div className="absolute top-full right-0 mt-4 w-96 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                                <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden ring-1 ring-white/5">
                                    
                                    {/* Header */}
                                    <div className="p-4 border-b border-white/5 flex justify-between items-center bg-slate-950/30">
                                        <h3 className="font-semibold text-sm text-slate-200">Inbox</h3>
                                        {unreadCount > 0 ? (
                                            <span className="text-[10px] font-bold bg-gradient-to-r from-blue-600 to-cyan-500 text-white px-2 py-0.5 rounded-full shadow-lg shadow-blue-500/20">
                                                {unreadCount} NEW
                                            </span>
                                        ) : (
                                            <span className="text-slate-500 text-xs flex items-center gap-1">
                                                <CheckCircle2 size={12} /> All caught up
                                            </span>
                                        )}
                                    </div>

                                    {/* List */}
                                    <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                                        {notifications.length === 0 ? (
                                            <div className="py-12 px-6 text-center flex flex-col items-center justify-center opacity-50">
                                                <div className="w-12 h-12 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                                    <Inbox size={24} className="text-slate-400" />
                                                </div>
                                                <p className="text-sm font-medium text-slate-300">No new notifications</p>
                                                <p className="text-xs text-slate-500 mt-1">We'll let you know when something happens.</p>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-white/5">
                                                {notifications.map(note => (
                                                    <div 
                                                      key={note.id} 
                                                      onClick={() => handleNotificationClick(note.id)}
                                                      className={`p-4 cursor-pointer transition-all duration-200 group relative
                                                        ${!note.read 
                                                            ? 'bg-gradient-to-r from-blue-500/10 to-transparent hover:from-blue-500/20' 
                                                            : 'hover:bg-slate-800/50 opacity-70 hover:opacity-100'
                                                        }
                                                      `}
                                                    >
                                                        {/* Unread Indicator Line */}
                                                        {!note.read && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"></div>
                                                        )}

                                                        <div className="flex justify-between items-start gap-3">
                                                            <div className="flex-1">
                                                                {note.type === 'system' && (
                                                                    <div className="flex items-center gap-1.5 mb-1.5">
                                                                        <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                                                                            <ShieldAlert size={8} className="text-blue-400" /> System
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500">• FocusTwin Team</span>
                                                                    </div>
                                                                )}
                                                                <p className={`text-sm leading-relaxed ${!note.read ? 'text-white font-medium' : 'text-slate-400 group-hover:text-slate-300'}`}>
                                                                    {note.text}
                                                                </p>
                                                            </div>
                                                            <span className="text-[10px] text-slate-600 whitespace-nowrap mt-1 font-mono">
                                                                {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Footer */}
                                    {notifications.length > 0 && (
                                        <div className="p-2 bg-slate-950/30 border-t border-white/5 text-[10px] text-center text-slate-600 italic">
                                            Notifications disappear after 12 hours
                                        </div>
                                    )}
                                </div>
                            </div>
                          </>
                      )}
                  </div>
              )}
              
              {showAdmin && (
                 <button 
                 onClick={onAdminClick}
                 className="p-2 text-amber-400 hover:bg-amber-400/10 hover:shadow-[0_0_15px_rgba(251,191,36,0.2)] rounded-full transition-all duration-300"
                 title="Admin Dashboard"
               >
                 <ShieldAlert size={20} />
               </button>
              )}

              {/* FIX: Made the button more explicit and prevent event bubbling issues */}
              {showLogout && (
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    onLogout();
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              )}
            </div>
          )}
        </nav>
      )}

      <main className="flex-1 flex flex-col relative overflow-hidden">
        {children}
      </main>

      {showFooter && (
        <footer className="border-t border-slate-900 bg-slate-950 py-6 px-4 relative z-10">
            <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-xs text-slate-600">
                    © 2025 FocusTwin.
                </div>
                
                <div className="flex items-center gap-4">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Find Us Here</span>
                    <div className="flex items-center gap-3">
                        <a 
                          href="https://www.instagram.com/focustwin_?igsh=MTJieG9reWh6dHl4cQ==" 
                           target="_blank"             // new tab
                          rel="noopener noreferrer"
                          className="group p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-500 transition-all duration-300 hover:text-[#E4405F] hover:border-[#E4405F]/50 hover:bg-[#E4405F]/10 hover:shadow-[0_0_15px_rgba(228,64,95,0.4)] hover:-translate-y-1"
                          title="Instagram"
                        >
                            <Instagram size={18} />
                        </a>

                        <a 
                          href="#" 
                          className="group p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-500 transition-all duration-300 hover:text-white hover:border-[#ff0050]/60 hover:bg-slate-900 hover:shadow-[0_0_15px_rgba(0,242,234,0.4)] hover:-translate-y-1 relative overflow-hidden"
                          title="TikTok"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0050]/10 to-[#00f2ea]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Music2 size={18} className="relative z-10" />
                        </a>

                        <a 
                          href="#" 
                          className="group p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-500 transition-all duration-300 hover:text-[#1877F2] hover:border-[#1877F2]/50 hover:bg-[#1877F2]/10 hover:shadow-[0_0_15px_rgba(24,119,242,0.4)] hover:-translate-y-1"
                          title="Facebook"
                        >
                            <Facebook size={18} />
                        </a>
                    </div>
                </div>
            </div>
        </footer>
      )}
    </div>
  );
};
