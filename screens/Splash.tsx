import React, { useEffect, useState, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { Logo } from '../components/Logo';

// --- PART 1: THE BACKGROUND COMPONENT (Internal) ---

const MAX_COLORS = 8;
const hexToRGB = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const GradientBlinds: React.FC<any> = ({
  gradientColors = ['#FF9FFC', '#5227FF'], // Default Pink/Purple
  angle = 0,
  noise = 0.3,
  blindCount = 12,
  spotlightRadius = 0.5,
  spotlightOpacity = 1,
  mouseDampening = 0.15,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const rendererRef = useRef<any>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ alpha: true, antialias: true, dpr: 1 });
    const gl = renderer.gl;
    container.appendChild(gl.canvas);
    gl.canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
    rendererRef.current = renderer;

    const vertex = `attribute vec2 position; attribute vec2 uv; varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position, 0.0, 1.0); }`;
    const fragment = `
      precision mediump float;
      uniform vec3 iResolution; uniform vec2 iMouse; uniform float iTime;
      uniform float uAngle; uniform float uNoise; uniform float uBlindCount;
      uniform float uSpotlightRadius; uniform float uSpotlightOpacity;
      uniform vec3 uColor0; uniform vec3 uColor1;
      varying vec2 vUv;

      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
      vec2 rotate2D(vec2 p, float a){ float c = cos(a); float s = sin(a); return mat2(c, -s, s, c) * p; }

      void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        vec2 p = uv * 2.0 - 1.0;
        p.x *= iResolution.x / iResolution.y;
        vec2 pr = rotate2D(p, uAngle);
        vec2 rotUV = pr * 0.5 + 0.5;

        // Gradient Logic
        vec3 base = mix(uColor0, uColor1, rotUV.x);

        // Spotlight
        vec2 mouse = iMouse.xy / iResolution.xy;
        mouse.y = 1.0 - mouse.y; // Flip Y for OGL
        float d = distance(uv, mouse);
        float spot = (1.0 - smoothstep(0.0, uSpotlightRadius, d)) * uSpotlightOpacity;

        // Blinds pattern
        float stripe = fract(rotUV.x * uBlindCount);
        
        vec3 col = base + vec3(spot) - vec3(stripe * 0.1); // Subtle blind effect
        col += (rand(uv + iTime) - 0.5) * uNoise; // Noise

        gl_FragColor = vec4(col, 1.0);
      }
    `;

    const c0 = hexToRGB(gradientColors[0]);
    const c1 = hexToRGB(gradientColors[1]);

    const program = new Program(gl, {
      vertex,
      fragment,
      uniforms: {
        iResolution: { value: [gl.canvas.width, gl.canvas.height, 1] },
        iMouse: { value: [gl.canvas.width / 2, gl.canvas.height / 2] },
        iTime: { value: 0 },
        uAngle: { value: (angle * Math.PI) / 180 },
        uNoise: { value: noise },
        uBlindCount: { value: blindCount },
        uSpotlightRadius: { value: spotlightRadius },
        uSpotlightOpacity: { value: spotlightOpacity },
        uColor0: { value: c0 },
        uColor1: { value: c1 },
      }
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      program.uniforms.iResolution.value = [gl.canvas.width, gl.canvas.height, 1];
    };
    window.addEventListener('resize', resize);
    resize();

    const onMove = (e: MouseEvent) => {
        // Simple mouse tracking
        mouseTargetRef.current = [e.clientX, e.clientY]; 
    };
    window.addEventListener('mousemove', onMove);

    let lastTime = 0;
    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      program.uniforms.iTime.value = t * 0.001;
      
      // Smooth Mouse
      const dt = (t - lastTime) / 1000;
      lastTime = t;
      const cur = program.uniforms.iMouse.value;
      const target = mouseTargetRef.current;
      // Convert screen coords to canvas coords (roughly)
      const rect = gl.canvas.getBoundingClientRect();
      const tx = target[0] - rect.left;
      const ty = target[1] - rect.top;

      cur[0] += (tx - cur[0]) * 0.1;
      cur[1] += (ty - cur[1]) * 0.1;

      renderer.render({ scene: mesh });
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      if (container.contains(gl.canvas)) container.removeChild(gl.canvas);
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
};

// --- PART 2: THE MAIN SPLASH COMPONENT ---

interface SplashProps {
  onComplete: () => void;
}

export const Splash: React.FC<SplashProps> = ({ onComplete }) => {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 500); // Logo
    const t2 = setTimeout(() => setStage(2), 2000); // Quote 1
    const t3 = setTimeout(() => setStage(3), 3500); // Quote 2
    const t4 = setTimeout(() => onComplete(), 5500); // Finish

    return () => {
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4);
    };
  }, [onComplete]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-black relative overflow-hidden h-screen w-screen">
      
      {/* 1. The Cool Background (Pink #FF9FFC to Purple #5227FF) */}
      <GradientBlinds 
        gradientColors={['#FF9FFC', '#5227FF']} 
        angle={-15} 
        blindCount={8} 
        noise={0.15}
      />
      
      {/* 2. Dark Overlay (so text pops) */}
      <div className="absolute inset-0 bg-black/10 z-0 pointer-events-none"></div>

      {/* 3. The Content */}
      <div className={`relative z-10 transition-all duration-1000 transform ${stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'}`}>
        <div className="mb-8 mx-auto">
           {/* White Logo */}
           <Logo className="w-24 h-24 md:w-32 md:h-32 text-white drop-shadow-2xl" animated={true} />
        </div>
      </div>

      <div className="relative z-10 text-center space-y-4 px-4">
        {/* Quote 1: "Get it done." (White) */}
        <h1 className={`text-4xl md:text-6xl font-black text-white drop-shadow-lg tracking-tight transition-all duration-1000 ${stage >= 2 ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}>
          Get it done.
        </h1>

        {/* Quote 2: "Make it fun." (Matches Background) */}
        <h1 className={`text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF9FFC] to-[#5227FF] drop-shadow-xl tracking-tight transition-all duration-1000 delay-200 ${stage >= 3 ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-95'}`}>
          Make it fun.
        </h1>
      </div>
    </div>
  );
};
