import { useEffect, useRef, useState } from 'react';
import type { Particle } from '../types';

export function useCursorEffect() {
  const [isMobile, setIsMobile] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const coords = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number>(0);
  const particles = useRef<Particle[]>([]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) {
      document.body.style.cursor = 'auto';
      return;
    }

    document.body.style.cursor = "url('/assets/custom_cursor.png') 4 4, auto";

    const handleMouseMove = (e: MouseEvent) => {
      coords.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      const colors = ['#FF6B00', '#FF8E3C', '#E87C1E', '#FFD580', '#FFFFFF'];
      for (let i = 0; i < 25; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 5.5;
        particles.current.push({
          x: e.clientX, y: e.clientY,
          lastX: e.clientX, lastY: e.clientY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 400 + Math.random() * 600,
          maxLife: 1000,
          size: 2.2 + Math.random() * 3.5,
          color: colors[Math.floor(Math.random() * colors.length)],
          rot: Math.random() * Math.PI,
          rotSpeed: (Math.random() - 0.5) * 0.2,
          shape: Math.random() > 0.4 ? 'star' : 'circle',
        });
      }
    };

    const drawStar = (
      ctx: CanvasRenderingContext2D,
      cx: number, cy: number,
      spikes: number, outerRadius: number, innerRadius: number, rot: number,
    ) => {
      const step = Math.PI / spikes;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * innerRadius, cy + Math.sin(rot) * innerRadius);
        rot += step;
      }
      ctx.lineTo(cx + Math.cos(rot) * outerRadius, cy + Math.sin(rot) * outerRadius);
      ctx.closePath();
    };

    const drawParticles = (ctx: CanvasRenderingContext2D) => {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      for (let i = particles.current.length - 1; i >= 0; i--) {
        const p = particles.current[i];
        p.life -= 16.6;
        if (p.life <= 0) { particles.current.splice(i, 1); continue; }
        p.lastX = p.x; p.lastY = p.y;
        p.x += p.vx; p.y += p.vy;
        p.rot += p.rotSpeed;
        p.vx *= 0.94; p.vy *= 0.94;
        const lifeRatio = p.life / p.maxLife;
        const opacity = Math.max(0, lifeRatio);
        ctx.shadowBlur = p.shape === 'circle' ? 12 : 5;
        ctx.shadowColor = p.color;
        ctx.fillStyle = p.color;
        ctx.globalAlpha = opacity;
        if (p.shape === 'star') {
          drawStar(ctx, p.x, p.y, 4, p.size * 1.5, p.size * 0.4, p.rot);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = '#FFFFFF';
          ctx.globalAlpha = opacity * 0.9;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    };

    const render = () => {
      const dx = coords.current.x - lastPos.current.x;
      const dy = coords.current.y - lastPos.current.y;
      const moveDist = Math.sqrt(dx * dx + dy * dy);
      if (moveDist > 2) {
        const moveAngle = Math.atan2(dy, dx);
        const exhaustAngle = moveAngle + Math.PI;
        const steps = Math.max(1, Math.floor(moveDist / 4.5)); // Increased density back to a sweet spot
        const colors = ['#FF6B00', '#FF8E3C', '#E87C1E', '#FFD580', '#FFFFFF'];
        
        // Calculate perpendicular vector for lateral spread
        const perpX = -dy / moveDist;
        const perpY = dx / moveDist;

        for (let i = 0; i < steps; i++) {
          const interX = lastPos.current.x + (dx * (i / steps));
          const interY = lastPos.current.y + (dy * (i / steps));
          
          // Velocity mostly backwards, with significant lateral spread
          const spreadFactor = (Math.random() - 0.5) * 2.5;
          const driftSpeed = 0.4 + Math.random() * 1.5;
          
          particles.current.push({
            x: interX,
            y: interY,
            lastX: interX, lastY: interY,
            // vX/vY: combination of backward "exhaust" and lateral "drift"
            vx: (Math.cos(exhaustAngle) * driftSpeed) + (perpX * spreadFactor * 1.6),
            vy: (Math.sin(exhaustAngle) * driftSpeed) + (perpY * spreadFactor * 1.6),
            life: 350 + Math.random() * 500, // Slightly more life than 700ms max
            maxLife: 850,
            size: 1.1 + Math.random() * 2.2,
            color: colors[Math.floor(Math.random() * colors.length)],
            rot: Math.random() * Math.PI,
            rotSpeed: (Math.random() - 0.5) * 0.04,
            shape: Math.random() > 0.4 ? 'star' : 'circle',
          });
        }
        lastPos.current = { ...coords.current };
      }
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) drawParticles(ctx);
      }
      animationFrameId.current = requestAnimationFrame(render);
    };

    const resizeCanvas = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    animationFrameId.current = requestAnimationFrame(render);

    return () => {
      document.body.style.cursor = 'auto';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('resize', resizeCanvas);
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [isMobile]);

  return { canvasRef, isMobile };
}
