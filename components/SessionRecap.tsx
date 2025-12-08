import React, { useState } from 'react';
import { Button } from './Button';
import { Download, X, Share2, Music } from 'lucide-react';
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
  const completedCount = tasks.filter(t => t.completed).length;

  // --- GENERATE CANVAS ---
  const generateCanvas = async (): Promise<HTMLCanvasElement | null> => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    canvas.width = 1080;
    canvas.height = 1920;

    try { await document.fonts.ready; } catch (e) {}

    // Clear and Draw
    ctx.clearRect(0, 0, 1080, 1920);
    
    if (currentTheme === 'NOIR') drawNoirTheme(ctx);
    else if (currentTheme === 'ZEN') drawZenTheme(ctx);
    else if (currentTheme === 'AURA') drawAuraTheme(ctx);
    else drawNeonTheme(ctx);

    return canvas;
  };

  // --- ACTION: DOWNLOAD ---
  const handleDownload = async () => {
    const canvas = await generateCanvas();
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `FocusTwin_${currentTheme}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    // Auto-close after download
    setTimeout(() => {
        onClose();
    }, 1000);
  };

  // --- ACTION: SHARE ---
  const handleShare = async () => {
    setIsSharing(true);
    const canvas = await generateCanvas();
    if (!canvas) { setIsSharing(false); return; }

    canvas.toBlob(async (blob) => {
        if (!blob) return;
        
        const file = new File([blob], "focustwin-story.png", { type: "image/png" });

        // Mobile Native Share
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
                await navigator.share({
                    files: [file],
                    title: 'My Focus Session',
                    text: `Just crushed a ${Math.round(duration)}min deep work session on FocusTwin!`
                });
                onClose(); // Close on success
            } catch (error) {
                console.log("Share cancelled", error);
            }
        } else {
            // Desktop Fallback: Copy to Clipboard
            try {
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob })
                ]);
                alert("Image copied to clipboard!");
                onClose();
            } catch (err) {
                // Last resort: just download it
                handleDownload();
            }
        }
        setIsSharing(false);
    }, 'image/png');
  };

  // --- THEME 1: NOIR DETECTIVE ---
  const drawNoirTheme = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 1080, 1920);

    // Noise
    for (let i = 0; i < 50000; i++) {
        ctx.fillStyle = Math.random() > 0.5 ? '#222' : '#000';
        ctx.fillRect(Math.random() * 1080, Math.random() * 1920, 2, 2);
    }

    const grad = ctx.createRadialGradient(540, 960, 300, 540, 960, 1000);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,1080,1920);

    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 4;
    ctx.strokeRect(80, 80, 920, 1760);

    ctx.textAlign = 'center';
    ctx.font = 'bold 60px "Courier New", monospace';
    ctx.fillStyle = '#f5f5f5';
    ctx.fillText('CASE FILE: CLOSED', 540, 300);

    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(240, 600, 600, 200);
    
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 160px "Courier New", monospace';
    ctx.fillText(`${Math.round(duration)}m`, 540, 760);

    ctx.fillStyle = '#f5f5f5';
    ctx.font = '40px "Courier New", monospace';
    ctx.fillText('DURATION LOGGED', 540, 860);

    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 1100);
    ctx.lineTo(740, 1100);
    ctx.stroke();

    ctx.font = '40px "Courier New", monospace';
    ctx.fillText(`DETECTIVE: ${user.name.toUpperCase()}`, 540, 1200);
    ctx.fillText(`PARTNER: ${partner.name.toUpperCase()}`, 540, 1280);

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
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#312e81');
    grad.addColorStop(1, '#4c1d95');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    const glow1 = ctx.createRadialGradient(200, 300, 0, 200, 300, 500);
    glow1.addColorStop(0, 'rgba(236, 72, 153, 0.4)');
    glow1.addColorStop(1, 'transparent');
    ctx.fillStyle = glow1;
    ctx.fillRect(0,0,1080,1920);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    drawRoundedRect(ctx, 100, 400, 880, 1100, 60);
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillStyle = '#c084fc';
    ctx.fillText('SESSION COMPLETE', 540, 550);

    ctx.font = '900 300px Inter, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#d946ef';
    ctx.shadowBlur = 40;
    ctx.fillText(`${Math.round(duration)}`, 540, 900);
    ctx.shadowBlur = 0;
    
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillText('MINUTES', 540, 1000);

    ctx.font = '50px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText(`${user.name}  ×  ${partner.name}`, 540, 1200);

    ctx.fillStyle = '#22c55e';
    drawRoundedRect(ctx, 340, 1300, 400, 100, 50);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillText(`${completedCount} TASKS CRUSHED`, 540, 1365);
  };

  // --- THEME 3: KYOTO ZEN ---
  const drawZenTheme = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#f4f1ea'; 
    ctx.fillRect(0, 0, 1080, 1920);

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(540, 600, 180, 0, Math.PI * 2);
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#1c1917';
    ctx.font = 'bold 80px serif';
    ctx.fillText('深', 950, 200); 
    ctx.fillText('度', 950, 300);
    ctx.fillText('集', 950, 400); 
    ctx.fillText('中', 950, 500); 

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 120px serif';
    ctx.fillText(`${Math.round(duration)}m`, 540, 640);

    ctx.fillStyle = '#44403c';
    ctx.font = '50px serif';
    ctx.fillText('Mindful Session', 540, 950);

    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 1050);
    ctx.lineTo(680, 1050);
    ctx.stroke();

    ctx.font = 'italic 50px serif';
    ctx.fillText(user.name, 540, 1150);
    ctx.font = '30px sans-serif';
    ctx.fillStyle = '#a8a29e';
    ctx.fillText('&', 540, 1220);
    ctx.fillStyle = '#44403c';
    ctx.font = 'italic 50px serif';
    ctx.fillText(partner.name, 540, 1290);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 8;
    ctx.strokeRect(490, 1500, 100, 100);
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('FOCUS', 540, 1540);
    ctx.fillText('TWIN', 540, 1570);
  };

  // --- THEME 4: AURA (New - Spotify Inspired) ---
  const drawAuraTheme = (ctx: CanvasRenderingContext2D) => {
    // 1. Background (Pastel Gradient)
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#f9a8d4'); // Pink-300
    grad.addColorStop(0.5, '#e879f9'); // Purple-400
    grad.addColorStop(1, '#818cf8'); // Indigo-400
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Abstract Shapes (The "Aura")
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.beginPath();
    ctx.arc(900, 300, 400, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.arc(100, 1500, 500, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.textAlign = 'center';

    // 3. Header (Top Fan Style)
    ctx.font = 'bold 50px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TOP FOCUS SESSION', 540, 250);

    // 4. The "Album Cover" Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 50;
    ctx.fillRect(190, 400, 700, 700); // Shadow box
    
    // Main Image Placeholder (Just a solid color since we can't load ext images easily)
    ctx.fillStyle = '#1e1b4b'; // Indigo-950
    ctx.shadowBlur = 0;
    ctx.fillRect(190, 400, 700, 700);
    
    // Inner Text
    ctx.font = 'bold 300px Inter, sans-serif';
    ctx.fillStyle = '#f472b6'; // Pink-400
    ctx.fillText(`${Math.round(duration)}`, 540, 850);
    
    ctx.font = 'bold 50px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('MINUTES', 540, 950);

    // 5. Track Info
    ctx.textAlign = 'left';
    ctx.font = 'bold 60px Inter, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(user.name, 190, 1250);
    
    ctx.font = '40px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(`ft. ${partner.name}`, 190, 1320);

    // 6. Progress Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    drawRoundedRect(ctx, 190, 1450, 700, 10, 5);
    ctx.fill();
    
    ctx.fillStyle = '#ffffff';
    drawRoundedRect(ctx, 190, 1450, 700, 10, 5); // Full because finished
    ctx.fill();

    ctx.font = '30px Inter, sans-serif';
    ctx.fillText(`0:00`, 190, 1500);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.round(duration)}:00`, 890, 1500);

    // 7. Footer
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fillText('FocusTwin Wrapped', 540, 1750);
  };

  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
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
    <div className="absolute inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md animate-in fade-in pointer-events-auto overflow-y-auto">
      
      {/* --- PREVIEW CARD --- */}
      <div className={`
        relative w-full max-w-[320px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden transition-all duration-500 mb-8 border-4
        ${currentTheme === 'NOIR' ? 'border-zinc-800 bg-zinc-950 text-zinc-100 font-mono grayscale' : ''}
        ${currentTheme === 'NEON' ? 'border-purple-500/50 bg-gradient-to-br from-slate-900 via-indigo-950 to-purple-950 text-white font-sans' : ''}
        ${currentTheme === 'ZEN' ? 'border-stone-200 bg-[#f4f1ea] text-stone-800 font-serif' : ''}
        ${currentTheme === 'AURA' ? 'border-pink-300 bg-gradient-to-tr from-pink-300 via-purple-300 to-indigo-300 text-white font-sans' : ''}
      `}>
        
        {/* NOIR PREVIEW */}
        {currentTheme === 'NOIR' && (
           <div className="flex flex-col items-center justify-center h-full p-6 relative">
             <div className="absolute inset-0 opacity-20 pointer-events-none" style={{backgroundImage: 'radial-gradient(circle, #333 1px, transparent 1px)', backgroundSize: '4px 4px'}}></div>
             <div className="text-xl font-bold border-b-2 border-zinc-100 pb-2 mb-8 tracking-tighter">CASE CLOSED</div>
             <div className="bg-zinc-100 text-black px-4 py-2 text-6xl font-black mb-4">{Math.round(duration)}m</div>
             <div className="text-xs uppercase tracking-widest mb-12">Duration Logged</div>
             <div className="text-sm mt-auto">DET. {user.name.toUpperCase()}</div>
             <div className="mt-8 border-4 border-red-600 text-red-600 px-4 py-1 text-xl font-bold -rotate-12 opacity-80 mb-8">CONFIDENTIAL</div>
           </div>
        )}

        {/* NEON PREVIEW */}
        {currentTheme === 'NEON' && (
           <div className="flex flex-col items-center justify-between h-full p-6 relative">
             <div className="absolute top-[-50px] left-[-50px] w-40 h-40 bg-pink-500/30 blur-3xl rounded-full"></div>
             <div className="mt-8 text-center z-10"><div className="text-sm font-bold text-purple-300 uppercase">Session Complete</div></div>
             <div className="relative z-10 text-center"><div className="text-8xl font-black drop-shadow-lg">{Math.round(duration)}<span className="text-4xl">m</span></div></div>
             <div className="mb-8 z-10 text-center"><div className="bg-emerald-500 text-black font-bold px-4 py-2 rounded-full text-xs">{completedCount} TASKS CRUSHED</div></div>
           </div>
        )}

        {/* ZEN PREVIEW */}
        {currentTheme === 'ZEN' && (
           <div className="flex flex-col items-center h-full p-6 relative">
             <div className="absolute top-24 w-32 h-32 bg-red-500 rounded-full mix-blend-multiply opacity-90"></div>
             <div className="mt-32 relative z-10 text-white text-6xl font-bold drop-shadow-md">{Math.round(duration)}m</div>
             <div className="mt-auto mb-4 border-2 border-red-500 p-2 text-[10px] text-red-500 font-bold leading-tight text-center">FOCUS<br/>TWIN</div>
           </div>
        )}

        {/* AURA PREVIEW (New) */}
        {currentTheme === 'AURA' && (
           <div className="flex flex-col h-full p-6 relative overflow-hidden">
             {/* Abstract blobs */}
             <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-white/20 rounded-full blur-2xl"></div>
             <div className="absolute bottom-[-50px] left-[-50px] w-64 h-64 bg-purple-500/20 rounded-full blur-2xl"></div>
             
             <div className="mt-8 text-white font-bold text-lg tracking-wide">TOP SESSION</div>
             
             <div className="my-auto relative">
                 <div className="w-full aspect-square bg-indigo-950 shadow-2xl flex flex-col items-center justify-center text-center p-4">
                     <div className="text-pink-400 font-black text-8xl">{Math.round(duration)}</div>
                     <div className="text-white font-bold tracking-widest mt-2">MINUTES</div>
                 </div>
             </div>

             <div className="mb-8">
                 <div className="text-2xl font-bold text-white">{user.name}</div>
                 <div className="text-white/70">ft. {partner.name}</div>
                 {/* Progress Bar */}
                 <div className="w-full h-1 bg-white/30 mt-4 rounded-full overflow-hidden">
                     <div className="w-full h-full bg-white"></div>
                 </div>
                 <div className="flex justify-between text-[10px] text-white/70 mt-1 font-mono">
                     <span>0:00</span>
                     <span>{Math.round(duration)}:00</span>
                 </div>
             </div>
           </div>
        )}
      </div>

      {/* --- CONTROLS --- */}
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-slate-400 text-xs font-bold mb-4 text-center uppercase tracking-widest">Select Vibe</h3>
        
        {/* Color Swatches */}
        <div className="flex justify-center gap-4 mb-8">
          <button 
            onClick={() => setCurrentTheme('NOIR')}
            className={`w-12 h-12 rounded-full bg-zinc-900 border-2 transition-all hover:scale-110 ${currentTheme === 'NOIR' ? 'border-white ring-2 ring-zinc-500 scale-110' : 'border-zinc-700'}`}
            title="Detective Noir"
          />
          <button 
            onClick={() => setCurrentTheme('NEON')}
            className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 border-2 transition-all hover:scale-110 ${currentTheme === 'NEON' ? 'border-white ring-2 ring-purple-500 scale-110' : 'border-transparent'}`}
            title="Hyper Flux"
          />
          <button 
            onClick={() => setCurrentTheme('ZEN')}
            className={`w-12 h-12 rounded-full bg-[#f4f1ea] border-2 transition-all hover:scale-110 flex items-center justify-center ${currentTheme === 'ZEN' ? 'border-red-500 ring-2 ring-stone-400 scale-110' : 'border-stone-300'}`}
            title="Kyoto Zen"
          >
             <div className="w-4 h-4 bg-red-500 rounded-full"></div>
          </button>
          <button 
            onClick={() => setCurrentTheme('AURA')}
            className={`w-12 h-12 rounded-full bg-gradient-to-tr from-pink-300 to-indigo-300 border-2 transition-all hover:scale-110 ${currentTheme === 'AURA' ? 'border-white ring-2 ring-pink-400 scale-110' : 'border-transparent'}`}
            title="Aura"
          >
             <Music size={16} className="text-white mx-auto"/>
          </button>
        </div>

        <div className="flex gap-3">
            <Button variant="secondary" onClick={onClose} className="flex-1 py-3 text-xs bg-slate-800 border-transparent hover:bg-slate-700">
                <X size={16} className="mr-2"/> Skip
            </Button>
            
            <Button onClick={handleShare} disabled={isSharing} className="flex-1 py-3 text-xs bg-blue-600 hover:bg-blue-500 border-transparent text-white">
                {isSharing ? 'Sharing...' : <><Share2 size={16} className="mr-2"/> Share</>}
            </Button>

            <Button onClick={handleDownload} className="flex-[2] py-3 text-xs bg-white text-black hover:bg-slate-200 border-transparent font-bold">
                <Download size={16} className="mr-2"/> Save & Close
            </Button>
        </div>
      </div>
    </div>
  );
};
