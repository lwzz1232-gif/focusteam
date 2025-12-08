import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, query, orderBy, getDocs, updateDoc, doc, limit, where, startAfter, DocumentData, QueryDocumentSnapshot, writeBatch, deleteDoc } from 'firebase/firestore';
import { Report, SessionLog, ChatMessage, User } from '../types';
import { Button } from '../components/Button';
import { Shield, AlertTriangle, UserX, UserCheck, History, XCircle, CheckCircle, ArrowLeft, X, FileText, Download, Users, Radio, Activity, Zap, Search, ChevronDown, ArrowRight, RefreshCw, Copy, Trash2, Server } from 'lucide-react';

interface AdminProps {
  onBack: () => void;
}

export const Admin: React.FC<AdminProps> = ({ onBack }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'sessions' | 'users'>('reports');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Pagination State
  const [lastUserDoc, setLastUserDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastSessionDoc, setLastSessionDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Stats State
  const [stats, setStats] = useState({ activeUsers: 0, activeSessions: 0, totalHoursFocused: 0 });
  
  // Broadcast State
  const [broadcastMsg, setBroadcastMsg] = useState('');

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  // Detail Modal State
  const [selectedSession, setSelectedSession] = useState<SessionLog | null>(null);
  const [sessionChats, setSessionChats] = useState<ChatMessage[]>([]);
  
  // Initial Fetch & Refresh
  useEffect(() => {
    fetchInitialData();
  }, [refreshTrigger, activeTab]);

  const fetchInitialData = async () => {
    setIsRefreshing(true);
    try {
        if (activeTab === 'users') {
            const q = query(collection(db, 'users'), limit(20)); // Increased limit for desktop
            const snap = await getDocs(q);
            setLastUserDoc(snap.docs[snap.docs.length - 1]);
            setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        } 
        else if (activeTab === 'sessions') {
            const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(20));
            const snap = await getDocs(q);
            setLastSessionDoc(snap.docs[snap.docs.length - 1]);
            setSessions(mapSessions(snap));
        }
        else if (activeTab === 'reports') {
            const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc')));
            const reportsData = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: d.data().timestamp?.toMillis() || Date.now() } as Report));
            setReports(reportsData);
        }

        // Stats
        const activeSessSnap = await getDocs(query(collection(db, 'sessions'), where('status', '==', 'active')));
        const userCountSnap = await getDocs(collection(db, 'users')); 
        
        setStats({
            activeUsers: userCountSnap.size,
            activeSessions: activeSessSnap.size,
            totalHoursFocused: 0 // Placeholder
        });

    } catch (e) { console.error("Admin Fetch Error:", e); }
    setIsRefreshing(false);
  };

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoadMoreUsers = async () => {
    if (!lastUserDoc) return;
    setLoadingMore(true);
    const q = query(collection(db, 'users'), startAfter(lastUserDoc), limit(10));
    const snap = await getDocs(q);
    setLastUserDoc(snap.docs[snap.docs.length - 1]);
    setUsers(prev => [...prev, ...snap.docs.map(d => ({ ...d.data(), id: d.id } as User))]);
    setLoadingMore(false);
  };

  const handleLoadMoreSessions = async () => {
    if (!lastSessionDoc) return;
    setLoadingMore(true);
    const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), startAfter(lastSessionDoc), limit(10));
    const snap = await getDocs(q);
    setLastSessionDoc(snap.docs[snap.docs.length - 1]);
    setSessions(prev => [...prev, ...mapSessions(snap)]);
    setLoadingMore(false);
  };

  const handleSearchUser = async () => {
      if (!searchQuery.trim()) {
          setIsSearching(false);
          fetchInitialData();
          return;
      }
      setIsSearching(true);
      try {
        // Simple client-side search for ID or Email since Firestore searching is limited without Algolia
        const q = query(collection(db, 'users'));
        const snap = await getDocs(q);
        const results = snap.docs
            .map(d => ({ ...d.data(), id: d.id } as User))
            .filter(u => 
                u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
                u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                u.id === searchQuery
            );
        setUsers(results);
      } catch (e) { console.error(e); }
  };

  const mapSessions = (snap: any): SessionLog[] => {
      return snap.docs.map((d: any) => {
        const data = d.data();
        return {
            id: d.id,
            user1: data.user1,
            user2: data.user2,
            startTime: data.createdAt?.toMillis() || Date.now(),
            duration: data.config?.duration || 0,
            actualDuration: data.endedAt ? Math.round((data.endedAt.toMillis() - data.createdAt.toMillis()) / 60000) : 0,
            type: data.config?.type,
            outcome: data.status === 'completed' ? 'COMPLETED' : 'ABORTED',
            tasks: data.tasks || []
        } as SessionLog;
    });
  };

 const handleBan = async (userId: string) => {
  const reason = prompt("Ban reason (optional):", "Violation of Terms");
  if (!reason) return; // User cancelled
  
  if (confirm(`Ban user ${userId} for 24 hours?`)) {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000;
      await updateDoc(doc(db, 'users', userId), {
          bannedUntil: until,
          banReason: reason
      });
      // Update local state immediately
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, bannedUntil: until, banReason: reason } : u));
      alert("User banned successfully!");
    } catch(e: any) { 
      alert("Failed to ban: " + e.message); 
    }
  }
};

