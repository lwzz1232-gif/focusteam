import React, { useState, useEffect, useRef } from 'react';
import { X, Circle, Trophy, Zap, Gamepad2, MousePointer2 } from 'lucide-react';

// --- TYPES (Internal to keep file isolated) ---
export type GameType = 'TICTACTOE' | 'PONG' | 'REACTION' | null;

export interface GameState {
  type: GameType;
  // Common
  status: 'INVITE' | 'PLAYING' | 'FINISHED';
  turn?: string; // userId
  winner?: string | 'DRAW' | null;
  // TicTacToe
  board?: (string | null)[];
  // Pong (Rally Style)
  ballOwner?: string; 
  rallyCount?: number;
  // Reaction
  reactionRound?: number; // 1, 2, 3
  reactionScores?: Record<string, number>;
  reactionStartTime?: number | null; // When the "GO" signal happens
}

interface GameOverlayProps {
  sessionId: string;
  userId: string;
  partnerId: string;
  partnerName: string;
  gameState: GameState;
  onUpdateGameState: (newState: Partial<GameState>) => void;
  onClose: () => void;
}

// --- SUB-COMPONENTS ---

// 1. TIC-TAC-TOE
const TicTacToe = ({ userId, gameState, onMove }: { userId: string, gameState: GameState, onMove: (i: number) => void }) => {
  const isMyTurn = gameState.turn === userId;
  const isWinner = gameState.winner === userId;
  const isLoser = gameState.winner && gameState.winner !== userId && gameState.winner !== 'DRAW';

  return (
    <div className={`flex flex-col items-center transition-all duration-500 ${isWinner ? 'scale-105' : isLoser ? 'opacity-50 grayscale' : ''}`}>
      <div className="grid grid-cols-3 gap-3 p-4 bg-slate-800/50 rounded-2xl border border-white/5 shadow-2xl">
        {gameState.board?.map((cell, i) => (
          <button
            key={i}
            onClick={() => onMove(i)}
            disabled={!!cell || !!gameState.winner || !isMyTurn}
            className={`w-20 h-20 rounded-xl flex items-center justify-center text-4xl transition-all duration-200
              ${!cell ? 'hover:bg-white/5' : ''}
              ${cell ? 'bg-slate-900/80 shadow-inner' : 'bg-slate-800'}
              ${isMyTurn && !cell && !gameState.winner ? 'cursor-pointer hover:scale-105 ring-1 ring-white/10' : 'cursor-default'}
            `}
          >
            {cell === userId ? (
              <X size={40} className="text-emerald-400 animate-in zoom-in duration-300" strokeWidth={2.5} />
            ) : cell ? (
              <Circle size={36} className="text-slate-400 animate-in zoom-in duration-300" strokeWidth={2.5} />
            ) : null}
          </button>
        ))}
      </div>
      <div className="mt-6 text-sm font-medium tracking-wide uppercase text-slate-400">
        {gameState.winner 
          ? (gameState.winner === 'DRAW' ? "It's a Draw" : (isWinner ? "Victory" : "Defeat"))
          : (isMyTurn ? <span className="text-emerald-400 animate-pulse">Your Turn</span> : "Opponent's Turn")
        }
      </div>
    </div>
  );
};

