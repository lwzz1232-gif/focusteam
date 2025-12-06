
import React, { useState, useEffect } from 'react';
import { User, Screen, Notification } from '../types';
import { LogOut, ShieldAlert, Instagram, Facebook, Music2, Bell } from 'lucide-react';
import { Logo } from './Logo';
import { getNotifications, markNotificationRead } from '../services/mockBackend';

interface LayoutProps {
  children: React.ReactNode;
  user: User | null;
  currentScreen: Screen;
  onLogout: () => void;
  onAdminClick?: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, user, currentScreen, onLogout, onAdminClick }) => {
  const showLogout = currentScreen === Screen.DASHBOARD;
  // FIX: Allow both 'admin' and 'dev' roles to access admin features
 const showAdmin = user?.role === 'admin' && currentScreen === Screen.DASHBOARD;
  const showFooter = currentScreen !== Screen.SPLASH && currentScreen !== Screen.SESSION;
  const showNotifications = user && currentScreen !== Screen.SPLASH && currentScreen !== Screen.SESSION;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const unreadCount = notifications.filter(n => !n.read).length;

useEffect(() => {
    if (user) {
        const fetchNotes = async () => {
            const notes = await getNotifications(user.id);
            setNotifications(notes);
        };
        fetchNotes();
        const interval = setInterval(fetchNotes, 3000);
        return () => clearInterval(interval);
    }
}, [user]);

  const handleNotificationClick = (id: string) => {
      if (user) markNotificationRead(user.id, id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
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
        <nav className="h-16 border-b border-slate-800 flex items-center justify-between px-4 md:px-8 bg-slate-950/80 backdrop-blur-sm sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
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
                        className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors relative"
                      >
                          <Bell size={20} />
                          {unreadCount > 0 && (
                              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          )}
                      </button>

                      {showNotifDropdown && (
                          <div className="absolute top-full right-0 mt-2 w-80 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2">
                              <div className="p-3 border-b border-slate-800 font-semibold text-sm flex justify-between">
                                  <span>Notifications</span>
                                  {unreadCount > 0 && <span className="text-xs text-blue-400">{unreadCount} new</span>}
                              </div>
                              <div className="max-h-64 overflow-y-auto">
                                  {notifications.length === 0 ? (
                                      <div className="p-4 text-center text-slate-500 text-sm">No notifications</div>
                                  ) : (
                                      notifications.map(note => (
                                          <div 
                                            key={note.id} 
                                            onClick={() => handleNotificationClick(note.id)}
                                            className={`p-3 border-b border-slate-800/50 cursor-pointer hover:bg-slate-800 transition-colors ${!note.read ? 'bg-blue-500/5' : ''}`}
                                          >
                                              {note.type === 'system' && (
                                                  <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide block mb-1">
                                                      From: FocusTwin Team
                                                  </span>
                                              )}
                                              <p className={`text-sm ${!note.read ? 'text-white font-medium' : 'text-slate-400'}`}>
                                                  {note.text}
                                              </p>
                                              <p className="text-[10px] text-slate-600 mt-1">
                                                  {new Date(note.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                              </p>
                                          </div>
                                      ))
                                  )}
                              </div>
                          </div>
                      )}
                  </div>
              )}
              
              {showAdmin && (
                 <button 
                 onClick={onAdminClick}
                 className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-full transition-colors"
                 title="Admin Dashboard"
               >
                 <ShieldAlert size={20} />
               </button>
              )}

              {showLogout && (
                <button 
                  onClick={onLogout}
                  className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
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
                        {/* Instagram - Official Color #E4405F */}
                        <a 
                          href="#" 
                          className="group p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-500 transition-all duration-300 hover:text-[#E4405F] hover:border-[#E4405F]/50 hover:bg-[#E4405F]/10 hover:shadow-[0_0_15px_rgba(228,64,95,0.4)] hover:-translate-y-1"
                          title="Instagram"
                        >
                            <Instagram size={18} />
                        </a>

                        {/* TikTok - Official Colors: Black/White with Red (#ff0050) & Cyan (#00f2ea) Accents */}
                        <a 
                          href="#" 
                          className="group p-2 rounded-full bg-slate-900 border border-slate-800 text-slate-500 transition-all duration-300 hover:text-white hover:border-[#ff0050]/60 hover:bg-slate-900 hover:shadow-[0_0_15px_rgba(0,242,234,0.4)] hover:-translate-y-1 relative overflow-hidden"
                          title="TikTok"
                        >
                            <div className="absolute inset-0 bg-gradient-to-br from-[#ff0050]/10 to-[#00f2ea]/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <Music2 size={18} className="relative z-10" />
                        </a>

                        {/* Facebook - Official Color #1877F2 */}
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