const handleUnban = async (userId: string) => {
  if (confirm(`Unban user ${userId}?`)) {
      try {
          await updateDoc(doc(db, 'users', userId), {
              bannedUntil: null,
              banReason: null
          });
          // Update local state
          setUsers(prev => prev.map(u => u.id === userId ? { ...u, bannedUntil: undefined, banReason: undefined } : u));
      } catch(e: any) { 
          alert("Failed to unban: " + e.message); 
      }
  }
}

// Added: Dismiss report (delete it)
const handleDismissReport = async (reportId: string) => {
    if(confirm("Dismiss and delete this report?")) {
        try {
            await deleteDoc(doc(db, 'reports', reportId));
            setReports(prev => prev.filter(r => r.id !== reportId));
        } catch (e) { console.error(e); }
    }
}

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    if (!confirm(`Send to ${stats.activeUsers} users?`)) return;
    
    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      const batch = writeBatch(db);
      usersSnap.forEach(userDoc => {
        const notifRef = doc(collection(db, 'users', userDoc.id, 'notifications'));
        batch.set(notifRef, {
          text: broadcastMsg,
          timestamp: Date.now(),
          read: false,
          type: 'system'
        });
      });
      await batch.commit();
      alert(`✅ Sent!`);
      setBroadcastMsg('');
    } catch(e: any) {
      alert("Error: " + e.message);
    }
};

  const getBanInfo = (user: User) => {
    if (!user.bannedUntil || user.bannedUntil < Date.now()) return null;
    return {
        endTime: user.bannedUntil,
        reason: user.banReason || "Admin Action",
        timeLeft: Math.ceil((user.bannedUntil - Date.now()) / 1000 / 60)
    };
  };

  const openSessionDetails = async (session: SessionLog) => {
    setSelectedSession(session);
    const chatsSnap = await getDocs(query(collection(db, 'sessions', session.id, 'messages'), orderBy('timestamp', 'asc')));
    const chats = chatsSnap.docs.map(d => ({
        ...d.data(),
        id: d.id,
        timestamp: d.data().timestamp?.toMillis() || Date.now()
    } as ChatMessage));
    setSessionChats(chats);
  };

  const downloadChatLog = () => {
    if (!selectedSession) return;
    const lines = sessionChats.map(c => `[${new Date(c.timestamp).toLocaleString()}] ${c.senderName}: ${c.text}`);
    const content = `Session ID: ${selectedSession.id}\nParticipants: ${selectedSession.user1?.name} & ${selectedSession.user2?.name}\nDate: ${new Date(selectedSession.startTime).toLocaleString()}\n\n--- CHAT LOG ---\n${lines.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat_log_${selectedSession.id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      // Could add toast here
  };

  return (
    <div className="flex-1 h-screen overflow-hidden flex flex-col bg-slate-950 relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>
      
      {/* Header */}
      <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-slate-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-white hover:bg-white/5">
                <ArrowLeft size={20} />
            </Button>
            <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                    <Shield className="text-blue-500" size={24} />
                    Admin Command
                </h1>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Systems Operational
                </div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={handleRefresh} className={`text-slate-400 hover:text-white ${isRefreshing ? 'animate-spin' : ''}`}>
                <RefreshCw size={18} />
            </Button>
            <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <Server size={14} className="text-slate-500"/>
                <span className="text-xs font-mono text-slate-300">v2.1.0</span>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StatsCard 
                icon={<Users size={20} />} 
                label="Total Users" 
                value={stats.activeUsers.toString()} 
                color="blue" 
            />
            <StatsCard 
                icon={<Zap size={20} />} 
                label="Live Sessions" 
                value={stats.activeSessions.toString()} 
                color="emerald" 
            />
            <StatsCard 
                icon={<Activity size={20} />} 
                label="Focus Hours" 
                value={stats.totalHoursFocused.toString()} 
                color="purple" 
            />
            
            {/* Broadcast Input */}
            <div className="bg-slate-900/50 border border-white/10 p-4 rounded-xl flex flex-col gap-2 shadow-lg">
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        placeholder="System Broadcast..." 
                        className="bg-slate-950 border border-slate-700 rounded px-3 py-1.5 text-xs w-full text-white focus:outline-none focus:border-blue-500 placeholder:text-slate-600"
                        value={broadcastMsg}
                        onChange={(e) => setBroadcastMsg(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleBroadcast()}
                    />
                    <button onClick={handleBroadcast} className="bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded px-3 py-1 text-xs transition-colors">
                        <Radio size={14} />
                    </button>
                </div>
                <span className="text-[10px] text-slate-500 pl-1">Alerts all active users immediately.</span>
            </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-white/5 w-fit mb-6 shadow-xl">
            <TabButton 
                isActive={activeTab === 'reports'} 
                onClick={() => setActiveTab('reports')} 
                icon={<AlertTriangle size={16}/>} 
                label="Reports" 
                count={reports.length}
                alert={reports.length > 0}
            />
            <TabButton 
                isActive={activeTab === 'sessions'} 
                onClick={() => setActiveTab('sessions')} 
                icon={<History size={16}/>} 
                label="History" 
            />
            <TabButton 
                isActive={activeTab === 'users'} 
                onClick={() => setActiveTab('users')} 
                icon={<Users size={16}/>} 
                label="Userbase" 
            />
        </div>

        {/* --- CONTENT AREA --- */}
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* REPORTS TAB */}
            {activeTab === 'reports' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {reports.length === 0 ? (
                        <div className="col-span-full py-20 text-center text-slate-500 bg-slate-900/30 border border-white/5 rounded-xl border-dashed">
                            <Shield size={48} className="mx-auto mb-4 opacity-20" />
                            <p>No active reports. Community is safe.</p>
                        </div>
                    ) : (
                        reports.map((report) => (
                            <div key={report.id} className="bg-slate-900/80 border border-red-500/20 rounded-xl p-5 shadow-lg flex flex-col gap-4 relative overflow-hidden group">
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-red-400 font-bold uppercase text-xs tracking-wider border border-red-500/30 px-2 py-0.5 rounded bg-red-500/10">{report.reason}</span>
                                            <span className="text-xs text-slate-500">{new Date(report.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="text-sm text-slate-300 mt-2">
                                            Reported by <span className="text-slate-500 font-mono text-xs cursor-pointer hover:text-white" onClick={() => copyToClipboard(report.reporterId)}>{report.reporterId}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleDismissReport(report.id)} className="p-2 text-slate-500 hover:text-white hover:bg-slate-800 rounded-lg transition-colors" title="Dismiss">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Suspect ID</div>
                                        <div className="font-mono text-white text-sm cursor-pointer hover:text-blue-400 flex items-center gap-2" onClick={() => copyToClipboard(report.reportedId)}>
                                            {report.reportedId} <Copy size={10} className="opacity-50"/>
                                        </div>
                                    </div>
                                    <Button variant="danger" onClick={() => handleBan(report.reportedId)} className="text-xs py-1.5 h-auto">
                                        <UserX size={14} className="mr-2" /> Ban User
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* SESSIONS TAB */}
            {activeTab === 'sessions' && (
                <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4 font-medium">Session ID</th>
                                    <th className="px-6 py-4 font-medium">Users</th>
                                    <th className="px-6 py-4 font-medium">Duration</th>
                                    <th className="px-6 py-4 font-medium">Status</th>
                                    <th className="px-6 py-4 font-medium text-right">Time</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sessions.map(s => (
                                    <tr 
                                        key={s.id} 
                                        onClick={() => openSessionDetails(s)}
                                        className="hover:bg-white/5 transition-colors cursor-pointer group"
                                    >
                                        <td className="px-6 py-4 font-mono text-slate-500 text-xs group-hover:text-blue-400 transition-colors">
                                            {s.id.substring(0,8)}...
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-slate-200">{s.user1?.name || 'Unknown'}</span>
                                                <span className="text-slate-400 text-xs">& {s.user2?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-mono font-bold ${s.outcome === 'ABORTED' ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {s.actualDuration}m
                                                </span>
                                                <span className="text-slate-600 text-xs">/ {s.duration}m</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={s.outcome} />
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500 text-xs">
                                            {new Date(s.startTime).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {lastSessionDoc && (
                        <div className="p-3 bg-slate-950/50 border-t border-white/5 text-center">
                             <button onClick={handleLoadMoreSessions} disabled={loadingMore} className="text-xs text-slate-400 hover:text-white transition-colors flex items-center justify-center gap-1 mx-auto">
                                {loadingMore ? 'Loading...' : 'Load More'} <ChevronDown size={12}/>
                             </button>
                        </div>
                    )}
                </div>
            )}

            {/* USERS TAB */}
            {activeTab === 'users' && (
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="bg-slate-900/50 border border-white/10 p-2 rounded-xl flex items-center gap-2 max-w-md">
                        <Search size={16} className="ml-2 text-slate-500" />
                        <input 
                            type="text" 
                            placeholder="Search by Name, Email or ID..." 
                            className="bg-transparent border-none focus:ring-0 text-sm text-white w-full placeholder:text-slate-600"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                        />
                    </div>

                    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.map(u => {
                                        const banInfo = getBanInfo(u);
                                        return (
                                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                                        {u.name.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white">{u.name}</div>
                                                        <div className="text-xs text-slate-500 font-mono cursor-pointer hover:text-blue-400" onClick={() => copyToClipboard(u.id)} title="Click to Copy ID">
                                                            {u.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${u.role === 'admin' || u.role === 'dev' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
                                                    {u.role || 'USER'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {banInfo ? (
                                                    <div className="flex flex-col">
                                                        <span className="text-red-400 text-xs font-bold flex items-center gap-1">
                                                            <UserX size={12}/> BANNED
                                                        </span>
                                                        <span className="text-[10px] text-slate-500">{banInfo.timeLeft}m remaining</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                                                        <UserCheck size={12}/> ACTIVE
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {banInfo ? (
                                                    <button onClick={() => handleUnban(u.id)} className="text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded hover:bg-emerald-500/20 transition-colors border border-emerald-500/30">
                                                        Unban
                                                    </button>
                                                ) : (
                                                    <button onClick={() => handleBan(u.id)} className="text-xs bg-red-500/10 text-red-400 px-3 py-1.5 rounded hover:bg-red-500/20 transition-colors border border-red-500/30">
                                                        Ban User
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>

      </div>

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
             <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden ring-1 ring-white/10">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Session Inspector
                            <span className="text-xs font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{selectedSession.id}</span>
                        </h2>
                        <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                            <span>{new Date(selectedSession.startTime).toLocaleString()}</span>
                            <span>•</span>
                            <span className="text-white bg-blue-600/20 px-1.5 rounded text-[10px]">{selectedSession.type}</span>
                        </div>
                    </div>
                    <button onClick={() => setSelectedSession(null)} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-gradient-to-b from-slate-900 to-slate-950">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-950/80 p-5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                             <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Outcome</div>
                             <StatusBadge status={selectedSession.outcome} large />
                         </div>
                         <div className="bg-slate-950/80 p-5 rounded-xl border border-white/5 flex flex-col items-center justify-center text-center">
                             <div className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-widest">Duration</div>
                             <div className="text-3xl font-black text-white">
                                {selectedSession.actualDuration}<span className="text-base font-normal text-slate-600">m</span>
                             </div>
                             <div className="text-xs text-slate-600 mt-1">Target: {selectedSession.duration}m</div>
                         </div>
                    </div>

                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                <FileText size={18} className="text-blue-400"/>
                                Chat Transcripts
                            </h3>
                            {sessionChats.length > 0 && (
                                <Button onClick={downloadChatLog} variant="secondary" className="py-1.5 px-3 text-xs border-slate-700 bg-slate-800 hover:bg-slate-700">
                                    <Download size={14} className="mr-2"/> Export Log
                                </Button>
                            )}
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto shadow-inner">
                            {sessionChats.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-700 gap-2 opacity-50">
                                    <FileText size={32} />
                                    <span className="text-sm">No chat activity recorded.</span>
                                </div>
                            ) : (
                                <div className="space-y-4 font-mono text-sm">
                                    {sessionChats.map(msg => (
                                        <div key={msg.id} className="flex gap-4 group hover:bg-white/5 p-2 rounded transition-colors -mx-2">
                                            <span className="text-slate-600 text-xs w-16 text-right flex-shrink-0 pt-0.5">
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <div className="flex-1">
                                                <div className={`font-bold text-xs mb-0.5 ${msg.senderName === selectedSession.user1?.name ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                    {msg.senderName}
                                                </div>
                                                <div className="text-slate-300 leading-relaxed">{msg.text}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};

// --- Sub-components for cleaner code ---

const StatsCard = ({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: 'blue' | 'emerald' | 'purple' }) => {
    const colors = {
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return (
        <div className={`p-4 rounded-xl border flex items-center gap-4 ${colors[color]}`}>
            <div className={`p-3 rounded-lg bg-black/20`}>{icon}</div>
            <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
            </div>
        </div>
    );
};

const TabButton = ({ isActive, onClick, icon, label, count, alert }: any) => (
    <button 
        onClick={onClick}
        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 relative ${
            isActive 
            ? 'bg-slate-800 text-white shadow-lg shadow-black/20' 
            : 'text-slate-400 hover:text-white hover:bg-white/5'
        }`}
    >
        {icon} 
        {label}
        {count !== undefined && (
            <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${alert ? 'bg-red-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                {count}
            </span>
        )}
    </button>
);

const StatusBadge = ({ status, large }: { status: string, large?: boolean }) => {
    const isCompleted = status === 'COMPLETED';
    return (
        <span className={`inline-flex items-center gap-1.5 rounded-full font-bold border ${large ? 'px-4 py-2 text-sm' : 'px-2.5 py-1 text-[10px]'} ${
            isCompleted 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-red-500/10 text-red-400 border-red-500/20'
        }`}>
            {isCompleted ? <CheckCircle size={large ? 18 : 12}/> : <XCircle size={large ? 18 : 12}/>}
            {isCompleted ? 'COMPLETED' : 'ABORTED'}
        </span>
    );
};
