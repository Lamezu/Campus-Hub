import type { SlideConfig } from '../../types';

interface SlideIndicatorProps {
  slides: SlideConfig[];
  current: number;
  onGoTo: (idx: number) => void;
}

export default function SlideIndicator({ slides, current, onGoTo }: SlideIndicatorProps) {
  const progress = ((current + 1) / slides.length) * 100;

  return (
    <>
      <div className="presentation-progress-bar" style={{ width: `${progress}%` }} />

      <nav className="slide-nav" aria-label="Navegación de diapositivas">
        {slides.map((s, i) => (
          <button
            key={s.id}
            className={`slide-nav-dot${i === current ? ' active' : ''}`}
            onClick={() => onGoTo(i)}
            aria-label={`Ir a ${s.label}`}
          >
            <span className="slide-nav-tooltip">{s.num} · {s.label}</span>
          </button>
        ))}
      </nav>

      <div className="slide-counter" aria-live="polite">
        <span className="slide-counter-current">{String(current + 1).padStart(2, '0')}</span>
        <span className="slide-counter-separator"> / </span>
        <span className="slide-counter-total">{String(slides.length).padStart(2, '0')}</span>
      </div>

      <div className="keyboard-hint">
        <kbd>↑</kbd><kbd>↓</kbd><kbd>Space</kbd> para navegar
      </div>
    </>
  );
}
