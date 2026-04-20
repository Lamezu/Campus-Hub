import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { GalleryImage } from '../../types';

interface LightboxProps {
  isOpen: boolean;
  onClose: () => void;
  images: GalleryImage[];
}

export default function Lightbox({ isOpen, onClose, images }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isOpen) setCurrentIndex(0);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.stopPropagation();
      e.stopImmediatePropagation();
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isOpen, images.length, onClose]);

  if (!isOpen || images.length === 0) return null;

  const next = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };
  const prev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const current = images[currentIndex];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.9)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <button
          onClick={onClose}
          className="interactive"
          style={{
            position: 'absolute', top: '2rem', right: '2rem',
            background: 'rgba(255,255,255,0.1)', border: 'none',
            borderRadius: '50%', width: 48, height: 48,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', zIndex: 2,
          }}
        >
          <X size={24} />
        </button>

        {images.length > 1 && (
          <button
            onClick={prev}
            className="interactive"
            style={{
              position: 'absolute', left: '2rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 56, height: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', zIndex: 2,
            }}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, scale: 0.9, x: 20 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.9, x: -20 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '80%', maxWidth: 1200, height: '75vh',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            background: current.src ? 'transparent' : (current.placeholderColor || 'rgba(59,130,246,0.1)'),
            borderRadius: '1rem',
            border: current.src ? 'none' : '1px solid rgba(255,255,255,0.1)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {current.src ? (
            <img
              src={current.src}
              alt={current.title}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ textAlign: 'center', color: '#fff' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>📸</div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 600 }}>{current.title}</h3>
              <p style={{ opacity: 0.5, marginTop: '0.5rem' }}>— Inserta la captura real aquí —</p>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ marginTop: '2rem', color: '#fff', fontSize: '1.2rem', fontWeight: 500, textAlign: 'center' }}
        >
          {current.title}
        </motion.div>

        {images.length > 1 && (
          <button
            onClick={next}
            className="interactive"
            style={{
              position: 'absolute', right: '2rem', top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(255,255,255,0.1)', border: 'none',
              borderRadius: '50%', width: 56, height: 56,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', zIndex: 2,
            }}
          >
            <ChevronRight size={32} />
          </button>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
          {images.map((_, idx) => (
            <div
              key={idx}
              style={{
                width: idx === currentIndex ? 24 : 8, height: 8,
                borderRadius: 4,
                background: idx === currentIndex ? 'var(--color-accent)' : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
