import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Activity, Clock, Settings, GitBranch, Share2 } from 'lucide-react';
import { SPRINTS, PLANNING_METRICS } from '../../data/sprints';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_Y_SMALL } from '../../types';
import type { SlideProps } from '../../types';

export default function SlidePlanning({ isActive }: SlideProps) {
  const [activeSprint, setActiveSprint] = useState(SPRINTS.length - 1);

  return (
    <section className="slide">
      <motion.div
        className="slide-inner"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
        style={{ maxWidth: 1200, width: '100%', display: 'flex', flexDirection: 'column' }}
      >
        <div style={{ textAlign: 'left', marginBottom: '1.2rem' }}>
          <motion.span variants={ITEM_VARIANTS_Y_SMALL} className="slide-number">03 — Planificación</motion.span>
          <motion.h2 variants={ITEM_VARIANTS_Y_SMALL} className="slide-heading" style={{ fontSize: '2.4rem', marginBottom: '0.2rem' }}>Metodología Ágil</motion.h2>
          <motion.p variants={ITEM_VARIANTS_Y_SMALL} className="slide-subtitle" style={{ fontSize: '0.95rem' }}>
            Ciclos de desarrollo (Sprints) para un crecimiento iterativo y controlado.
          </motion.p>
        </div>

        <div className="planning-container" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', flex: 1 }}>
          {/* Sidebar: Sprints + Metrics */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {/* Sprints List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {SPRINTS.map((s, i) => (
                <motion.div
                  key={i}
                  variants={ITEM_VARIANTS_Y_SMALL}
                  onClick={() => setActiveSprint(i)}
                  className={`sprint-card-interactive ${activeSprint === i ? 'active' : ''}`}
                  style={{
                    padding: '0.8rem 1.2rem',
                    borderRadius: '10px',
                    background: activeSprint === i ? 'rgba(255,165,0,0.1)' : 'rgba(255,255,255,0.02)',
                    border: '1px solid',
                    borderColor: activeSprint === i ? 'rgba(255,165,0,0.3)' : 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: 28, height: 28, borderRadius: 6, 
                      background: activeSprint === i ? '#E87C1E' : 'rgba(255,255,255,0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: activeSprint === i ? '#000' : '#666',
                      fontSize: '0.7rem', fontWeight: 800
                    }}>
                      {i}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: activeSprint === i ? '#fff' : '#aaa' }}>{s.num}</div>
                      <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.1rem' }}>{s.text.split(',')[0]}</div>
                    </div>
                  </div>
                  {activeSprint === i && (
                    <motion.div layoutId="sprint-arrow">
                      <ChevronRight size={14} color="#E87C1E" />
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Sidebar Metrics - Compacted here to save bottom space */}
            <div style={{ 
              marginTop: 'auto', padding: '1.2rem', borderRadius: '12px',
              background: 'rgba(255,165,0,0.03)', border: '1px solid rgba(255,165,0,0.08)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem'
            }}>
              {PLANNING_METRICS.map((m, i) => (
                <div key={i}>
                  <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.1rem' }}>{m.label}</div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#E87C1E' }}>{m.val}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Details Panel - More space now */}
          <div style={{ position: 'relative' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSprint}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                style={{
                  height: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '20px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  padding: '2.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ background: 'rgba(232,124,30,0.15)', padding: '0.6rem', borderRadius: '12px' }}>
                    <Activity size={24} color="#E87C1E" />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: '#E87C1E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Logros Técnicos</div>
                    <h3 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff' }}>{SPRINTS[activeSprint].text}</h3>
                  </div>
                </div>

                <p style={{ fontSize: '1.1rem', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: '2.5rem', maxWidth: '95%' }}>
                  {SPRINTS[activeSprint].details}
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.8rem', marginBottom: 'auto' }}>
                  {SPRINTS[activeSprint].tags.map((t, idx) => (
                    <div key={idx} style={{ 
                      padding: '0.6rem 1.2rem', borderRadius: '25px', background: t.color + '15',
                      border: `1px solid ${t.color}40`, color: t.color, fontSize: '0.8rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', gap: '0.6rem'
                    }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: t.color }} />
                      {t.label}
                    </div>
                  ))}
                </div>

                <div style={{ 
                  marginTop: '2rem', paddingTop: '2rem', borderTop: '1px solid rgba(255,255,255,0.05)',
                  display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem'
                }}>
                  {[
                    { icon: <Clock size={16} />, label: 'Estado', val: 'Finalizado', col: '#10B981' },
                    { icon: <Settings size={16} />, label: 'Entorno', val: 'Producción', col: '#fff' },
                    { icon: <GitBranch size={16} />, label: 'Rama', val: 'main', col: '#fff' },
                    { icon: <Share2 size={16} />, label: 'Review', val: 'Aprobado', col: '#fff' }
                  ].map((item, i) => (
                    <div key={i}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'rgba(255,255,255,0.3)', marginBottom: '0.3rem' }}>
                        {item.icon}
                        <span style={{ fontSize: '0.6rem', textTransform: 'uppercase' }}>{item.label}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', fontWeight: 700, color: item.col }}>{item.val}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <style>{`
        .sprint-card-interactive:hover {
          background: rgba(255,255,255,0.06) !important;
          transform: translateX(4px);
        }
        .sprint-card-interactive.active {
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        @media (max-width: 1000px) {
          .planning-container {
            grid-template-columns: 1fr !important;
          }
          .sprint-card-interactive {
            padding: 0.6rem 1rem !important;
          }
        }
      `}</style>
    </section>
  );
}
