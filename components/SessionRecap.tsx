import React, { useState } from 'react';
import { Button } from './Button';
import { Download, X, Search, Zap, Flower2 } from 'lucide-react';
import { User, Partner, TodoItem } from '../types';

interface SessionRecapProps {
  user: User;
  partner: Partner;
  duration: number;
  tasks: TodoItem[];
  onClose: () => void;
}

type Theme = 'NOIR' | 'NEON' | 'ZEN';

export const SessionRecap: React.FC<SessionRecapProps> = ({ user, partner, duration, tasks, onClose }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>('NEON');
  const completedCount = tasks.filter(t => t.completed).length;

  // --- CANVAS GENERATION ---
  const handleDownload = async () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    // Load fonts (best effort)
    try {
      await document.fonts.ready;
    } catch (e) { console.warn("Font loading skipped"); }

    drawStoryCard(ctx);

    const link = document.createElement('a');
    link.download = `FocusTwin_${currentTheme}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const drawStoryCard = (ctx: CanvasRenderingContext2D) => {
    // Clear
    ctx.clearRect(0, 0, 1080, 1920);

    if (currentTheme === 'NOIR') drawNoirTheme(ctx);
    else if (currentTheme === 'ZEN') drawZenTheme(ctx);
    else drawNeonTheme(ctx);
  };

  // --- THEME 1: NOIR DETECTIVE ---
  const drawNoirTheme = (ctx: CanvasRenderingContext2D) => {
    // Bg
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 1080, 1920);

    // Grain/Noise effect
    for (let i = 0; i < 50000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#000';
        ctx.fillRect(Math.random() * 1080, Math.random() * 1920, 2, 2);
    }

    // Vignette Circle
    const grad = ctx.createRadialGradient(540, 960, 300, 540, 960, 1000);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,1080,1920);

    // Border
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 920, 1760);

    ctx.textAlign = 'center';
    
    // Header
    ctx.font = 'bold 60px "Courier New", monospace';
    ctx.fillStyle = '#f5f5f5';
    ctx.fillText('CASE FILE: CLOSED', 540, 300);

    // Duration Box
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(240, 600, 600, 200);
    
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 160px "Courier New", monospace';
    ctx.fillText(`${Math.round(duration)}m`, 540, 760);

    // Labels
    ctx.fillStyle = '#f5f5f5';
    ctx.font = '40px "Courier New", monospace';
    ctx.fillText('DURATION LOGGED', 540, 860);

    // Partner info
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 1100);
    ctx.lineTo(740, 1100);
    ctx.stroke();

    ctx.font = '40px "Courier New", monospace';
    ctx.fillText(`DETECTIVE: ${user.name.toUpperCase()}`, 540, 1200);
    ctx.fillText(`PARTNER: ${partner.name.toUpperCase()}`, 540, 1280);

    // Stamp
    ctx.save();
    ctx.translate(540, 1500);
    ctx.rotate(-0.2);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 15;
    drawRoundedRect(ctx, -250, -80, 500, 160, 20);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.font = 'bold 80px "Courier New", monospace';
    ctx.fillText('CONFIDENTIAL', 0, 25);
    ctx.restore();
  };

  // --- THEME 2: HYPER FLUX (NEON) ---
  const drawNeonTheme = (ctx: CanvasRenderingContext2D) => {
    // Gradient Bg
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#312e81');
    grad.addColorStop(1, '#4c1d95');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Orbs
    const glow1 = ctx.createRadialGradient(200, 300, 0, 200, 300, 500);
    glow1.addColorStop(0, 'rgba(236, 72, 153, 0.4)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0,0,1080,1920);

    // Glass Card
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 100, 400, 880, 1100, 60);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';

    // Header
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.fillText('SESSION COMPLETE', 540, 550);

    // Big Number
    ctx.font = '900 300px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 40;
    ctx.fillText(`${Math.round(duration)}`, 540, 900);
    ctx.shadowBlur = 0;
    
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillText('MINUTES', 540, 1000);

    // Stats
    ctx.font = '50px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${user.name}  ×  ${partner.name}`, 540, 1200);

    // Task Pill
    ctx.fillStyle = '#22c55e';
    drawRoundedRect(ctx, 340, 1300, 400, 100, 50);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillText(`${completedCount} TASKS CRUSHED`, 540, 1365);
  };

  // --- THEME 3: KYOTO ZEN ---
  const drawZenTheme = (ctx: CanvasRenderingContext2D) => {
    // Paper texture color
    ctx.fillStyle = '#f4f1ea'; 
    ctx.fillRect(0, 0, 1080, 1920);

    // Big Red Sun
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(540, 600, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';

    // Vertical Text (Simulated)
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 80px serif';
    ctx.fillText('深', 950, 200); // Deep
    ctx.fillText('度', 950, 300); // Degree/Depth
    ctx.fillText('集', 950, 400); // Focus
    ctx.fillText('中', 950, 500); // Middle/In

    // Time
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 120px serif';
    ctx.fillText(`${Math.round(duration)}m`, 540, 640);

    // Content
    ctx.fillStyle = '#44403c';
    ctx.font = '50px serif';
    ctx.fillText('Mindful Session', 540, 950);

    // Line
    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 1050);
    ctx.lineTo(680, 1050);
    ctx.stroke();

    // Partners
    ctx.font = 'italic 50px serif';
    ctx.fillText(user.name, 540, 1150);
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#a8a29e';
    ctx.fillText('&', 540, 1220);
    ctx.fillStyle = '#44403c';
    ctx.font = 'italic 50px serif';
    ctx.fillText(partner.name, 540, 1290);

    // Stamp
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.strokeRect(490, 1500, 100, 100);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('FOCUS', 540, 1540);
    ctx.fillText('TWIN', 540, 1570);
  };

  // Helper
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, r);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };

  return (
    <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in pointer-events-auto overflow-y-auto">
      
      {/* --- PREVIEW CARD --- */}
      <div className={`
        relative w-full max-w-[320px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 mb-8 border-4
        ${currentTheme === 'NOIR' ? 'border-zinc-800 bg-zinc-950 text-zinc-100 font-mono grayscale' : ''}
        ${currentTheme === 'NEON' ? 'border-purple-500/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white font-sans' : ''}
        ${currentTheme === 'ZEN' ? 'border-stone-200 bg-[#f4f1ea] text-stone-800 font-serif' : ''}
      `}>
        
        {/* NOIR PREVIEW */}
        {currentTheme === 'NOIR' && (
           <div className="flex flex-col items-center justify-center h-full p-6 relative">
             <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '4px 4px'}}></div>
             <div className="text-xl font-bold border-b-2 border-zinc-100 pb-2 mb-8 tracking-tighter">CASE CLOSED</div>
             <div className="bg-zinc-100 text-black px-4 py-2 text-6xl font-black mb-4">{Math.round(duration)}m</div>
             <div className="text-xs uppercase tracking-widest mb-12">Duration Logged</div>
             <div className="w-full border-t border-zinc-700 my-4"></div>
             <div className="text-sm">DET. {user.name.toUpperCase()}</div>
             <div className="text-sm mt-1">PTR. {partner.name.toUpperCase()}</div>
             <div className="mt-12 border-4 border-red-600 text-red-600 px-4 py-1 text-xl font-bold -rotate-12 opacity-80">CONFIDENTIAL</div>
           </div>
        )}

        {/* NEON PREVIEW */}
        {currentTheme === 'NEON' && (
           <div className="flex flex-col items-center justify-between h-full p-6 relative">
             <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-pink-500/30 blur-3xl rounded-full"></div>
             <div className="absolute bottom-[-50px] right-[-50px] w-40 h-40 bg-blue-500/30 blur-3xl rounded-full"></div>
             
             <div className="mt-8 text-center z-10">
               <div className="text-sm font-bold text-purple-300 uppercase tracking-widest">Session Complete</div>
             </div>
             <div className="relative z-10 text-center">
               <div className="text-8xl font-black drop-shadow-[0_0_15px_rgba(192,132,252,0.5)]">{Math.round(duration)}<span className="text-4xl">m</span></div>
               <div className="text-xl font-bold opacity-80">FOCUS</div>
             </div>
             <div className="mb-8 z-10 text-center">
               <div className="text-lg font-medium">{user.name} + {partner.name}</div>
               <div className="mt-4 bg-emerald-500 text-black font-bold px-4 py-2 rounded-full text-xs">
                 {completedCount} TASKS CRUSHED
               </div>
             </div>
           </div>
        )}

        {/* ZEN PREVIEW */}
        {currentTheme === 'ZEN' && (
           <div className="flex flex-col items-center h-full p-6 relative">
             <div className="absolute top-24 w-32 h-32 bg-red-500 rounded-full mix-blend-multiply opacity-90"></div>
             <div className="absolute top-8 right-6 text-stone-900 font-bold text-lg flex flex-col gap-1 opacity-60">
                <span>深</span><span>度</span><span>集</span><span>中</span>
             </div>
             <div className="mt-32 relative z-10 text-white text-6xl font-bold drop-shadow-md">{Math.round(duration)}m</div>
             
             <div className="mt-32 text-center">
               <h3 className="text-2xl italic text-stone-700">Mindful Session</h3>
               <div className="w-16 h-px bg-stone-400 mx-auto my-4"></div>
               <p className="text-lg text-stone-800">{user.name}</p>
               <p className="text-xs text-stone-400 my-1">&</p>
               <p className="text-lg text-stone-800">{partner.name}</p>
             </div>
             <div className="mt-auto mb-4 border-2 border-red-500 p-2 text-[10px] text-red-500 font-bold leading-tight text-center">
               FOCUS<br/>TWIN
             </div>
           </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-sm">
        <h3 className="text-slate-400 text-sm font-medium mb-4 text-center uppercase tracking-wider">Choose Theme</h3>
        
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button 
            onClick={() => setCurrentTheme('NOIR')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              currentTheme === 'NOIR' ? 'bg-zinc-800 border-zinc-100 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
          >
            <Search size={20} />
            <span className="text-[10px] font-bold">DETECTIVE</span>
          </button>

          <button 
            onClick={() => setCurrentTheme('NEON')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              currentTheme === 'NEON' ? 'bg-indigo-900 border-purple-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
          >
            <Zap size={20} />
            <span className="text-[10px] font-bold">HYPER</span>
          </button>

          <button 
            onClick={() => setCurrentTheme('ZEN')}
            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
              currentTheme === 'ZEN' ? 'bg-[#e5e0d5] border-red-400 text-stone-800' : 'bg-slate-950 border-slate-800 text-slate-500 hover:bg-slate-800'
            }`}
          >
            <Flower2 size={20} />
            <span className="text-[10px] font-bold">KYOTO</span>
          </button>
        </div>

        <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1 py-3 text-xs">
                <X size={16} className="mr-2"/> Close
            </Button>
            <Button onClick={handleDownload} className="flex-[2] py-3 text-xs bg-white text-black hover:bg-slate-200">
                <Download size={16} className="mr-2"/> Save Story
            </Button>
        </div>
      </div>
    </div>
  );
};
