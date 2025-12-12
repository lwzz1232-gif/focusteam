import React, { useState, useEffect, useCallback } from 'react';
import { User, SessionConfig, SessionType } from '../types';
import { db } from '../utils/firebaseConfig';
import { collection, query, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Play, Code, BookOpen, Briefcase, Coffee, Clock, User as UserIcon, Loader2, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface LiveRequestsProps {
  currentUser: User;
  onJoinSession: (partnerId: string, config: SessionConfig) => void;
}

// Strictly typed interface to prevent errors
interface WaitingRoomRequest {
  id: string;
  userId: string;
  userName: string;
  config: SessionConfig;
  createdAt: Timestamp;
}

export const LiveRequests: React.FC<LiveRequestsProps> = ({ currentUser, onJoinSession }) => {
  const [requests, setRequests] = useState<WaitingRoomRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Performance: Memoize the icon getter so it doesn't recalculate on every render
  const getIcon = useCallback((type: SessionType) => {
    const props = { size: 16 };
    switch (type) {
      case SessionType.CODING: return <Code {...props} className="text-blue-400"/>;
      case SessionType.WORK: return <Briefcase {...props} className="text-purple-400"/>;
      case SessionType.READING: return <Coffee {...props} className="text-orange-400"/>;
      case SessionType.STUDY:
      default: return <BookOpen {...props} className="text-emerald-400"/>;
    }
  }, []);

  // 2. Utility: Safe time formatting that won't crash if timestamp is null
  const getRelativeTime = (timestamp: Timestamp | null) => {
    if (!timestamp) return 'Just now';
    
    // Convert to milliseconds safely
    const now = Date.now();
    const then = timestamp.toMillis();
    const diffMin = Math.floor((now - then) / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    
    const diffHours = Math.floor(diffMin / 60);
    return diffHours === 1 ? '1 hr ago' : `${diffHours} hrs ago`;
  };

  // 3. Logic: Listen to Firebase + Filter "Ghosts"
  useEffect(() => {
    // Only get the last 20 requests to save bandwidth
    const q = query(
        collection(db, 'waiting_room'), 
        orderBy('createdAt', 'desc'), 
        limit(20)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const STALE_THRESHOLD = 15 * 60 * 1000; // 15 Minutes

      const activeRequests = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as WaitingRoomRequest))
        .filter(req => {
            // Filter A: Don't show myself
            if (req.userId === currentUser.id) return false;
            
            // Filter B: Don't show "ghost" requests older than 15 mins
            // This fixes the issue where people close the tab but stay in the list
            if (req.createdAt) {
                const age = now - req.createdAt.toMillis();
                if (age > STALE_THRESHOLD) return false;
            }
            
            return true;
        });
      
      setRequests(activeRequests);
      setIsLoading(false);
    });

    return () => unsub();
  }, [currentUser.id]);

  return (
    <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Live Lobby
        </h2>
        
        {/* Active Count Badge */}
        {requests.length > 0 && (
            <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={10} />
                {requests.length} Active
            </span>
        )}
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* State: Loading */}
        {isLoading && (
            <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 border border-white/5 rounded-xl border-dashed">
                <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                <p className="text-sm font-medium">Scanning for active partners...</p>
            </div>
        )}

        {/* State: Empty */}
        {!isLoading && requests.length === 0 && (
            <div className="col-span-full py-10 text-center bg-slate-900/30 border border-white/5 rounded-xl border-dashed flex flex-col items-center">
                <div className="bg-slate-800/50 p-4 rounded-full mb-3">
                    <UserIcon size={24} className="opacity-50 text-slate-400" />
                </div>
                <p className="text-base font-bold text-slate-300">The Lobby is Empty</p>
                <p className="text-sm text-slate-500 mt-1">Be the first to start a session!</p>
            </div>
        )}

        {/* State: List Requests */}
        {requests.map((req, index) => (
            <div 
                key={req.id}
                style={{ animationDelay: `${index * 50}ms` }}
                className="group bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/50 p-4 rounded-xl transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/20 flex flex-col gap-3 relative overflow-hidden animate-in slide-in-from-bottom-2 fade-in fill-mode-backwards"
            >
                {/* Hover Glow Effect */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                {/* "New" Dot if < 2 mins old */}
                {req.createdAt && (Date.now() - req.createdAt.toMillis() < 120000) && (
                    <div className="absolute top-3 right-3 flex items-center gap-1" title="Just joined">
                        <span className="relative flex h-2 w-2">
                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                           <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                        </span>
                    </div>
                )}

                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-white font-bold text-sm shadow-inner group-hover:border-blue-500/30 transition-colors">
                            {req.userName ? req.userName.substring(0,2).toUpperCase() : "??"}
                        </div>
                        
                        {/* Name & Time */}
                        <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                {req.userName}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1">
                                <Clock size={11} /> 
                                {getRelativeTime(req.createdAt)}
                            </div>
                        </div>
                    </div>

                    {/* Type Badge */}
                    <div className="bg-slate-950/50 border border-white/10 px-2 py-1 rounded flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-300">
                        {getIcon(req.config.type)}
                        {req.config.type}
                    </div>
                </div>

                {/* Footer: Details & Action */}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                       <span className="bg-white/5 px-2 py-0.5 rounded text-white font-mono border border-white/5">
                            {req.config.duration < 60 ? `${req.config.duration}m` : `${req.config.duration / 60}h`}
                       </span>
                       <span className="capitalize text-slate-500">
                            {req.config.mode.replace(/_/g, ' ').toLowerCase()}
                       </span>
                    </div>
                    
                    <Button 
                        size="sm" 
                        onClick={() => onJoinSession(req.userId, req.config)}
                        className="text-xs h-8 bg-blue-600 hover:bg-blue-500 text-white border-0 shadow-lg shadow-blue-900/20 active:scale-95 transition-transform"
                    >
                        Join <Play size={10} className="ml-1 fill-current" />
                    </Button>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
