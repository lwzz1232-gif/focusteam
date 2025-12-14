import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Download, X, Share2, Music, Search, Zap, Flower2, Check } from 'lucide-react';
import { User, Partner, TodoItem } from '../types';

interface SessionRecapProps {
  user: User;
  partner: Partner;
  duration: number;
  tasks: TodoItem[];
  onClose: () => void;
}

type Theme = 'NOIR' | 'NEON' | 'ZEN' | 'AURA';

export const SessionRecap: React.FC<SessionRecapProps> = ({ user, partner, duration, tasks, onClose }) => {
  const [currentTheme, setCurrentTheme] = useState<Theme>('NEON');
  const [isSharing, setIsSharing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const completedCount = tasks.filter(t => t.completed).length;

  // --- CANVAS LOGIC (UNTOUCHED) ---
  const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 1080;
    canvas.height = 1920;

    try { await document.fonts.ready; } catch (e) {}

    ctx.clearRect(0, 0, 1080, 1920);
    
    if (currentTheme === 'NOIR') drawNoirTheme(ctx);
    else if (currentTheme === 'ZEN') drawZenTheme(ctx);
    else if (currentTheme === 'AURA') drawAuraTheme(ctx);
    else drawNeonTheme(ctx);

    return canvas;
  };

  const handleDownload = async () => {
    const canvas = await generateCanvas();
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `FocusTwin_${currentTheme}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    setTimeout(() => onClose(), 1000);
  };

  const handleShare = async () => {
    setIsSharing(true);
    const canvas = await generateCanvas();
    if (!canvas) { setIsSharing(false); return; }

    canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], "focustwin-story.png", { type: "image/png" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'My Focus Session',
                    text: `Just crushed a ${Math.round(duration)}min deep work session on FocusTwin!`
                });
                onClose(); 
            } catch (error) { console.log("Share cancelled"); }
        } else {
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                alert("Image copied to clipboard!");
                onClose();
            } catch (err) { handleDownload(); }
        }
        setIsSharing(false);
    }, 'image/png');
  };

  // --- DRAWING FUNCTIONS (UNTOUCHED) ---
  const drawNoirTheme = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#111111'; ctx.fillRect(0, 0, 1080, 1920);
    for (let i = 0; i < 50000; i++) { ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#000'; ctx.fillRect(Math.random() * 1080, Math.random() * 1920, 2, 2); }
    const grad = ctx.createRadialGradient(540, 960, 300, 540, 960, 1000); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,0.8)'); ctx.fillStyle = grad; ctx.fillRect(0,0,1080,1920);
    ctx.strokeStyle = '#f5f5f5'; ctx.lineWidth = 4; ctx.strokeRect(80, 80, 920, 1760);
    ctx.textAlign = 'center'; ctx.font = 'bold 60px "Courier New", monospace'; ctx.fillStyle = '#f5f5f5'; ctx.fillText('CASE FILE: CLOSED', 540, 300);
    ctx.fillStyle = '#f5f5f5'; ctx.fillRect(240, 600, 600, 200);
    ctx.fillStyle = '#111111'; ctx.font = 'bold 160px "Courier New", monospace'; ctx.fillText(`${Math.round(duration)}m`, 540, 760);
    ctx.fillStyle = '#f5f5f5'; ctx.font = '40px "Courier New", monospace'; ctx.fillText('DURATION LOGGED', 540, 860);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(340, 1100); ctx.lineTo(740, 1100); ctx.stroke();
    ctx.font = '40px "Courier New", monospace'; ctx.fillText(`DETECTIVE: ${user.name.toUpperCase()}`, 540, 1200); ctx.fillText(`PARTNER: ${partner.name.toUpperCase()}`, 540, 1280);
    ctx.save(); ctx.translate(540, 1500); ctx.rotate(-0.2); ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 15;
    drawRoundedRect(ctx, -250, -80, 500, 160, 20); ctx.stroke(); ctx.fillStyle = '#ef4444'; ctx.font = 'bold 80px "Courier New", monospace'; ctx.fillText('CONFIDENTIAL', 0, 25); ctx.restore();
  };

  const drawNeonTheme = (ctx: CanvasRenderingContext2D) => {
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920); grad.addColorStop(0, '#0f172a'); grad.addColorStop(0.5, '#312e81'); grad.addColorStop(1, '#4c1d95'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);
    const glow1 = ctx.createRadialGradient(200, 300, 0, 200, 300, 500); glow1.addColorStop(0, 'rgba(236, 72, 153, 0.4)'); glow1.addColorStop(1, 'transparent'); ctx.fillStyle = glow1; ctx.fillRect(0,0,1080,1920);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; ctx.lineWidth = 3; drawRoundedRect(ctx, 100, 400, 880, 1100, 60); ctx.fill(); ctx.stroke();
    ctx.textAlign = 'center'; ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillStyle = '#c084fc'; ctx.fillText('SESSION COMPLETE', 540, 550);
    ctx.font = '900 300px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.shadowColor = '#d946ef'; ctx.shadowBlur = 40; ctx.fillText(`${Math.round(duration)}`, 540, 900); ctx.shadowBlur = 0;
    ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillText('MINUTES', 540, 1000);
    ctx.font = '50px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillText(`${user.name}  ×  ${partner.name}`, 540, 1200);
    ctx.fillStyle = '#22c55e'; drawRoundedRect(ctx, 340, 1300, 400, 100, 50); ctx.fill();
    ctx.fillStyle = '#000'; ctx.font = 'bold 40px Inter, sans-serif'; ctx.fillText(`${completedCount} TASKS CRUSHED`, 540, 1365);
  };

  const drawZenTheme = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#f4f1ea'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(540, 600, 180, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'center'; ctx.fillStyle = '#1c1917'; ctx.font = 'bold 80px serif';
    ctx.fillText('深', 950, 200); ctx.fillText('度', 950, 300); ctx.fillText('集', 950, 400); ctx.fillText('中', 950, 500); 
    ctx.fillStyle = '#fff'; ctx.font = 'bold 120px serif'; ctx.fillText(`${Math.round(duration)}m`, 540, 640);
    ctx.fillStyle = '#44403c'; ctx.font = '50px serif'; ctx.fillText('Mindful Session', 540, 950);
    ctx.strokeStyle = '#d6d3d1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(400, 1050); ctx.lineTo(680, 1050); ctx.stroke();
    ctx.font = 'italic 50px serif'; ctx.fillText(user.name, 540, 1150); ctx.font = '30px sans-serif'; ctx.fillStyle = '#a8a29e'; ctx.fillText('&', 540, 1220); ctx.fillStyle = '#44403c'; ctx.font = 'italic 50px serif'; ctx.fillText(partner.name, 540, 1290);
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 8; ctx.strokeRect(490, 1500, 100, 100); ctx.font = '20px sans-serif'; ctx.fillStyle = '#ef4444'; ctx.fillText('FOCUS', 540, 1540); ctx.fillText('TWIN', 540, 1570);
  };

  const drawAuraTheme = (ctx: CanvasRenderingContext2D) => {
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920); grad.addColorStop(0, '#f9a8d4'); grad.addColorStop(0.5, '#e879f9'); grad.addColorStop(1, '#818cf8'); ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1920);
    ctx.globalCompositeOperation = 'overlay'; ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'; ctx.beginPath(); ctx.arc(900, 300, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; ctx.beginPath(); ctx.arc(100, 1500, 500, 0, Math.PI * 2); ctx.fill(); ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center'; ctx.font = 'bold 50px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('TOP FOCUS SESSION', 540, 250);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; ctx.shadowColor = 'rgba(0, 0, 0, 0.3)'; ctx.shadowBlur = 50; ctx.fillRect(190, 400, 700, 700); 
    ctx.fillStyle = '#1e1b4b'; ctx.shadowBlur = 0; ctx.fillRect(190, 400, 700, 700);
    ctx.font = 'bold 300px Inter, sans-serif'; ctx.fillStyle = '#f472b6'; ctx.fillText(`${Math.round(duration)}`, 540, 850);
    ctx.font = 'bold 50px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('MINUTES', 540, 950);
    ctx.textAlign = 'left'; ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(user.name, 190, 1250);
    ctx.font = '40px Inter, sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'; ctx.fillText(`ft. ${partner.name}`, 190, 1320);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'; drawRoundedRect(ctx, 190, 1450, 700, 10, 5); ctx.fill();
    ctx.fillStyle = '#ffffff'; drawRoundedRect(ctx, 190, 1450, 700, 10, 5); ctx.fill();
    ctx.font = '30px Inter, sans-serif'; ctx.fillText(`0:00`, 190, 1500); ctx.textAlign = 'right'; ctx.fillText(`${Math.round(duration)}:00`, 890, 1500);
    ctx.textAlign = 'center'; ctx.font = 'bold 40px Inter, sans-serif'; ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'; ctx.fillText('FocusTwin Wrapped', 540, 1750);
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  };

  // --- DYNAMIC BACKGROUND & COLORS ---
  const getThemeStyles = () => {
    switch (currentTheme) {
        case 'NOIR': return { bg: 'bg-zinc-950', accent: 'text-white', ring: 'ring-zinc-500', button: 'bg-white text-black' };
        case 'ZEN':  return { bg: 'bg-[#e5e0d5]', accent: 'text-stone-800', ring: 'ring-stone-400', button: 'bg-stone-800 text-[#e5e0d5]' };
        case 'AURA': return { bg: 'bg-pink-950', accent: 'text-pink-200', ring: 'ring-pink-400', button: 'bg-pink-500 text-white' };
        default:     return { bg: 'bg-slate-950', accent: 'text-cyan-400', ring: 'ring-purple-500', button: 'bg-cyan-400 text-black' };
    }
  };
  // --- NEW: GENERATE LIVE PREVIEW ---
  useEffect(() => {
    // Small delay to ensure fonts/canvas are ready
    const timer = setTimeout(() => {
      generateCanvas().then(canvas => {
        if (canvas) setPreviewUrl(canvas.toDataURL());
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentTheme, user, partner, duration, completedCount]);
  const themeStyle = getThemeStyles();

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-colors duration-700 ${themeStyle.bg}`}>
      
      {/* 1. CLOSE BUTTON (Top Right, Subtle) */}
      <button 
        onClick={onClose}
        className={`absolute top-6 right-6 p-2 rounded-full backdrop-blur-md bg-black/20 hover:bg-black/40 transition-all ${themeStyle.accent}`}
      >
        <X size={24} />
      </button>

    {/* 2. THE MAIN CARD (Updated with Real Preview) */}
      <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 mb-8 border-4 border-white/10 animate-in zoom-in-95 duration-500 bg-slate-900">
         
         {previewUrl ? (
             <img 
               src={previewUrl} 
               alt="Session Preview" 
               className="w-full h-full object-contain" 
             />
         ) : (
             <div className="flex items-center justify-center h-full text-white/50 animate-pulse">
               Generating Preview...
             </div>
         )}

      </div>

      {/* 3. THE CONTROL DOCK (Glassmorphic) */}
      <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-2 flex flex-col gap-4 shadow-2xl">
        
        {/* Theme Selectors */}
        <div className="flex justify-between items-center px-4 py-2">
            {[
                { id: 'NOIR', icon: <Search size={16}/>, label: 'Noir' },
                { id: 'NEON', icon: <Zap size={16}/>, label: 'Neon' },
                { id: 'ZEN', icon: <Flower2 size={16}/>, label: 'Zen' },
                { id: 'AURA', icon: <Music size={16}/>, label: 'Aura' },
            ].map((t) => (
                <button
                    key={t.id}
                    onClick={() => setCurrentTheme(t.id as Theme)}
                    className={`flex flex-col items-center gap-1 transition-all duration-300 ${currentTheme === t.id ? 'opacity-100 scale-110' : 'opacity-50 hover:opacity-80'}`}
                >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        currentTheme === t.id ? `${themeStyle.bg} ${themeStyle.accent} border-current` : 'bg-black/20 border-transparent text-white'
                    }`}>
                        {t.icon}
                    </div>
                    <span className="text-[9px] font-bold text-white uppercase tracking-wider">{t.label}</span>
                </button>
            ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
            <button 
                onClick={handleShare}
                className="flex-1 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-medium flex items-center justify-center gap-2 transition-all backdrop-blur-sm"
            >
                <Share2 size={18} />
                <span className="text-xs">Share</span>
            </button>

            <button 
                onClick={handleDownload}
                className={`flex-[2] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg hover:brightness-110 hover:scale-[1.02] active:scale-95 ${themeStyle.button}`}
            >
                <Download size={20} />
                <span>Save Memory</span>
            </button>
        </div>
      </div>

    </div>
  );
};
