import React, { useState, useEffect } from 'react';
import { User, SessionConfig, SessionType } from '../types';
import { db } from '../utils/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit, deleteDoc, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Play, Code, BookOpen, Briefcase, Coffee, Clock, User as UserIcon, Loader2 } from 'lucide-react';
import { Button } from './Button';

interface LiveRequestsProps {
  currentUser: User;
  onJoinSession: (partnerId: string, config: SessionConfig) => void;
}

export const LiveRequests: React.FC<LiveRequestsProps> = ({ currentUser, onJoinSession }) => {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 1. Listen to the "waiting_room" collection
  useEffect(() => {
    // Clean up old requests first (Client-side cleanup for visual clarity)
    // In a real production app, a backend function would delete old docs.
    
    const q = query(
        collection(db, 'waiting_room'), 
        orderBy('createdAt', 'desc'), 
        limit(10)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const activeRequests = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as any))
        .filter(req => req.userId !== currentUser.id); // Don't show my own request
      
      setRequests(activeRequests);
      setIsLoading(false);
    });

    return () => unsub();
  }, [currentUser.id]);

  // Helper to get Icon
  const getIcon = (type: SessionType) => {
    switch (type) {
      case 'CODING': return <Code size={16} className="text-blue-400"/>;
      case 'WORK': return <Briefcase size={16} className="text-purple-400"/>;
      case 'READING': return <Coffee size={16} className="text-orange-400"/>;
      default: return <BookOpen size={16} className="text-emerald-400"/>;
    }
  };

  return (
    <div className="w-full mt-8 animate-in fade-in slide-in-from-bottom-4">
      
      {/* Title Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
            Live Lobby
        </h2>
        <span className="text-xs text-slate-500 font-mono">
            {requests.length} Online
        </span>
      </div>

      {/* The List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        
        {/* Loading State */}
        {isLoading && (
            <div className="col-span-full py-8 text-center text-slate-500 bg-slate-900/50 border border-white/5 rounded-xl border-dashed">
                <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                <p className="text-xs">Scanning for active partners...</p>
            </div>
        )}

        {/* Empty State */}
        {!isLoading && requests.length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 bg-slate-900/30 border border-white/5 rounded-xl border-dashed flex flex-col items-center">
                <div className="bg-slate-800/50 p-3 rounded-full mb-3">
                    <UserIcon size={20} className="opacity-50" />
                </div>
                <p className="text-sm font-medium text-slate-400">The Lobby is Empty</p>
                <p className="text-xs text-slate-600 mt-1">Be the first to start a session!</p>
            </div>
        )}

        {/* Request Cards */}
        {requests.map((req) => (
            <div 
                key={req.id}
                className="group bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/30 p-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 flex flex-col gap-3 relative overflow-hidden"
            >
                {/* Glow Effect */}
                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        {/* Avatar / Icon */}
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-slate-300 font-bold">
                            {req.userName ? req.userName.substring(0,2).toUpperCase() : "??"}
                        </div>
                        <div>
                            <div className="text-sm font-bold text-white flex items-center gap-2">
                                {req.userName}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Clock size={10} /> Waiting since {new Date(req.createdAt?.toMillis() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </div>
                        </div>
                    </div>
                    {/* Type Badge */}
                    <div className="bg-slate-950 border border-white/10 px-2 py-1 rounded flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-300">
                        {getIcon(req.config.type)}
                        {req.config.type}
                    </div>
                </div>

                <div className="flex items-center justify-between mt-1">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                       <span className="bg-white/5 px-2 py-0.5 rounded text-white">{req.config.duration}m</span>
                       <span>•</span>
                       <span>{req.config.mode.replace('_', ' ')}</span>
                    </div>
                    
                    <Button 
                        size="sm" 
                        onClick={() => onJoinSession(req.userId, req.config)}
                        className="text-xs h-8 bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/30"
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
