import React, { useState, useEffect } from 'react';
import { Download, X, Share2, Music, Search, Zap, Flower2, CloudSun, Box } from 'lucide-react';
import { User, Partner, TodoItem } from '../types';
import * as THREE from 'three';

interface SessionRecapProps {
  user: User;
  partner: Partner;
  duration: number;
  tasks: TodoItem[];
  onClose: () => void;
}

type Theme = 'NOIR' | 'NEON' | 'ZEN' | 'AURA' | 'GHIBLI' | 'QUANTUM';

export const SessionRecap: React.FC<SessionRecapProps> = ({ user, partner, duration, tasks, onClose }) => {
  // --- STATE ---
  const [currentTheme, setCurrentTheme] = useState<Theme>('NEON');
  const [isSharing, setIsSharing] = useState(false);
  const [neonVariant, setNeonVariant] = useState(0); // 0, 1, or 2
  const [previewUrl, setPreviewUrl] = useState<string>('');
  
  const completedCount = tasks.filter(t => t.completed).length;

  // --- 1. RANDOMIZE NEON VARIANT ON MOUNT ---
  useEffect(() => {
    setNeonVariant(Math.floor(Math.random() * 3));
  }, []);

  // --- 2. GENERATE LIVE PREVIEW ---
  useEffect(() => {
    const timer = setTimeout(() => {
      ().then(canvas => {
        if (canvas) setPreviewUrl(canvas.toDataURL());
      });
    }, 100);
    return () => clearTimeout(timer);
  }, [currentTheme, neonVariant, user, partner, duration, completedCount]);

  // --- CANVAS GENERATOR ---
  const  = async (): Promise<HTMLCanvasElement | null> => {
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
    else drawNeonTheme(ctx); // Calls the router
     else if (currentTheme === 'AURA') drawAuraTheme(ctx);
    else if (currentTheme === 'GHIBLI') drawGhibliTheme(ctx); // ADD THIS
    else if (currentTheme === 'QUANTUM') await drawQuantumTheme(ctx); // ADD THIS (Note the await)
    else drawNeonTheme(ctx); 
    return canvas;
  };

  // --- HANDLERS ---
  const handleDownload = async () => {
    const canvas = await ();
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `FocusTwin_${currentTheme}_${new Date().toISOString().slice(0,10)}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    setTimeout(() => onClose(), 1000);
  };

  const handleShare = async () => {
    setIsSharing(true);
    const canvas = await ();
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

  // --- THEME 1: NOIR ---
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

  // --- THEME 2: NEON (ROUTER) ---
  const drawNeonTheme = (ctx: CanvasRenderingContext2D) => {
    if (neonVariant === 0) drawNeonCard(ctx);
    else if (neonVariant === 1) drawNeonRing(ctx);
    else drawNeonTypo(ctx);
  };

  // NEON VARIATION A: CARD
  const drawNeonCard = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 1080, 1920);
    const topGlow = ctx.createRadialGradient(1080, 0, 0, 1080, 0, 900); topGlow.addColorStop(0, 'rgba(99, 102, 241, 0.4)'); topGlow.addColorStop(1, 'transparent'); ctx.fillStyle = topGlow; ctx.fillRect(0,0,1080,1920);
    const botGlow = ctx.createRadialGradient(0, 1920, 0, 0, 1920, 900); botGlow.addColorStop(0, 'rgba(236, 72, 153, 0.4)'); botGlow.addColorStop(1, 'transparent'); ctx.fillStyle = botGlow; ctx.fillRect(0,0,1080,1920);
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 60; ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'; ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; ctx.lineWidth = 3;
    drawRoundedRect(ctx, 140, 460, 800, 1000, 60); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.font = 'bold 320px Inter, sans-serif'; 
    const numGrad = ctx.createLinearGradient(140, 700, 940, 900); numGrad.addColorStop(0, '#ffffff'); numGrad.addColorStop(1, '#94a3b8'); ctx.fillStyle = numGrad; ctx.fillText(`${Math.round(duration)}`, 540, 950);
    ctx.fillStyle = '#94a3b8'; ctx.font = '500 50px Inter, sans-serif'; ctx.letterSpacing = '10px'; ctx.fillText('MINUTES FOCUSED', 540, 1050);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(340, 1150); ctx.lineTo(740, 1150); ctx.stroke();
    ctx.font = '40px Inter, sans-serif'; ctx.fillStyle = '#cbd5e1'; ctx.letterSpacing = '0px'; ctx.fillText(`with ${partner.name}`, 540, 1230);
    ctx.font = 'bold 80px Inter, sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText('FocusTwin.', 540, 1700);
  };

  // NEON VARIATION B: RING
  const drawNeonRing = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.lineWidth = 60; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e1b4b'; ctx.beginPath(); ctx.arc(540, 800, 350, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#4ade80'; ctx.shadowColor = '#4ade80'; ctx.shadowBlur = 40; ctx.beginPath(); ctx.arc(540, 800, 350, -Math.PI / 2, Math.PI * 1); ctx.stroke(); ctx.shadowBlur = 0;
    ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 240px Inter, sans-serif'; ctx.fillText(`${Math.round(duration)}`, 540, 850);
    ctx.font = '50px Inter, sans-serif'; ctx.fillStyle = '#4ade80'; ctx.fillText('MINUTES', 540, 940);
    ctx.textAlign = 'left'; ctx.fillStyle = '#333'; ctx.fillRect(140, 1300, 380, 250); ctx.fillStyle = '#333'; ctx.fillRect(560, 1300, 380, 250);
    ctx.fillStyle = '#9ca3af'; ctx.font = '40px Inter, sans-serif'; ctx.fillText('PARTNER', 180, 1370); ctx.fillText('TASKS', 600, 1370);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillText(partner.name.substring(0,8), 180, 1460); ctx.fillText(`${completedCount} Done`, 600, 1460);
    ctx.textAlign = 'center'; ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('FocusTwin Activity', 540, 200);
  };

  // NEON VARIATION C: TYPOGRAPHY
  const drawNeonTypo = (ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#4c0519'; ctx.fillRect(0, 0, 1080, 1920);
    ctx.font = 'bold 400px Inter, sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.textAlign = 'center';
    ctx.fillText('FOCUS', 540, 400); ctx.fillText('MODE', 540, 700); ctx.fillText('ON', 540, 1000);
    ctx.fillStyle = '#f43f5e'; ctx.beginPath(); ctx.arc(540, 960, 400, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 350px Inter, sans-serif'; ctx.fillText(`${Math.round(duration)}`, 540, 1050);
    ctx.font = 'bold 60px Inter, sans-serif'; ctx.fillText('MINUTES LOCKED IN', 540, 1150);
    ctx.fillStyle = '#fff'; ctx.fillRect(240, 1500, 600, 120);
    ctx.fillStyle = '#000'; ctx.font = 'bold 50px Inter, sans-serif'; ctx.fillText(`Partner: ${partner.name}`, 540, 1580);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 50px Inter, sans-serif'; ctx.fillText('#FocusTwin', 540, 1800);
  };

  // --- THEME 3: ZEN ---
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

  // --- THEME 4: AURA ---
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

// --- THEME 5: GHIBLI (Anime Aesthetic) ---
  const drawGhibliTheme = (ctx: CanvasRenderingContext2D) => {
    // 1. Anime Sky Gradient
    const sky = ctx.createLinearGradient(0, 0, 0, 1920);
    sky.addColorStop(0, '#3b82f6'); // Deep Blue
    sky.addColorStop(0.6, '#93c5fd'); // Light Blue
    sky.addColorStop(1, '#e0f2fe'); // White-ish horizon
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Procedural Fluffy Clouds
    const drawCloud = (cx: number, cy: number, scale: number) => {
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.8)';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(cx, cy, 60 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 50 * scale, cy - 20 * scale, 70 * scale, 0, Math.PI * 2);
        ctx.arc(cx + 90 * scale, cy, 60 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    };
    
    // Draw background clouds
    drawCloud(200, 400, 1.5);
    drawCloud(800, 600, 2.0);
    drawCloud(500, 200, 1.2);

    // 3. Grassy Hill
    ctx.fillStyle = '#4ade80'; // Bright Anime Green
    ctx.beginPath();
    ctx.moveTo(0, 1920);
    ctx.lineTo(0, 1400);
    ctx.bezierCurveTo(300, 1350, 700, 1250, 1080, 1450); // Rolling hill curve
    ctx.lineTo(1080, 1920);
    ctx.fill();
    
    // Hill Shadow/Texture
    ctx.fillStyle = 'rgba(21, 128, 61, 0.1)';
    ctx.fillRect(0, 1400, 1080, 520);

    // 4. "Soot Sprites" (Little cute black dots)
    const drawSoot = (x: number, y: number) => {
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(x, y, 20, 0, Math.PI*2); ctx.fill(); // Body
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x-5, y-5, 6, 0, Math.PI*2); ctx.fill(); // Left Eye
        ctx.beginPath(); ctx.arc(x+5, y-5, 6, 0, Math.PI*2); ctx.fill(); // Right Eye
        ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.arc(x-5, y-5, 2, 0, Math.PI*2); ctx.fill(); // Pupil
        ctx.beginPath(); ctx.arc(x+5, y-5, 2, 0, Math.PI*2); ctx.fill(); // Pupil
    };
    drawSoot(200, 1500); drawSoot(230, 1480); drawSoot(260, 1510);
    
    // 5. Typography
    ctx.textAlign = 'center';
    ctx.fillStyle = '#1e3a8a';
    ctx.font = 'bold 60px serif'; 
    ctx.fillText("The Wind Rises...", 540, 300);
    
    ctx.fillStyle = '#fff';
    ctx.font = '900 300px serif';
    ctx.shadowColor = 'rgba(0,0,0,0.1)'; ctx.shadowOffsetX = 10; ctx.shadowOffsetY = 10;
    ctx.fillText(`${Math.round(duration)}`, 540, 900);
    ctx.shadowColor = 'transparent';
    
    ctx.font = 'italic 50px serif';
    ctx.fillStyle = '#1e3a8a';
    ctx.fillText("minutes of journey", 540, 1000);

    // Card Info
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.roundRect(140, 1100, 800, 200, 20);
    ctx.fill();
    
    ctx.fillStyle = '#1e3a8a';
    ctx.font = '40px sans-serif';
    ctx.fillText(`Traveler: ${user.name}`, 540, 1180);
    ctx.fillText(`Companion: ${partner.name}`, 540, 1240);
  };
// --- THEME 6: QUANTUM (Three.js 3D Render) ---
  const drawQuantumTheme = async (ctx: CanvasRenderingContext2D) => {
    // 1. Background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, 1080, 1920);

    // 2. Setup Temporary Three.js Scene
    const width = 1080; 
    const height = 1920;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.z = 5;

    const renderer = new THREE.WebGLRenderer({ alpha: true, preserveDrawingBuffer: true });
    renderer.setSize(width, height);

    // 3. Create 3D Object (Icosahedron Wireframe)
    const geometry = new THREE.IcosahedronGeometry(2.5, 1);
    const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ffff, 
        wireframe: true, 
        transparent: true, 
        opacity: 0.8 
    });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    // Inner glowing core
    const coreGeo = new THREE.IcosahedronGeometry(1.5, 0);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xff00ff, wireframe: true });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // Particles
    const particlesGeo = new THREE.BufferGeometry();
    const particleCount = 200;
    const posArray = new Float32Array(particleCount * 3);
    for(let i = 0; i < particleCount * 3; i++) {
        posArray[i] = (Math.random() - 0.5) * 15;
    }
    particlesGeo.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
    const particlesMat = new THREE.PointsMaterial({ size: 0.05, color: 0xffffff });
    const particlesMesh = new THREE.Points(particlesGeo, particlesMat);
    scene.add(particlesMesh);

    // 4. Random Rotation based on duration (so it's unique every time)
    sphere.rotation.x = Math.random() * Math.PI;
    sphere.rotation.y = Math.random() * Math.PI;
    core.rotation.x = -sphere.rotation.x;

    // 5. Render to Image
    renderer.render(scene, camera);
    const dataURL = renderer.domElement.toDataURL('image/png');
    
    // 6. Draw 3D Image onto 2D Canvas
    const img = new Image();
    img.src = dataURL;
    await new Promise(r => { img.onload = r; });
    ctx.drawImage(img, 0, 0);

    // Cleanup Three.js
    renderer.dispose();
    geometry.dispose();
    material.dispose();

    // 7. Overlay HUD Text (Cyberpunk Style)
    ctx.font = 'bold 100px "Courier New", monospace';
    ctx.fillStyle = '#00ffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#00ffff'; ctx.shadowBlur = 20;
    ctx.fillText("QUANTUM SYNC", 540, 300);
    
    ctx.font = 'bold 300px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff00ff'; ctx.shadowBlur = 40;
    ctx.fillText(`${Math.round(duration)}`, 540, 950);
    
    ctx.shadowBlur = 0;
    ctx.font = '40px "Courier New", monospace';
    ctx.fillStyle = '#00ffff';
    ctx.fillText(`// PROTOCOL: COMPLETE`, 540, 1100);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`USER: ${user.name}`, 540, 1600);
    ctx.fillText(`LINK: ${partner.name}`, 540, 1660);
    
    // Draw Border
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(50, 50, 980, 1820);
  };
  
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
  };

  // --- STYLES ---
  const getThemeStyles = () => {
    switch (currentTheme) {
        case 'NOIR': return { bg: 'bg-zinc-950', accent: 'text-white', ring: 'ring-zinc-500', button: 'bg-white text-black' };
        case 'ZEN':  return { bg: 'bg-[#e5e0d5]', accent: 'text-stone-800', ring: 'ring-stone-400', button: 'bg-stone-800 text-[#e5e0d5]' };
        case 'AURA': return { bg: 'bg-pink-950', accent: 'text-pink-200', ring: 'ring-pink-400', button: 'bg-pink-500 text-white' };
        case 'GHIBLI': return { bg: 'bg-sky-200', accent: 'text-blue-600', ring: 'ring-blue-400', button: 'bg-blue-500 text-white' };
        case 'QUANTUM': return { bg: 'bg-black', accent: 'text-cyan-400', ring: 'ring-cyan-400', button: 'bg-cyan-600 text-black' };
        default:     return { bg: 'bg-slate-950', accent: 'text-cyan-400', ring: 'ring-purple-500', button: 'bg-cyan-400 text-black' };
    }
  };
  const themeStyle = getThemeStyles();

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 transition-colors duration-700 ${themeStyle.bg}`}>
      
      <button 
        onClick={onClose}
        className={`absolute top-6 right-6 p-2 rounded-full backdrop-blur-md bg-black/20 hover:bg-black/40 transition-all ${themeStyle.accent}`}
      >
        <X size={24} />
      </button>

      {/* MAIN CARD WITH PREVIEW */}
      <div className="relative w-full max-w-[360px] aspect-[9/16] rounded-3xl shadow-2xl overflow-hidden transition-all duration-500 mb-8 border-4 border-white/10 animate-in zoom-in-95 duration-500 bg-slate-900">
         {previewUrl ? (
             <img src={previewUrl} alt="Session Preview" className="w-full h-full object-contain" />
         ) : (
             <div className="flex items-center justify-center h-full text-white/50 animate-pulse">Generating Preview...</div>
         )}
      </div>

      <div className="w-full max-w-md bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-2 flex flex-col gap-4 shadow-2xl">
        <div className="flex justify-between items-center px-4 py-2">
            {[
                { id: 'NOIR', icon: <Search size={16}/>, label: 'Noir' },
                { id: 'NEON', icon: <Zap size={16}/>, label: 'Neon' },
                { id: 'ZEN', icon: <Flower2 size={16}/>, label: 'Zen' },
                { id: 'AURA', icon: <Music size={16}/>, label: 'Aura' },
                { id: 'GHIBLI', icon: <CloudSun size={16}/>, label: 'Ghibli' },
                { id: 'QUANTUM', icon: <Box size={16}/>, label: '3D' },
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
