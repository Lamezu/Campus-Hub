import { useState } from 'react';
import { motion } from 'framer-motion';
import { PROBLEMS } from '../../data/problems';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_Y_LARGE } from '../../types';
import type { SlideProps } from '../../types';

export default function SlideProblem({ isActive }: SlideProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  const activeProblem = PROBLEMS[activeIndex];

  return (
    <section className="slide">
      <motion.div
        className="slide-inner"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <motion.span variants={ITEM_VARIANTS_Y_LARGE} className="slide-number">01 — El Desafío</motion.span>
          <motion.h2 variants={ITEM_VARIANTS_Y_LARGE} className="slide-heading" style={{ marginBottom: '0.5rem' }}>¿Por qué CampusHub?</motion.h2>
          <motion.p variants={ITEM_VARIANTS_Y_LARGE} className="slide-subtitle" style={{ maxWidth: 650, margin: '0 auto' }}>
            Identificamos las barreras críticas que frenan el potencial de la comunidad educativa actual.
          </motion.p>
        </div>

        <div className="demo-layout">
          {/* Main Content Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            <motion.div 
              key={activeIndex}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              style={{ 
                height: 340, borderRadius: '1.5rem', overflow: 'hidden', position: 'relative',
                border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)',
                boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 40px ${activeProblem.iconColor}15`
              }}
            >
              <img 
                src={activeProblem.image} 
                alt={activeProblem.title} 
                style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.7) contrast(1.1)' }} 
              />
              <div style={{ 
                position: 'absolute', bottom: 0, left: 0, right: 0, padding: '2rem',
                background: 'linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 100%)'
              }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: 800, color: activeProblem.iconColor, marginBottom: '0.5rem' }}>{activeProblem.title}</h3>
                <p style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{activeProblem.desc}</p>
              </div>
            </motion.div>

            <motion.div variants={ITEM_VARIANTS_Y_LARGE} className="problem-quote glass-panel" style={{ padding: '1.5rem 2.5rem', position: 'relative', background: 'rgba(232,124,30,0.03)', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -10, left: -5, opacity: 0.1, color: '#E87C1E' }}>
                <svg width="120" height="120" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M14.017 21L14.017 18C14.017 16.8954 14.9124 16 16.017 16H19.017C20.1216 16 21.017 16.8954 21.017 18V21C21.017 22.1046 20.1216 23 19.017 23H16.017C14.9124 23 14.017 22.1046 14.017 21ZM14.017 21C14.017 12.5 16.017 1 20.017 1L21.017 3C18.017 3 17.017 11 17.017 13H21.017V16H17.017C15.3601 16 14.017 17.3431 14.017 19V21ZM3.01691 21L3.01691 18C3.01691 16.8954 3.91234 16 5.01691 16H8.01691C9.12148 16 10.0169 16.8954 10.0169 18V21C10.0169 22.1046 9.12148 23 8.01691 23H5.01691C3.91234 23 3.01691 22.1046 3.01691 21ZM3.01691 21C3.01691 12.5 5.01691 1 9.01691 1L10.0169 3C7.01691 3 6.01691 11 6.01691 13H10.0169V16H6.01691C4.36 16 3.01691 17.3431 3.01691 19V21Z" />
                </svg>
              </div>
              <p style={{ position: 'relative', zIndex: 1, fontSize: '0.95rem', color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', lineHeight: 1.7 }}>
                "La saturación de plataformas y la falta de canales directos genera una desconexión emocional y operativa entre el centro, los docentes y las familias."
              </p>
            </motion.div>
          </div>

          {/* Selector Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {PROBLEMS.map((p, i) => (
              <motion.div 
                key={i} 
                variants={ITEM_VARIANTS_Y_LARGE}
                onClick={() => setActiveIndex(i)}
                className={`problem-card glass-panel ${i === activeIndex ? 'active' : ''}`}
                style={{ 
                  cursor: 'url("/assets/custom_pointer.png") 16 0, pointer',
                  padding: '1.2rem',
                  borderColor: i === activeIndex ? p.iconColor : 'rgba(255,255,255,0.1)',
                  background: i === activeIndex ? `${p.iconColor}08` : 'rgba(0,0,0,0.3)',
                  opacity: i === activeIndex ? 1 : 0.6,
                  transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
                whileHover={{ scale: 1.02, opacity: 1, background: `${p.iconColor}05` }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div className={`problem-icon ${p.colorClass}`} style={{ width: 40, height: 40, borderRadius: 10 }}>
                    <p.Icon size={20} color={p.iconColor} strokeWidth={1.5} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: i === activeIndex ? '#fff' : 'rgba(255,255,255,0.6)' }}>{p.title}</h4>
                  </div>
                </div>
              </motion.div>
            ))}


          </div>
        </div>
      </motion.div>
    </section>
  );
}
