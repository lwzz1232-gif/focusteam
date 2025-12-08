import React, { useState, useEffect } from 'react';
import { db } from '../utils/firebaseConfig';
import { collection, query, orderBy, getDocs, updateDoc, doc, limit, where, startAfter, DocumentData, QueryDocumentSnapshot, writeBatch, deleteDoc, addDoc, getDoc } from 'firebase/firestore';
import { Report, SessionLog, ChatMessage, User } from '../types';
import { Button } from '../components/Button';
import { Shield, AlertTriangle, UserX, UserCheck, History, XCircle, CheckCircle, ArrowLeft, X, FileText, Download, Users, Radio, Activity, Zap, Search, ChevronDown, ArrowRight, RefreshCw, Copy, Trash2, Server, MessageSquarePlus, Send, AlertOctagon, Eye, EyeOff } from 'lucide-react';

interface AdminProps {
    onBack: () => void;
}

export const Admin: React.FC<AdminProps> = ({ onBack }) => {
    // Data State
    const [reports, setReports] = useState<any[]>([]); 
    const [sessions, setSessions] = useState<SessionLog[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState({ activeUsers: 0, activeSessions: 0, totalHoursFocused: 0 });

    // UI State
    const [activeTab, setActiveTab] = useState<'reports' | 'sessions' | 'users'>('reports');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // NEW: Ban Duration State
    const [banDuration, setBanDuration] = useState(24);

    // NEW: User History State (for the modal)
    const [historyReports, setHistoryReports] = useState<any[]>([]);

    // Pagination
    const [lastUserDoc, setLastUserDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [lastSessionDoc, setLastSessionDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        type: 'BROADCAST' | 'DM' | 'BAN' | 'SESSION_DETAIL' | 'USER_HISTORY';
        data?: any;
        title?: string;
        message?: string;
    }>({ isOpen: false, type: 'BROADCAST' });

    // Input State for Modals
    const [inputText, setInputText] = useState('');
    const [sessionChats, setSessionChats] = useState<ChatMessage[]>([]);

    // --- FETCHING LOGIC ---
    useEffect(() => {
        fetchInitialData();
    }, [activeTab]);

    const fetchInitialData = async () => {
        setIsRefreshing(true);
        try {
            if (activeTab === 'users') {
                const q = query(collection(db, 'users'), limit(20));
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
                // Fetch reports
                const reportsSnap = await getDocs(query(collection(db, 'reports'), orderBy('timestamp', 'desc')));
                
                // Fetch User Details for Reports
                const reportsWithUsers = await Promise.all(reportsSnap.docs.map(async (d) => {
                    const data = d.data();
                    let userData = null;
                    try {
                        const userSnap = await getDoc(doc(db, 'users', data.reportedId));
                        if (userSnap.exists()) {
                            userData = { ...userSnap.data(), id: userSnap.id };
                        }
                    } catch (err) { console.error("Error fetching reported user", err); }
        
                    return { 
                        ...data, 
                        id: d.id, 
                        timestamp: data.timestamp?.toMillis() || Date.now(),
                        reportedUserObj: userData
                    }; 
                }));
                setReports(reportsWithUsers);
            }

            // Stats
            const activeSessSnap = await getDocs(query(collection(db, 'sessions'), where('status', '==', 'active')));
            const userCountSnap = await getDocs(collection(db, 'users')); 
            setStats({ activeUsers: userCountSnap.size, activeSessions: activeSessSnap.size, totalHoursFocused: 0 });

        } catch (e) { console.error("Admin Fetch Error:", e); }
        setIsRefreshing(false);
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

    // --- ACTIONS ---
    const openBroadcastModal = () => {
        setInputText('');
        setModal({ isOpen: true, type: 'BROADCAST', title: 'System Broadcast', message: `Send alert to ${stats.activeUsers} users?` });
    };
    
    const openDMModal = (user: User) => {
        setInputText('');
        setModal({ isOpen: true, type: 'DM', data: user, title: 'Direct Message', message: `Send private message to ${user.name}` });
    };

    const openBanModal = (userId: string) => {
        setInputText('');
        setBanDuration(24); 
        setModal({ isOpen: true, type: 'BAN', data: userId, title: 'Ban User', message: 'Select duration and enter reason:' });
    };

    const openSessionModal = async (session: SessionLog) => {
        setModal({ isOpen: true, type: 'SESSION_DETAIL', data: session });
        const chatsSnap = await getDocs(query(collection(db, 'sessions', session.id, 'messages'), orderBy('timestamp', 'asc')));
        setSessionChats(chatsSnap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: d.data().timestamp?.toMillis() } as ChatMessage)));
    };

    // NEW: Open User History Modal
    const openUserHistoryModal = async (user: any, userId: string) => {
        setHistoryReports([]); // Clear previous
        setModal({ isOpen: true, type: 'USER_HISTORY', data: { user, id: userId }, title: 'User Report History' });
        
        try {
            // Fetch all reports for this specific user
            const q = query(collection(db, 'reports'), where('reportedId', '==', userId), orderBy('timestamp', 'desc'));
            const snap = await getDocs(q);
            setHistoryReports(snap.docs.map(d => ({ ...d.data(), id: d.id, timestamp: d.data().timestamp?.toMillis() || Date.now() })));
        } catch (e) { console.error(e); }
    };

    // 2. EXECUTE ACTIONS
    const executeAction = async () => {
        if (!inputText.trim() && modal.type !== 'SESSION_DETAIL' && modal.type !== 'USER_HISTORY') return;

        try {
            if (modal.type === 'BROADCAST') {
                const usersSnap = await getDocs(collection(db, 'users'));
                const batch = writeBatch(db);
                usersSnap.forEach(userDoc => {
                    const notifRef = doc(collection(db, 'users', userDoc.id, 'notifications'));
                    batch.set(notifRef, { text: inputText, timestamp: Date.now(), read: false, type: 'system' });
                });
                await batch.commit();
            }
            
            if (modal.type === 'DM') {
                const user = modal.data as User;
                await addDoc(collection(db, 'users', user.id, 'notifications'), {
                    text: `Admin Message: ${inputText}`,
                    timestamp: Date.now(),
                    read: false,
                    type: 'system'
                });
            }

            if (modal.type === 'BAN') {
                const userId = modal.data as string;
                const until = Date.now() + banDuration * 60 * 60 * 1000;
                await updateDoc(doc(db, 'users', userId), { bannedUntil: until, banReason: inputText });
                setUsers(prev => prev.map(u => u.id === userId ? { ...u, bannedUntil: until, banReason: inputText } : u));
            }

            closeModal();
            fetchInitialData();

        } catch (e: any) {
            alert(`Action Failed: ${e.message}`);
        }
    };

    const handleUnban = async (userId: string) => {
        try {
            await updateDoc(doc(db, 'users', userId), { bannedUntil: null, banReason: null });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, bannedUntil: undefined } : u));
        } catch (e) { console.error(e); }
    };

    // FIXED: Better Delete Handling
    const handleDismissReport = async (reportId: string, e?: React.MouseEvent) => {
        e?.stopPropagation(); // Prevent click from bubbling to other elements
        
        if (!window.confirm("Are you sure you want to delete this report?")) return;

        // Optimistic update: Remove from UI immediately so it feels "working"
        setReports(prev => prev.filter(r => r.id !== reportId));

        try {
            await deleteDoc(doc(db, 'reports', reportId));
        } catch (e) { 
            console.error("Delete failed:", e);
            fetchInitialData(); // If it fails, reload data to show it again
        }
    };

    // NEW: Mark Report as Read/Seen
    const handleMarkAsRead = async (reportId: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
        // Optimistic UI update
        setReports(prev => prev.map(r => r.id === reportId ? { ...r, read: true } : r));
        try {
            await updateDoc(doc(db, 'reports', reportId), { read: true });
        } catch (e) { console.error(e); }
    };

    const closeModal = () => {
        setModal({ isOpen: false, type: 'BROADCAST' });
        setSessionChats([]);
        setHistoryReports([]);
    };

    // --- HELPERS ---
    const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
    
    const getBanInfo = (user: User) => {
        if (!user.bannedUntil || user.bannedUntil < Date.now()) return null;
        return { timeLeft: Math.ceil((user.bannedUntil - Date.now()) / 1000 / 60) };
    };

    const downloadChatLog = () => {
        if (!modal.data) return;
        const session = modal.data as SessionLog;
        const lines = sessionChats.map(c => `[${new Date(c.timestamp).toLocaleString()}] ${c.senderName}: ${c.text}`);
        const content = `Session ID: ${session.id}\nParticipants: ${session.user1?.name} & ${session.user2?.name}\n\n${lines.join('\n')}`;
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat_log_${session.id}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    };

    // --- RENDER ---
    return (
        <div className="flex-1 h-screen overflow-hidden flex flex-col bg-slate-950 relative font-inter">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-blue-900/10 to-transparent pointer-events-none"></div>

            {/* Header */}
            <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-slate-950/80 backdrop-blur-md z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" onClick={onBack} className="text-slate-400 hover:text-white hover:bg-white/5">
                        <ArrowLeft size={20} />
                    </Button>
                    <div>
                        <h1 className="text-xl font-bold flex items-center gap-2 text-white">
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
                    <Button variant="ghost" onClick={fetchInitialData} className={`text-slate-400 hover:text-white ${isRefreshing ? 'animate-spin' : ''}`}>
                        <RefreshCw size={18} />
                    </Button>
                    <div className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <Server size={14} className="text-slate-500"/>
                        <span className="text-xs font-mono text-slate-300">System</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 max-w-7xl mx-auto w-full">
                
                {/* Quick Stats & Action Bar */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <StatsCard icon={<Users size={20} />} label="Total Users" value={stats.activeUsers.toString()} color="blue" />
                    <StatsCard icon={<Zap size={20} />} label="Live Sessions" value={stats.activeSessions.toString()} color="emerald" />
                    
                    {/* Quick Broadcast Button */}
                    <div className="md:col-span-2 bg-gradient-to-r from-blue-900/20 to-purple-900/20 border border-white/10 p-1 rounded-xl flex items-center shadow-lg">
                        <button 
                            onClick={openBroadcastModal}
                            className="w-full h-full flex items-center justify-center gap-3 text-sm font-medium text-blue-100 hover:bg-white/5 rounded-lg transition-all py-3"
                        >
                            <Radio size={18} className="text-blue-400" />
                            Send System Broadcast
                        </button>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-white/5 w-fit mb-6 shadow-xl sticky top-0 z-20 backdrop-blur">
                    {/* NEW: Badge count only shows unread reports */}
                    <TabButton active={activeTab === 'reports'} onClick={() => setActiveTab('reports')} icon={<AlertTriangle size={16}/>} label="Reports" count={reports.filter(r => !r.read).length} alert={reports.some(r => !r.read)} />
                    <TabButton active={activeTab === 'sessions'} onClick={() => setActiveTab('sessions')} icon={<History size={16}/>} label="History" />
                    <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<Users size={16}/>} label="Userbase" />
                </div>

                {/* --- REPORTS TAB --- */}
                {activeTab === 'reports' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-2">
                        {reports.length === 0 && (
                            <EmptyState icon={<Shield size={48}/>} message="System Clean. No active reports." />
                        )}
                        {reports.map((report) => (
                            <div 
                                key={report.id} 
                                className={`bg-slate-900/80 border rounded-xl p-5 shadow-lg relative overflow-hidden group transition-all duration-300 ${!report.read ? 'border-blue-500/50 shadow-blue-500/10' : 'border-white/5 opacity-80 hover:opacity-100'}`}
                            >
                                {/* NEW: Visual indicator for Unread */}
                                { !report.read && (
                                    <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-bold px-2 py-1 rounded-bl-lg z-10 animate-pulse">
                                        NEW
                                    </div>
                                )}
                                <div className={`absolute top-0 left-0 w-1 h-full ${!report.read ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                                
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-red-400 font-bold uppercase text-[10px] tracking-wider border border-red-500/30 px-2 py-0.5 rounded bg-red-500/10">{report.reason}</span>
                                            <span className="text-[10px] text-slate-500">{new Date(report.timestamp).toLocaleString()}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2">
                                            Reporter ID: <span className="font-mono text-white">{report.reporterId.substring(0,8)}...</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        {/* NEW: Mark as Read Button */}
                                        <button 
                                            onClick={(e) => handleMarkAsRead(report.id, e)} 
                                            className={`p-2 rounded-lg transition-colors ${report.read ? 'text-slate-600 hover:text-white' : 'text-blue-400 hover:bg-blue-500/20'}`}
                                            title={report.read ? "Seen" : "Mark as Seen"}
                                        >
                                            {report.read ? <EyeOff size={16}/> : <Eye size={16}/>}
                                        </button>
                                        <button 
                                            onClick={(e) => handleDismissReport(report.id, e)} 
                                            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            title="Delete Report"
                                        >
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                                
                                <div className="bg-black/30 p-3 rounded-lg border border-white/5 flex items-center justify-between">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-bold">Offender</div>
                                        {/* NEW: Click Name to Open History Modal */}
                                        <div 
                                            className="font-bold text-white text-base flex items-center gap-2 cursor-pointer hover:text-blue-400 hover:underline transition-all" 
                                            onClick={() => openUserHistoryModal(report.reportedUserObj, report.reportedId)}
                                            title="View User History & Actions"
                                        >
                                            {report.reportedUserObj ? report.reportedUserObj.name : report.reportedId.substring(0,12)} 
                                            <History size={14} className="opacity-70" />
                                        </div>
                                        <div className="text-[10px] font-mono text-slate-600">
                                            {report.reportedId}
                                        </div>
                                    </div>
                                    <Button variant="danger" onClick={() => openBanModal(report.reportedId)} className="text-xs py-1.5 h-auto">
                                        <UserX size={14} className="mr-2" /> Ban
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* --- USERS TAB --- */}
                {activeTab === 'users' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="bg-slate-900/50 border border-white/10 p-2 rounded-xl flex items-center gap-2 max-w-md">
                            <Search size={16} className="ml-2 text-slate-500" />
                            <input 
                                type="text" 
                                placeholder="Search users..." 
                                className="bg-transparent border-none focus:ring-0 text-sm text-white w-full placeholder:text-slate-600"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-white/5">
                                    <tr>
                                        <th className="px-6 py-4">User</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {users.filter(u => u.name.toLowerCase().includes(searchQuery.toLowerCase())).map(u => {
                                        const banInfo = getBanInfo(u);
                                        return (
                                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                                                        {u.name.substring(0,2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-white flex items-center gap-2">
                                                            {u.name}
                                                            {(u.role === 'admin' || u.role === 'dev') && <span className="text-[9px] bg-amber-500/20 text-amber-400 px-1.5 rounded border border-amber-500/30">ADMIN</span>}
                                                        </div>
                                                        <div className="text-xs text-slate-500 font-mono cursor-pointer hover:text-blue-400" onClick={() => copyToClipboard(u.id)}>
                                                            {u.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {banInfo ? (
                                                    <span className="text-red-400 text-xs font-bold flex items-center gap-1 bg-red-500/10 px-2 py-1 rounded w-fit"><UserX size={12}/> BANNED ({banInfo.timeLeft}m)</span>
                                                ) : (
                                                    <span className="text-emerald-500 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2 py-1 rounded w-fit"><UserCheck size={12}/> ACTIVE</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end items-center gap-2">
                                                    <button onClick={() => openDMModal(u)} className="p-2 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/20" title="Message User">
                                                        <MessageSquarePlus size={16} />
                                                    </button>
                                                    {banInfo ? (
                                                        <button onClick={() => handleUnban(u.id)} className="p-2 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-transparent hover:border-emerald-500/20" title="Unban">
                                                            <UserCheck size={16} />
                                                        </button>
                                                    ) : (
                                                        <button onClick={() => openBanModal(u.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/20" title="Ban">
                                                            <UserX size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )})}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* --- SESSIONS TAB --- */}
                {activeTab === 'sessions' && (
                    <div className="bg-slate-900/50 border border-white/10 rounded-xl overflow-hidden shadow-xl animate-in fade-in slide-in-from-bottom-2">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-slate-500 uppercase bg-slate-950 border-b border-white/5">
                                <tr>
                                    <th className="px-6 py-4">ID</th>
                                    <th className="px-6 py-4">Duration</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {sessions.map(s => (
                                    <tr key={s.id} onClick={() => openSessionModal(s)} className="hover:bg-white/5 cursor-pointer">
                                        <td className="px-6 py-4 font-mono text-slate-500 text-xs">{s.id.substring(0,8)}...</td>
                                        <td className="px-6 py-4 font-bold text-white">{s.actualDuration}m <span className="text-slate-600 font-normal">/ {s.duration}m</span></td>
                                        <td className="px-6 py-4">
                                            <span className={`text-[10px] px-2 py-1 rounded-full ${s.outcome === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{s.outcome}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-500 text-xs">{new Date(s.startTime).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* --- UNIFIED GLASS MODAL --- */}
            {modal.isOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden ring-1 ring-white/10 flex flex-col max-h-[85vh]">
                        
                        {/* Modal Header */}
                        <div className="p-6 border-b border-slate-800 bg-slate-950 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                {modal.type === 'BROADCAST' && <Radio className="text-blue-400" size={20}/>}
                                {modal.type === 'DM' && <MessageSquarePlus className="text-purple-400" size={20}/>}
                                {modal.type === 'BAN' && <AlertOctagon className="text-red-400" size={20}/>}
                                {modal.type === 'SESSION_DETAIL' && <FileText className="text-emerald-400" size={20}/>}
                                {modal.type === 'USER_HISTORY' && <History className="text-orange-400" size={20}/>}
                                {modal.type === 'SESSION_DETAIL' ? 'Session Inspector' : modal.title}
                            </h2>
                            <button onClick={closeModal} className="text-slate-500 hover:text-white transition-colors"><X size={20}/></button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 overflow-y-auto flex-1">
                            {modal.type === 'SESSION_DETAIL' ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center">
                                            <div className="text-xs text-slate-500 uppercase">Duration</div>
                                            <div className="text-2xl font-bold text-white">{(modal.data as SessionLog).actualDuration}m</div>
                                        </div>
                                        <div className="bg-slate-950 p-4 rounded-xl border border-white/5 text-center">
                                            <div className="text-xs text-slate-500 uppercase">Status</div>
                                            <div className="text-xl font-bold text-emerald-400">{(modal.data as SessionLog).outcome}</div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
                                        {sessionChats.length === 0 ? <p className="text-center text-slate-600 italic">No chats.</p> : (
                                            <div className="space-y-3 font-mono text-sm">
                                                {sessionChats.map(m => (
                                                    <div key={m.id} className="text-slate-300">
                                                        <span className="text-blue-400 font-bold">{m.senderName}:</span> {m.text}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <Button onClick={downloadChatLog} variant="secondary" className="w-full text-xs"><Download size={14} className="mr-2"/> Download Log</Button>
                                </div>
                            ) : modal.type === 'USER_HISTORY' ? (
                                // NEW: USER HISTORY VIEW
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg border border-white/5">
                                        <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center font-bold text-white">
                                            {modal.data.user?.name.substring(0,2).toUpperCase() || "??"}
                                        </div>
                                        <div>
                                            <div className="text-white font-bold">{modal.data.user?.name || "Unknown User"}</div>
                                            <div className="text-xs text-slate-500 font-mono">{modal.data.id}</div>
                                        </div>
                                        <div className="ml-auto flex gap-2">
                                            <button onClick={() => openDMModal(modal.data.user)} className="p-2 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30"><MessageSquarePlus size={16}/></button>
                                            <button onClick={() => openBanModal(modal.data.id)} className="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"><UserX size={16}/></button>
                                        </div>
                                    </div>

                                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">Report History ({historyReports.length})</div>
                                    
                                    <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                        {historyReports.length === 0 ? (
                                            <div className="text-center py-8 text-slate-500 border border-dashed border-slate-700 rounded-lg">No history found.</div>
                                        ) : historyReports.map((r, i) => (
                                            <div key={i} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                                                <div>
                                                    <div className="text-red-400 font-bold text-xs mb-1">{r.reason}</div>
                                                    <div className="text-[10px] text-slate-500">{new Date(r.timestamp).toLocaleString()}</div>
                                                </div>
                                                <div className="text-[10px] text-slate-600 font-mono">
                                                    by {r.reporterId.substring(0,6)}...
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Ban Duration Selector */}
                                    {modal.type === 'BAN' && (
                                        <div className="bg-red-500/10 border border-red-500/20 p-3 rounded-lg mb-2">
                                            <label className="text-xs text-red-300 font-bold uppercase mb-1 block">Ban Duration</label>
                                            <select 
                                                value={banDuration} 
                                                onChange={(e) => setBanDuration(Number(e.target.value))}
                                                className="w-full bg-slate-900 border border-red-500/30 rounded px-2 py-2 text-white text-sm focus:outline-none"
                                            >
                                                <option value={24}>24 Hours</option>
                                                <option value={72}>3 Days</option>
                                                <option value={168}>1 Week</option>
                                                <option value={720}>1 Month</option>
                                                <option value={8760}>Permanent (1 Year)</option>
                                            </select>
                                        </div>
                                    )}

                                    <p className="text-slate-300">{modal.message}</p>
                                    <textarea 
                                        autoFocus
                                        value={inputText}
                                        onChange={(e) => setInputText(e.target.value)}
                                        placeholder={modal.type === 'BAN' ? "Reason for ban..." : "Type here..."}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:outline-none focus:border-blue-500 min-h-[100px] text-sm resize-none"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        {modal.type !== 'SESSION_DETAIL' && modal.type !== 'USER_HISTORY' && (
                            <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
                                <Button variant="ghost" onClick={closeModal} className="text-slate-400">Cancel</Button>
                                <Button 
                                    onClick={executeAction}
                                    variant={modal.type === 'BAN' ? 'danger' : 'primary'}
                                    className="px-6"
                                >
                                    {modal.type === 'BAN' ? 'Confirm Ban' : 'Send'} <Send size={14} className="ml-2"/>
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUB COMPONENTS ---
const StatsCard = ({ icon, label, value, color }: any) => {
    const colors = { blue: 'text-blue-400 bg-blue-500/10', emerald: 'text-emerald-400 bg-emerald-500/10', purple: 'text-purple-400 bg-purple-500/10' };
    return (
        <div className="p-4 rounded-xl border border-white/5 flex items-center gap-4 bg-slate-900/50 shadow-lg">
            <div className={`p-3 rounded-lg ${colors[color as keyof typeof colors]}`}>{icon}</div>
            <div>
                <div className="text-2xl font-bold text-white">{value}</div>
                <div className="text-[10px] uppercase tracking-wide opacity-60 text-slate-300">{label}</div>
            </div>
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label, count, alert }: any) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${active ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}>
        {icon} {label}
        {count !== undefined && count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] ${alert ? 'bg-blue-500 text-white animate-pulse' : 'bg-slate-700'}`}>{count}</span>}
    </button>
);

const EmptyState = ({ icon, message }: any) => (
    <div className="col-span-full py-16 text-center text-slate-500 bg-slate-900/30 border border-white/5 rounded-xl border-dashed flex flex-col items-center">
        <div className="mb-4 opacity-20">{icon}</div>
        <p>{message}</p>
    </div>
);
