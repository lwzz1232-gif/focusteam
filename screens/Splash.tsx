import React, { useEffect, useState, useRef } from 'react';
import { Renderer, Program, Mesh, Triangle } from 'ogl';
import { Logo } from '../components/Logo';

// --- EXACT GRADIENT BLINDS LOGIC (UNSIMPLIFIED) ---

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

const GradientBlinds: React.FC<any> = ({
  gradientColors = ['#FF9FFC', '#5227FF'],
  angle = 0,
  noise = 0.3,
  blindCount = 12,
  blindMinWidth = 50,
  spotlightRadius = 0.5,
  spotlightSoftness = 1,
  spotlightOpacity = 1,
  mouseDampening = 0.15,
  mirrorGradient = false,
  distortAmount = 0,
  shineDirection = 'left',
  mixBlendMode = 'lighten'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const programRef = useRef<Program | null>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const mouseTargetRef = useRef<[number, number]>([0, 0]);
  const lastTimeRef = useRef<number>(0);
  const firstResizeRef = useRef<boolean>(true);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const renderer = new Renderer({ 
        dpr: window.devicePixelRatio || 1, 
        alpha: true, 
        antialias: true 
    });
    rendererRef.current = renderer;
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
      #ifdef GL_ES
      precision mediump float;
      #endif

      uniform vec3  iResolution;
      uniform vec2  iMouse;
      uniform float iTime;

      uniform float uAngle;
      uniform float uNoise;
      uniform float uBlindCount;
      uniform float uSpotlightRadius;
      uniform float uSpotlightSoftness;
      uniform float uSpotlightOpacity;
      uniform float uMirror;
      uniform float uDistort;
      uniform float uShineFlip;
      uniform vec3  uColor0;
      uniform vec3  uColor1;
      uniform vec3  uColor2;
      uniform vec3  uColor3;
      uniform vec3  uColor4;
      uniform vec3  uColor5;
      uniform vec3  uColor6;
      uniform vec3  uColor7;
      uniform int   uColorCount;

      varying vec2 vUv;

      float rand(vec2 co){
        return fract(sin(dot(co, vec2(12.9898,78.233))) * 43758.5453);
      }

      vec2 rotate2D(vec2 p, float a){
        float c = cos(a);
        float s = sin(a);
        return mat2(c, -s, s, c) * p;
      }

      vec3 getGradientColor(float t){
        float tt = clamp(t, 0.0, 1.0);
        int count = uColorCount;
        if (count < 2) count = 2;
        float scaled = tt * float(count - 1);
        float seg = floor(scaled);
        float f = fract(scaled);

        if (seg < 1.0) return mix(uColor0, uColor1, f);
        if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
        if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
        if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
        if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
        if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
        if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
        return uColor7;
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
          vec2 uv0 = fragCoord.xy / iResolution.xy;
          float aspect = iResolution.x / iResolution.y;
          vec2 p = uv0 * 2.0 - 1.0;
          p.x *= aspect;
          vec2 pr = rotate2D(p, uAngle);
          pr.x /= aspect;
          vec2 uv = pr * 0.5 + 0.5;

          vec2 uvMod = uv;
          if (uDistort > 0.0) {
            float a = uvMod.y * 6.0;
            float b = uvMod.x * 6.0;
            float w = 0.01 * uDistort;
            uvMod.x += sin(a) * w;
            uvMod.y += cos(b) * w;
          }
          float t = uvMod.x;
          if (uMirror > 0.5) {
            t = 1.0 - abs(1.0 - 2.0 * fract(t));
          }
          vec3 base = getGradientColor(t);

          // Spotlight
          vec2 offset = vec2(iMouse.x/iResolution.x, iMouse.y/iResolution.y);
          // Flip Y for OGL coords if needed, but usually iMouse matches CSS coords
          // here we assume iMouse passed is correct canvas coords.
          
          float d = length(uv0 - vec2(offset.x, 1.0 - offset.y)); 
          float r = max(uSpotlightRadius, 1e-4);
          float dn = d / r;
          float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
          vec3 cir = vec3(spot);
          
          float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
          if (uShineFlip > 0.5) stripe = 1.0 - stripe;
          vec3 ran = vec3(stripe);

          vec3 col = cir + base - ran;
          col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

          fragColor = vec4(col, 1.0);
      }

      void main() {
          vec4 color;
          mainImage(color, vUv * iResolution.xy);
          gl_FragColor = color;
      }
    `;

    const { arr: colorArr, count: colorCount } = prepStops(gradientColors);

    const uniforms = {
      iResolution: { value: [gl.drawingBufferWidth, gl.drawingBufferHeight, 1] },
      iMouse: { value: [0, 0] },
      iTime: { value: 0 },
      uAngle: { value: (angle * Math.PI) / 180 },
      uNoise: { value: noise },
      uBlindCount: { value: blindCount },
      uSpotlightRadius: { value: spotlightRadius },
      uSpotlightSoftness: { value: spotlightSoftness },
      uSpotlightOpacity: { value: spotlightOpacity },
      uMirror: { value: mirrorGradient ? 1 : 0 },
      uDistort: { value: distortAmount },
      uShineFlip: { value: shineDirection === 'right' ? 1 : 0 },
      uColor0: { value: colorArr[0] },
      uColor1: { value: colorArr[1] },
      uColor2: { value: colorArr[2] },
      uColor3: { value: colorArr[3] },
      uColor4: { value: colorArr[4] },
      uColor5: { value: colorArr[5] },
      uColor6: { value: colorArr[6] },
      uColor7: { value: colorArr[7] },
      uColorCount: { value: colorCount }
    };

    const program = new Program(gl, { vertex, fragment, uniforms });
    programRef.current = program;

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

    const resize = () => {
      const rect = container.getBoundingClientRect();
      renderer.setSize(rect.width, rect.height);
      program.uniforms.iResolution.value = [gl.drawingBufferWidth, gl.drawingBufferHeight, 1];

      // Dynamic blind count based on width logic
      if (blindMinWidth && blindMinWidth > 0) {
        const maxByMinWidth = Math.max(1, Math.floor(rect.width / blindMinWidth));
        const effective = blindCount ? Math.min(blindCount, maxByMinWidth) : maxByMinWidth;
        program.uniforms.uBlindCount.value = Math.max(1, effective);
      } else {
        program.uniforms.uBlindCount.value = Math.max(1, blindCount);
      }

      if (firstResizeRef.current) {
        firstResizeRef.current = false;
        const cx = gl.drawingBufferWidth / 2;
        const cy = gl.drawingBufferHeight / 2;
        program.uniforms.iMouse.value = [cx, cy];
        mouseTargetRef.current = [cx, cy];
      }
    };
    window.addEventListener('resize', resize);
    resize();

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.devicePixelRatio || 1;
      const x = (e.clientX - rect.left) * scale;
      const y = (e.clientY - rect.top) * scale;
      mouseTargetRef.current = [x, y];
    };
    canvas.addEventListener('pointermove', onPointerMove);

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      program.uniforms.iTime.value = t * 0.001;
      
      // Mouse dampening
      if (mouseDampening > 0) {
        if (!lastTimeRef.current) lastTimeRef.current = t;
        const dt = (t - lastTimeRef.current) / 1000;
        lastTimeRef.current = t;
        const factor = 1 - Math.exp(-dt / Math.max(1e-4, mouseDampening));
        const target = mouseTargetRef.current;
        const cur = program.uniforms.iMouse.value;
        cur[0] += (target[0] - cur[0]) * factor;
        cur[1] += (target[1] - cur[1]) * factor;
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
      canvas.removeEventListener('pointermove', onPointerMove);
      if (container.contains(canvas)) container.removeChild(canvas);
    };
  }, [
    gradientColors, angle, noise, blindCount, blindMinWidth, 
    spotlightRadius, spotlightSoftness, spotlightOpacity, 
    mouseDampening, mirrorGradient, distortAmount, shineDirection
  ]);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', mixBlendMode: mixBlendMode as any }} />;
};

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
            gradientColors={['#FF9FFC', '#5227FF']} // The exact pink/purple you wanted
            angle={0} // Standard horizontal blinds
            noise={0.3} // The exact noise level from your code
            blindCount={12} // The exact count
            blindMinWidth={50}
            spotlightRadius={0.5}
            spotlightSoftness={1}
            spotlightOpacity={1}
            mouseDampening={0.15}
            distortAmount={0}
            shineDirection="left"
            mixBlendMode="normal" // Adjusted to normal so it renders correctly on black
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
        {/* Quote 1 */}
        <h1 className={`text-4xl md:text-6xl font-black text-white drop-shadow-lg tracking-tight transition-all duration-1000 ${stage >= 2 ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'}`}>
          Get it done.
        </h1>

        {/* Quote 2: Matches Background Colors */}
        <h1 className={`text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#FF9FFC] to-[#5227FF] drop-shadow-xl tracking-tight transition-all duration-1000 delay-200 ${stage >= 3 ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-sm scale-95'}`}>
          Make it fun.
        </h1>
      </div>
    </div>
  );
};
