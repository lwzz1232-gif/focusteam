import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, query, orderBy, getDocs, updateDoc, doc, limit, where, startAfter, DocumentData, QueryDocumentSnapshot, writeBatch } from 'firebase/firestore';
import { Report, SessionLog, ChatMessage, User, BanHistoryLog } from '../types';
import { Button } from '../components/Button';
import { Shield, AlertTriangle, UserX, UserCheck, History, XCircle, CheckCircle, ArrowLeft, X, FileText, Download, Users, Radio, Activity, Zap, Search, ChevronDown, ArrowRight } from 'lucide-react';
interface AdminProps {
  onBack: () => void;
}

export const Admin: React.FC<AdminProps> = ({ onBack }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [sessions, setSessions] = useState<SessionLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'sessions' | 'users'>('reports');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Pagination State
  const [lastUserDoc, setLastUserDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [lastSessionDoc, setLastSessionDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Live Stats State
  const [stats, setStats] = useState({ activeUsers: 0, activeSessions: 0, serverLoad: '0%', totalHoursFocused: 0 });
  
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
    try {
        if (activeTab === 'users') {
            const q = query(collection(db, 'users'), limit(10));
            const snap = await getDocs(q);
            setLastUserDoc(snap.docs[snap.docs.length - 1]);
            setUsers(snap.docs.map(d => ({ ...d.data(), id: d.id } as User)));
        } 
        else if (activeTab === 'sessions') {
            const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(10));
            const snap = await getDocs(q);
            setLastSessionDoc(snap.docs[snap.docs.length - 1]);
            setSessions(mapSessions(snap));
        }
        else if (activeTab === 'reports') {
            const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc')));
            const reportsData = reportsSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: d.data().timestamp?.toMillis() || Date.now() } as Report));
            setReports(reportsData);
        }

        // Stats (Lightweight fetch)
        // Note: For production, create a dedicated 'stats' document that increments via Cloud Functions
        const activeSessSnap = await getDocs(query(collection(db, 'sessions'), where('status', '==', 'active')));
        const userCountSnap = await getDocs(collection(db, 'users')); // Potentially heavy, removed in prod
        
        setStats({
            activeUsers: userCountSnap.size,
            activeSessions: activeSessSnap.size,
            serverLoad: 'Firebase',
            totalHoursFocused: 0 // Would calculate from total aggregation
        });

    } catch (e) { console.error("Admin Fetch Error:", e); }
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
      // Try by ID first
      try {
        const docRef = doc(db, 'users', searchQuery);
        const docSnap = await getDocs(query(collection(db, 'users'), where('email', '==', searchQuery)));
        
        // Combine results (ID check + Email check)
        // Firestore doesn't support OR queries easily here, so we do two checks or just Email
        // Let's do Email Query primarily
        const results: User[] = [];
        docSnap.forEach(d => results.push({ ...d.data(), id: d.id } as User));
        
        // Also check if ID exists directly
        // const idSnap = await getDoc(doc(db, 'users', searchQuery)); ... (Simplified for this MVP to just email)
        
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
  const reason = prompt("Ban reason (optional):", "Admin action");
  if (confirm(`Ban user ${userId} for 24 hours?`)) {
    try {
      const until = Date.now() + 24 * 60 * 60 * 1000;
      await updateDoc(doc(db, 'users', userId), {
          bannedUntil: until,
          banReason: reason || "Admin action"
      });
      alert("User banned successfully!");
      setRefreshTrigger(prev => prev + 1);
    } catch(e: any) { 
      console.error(e); 
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
          alert("User unbanned successfully!");
          setRefreshTrigger(prev => prev + 1);
      } catch(e: any) { 
          console.error(e); 
          alert("Failed to unban: " + e.message); 
      }
  }
}

  const handleBroadcast = async () => {
    if (!broadcastMsg.trim()) return;
    
    try {
      // Get all users
      const usersSnap = await getDocs(collection(db, 'users'));
      
      // Create notification for each user
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
      alert(`✅ Broadcast sent to ${usersSnap.size} users!`);
      setBroadcastMsg('');
      
    } catch(e: any) {
      console.error(e);
      alert("Failed to broadcast: " + e.message);
    }
};

  const getBanInfo = (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user || !user.bannedUntil || user.bannedUntil < Date.now()) return null;
    return {
        endTime: user.bannedUntil,
        reason: "Admin Action",
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

  const closeSessionDetails = () => {
      setSelectedSession(null);
      setSessionChats([]);
  };

  const downloadChatLog = () => {
    if (!selectedSession) return;
    const lines = sessionChats.map(c => `[${new Date(c.timestamp).toLocaleString()}] ${c.senderName}: ${c.text}`);
    const content = `Session ID: ${selectedSession.id}\nParticipants: ${selectedSession.user1.name} & ${selectedSession.user2.name}\nDate: ${new Date(selectedSession.startTime).toLocaleString()}\n\n--- CHAT LOG ---\n${lines.join('\n')}`;
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

  return (
    <div className="flex-1 p-8 max-w-7xl mx-auto w-full overflow-y-auto">
      
      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onBack} className="mr-2">
                <ArrowLeft size={20} />
            </Button>
            <Shield className="text-blue-500" size={32} />
            <div>
                <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                <p className="text-slate-500 text-sm">System Operations Center</p>
            </div>
        </div>
      </div>

      {/* Live Operations Center (Stats) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-500/20 text-blue-400">
                  <Users size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-white">{stats.activeUsers}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Registered Users</div>
              </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/20 text-emerald-400">
                  <Zap size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-white">{stats.activeSessions}</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Active Sessions</div>
              </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-500/20 text-purple-400">
                  <Activity size={24} />
              </div>
              <div>
                  <div className="text-2xl font-bold text-white">{stats.totalHoursFocused}h</div>
                  <div className="text-xs text-slate-500 uppercase tracking-wide">Total Focused Time</div>
              </div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col justify-center gap-2">
             <div className="flex gap-2">
                <input 
                    type="text" 
                    placeholder="Broadcast alert..." 
                    className="bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs w-full text-white focus:outline-none focus:border-blue-500"
                    value={broadcastMsg}
                    onChange={(e) => setBroadcastMsg(e.target.value)}
                />
                <button onClick={handleBroadcast} className="bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1 text-xs">
                    <Radio size={14} />
                </button>
             </div>
             <span className="text-[10px] text-slate-500">Send global notification to all users.</span>
          </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-slate-900 p-1 rounded-lg border border-slate-800 w-fit mb-6">
            <button 
                onClick={() => setActiveTab('reports')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'reports' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
                <span className="flex items-center gap-2"><AlertTriangle size={16}/> Reports</span>
            </button>
            <button 
                onClick={() => setActiveTab('sessions')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'sessions' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
                <span className="flex items-center gap-2"><History size={16}/> History</span>
            </button>
            <button 
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'users' ? 'bg-slate-800 text-white shadow' : 'text-slate-400 hover:text-white'}`}
            >
                <span className="flex items-center gap-2"><Users size={16}/> Users</span>
            </button>
      </div>

      {activeTab === 'reports' && (
        <div className="grid gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200">Recent Reports</h3>
              <span className="text-xs text-slate-500">{reports.length} total</span>
            </div>
            
            {reports.length === 0 ? (
              <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                <Shield size={48} className="mb-4 opacity-20" />
                No reports found. System is clean.
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {reports.map((report) => (
                    <div key={report.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between hover:bg-slate-800/30 gap-6 transition-colors">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="bg-red-500/10 text-red-400 px-2 py-1 rounded text-xs font-bold border border-red-500/20 uppercase tracking-wider">
                            {report.reason}
                          </span>
                          <span className="text-xs text-slate-500">
                             {new Date(report.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-sm bg-slate-950/50 p-3 rounded-lg border border-slate-800 w-fit">
                             <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Reporter</span>
                                <span className="font-mono text-slate-300">{report.reporterId}</span>
                             </div>
                             <ArrowRight size={14} className="text-slate-600" />
                             <div className="flex flex-col">
                                <span className="text-[10px] text-slate-500 uppercase tracking-wide">Reported User</span>
                                <span className="font-mono text-white font-bold">{report.reportedId}</span>
                             </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                            <Button 
                                variant="secondary" 
                                onClick={() => handleBan(report.reportedId)}
                                className="text-xs hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/50"
                            >
                                <UserX size={14} className="mr-2" />
                                Ban 24h
                            </Button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sessions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
             <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <h3 className="font-semibold text-slate-200">Session History</h3>
            </div>
            {sessions.length === 0 ? (
                 <div className="p-12 text-center text-slate-500 flex flex-col items-center">
                    <History size={48} className="mb-4 opacity-20" />
                    No sessions recorded yet.
                 </div>
            ) : (
                <>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                            <tr>
                                <th className="px-6 py-4">ID</th>
                                <th className="px-6 py-4">Participants</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Time</th>
                                <th className="px-6 py-4">Duration</th>
                                <th className="px-6 py-4">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                            {sessions.map(s => {
                                const isEarlyExit = s.outcome === 'ABORTED';
                                return (
                                <tr 
                                    key={s.id} 
                                    onClick={() => openSessionDetails(s)}
                                    className={`hover:bg-slate-800/30 transition-colors cursor-pointer ${isEarlyExit ? 'bg-red-500/5' : ''}`}
                                >
                                    <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.id.substring(0,8)}...</td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1.5">
                                            <span className="text-slate-300">{s.user1?.name || 'Unknown'}</span>
                                            <span className="text-slate-300">{s.user2?.name || 'Unknown'}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-block px-2 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 text-xs">
                                            {s.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">{new Date(s.startTime).toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <span className={`font-mono font-bold ${isEarlyExit ? 'text-red-400' : 'text-emerald-400'}`}>
                                                {s.actualDuration}m
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {s.outcome === 'COMPLETED' ? (
                                            <span className="flex items-center text-emerald-400 gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full w-fit border border-emerald-500/20 text-xs font-medium">
                                                <CheckCircle size={12}/> Completed
                                            </span>
                                        ) : (
                                            <span className="flex items-center text-red-400 gap-1.5 bg-red-500/10 px-2.5 py-1 rounded-full w-fit border border-red-500/20 text-xs font-medium">
                                                <XCircle size={12}/> Aborted
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            )})}
                        </tbody>
                    </table>
                </div>
                {lastSessionDoc && (
                    <div className="p-4 border-t border-slate-800 text-center">
                        <Button variant="ghost" onClick={handleLoadMoreSessions} disabled={loadingMore} className="text-xs">
                            {loadingMore ? 'Loading...' : 'Load More Sessions'} <ChevronDown size={14} className="ml-1"/>
                        </Button>
                    </div>
                )}
                </>
            )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
             <div className="p-4 border-b border-slate-800 bg-slate-950/30 flex justify-between items-center">
              <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-slate-200">User Directory</h3>
                  <div className="relative">
                      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input 
                        type="text" 
                        placeholder="Search Email..." 
                        className="bg-slate-950 border border-slate-700 rounded-full py-1.5 pl-8 pr-4 text-xs text-white focus:outline-none focus:border-blue-500 w-64 transition-all"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchUser()}
                      />
                  </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-400 uppercase bg-slate-950/50 border-b border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Email</th>
                            <th className="px-6 py-4">Role</th>
                            <th className="px-6 py-4">Status</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {users.map(u => {
                            const banInfo = getBanInfo(u.id);
                            return (
                            <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                <td className="px-6 py-4 font-medium text-white">{u.name}</td>
                                <td className="px-6 py-4 text-slate-400">{u.email}</td>
                                <td className="px-6 py-4">
                                    <span className={`text-xs px-2 py-1 rounded border ${u.role === 'admin' || u.role === 'dev' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' : 'bg-slate-800 border-slate-700 text-slate-400'}`}>
                                        {u.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {banInfo ? (
                                            <span className="text-red-400 text-xs font-bold px-2 py-1 bg-red-500/10 rounded border border-red-500/20">
                                                BANNED
                                            </span>
                                    ) : (
                                        <span className="text-emerald-500 text-xs px-2 py-1 bg-emerald-500/10 rounded border border-emerald-500/20">
                                            Active
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex justify-end items-center gap-3">
                                        {banInfo ? (
                                            <button 
                                                onClick={() => handleUnban(u.id)}
                                                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
                                            >
                                                Unban
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => handleBan(u.id)}
                                                className="text-xs text-red-400 hover:text-red-300 underline"
                                            >
                                                Ban
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        )})}
                    </tbody>
                </table>
            </div>
            {!isSearching && lastUserDoc && (
                <div className="p-4 border-t border-slate-800 text-center">
                    <Button variant="ghost" onClick={handleLoadMoreUsers} disabled={loadingMore} className="text-xs">
                        {loadingMore ? 'Loading...' : 'Load More Users'} <ChevronDown size={14} className="ml-1"/>
                    </Button>
                </div>
            )}
        </div>
      )}

      {/* Session Detail Modal */}
      {selectedSession && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
             <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl h-[80vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-950">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            Session Details
                            <span className="text-sm font-mono text-slate-500 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">{selectedSession.id.substring(0,8)}</span>
                        </h2>
                        <div className="text-xs text-slate-400 mt-1">
                            {new Date(selectedSession.startTime).toLocaleString()} • {selectedSession.type}
                        </div>
                    </div>
                    <button onClick={closeSessionDetails} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                         <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Outcome</h4>
                             <div className={`text-lg font-bold ${selectedSession.outcome === 'COMPLETED' ? 'text-emerald-400' : 'text-red-400'}`}>
                                {selectedSession.outcome}
                             </div>
                         </div>
                         <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                             <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Duration</h4>
                             <div className="text-lg font-bold text-white">
                                {selectedSession.actualDuration}m <span className="text-slate-500 text-sm font-normal">/ {selectedSession.duration}m planned</span>
                             </div>
                         </div>
                    </div>

                    {/* Chat Log */}
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                <FileText size={18} className="text-blue-400"/>
                                Chat Log
                            </h3>
                            {sessionChats.length > 0 && (
                                <Button onClick={downloadChatLog} variant="secondary" className="py-1 px-3 text-xs">
                                    <Download size={14} className="mr-2"/> Download .txt
                                </Button>
                            )}
                        </div>

                        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[150px] max-h-[300px] overflow-y-auto">
                            {sessionChats.length === 0 ? (
                                <div className="text-center text-slate-600 italic py-8">No messages recorded in this session.</div>
                            ) : (
                                <div className="space-y-3 font-mono text-sm">
                                    {sessionChats.map(msg => (
                                        <div key={msg.id} className="flex gap-3">
                                            <span className="text-slate-600 w-16 text-right flex-shrink-0">
                                                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                            </span>
                                            <div>
                                                <span className={`font-bold mr-2 ${msg.senderName === selectedSession.user1?.name ? 'text-blue-400' : 'text-emerald-400'}`}>
                                                    {msg.senderName}:
                                                </span>
                                                <span className="text-slate-300">{msg.text}</span>
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
