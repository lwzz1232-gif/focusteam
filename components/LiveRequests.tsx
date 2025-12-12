import React, { useState, useEffect, useCallback } from 'react';
import { User, SessionConfig, SessionType } from '../types';
import { db } from '../utils/firebaseConfig';
import { collection, query, where, onSnapshot, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Play, Code, BookOpen, Briefcase, Coffee, Clock, User as UserIcon, Loader2 } from 'lucide-react';
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

  // Memoized icon getter to prevent recreating on each render
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

  // Format relative time (e.g., "2 min ago")
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

  // Listen to waiting room with error handling
  useEffect(() => {
    const STALE_THRESHOLD = 10 * 60 * 1000; // 10 minutes
    
    try {
      const q = query(
        collection(db, 'waiting_room'),
        orderBy('createdAt', 'desc'),
        limit(20) // Increased from 10 for better visibility
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
              // Filter out current user
              if (req.userId === currentUser.id) return false;
              
              // Filter out stale requests (older than 10 min)
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

  // Format duration display
  const formatDuration = (duration: number) => {
    if (duration < 60) return `${duration}m`;
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  // Handle join with error boundary
  const handleJoin = useCallback((partnerId: string, config: SessionConfig) => {
    try {
      onJoinSession(partnerId, config);
    } catch (err) {
      console.error('Error joining session:', err);
      // You could add toast notification here
    }
  }, [onJoinSession]);

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
          {requests.length} {requests.length === 1 ? 'Person' : 'People'} Online
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

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
        {!isLoading && !error && requests.length === 0 && (
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
          <RequestCard
            key={req.id}
            request={req}
            onJoin={handleJoin}
            getIcon={getIcon}
            getRelativeTime={getRelativeTime}
            formatDuration={formatDuration}
          />
        ))}
      </div>
    </div>
  );
};

// Extracted RequestCard component for better performance
interface RequestCardProps {
  request: WaitingRoomRequest;
  onJoin: (partnerId: string, config: SessionConfig) => void;
  getIcon: (type: SessionType) => JSX.Element;
  getRelativeTime: (timestamp: Timestamp) => string;
  formatDuration: (duration: number) => string;
}

const RequestCard: React.FC<RequestCardProps> = React.memo(({ 
  request, 
  onJoin, 
  getIcon, 
  getRelativeTime,
  formatDuration 
}) => {
  const initials = request.userName 
    ? request.userName.substring(0, 2).toUpperCase() 
    : '??';

  const waitingTime = request.createdAt 
    ? getRelativeTime(request.createdAt)
    : 'Unknown';

  return (
    <div 
      className="group bg-slate-900/80 backdrop-blur-md border border-white/10 hover:border-blue-500/30 p-4 rounded-xl transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/10 flex flex-col gap-3 relative overflow-hidden"
    >
      {/* Glow Effect */}
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex justify-between items-start">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/5 flex items-center justify-center text-slate-300 font-bold text-sm">
            {initials}
          </div>
          <div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {request.userName}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1">
              <Clock size={10} /> {waitingTime}
            </div>
          </div>
        </div>
        
        {/* Type Badge */}
        <div className="bg-slate-950 border border-white/10 px-2 py-1 rounded flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-300">
          {getIcon(request.config.type)}
          {request.config.type}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="bg-white/5 px-2 py-0.5 rounded text-white">
            {formatDuration(request.config.duration)}
          </span>
          <span>•</span>
          <span className="capitalize">
            {request.config.mode.replace(/_/g, ' ').toLowerCase()}
          </span>
        </div>
        
        <Button 
          size="sm" 
          onClick={() => onJoin(request.userId, request.config)}
          className="text-xs h-8 bg-blue-600/20 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/30"
        >
          Join <Play size={10} className="ml-1 fill-current" />
        </Button>
      </div>
    </div>
  );
});
