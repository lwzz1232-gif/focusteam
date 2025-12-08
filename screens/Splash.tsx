import React, { useEffect, useState, useRef, memo } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { Logo } from '../components/Logo';

// --- PART 1: THE BACKGROUND LOGIC ---

const MAX_COLORS = 8;
const hexToRGB = (hex: string): [number, number, number] => {
  const c = hex.replace('#', '').padEnd(6, '0');
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  return [r, g, b];
};

const prepStops = (stops?: string[]) => {
  const base = (stops && stops.length ? stops : ['#FF9FFC', '#5227FF']).slice(0, MAX_COLORS);
  if (base.length === 1) base.push(base[0]);
  while (base.length < MAX_COLORS) base.push(base[base.length - 1]);
  const arr: [number, number, number][] = [];
  for (let i = 0; i < MAX_COLORS; i++) arr.push(hexToRGB(base[i]));
  const count = Math.max(2, Math.min(MAX_COLORS, stops?.length ?? 2));
  return { arr, count };
};

// We wrap this in React.memo to prevent it from resetting when the text changes
const GradientBlinds = memo(({
  gradientColors = ['#FF9FFC', '#5227FF'],
  angle = 0,
  noise = 0.3,
  blindCount = 12,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  mouseDampening = 0.15,
}: any) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const mouseTargetRef = useRef<[number, number]>([0.5, 0.5]); // Start center
  const currentMouseRef = useRef<[number, number]>([0.5, 0.5]);
  const lastTimeRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ 
        dpr: Math.min(window.devicePixelRatio, 2), 
        alpha: true, 
        antialias: true 
    });
    const gl = renderer.gl;
    const canvas = gl.canvas;

    canvas.style.cssText = 'width: 100%; height: 100%; display: block;';
    container.appendChild(canvas);

    const vertex = `
      attribute vec2 position;
      attribute vec2 uv;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    const fragment = `
      precision mediump float;
      uniform vec3  iResolution;
      uniform vec2  iMouse; // 0.0 to 1.0 normalized
      uniform float iTime;
      uniform float uAngle;
      uniform float uNoise;
      uniform float uBlindCount;
      uniform float uSpotlightRadius;
      uniform float uSpotlightSoftness;
      uniform float uSpotlightOpacity;
      uniform vec3  uColor0;
      uniform vec3  uColor1;
      
      varying vec2 vUv;

      float rand(vec2 co){ return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453); }
      vec2 rotate2D(vec2 p, float a){ float c = cos(a); float s = sin(a); return mat2(c, -s, s, c) * p; }

      void main() {
          vec2 uv0 = gl_FragCoord.xy / iResolution.xy;
          float aspect = iResolution.x / iResolution.y;
          
          // Rotation logic for blinds
          vec2 p = uv0 * 2.0 - 1.0;
          p.x *= aspect;
          vec2 pr = rotate2D(p, uAngle);
          pr.x /= aspect;
          vec2 uv = pr * 0.5 + 0.5;

          // Gradient
          vec3 base = mix(uColor0, uColor1, uv.x);

          // Spotlight Logic (using normalized iMouse 0-1)
          // We must correct mouse Y because GL coords are bottom-up
          vec2 mousePos = iMouse;
          mousePos.y = 1.0 - mousePos.y; 
          
          float d = distance(uv0, vec2(mousePos.x, 1.0 - mousePos.y));
          
          // Fix Aspect Ratio distortion for spotlight circle
          vec2 distVec = (uv0 - vec2(mousePos.x, 1.0 - mousePos.y));
          distVec.x *= aspect;
          float dist = length(distVec);

          float spot = (1.0 - smoothstep(0.0, uSpotlightRadius, dist)) * uSpotlightOpacity;
          
          // Blinds
          float stripe = fract(uv.x * uBlindCount);
          vec3 col = base + vec3(spot * 0.5) - vec3(stripe * 0.15); // increased contrast
          
          // Noise
          col += (rand(uv0 + iTime) - 0.5) * uNoise;

          gl_FragColor = vec4(col, 1.0);
      }
    `;

    const { arr: colorArr } = prepStops(gradientColors);

    const program = new Program(gl, { 
      vertex, 
      fragment, 
      uniforms: {
        iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
        iMouse: { value: [0.5, 0.5] },
        iTime: { value: 0 },
        uAngle: { value: (angle * Math.PI) / 180 },
        uNoise: { value: noise },
        uBlindCount: { value: blindCount },
        uSpotlightRadius: { value: spotlightRadius },
        uSpotlightSoftness: { value: spotlightSoftness },
        uSpotlightOpacity: { value: spotlightOpacity },
        uColor0: { value: colorArr[0] },
        uColor1: { value: colorArr[1] },
      }
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      renderer.setSize(container.offsetWidth, container.offsetHeight);
      program.uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];
    };
    window.addEventListener('resize', resize);
    resize();

    const onPointerMove = (e: MouseEvent) => {
      // Normalize mouse to 0.0 - 1.0 immediately to avoid pixel scale issues
      const x = e.clientX / window.innerWidth;
      const y = e.clientY / window.innerHeight;
      mouseTargetRef.current = [x, y];
    };
    window.addEventListener('mousemove', onPointerMove);

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      program.uniforms.iTime.value = t * 0.001;
      
      // Smooth Dampening
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = t;
        const dt = (t - lastTimeRef.current) / 1000;
        lastTimeRef.current = t;
        
        const factor = 1 - Math.exp(-dt / 0.05); // Faster response time
        const target = mouseTargetRef.current;
        const cur = currentMouseRef.current;
        
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
        
        program.uniforms.iMouse.value = cur;
      } else {
        lastTimeRef.current = t;
        program.uniforms.iMouse.value = mouseTargetRef.current;
      }

      renderer.render({ scene: mesh });
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onPointerMove);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, []); // Empty dependency array = Runs once and never resets!

  return <div ref={containerRef} className="absolute inset-0 z-0" />;
});

// --- SPLASH COMPONENT ---

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
      
      {/* 1. Background Container */}
      <div className="absolute inset-0 z-0">
         <GradientBlinds
            gradientColors={['#E062F9', '#3B15E6']} // Slightly deeper Pink/Purple for contrast
            angle={0}
            noise={0.15} // Reduced noise for cleaner look
            blindCount={12}
            spotlightRadius={0.4}
            spotlightOpacity={0.8}
            mouseDampening={0.1}
         />
      </div>

      {/* 2. Content */}
      <div className={`relative z-10 transition-all duration-1000 transform ${stage >= 1 ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-90'}`}>
        <div className="mb-8 mx-auto">
           {/* Logo White */}
           <Logo className="w-24 h-24 md:w-32 md:h-32 text-white drop-shadow-2xl" animated={true} />
        </div>
      </div>

      <div className="relative z-10 text-center space-y-4 px-4">
        {/* Quote 1: "Get it done." (White) */}
        <h1 className={`text-4xl md:text-6xl font-black text-white drop-shadow-xl tracking-tight transition-all duration-1000 ${stage >= 2 ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}>
          Get it done.
        </h1>

        {/* Quote 2: Improved Gradient to POP against the background */}
        <h1 className={`text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-purple-300 drop-shadow-2xl tracking-tight transition-all duration-1000 delay-200 ${stage >= 3 ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-95'}`}>
          Make it fun.
        </h1>
      </div>
    </div>
  );
};
