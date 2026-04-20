import { SLIDES } from './data/slides';
import { useSlideNavigation } from './hooks/useSlideNavigation';
import Background from './components/layout/Background';
import CursorEffect from './components/layout/CursorEffect';
import SlideIndicator from './components/layout/SlideIndicator';

export default function App() {
  const { current, goTo, containerRef } = useSlideNavigation(SLIDES.length);

  return (
    <>
      <CursorEffect />
      <Background />
      <SlideIndicator slides={SLIDES} current={current} onGoTo={goTo} />
      <div ref={containerRef} className="presentation-container">
        {SLIDES.map(({ id, Component }, i) => (
          <Component key={id} isActive={i === current} />
        ))}
      </div>
      <div style={{
        position: 'absolute', bottom: '1.2rem', left: '1.2rem',
        fontSize: '0.65rem', color: 'rgba(255,255,255,0.15)',
        letterSpacing: '0.05em', pointerEvents: 'none', zIndex: 100
      }}>
        © 2025-2026 CAMPUSHUB TEAM · TODOS LOS DERECHOS RESERVADOS
      </div>
    </>
  );
}
