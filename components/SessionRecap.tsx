
import React, { useEffect } from 'react';
import { Button } from './Button';
import { Download, X } from 'lucide-react';
import { User, Partner, TodoItem } from '../types';

interface SessionRecapProps {
  user: User;
  partner: Partner;
  duration: number; // actual duration
  tasks: TodoItem[];
  onClose: () => void;
}

export const SessionRecap: React.FC<SessionRecapProps> = ({ user, partner, duration, tasks, onClose }) => {
  
  // Canvas Logic
  const handleDownload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set dimensions for Story (1080x1920)
    canvas.width = 1080;
    canvas.height = 1920;

    drawStoryCard(ctx);

    // Download
    const link = document.createElement('a');
    link.download = `FocusTwin_${user.name}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const drawStoryCard = (ctx: CanvasRenderingContext2D) => {
    // Official Brand Gradient: Deep Blue to Cyan
    const gradient = ctx.createLinearGradient(0, 0, 0, 1920);
    gradient.addColorStop(0, '#0f172a'); // Slate-950
    gradient.addColorStop(0.3, '#1e3a8a'); // Blue-900
    gradient.addColorStop(1, '#083344'); // Cyan-950
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glow Orbs
    // Top Left Cyan
    const glow1 = ctx.createRadialGradient(200, 400, 0, 200, 400, 600);
    glow1.addColorStop(0, 'rgba(6, 182, 212, 0.2)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0, 0, 1080, 1920);

    // Bottom Right Blue
    const glow2 = ctx.createRadialGradient(880, 1500, 0, 880, 1500, 600);
    glow2.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2;
    ctx.fillRect(0, 0, 1080, 1920);

    // Glass Container
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(140, 450, 800, 1020, 60);
    ctx.fill();
    ctx.stroke();

    // Text Content
    ctx.textAlign = 'center';
    
    // Header
    ctx.font = 'bold 50px Inter';
    ctx.fillStyle = '#22d3ee'; // Cyan-400
    ctx.fillText('MISSION COMPLETE', 540, 600);

    // Focus Time
    ctx.font = 'bold 240px Inter';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
    ctx.shadowBlur = 60;
    ctx.fillText(`${Math.round(duration)}m`, 540, 900);
    ctx.shadowBlur = 0;

    ctx.font = '50px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText('DEEP FOCUS', 540, 980);

    // Separator
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 1060);
    ctx.lineTo(740, 1060);
    ctx.stroke();

    // Partners
    ctx.font = '50px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(user.name, 540, 1150);
    ctx.font = '30px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('with', 540, 1210);
    ctx.font = '50px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(partner.name, 540, 1280);

    // Tasks
    const completedCount = tasks.filter(t => t.completed).length;
    ctx.font = 'bold 60px Inter';
    ctx.fillStyle = '#34d399'; // Emerald-400
    ctx.fillText(`${completedCount} Targets Crushed`, 540, 1380);

    // Footer
    ctx.font = '30px Inter';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('FocusTwin App', 540, 1550);
  };

  const completedCount = tasks.filter(t => t.completed).length;

  return (
    <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in pointer-events-auto">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl flex flex-col relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors backdrop-blur-sm"
        >
          <X size={20} />
        </button>

        {/* Preview Area */}
        <div 
            className="aspect-[9/16] w-full relative p-8 flex flex-col items-center justify-between text-center overflow-hidden bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900"
        >
             {/* Simple Background Glows */}
             <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[50%] bg-cyan-500/10 blur-3xl rounded-full"></div>
             <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[50%] bg-blue-600/10 blur-3xl rounded-full"></div>

            <div className="mt-12 relative z-10">
                <h2 className="text-xl font-bold uppercase tracking-widest text-cyan-400">Mission Complete</h2>
                <p className="text-xs text-slate-300 mt-1 uppercase tracking-wide">Deep Focus Session</p>
            </div>

            <div className="relative z-10">
                <div className="text-8xl font-black text-white drop-shadow-[0_0_25px_rgba(6,182,212,0.4)]">
                    {Math.round(duration)}<span className="text-4xl">m</span>
                </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-4 rounded-xl w-full relative z-10">
                <div className="text-sm text-slate-300 mb-1">Targets Crushed</div>
                <div className="text-3xl font-bold text-emerald-400">
                    {completedCount}
                </div>
            </div>

            <div className="mb-8 relative z-10">
                <div className="flex flex-col items-center justify-center gap-1 text-sm font-medium text-white/90">
                    <span className="text-lg">{user.name}</span>
                    <span className="text-xs text-slate-500">synced with</span>
                    <span className="text-lg">{partner.name}</span>
                </div>
                <div className="text-[10px] text-slate-600 mt-4 uppercase tracking-widest">FocusTwin Official</div>
            </div>
        </div>

        {/* Action Button */}
        <div className="bg-slate-950 p-6 border-t border-slate-800">
          <Button onClick={handleDownload} className="w-full py-3 text-sm shadow-blue-500/20 shadow-lg">
            <Download size={16} className="mr-2" />
            Save to Story
          </Button>
        </div>
      </div>
    </div>
  );
};
