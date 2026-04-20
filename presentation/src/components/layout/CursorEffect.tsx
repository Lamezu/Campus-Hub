import { useCursorEffect } from '../../hooks/useCursorEffect';

export default function CursorEffect() {
  const { canvasRef, isMobile } = useCursorEffect();
  if (isMobile) return null;
  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 999999,
        width: '100vw',
        height: '100vh',
      }}
    />
  );
}
