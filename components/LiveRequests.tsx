import React, { useState, useEffect, useCallback } from 'react';
import { User, SessionConfig, SessionType } from '../types';
import { db } from '../utils/firebaseConfig';
import { collection, query, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Play, Code, BookOpen, Briefcase, Coffee, Clock, User as UserIcon, Loader2, Zap, TrendingUp, Users, Sparkles } from 'lucide-react';
import { Button } from './Button';

interface LiveRequestsProps {
  currentUser: User;
  onJoinSession: (partnerId: string, config: SessionConfig) => void;
}

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
  const [error, setError] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState(0);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // Simulate total sessions counter (you can connect to real data)
  useEffect(() => {
    const interval = setInterval(() => {
      setTotalSessions(prev => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = useCallback((type: SessionType) => {
    const iconProps = { size: 16 };
    
    switch (type) {
      case SessionType.CODING:
        return <Code {...iconProps} className="text-blue-400" />;
      case SessionType.WORK:
        return <Briefcase {...iconProps} className="text-purple-400" />;
      case SessionType.READING:
        return <Coffee {...iconProps} className="text-orange-400" />;
      case SessionType.STUDY:
      default:
        return <BookOpen {...iconProps} className="text-emerald-400" />;
    }
  }, []);

  const getTypeColor = useCallback((type: SessionType) => {
    switch (type) {
      case SessionType.CODING: return 'from-blue-500/20 to-cyan-500/20';
      case SessionType.WORK: return 'from-purple-500/20 to-pink-500/20';
      case SessionType.READING: return 'from-orange-500/20 to-red-500/20';
      case SessionType.STUDY:
      default: return 'from-emerald-500/20 to-teal-500/20';
    }
  }, []);

  const getRelativeTime = useCallback((timestamp: Timestamp) => {
    const now = Date.now();
    const then = timestamp.toMillis();
    const diffMs = now - then;
    const diffMin = Math.floor(diffMs / 60000);
    
    if (diffMin < 1) return 'Just now';
    if (diffMin === 1) return '1 min ago';
    if (diffMin < 60) return `${diffMin} min ago`;
    
    const diffHours = Math.floor(diffMin / 60);
    return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  }, []);

  useEffect(() => {
    const STALE_THRESHOLD = 10 * 60 * 1000;
    
    try {
      const q = query(
        collection(db, 'waiting_room'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsub = onSnapshot(
        q,
        (snapshot) => {
          const now = Date.now();
          
          const activeRequests = snapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data()
            } as WaitingRoomRequest))
            .filter(req => {
              if (req.userId === currentUser.id) return false;
              if (req.createdAt) {
                const age = now - req.createdAt.toMillis();
                if (age > STALE_THRESHOLD) return false;
              }
              return true;
            });
          
          setRequests(activeRequests);
          setIsLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error listening to waiting room:', err);
          setError('Failed to load lobby. Please refresh.');
          setIsLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.error('Error setting up waiting room listener:', err);
      setError('Failed to connect to lobby.');
      setIsLoading(false);
    }
  }, [currentUser.id]);

  const formatDuration = (duration: number) => {
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const handleJoin = useCallback((partnerId: string, config: SessionConfig) => {
    try {
      onJoinSession(partnerId, config);
    } catch (err) {
      console.error('Error joining session:', err);
    }
  }, [onJoinSession]);

  // Get most popular session type
  const getMostPopularType = () => {
    if (requests.length === 0) return null;
    const typeCounts = requests.reduce((acc, req) => {
      acc[req.config.type] = (acc[req.config.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };

  const popularType = getMostPopularType();

  return (
    <div className="w-full mt-8">
      
      {/* Enhanced Header with Stats */}
      <div className="mb-6 space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Live Lobby
            </h2>
            {requests.length > 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                <span className="text-emerald-400 text-sm font-bold">{requests.length} Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats Bar */}
        {!isLoading && requests.length > 0 && (
          <div className="grid grid-cols-3 gap-3 animate-in slide-in-from-bottom-2 fade-in">
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <Users size={14} className="text-blue-400" />
                <span className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">Active Now</span>
              </div>
              <div className="text-2xl font-bold text-white">{requests.length}</div>
            </div>
            
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp size={14} className="text-purple-400" />
                <span className="text-[10px] uppercase tracking-wider text-purple-300 font-bold">Sessions Today</span>
              </div>
              <div className="text-2xl font-bold text-white">{totalSessions}</div>
            </div>
            
            {popularType && (
              <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-3 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-1">
                  <Zap size={14} className="text-amber-400" />
                  <span className="text-[10px] uppercase tracking-wider text-amber-300 font-bold">Trending</span>
                </div>
                <div className="text-lg font-bold text-white capitalize">{popularType}</div>
              </div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm animate-in slide-in-from-top-2">
          {error}
        </div>
      )}

      {/* The List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        
        {isLoading && (
          <div className="col-span-full py-12 text-center text-slate-500 bg-slate-900/50 border border-white/5 rounded-xl border-dashed backdrop-blur-sm">
            <Loader2 className="animate-spin mx-auto mb-3" size={24} />
            <p className="text-sm font-medium">Scanning for active partners...</p>
            <p className="text-xs text-slate-600 mt-1">Finding your perfect match</p>
          </div>
        )}

        {!isLoading && !error && requests.length === 0 && (
          <div className="col-span-full py-12 text-center bg-slate-900/30 border border-white/5 rounded-xl border-dashed flex flex-col items-center backdrop-blur-sm">
            <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/50 p-4 rounded-full mb-4">
              <UserIcon size={28} className="opacity-50 text-slate-400" />
            </div>
            <p className="text-base font-bold text-slate-300 mb-1">The Lobby is Empty</p>
            <p className="text-sm text-slate-500">Be the first to start a session!</p>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-600">
              <Sparkles size={12} className="text-amber-500/50" />
              <span>New matches appear here in real-time</span>
            </div>
          </div>
        )}

        {requests.map((req, index) => (
          <RequestCard
            key={req.id}
            request={req}
            index={index}
            onJoin={handleJoin}
            getIcon={getIcon}
            getTypeColor={getTypeColor}
            getRelativeTime={getRelativeTime}
            formatDuration={formatDuration}
            isHovered={hoveredCard === req.id}
            onHover={setHoveredCard}
          />
        ))}
      </div>
    </div>
  );
};

interface RequestCardProps {
  request: WaitingRoomRequest;
  index: number;
  onJoin: (partnerId: string, config: SessionConfig) => void;
  getIcon: (type: SessionType) => JSX.Element;
  getTypeColor: (type: SessionType) => string;
  getRelativeTime: (timestamp: Timestamp) => string;
  formatDuration: (duration: number) => string;
  isHovered: boolean;
  onHover: (id: string | null) => void;
}

const RequestCard: React.FC<RequestCardProps> = React.memo(({ 
  request, 
  index,
  onJoin, 
  getIcon, 
  getTypeColor,
  getRelativeTime,
  formatDuration,
  isHovered,
  onHover
}) => {
  const initials = request.userName 
    ? request.userName.substring(0, 2).toUpperCase() 
    : '??';

  const waitingTime = request.createdAt 
    ? getRelativeTime(request.createdAt)
    : 'Unknown';

  // Fresh indicator (less than 2 min old)
  const isFresh = request.createdAt 
    ? (Date.now() - request.createdAt.toMillis()) < 120000 
    : false;

  return (
    <div 
      onMouseEnter={() => onHover(request.id)}
      onMouseLeave={() => onHover(null)}
      className={`group relative bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/50 p-5 rounded-2xl transition-all duration-500 hover:shadow-2xl hover:shadow-blue-500/20 flex flex-col gap-4 overflow-hidden hover:scale-[1.02] animate-in slide-in-from-bottom-4 fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Animated gradient background */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getTypeColor(request.config.type)} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
      
      {/* Accent line */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      {/* Fresh badge */}
      {isFresh && (
        <div className="absolute top-3 right-3 bg-emerald-500/20 border border-emerald-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
          <Sparkles size={10} className="text-emerald-400" />
          <span className="text-[9px] font-bold text-emerald-300 uppercase tracking-wider">New</span>
        </div>
      )}

      <div className="relative flex justify-between items-start">
        <div className="flex items-center gap-3">
          {/* Enhanced Avatar with glow */}
          <div className={`relative w-12 h-12 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border-2 ${isHovered ? 'border-blue-400' : 'border-white/10'} flex items-center justify-center text-white font-bold text-sm transition-all duration-300 shadow-lg`}>
            {isHovered && (
              <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
            )}
            <span className="relative z-10">{initials}</span>
          </div>
          
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2 mb-0.5">
              {request.userName}
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <Clock size={11} className="text-slate-500" />
              <span>{waitingTime}</span>
            </div>
          </div>
        </div>
        
        {/* Type Badge */}
        <div className="relative bg-slate-950/80 backdrop-blur-sm border border-white/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-200 group-hover:border-blue-400/30 transition-colors">
          {getIcon(request.config.type)}
          {request.config.type}
        </div>
      </div>

      <div className="relative flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1 rounded-lg border border-white/10">
            <Clock size={12} className="text-blue-400" />
            <span className="text-white font-semibold">
              {formatDuration(request.config.duration)}
            </span>
          </div>
          <span className="text-slate-600">•</span>
          <span className="capitalize text-slate-300">
            {request.config.mode.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
        
        <Button 
          size="sm" 
          onClick={() => onJoin(request.userId, request.config)}
          className="relative text-xs h-9 px-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white border-0 shadow-lg shadow-blue-500/25 group-hover:shadow-blue-500/50 transition-all duration-300 font-bold"
        >
          <span className="relative z-10 flex items-center gap-1.5">
            Join <Play size={11} className="fill-current" />
          </span>
        </Button>
      </div>
    </div>
  );
});
