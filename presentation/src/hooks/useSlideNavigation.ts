import { useState, useEffect, useRef, useCallback } from 'react';

export function useSlideNavigation(total: number) {
  const [current, setCurrent] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);

  const goTo = useCallback((idx: number) => {
    const target = Math.max(0, Math.min(idx, total - 1));
    if (target === current) return;
    programmaticRef.current = true;
    setCurrent(target);
    const child = containerRef.current?.children[target] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => { programmaticRef.current = false; }, 900);
  }, [current, total]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (['ArrowDown', ' ', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        goTo(current + 1);
      } else if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
        e.preventDefault();
        goTo(current - 1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(total - 1);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [current, goTo, total]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      if (programmaticRef.current) return;
      const idx = Math.round(el.scrollTop / el.clientHeight);
      if (idx >= 0 && idx < total) setCurrent(idx);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [total]);

  return { current, goTo, containerRef };
}