// 2. PONG (Rally Reflex Logic)
const Pong = ({ userId, gameState, onHit }: { userId: string, gameState: GameState, onHit: () => void }) => {
  const isMyBall = gameState.ballOwner === userId;
  const rally = gameState.rallyCount || 0;
  
  return (
    <div className="flex flex-col items-center w-full max-w-xs">
      <div className="w-full flex justify-between items-end h-64 relative bg-slate-900/50 rounded-2xl border border-white/5 p-4 overflow-hidden">
        
        {/* Middle Net */}
        <div className="absolute top-4 bottom-4 left-1/2 w-px bg-dashed border-l border-slate-700/50 -translate-x-1/2"></div>

        {/* Paddles */}
        <div className={`w-2 h-16 rounded-full transition-all duration-300 ${!isMyBall ? 'bg-slate-600' : 'bg-slate-800'}`}></div>
        <div className={`w-2 h-16 rounded-full transition-all duration-300 ${isMyBall ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-slate-800'}`}></div>

        {/* Ball (Abstract Representation) */}
        <div className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow-xl transition-all duration-700 ease-in-out
          ${isMyBall ? 'right-8 shadow-emerald-500/20' : 'left-8 shadow-slate-500/20'}
        `}></div>

        {/* Action Overlay */}
        {isMyBall && !gameState.winner && (
           <button 
             onClick={onHit}
             className="absolute inset-0 flex items-center justify-center bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer group"
           >
             <span className="bg-emerald-500 text-black font-bold px-6 py-2 rounded-full transform group-hover:scale-110 transition-transform shadow-lg">
               HIT BACK
             </span>
           </button>
        )}
      </div>

      <div className="mt-6 text-center">
        <div className="text-4xl font-mono font-bold text-slate-200 mb-1">{rally}</div>
        <div className="text-xs uppercase tracking-widest text-slate-500">Rally Count</div>
      </div>
    </div>
  );
};

// 3. REACTION DUEL
const ReactionDuel = ({ userId, gameState, onReact, isHost }: { userId: string, gameState: GameState, onReact: () => void, isHost: boolean }) => {
  const scores = gameState.reactionScores || {};
  const myScore = scores[userId] || 0;
  const partnerScore = Object.values(scores).find(s => s !== myScore) || 0; // Simple approximation
  
  const [localStatus, setLocalStatus] = useState<'WAIT' | 'READY' | 'GO'>('WAIT');
  
  useEffect(() => {
    if (!gameState.reactionStartTime) {
      setLocalStatus('WAIT');
      return;
    }
    
    // Check timing loop
    const checkTime = setInterval(() => {
      const now = Date.now();
      if (now >= gameState.reactionStartTime!) {
        setLocalStatus('GO');
        clearInterval(checkTime);
      } else if (gameState.reactionStartTime! - now < 2000) {
        setLocalStatus('READY');
      }
    }, 100);
    
    return () => clearInterval(checkTime);
  }, [gameState.reactionStartTime]);

  return (
    <div className="w-full flex flex-col items-center">
      {/* Scoreboard */}
      <div className="flex gap-8 mb-8 text-2xl font-mono font-bold text-slate-500">
        <span className={myScore > partnerScore ? 'text-emerald-400' : ''}>{myScore}</span>
        <span>-</span>
        <span className={partnerScore > myScore ? 'text-rose-400' : ''}>{partnerScore}</span>
      </div>

      {/* Game Button */}
      <button
        onClick={onReact}
        disabled={localStatus !== 'GO' && gameState.status === 'PLAYING'}
        className={`w-48 h-48 rounded-full border-4 flex items-center justify-center text-2xl font-bold tracking-wider transition-all duration-150
          ${localStatus === 'WAIT' ? 'border-slate-700 bg-slate-800 text-slate-500 cursor-wait' : ''}
          ${localStatus === 'READY' ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 animate-pulse cursor-wait' : ''}
          ${localStatus === 'GO' ? 'border-emerald-500 bg-emerald-500 text-black scale-110 shadow-[0_0_50px_rgba(16,185,129,0.4)] cursor-pointer active:scale-95' : ''}
        `}
      >
        {localStatus === 'WAIT' && "WAIT..."}
        {localStatus === 'READY' && "READY..."}
        {localStatus === 'GO' && "CLICK!"}
      </button>
      
      <p className="mt-6 text-xs text-slate-500 uppercase tracking-widest">
        First to 3 wins
      </p>
    </div>
  );
};

// --- MAIN COMPONENT ---

export const GameOverlay: React.FC<GameOverlayProps> = ({ 
  sessionId, userId, partnerId, partnerName, gameState, onUpdateGameState, onClose 
}) => {
  
  // -- Logic: TicTacToe --
  const playTicTacToe = (index: number) => {
    if (!gameState.board) return;
    const newBoard = [...gameState.board];
    newBoard[index] = userId;
    
    // Check Win
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winner = null;
    for (let line of lines) {
      const [a,b,c] = line;
      if (newBoard[a] && newBoard[a] === newBoard[b] && newBoard[a] === newBoard[c]) winner = newBoard[a];
    }
    if (!winner && !newBoard.includes(null)) winner = 'DRAW';
    
    onUpdateGameState({ board: newBoard, turn: partnerId, winner: winner || undefined, status: winner ? 'FINISHED' : 'PLAYING' });
  };

  // -- Logic: Pong --
  const playPong = () => {
    if (gameState.ballOwner !== userId) return;
    onUpdateGameState({ ballOwner: partnerId, rallyCount: (gameState.rallyCount || 0) + 1 });
  };

  // -- Logic: Reaction --
  const startReactionRound = () => {
    const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5s delay
    onUpdateGameState({ reactionStartTime: Date.now() + delay });
  };

  const playReaction = () => {
    if (gameState.winner) return; // Round already over
    
    // I clicked first
    const currentScores = gameState.reactionScores || { [userId]: 0, [partnerId]: 0 };
    const newScore = (currentScores[userId] || 0) + 1;
    const newScores = { ...currentScores, [userId]: newScore };
    
    // Check Match Win
    if (newScore >= 3) {
      onUpdateGameState({ winner: userId, reactionScores: newScores, status: 'FINISHED' });
    } else {
      // Prepare next round (Host handles timing usually, but here winner triggers reset)
      onUpdateGameState({ winner: userId, reactionScores: newScores }); // Temp winner of round
      setTimeout(() => {
        // Reset for next round
        const delay = Math.floor(Math.random() * 3000) + 2000;
        onUpdateGameState({ winner: null, reactionStartTime: Date.now() + delay });
      }, 2000);
    }
  };

  // -- Initialization --
  const startGame = (type: GameType) => {
    if (type === 'TICTACTOE') {
      onUpdateGameState({ type, status: 'PLAYING', board: Array(9).fill(null), turn: userId, winner: null });
    } else if (type === 'PONG') {
      onUpdateGameState({ type, status: 'PLAYING', ballOwner: userId, rallyCount: 0, winner: null });
    } else if (type === 'REACTION') {
      const delay = Math.floor(Math.random() * 3000) + 2000;
      onUpdateGameState({ type, status: 'PLAYING', reactionRound: 1, reactionScores: { [userId]: 0, [partnerId]: 0 }, reactionStartTime: Date.now() + delay, winner: null });
    }
  };

  // -- Render Helper --
  const isWinner = gameState.winner === userId;
  const isLoser = gameState.winner === partnerId;

  return (
    <div className={`absolute inset-0 z-[50] flex items-center justify-center bg-black/60 backdrop-blur-md animate-in fade-in duration-300
      ${isWinner ? 'bg-emerald-900/20' : ''}
      ${isLoser ? 'bg-red-900/10' : ''}
    `}>
      <div className="bg-[#0f172a] border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden w-full max-w-sm relative flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
          <h3 className="font-bold text-slate-200 text-sm tracking-widest uppercase flex items-center gap-2">
            <Gamepad2 size={16} className="text-emerald-400"/> 
            {gameState.type || 'Game Center'}
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content Area */}
        <div className="p-8 flex-1 flex flex-col items-center justify-center min-h-[300px]">
          
          {!gameState.type ? (
            /* MENU */
            <div className="grid grid-cols-1 w-full gap-3">
              <p className="text-center text-slate-500 text-xs mb-4 uppercase tracking-widest">Select a Game</p>
              
              <button onClick={() => startGame('TICTACTOE')} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-blue-500/30 transition-all group">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20"><X size={20} className="text-blue-400"/></div>
                <div className="text-left">
                  <div className="font-bold text-slate-200">Tic-Tac-Toe</div>
                  <div className="text-xs text-slate-500">Classic strategy</div>
                </div>
              </button>

              <button onClick={() => startGame('PONG')} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-emerald-500/30 transition-all group">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20"><Trophy size={20} className="text-emerald-400"/></div>
                <div className="text-left">
                  <div className="font-bold text-slate-200">Reflex Pong</div>
                  <div className="text-xs text-slate-500">Keep the rally going</div>
                </div>
              </button>

              <button onClick={() => startGame('REACTION')} className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-2xl border border-white/5 hover:bg-slate-800 hover:border-amber-500/30 transition-all group">
                <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20"><MousePointer2 size={20} className="text-amber-400"/></div>
                <div className="text-left">
                  <div className="font-bold text-slate-200">Reaction Duel</div>
                  <div className="text-xs text-slate-500">Best of 3 wins</div>
                </div>
              </button>
            </div>
          ) : (
            /* GAME AREA */
            <>
              {gameState.type === 'TICTACTOE' && <TicTacToe userId={userId} gameState={gameState} onMove={playTicTacToe} />}
              {gameState.type === 'PONG' && <Pong userId={userId} gameState={gameState} onHit={playPong} />}
              {gameState.type === 'REACTION' && <ReactionDuel userId={userId} isHost={userId < partnerId} gameState={gameState} onReact={playReaction} />}
              
              {/* Back Button */}
              <button 
                onClick={() => onUpdateGameState({ type: null, winner: null })} 
                className="mt-8 text-xs font-bold text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
              >
                Exit Game
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
