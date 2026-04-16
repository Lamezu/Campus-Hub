import { useState, useRef, useEffect, useCallback } from 'react';

export function useIsMobile(breakpoint = 640): boolean {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, [breakpoint]);
  return isMobile;
}

export function useDrag() {
  const [miniPos, setMiniPos] = useState(() => ({ x: window.innerWidth - 300, y: window.innerHeight - 240 }));
  const dragState = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragState.current.active) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const x = Math.max(0, Math.min(dragState.current.originX + clientX - dragState.current.startX, window.innerWidth - 280));
      const y = Math.max(0, Math.min(dragState.current.originY + clientY - dragState.current.startY, window.innerHeight - 200));
      setMiniPos({ x, y });
    };
    const onUp = () => { dragState.current.active = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
  }, []);

  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragState.current = { active: true, startX: clientX, startY: clientY, originX: miniPos.x, originY: miniPos.y };
  }, [miniPos]);

  return { miniPos, onDragStart };
}
