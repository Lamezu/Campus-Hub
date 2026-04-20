import { motion } from 'framer-motion';
import { PLATFORMS } from '../../data/platforms';
import { CONTAINER_VARIANTS, ITEM_VARIANTS } from '../../types';
import type { SlideProps } from '../../types';

export default function SlideSolution({ isActive }: SlideProps) {
  return (
    <section className="slide">
      {/* Decorative Background Glows */}
      <div style={{ position: 'absolute', top: '20%', left: '10%', width: '30%', height: '40%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: '10%', right: '10%', width: '40%', height: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div
        className="slide-inner"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.span variants={ITEM_VARIANTS} className="slide-number">03 — La Solución</motion.span>
        <motion.h2 variants={ITEM_VARIANTS} className="slide-heading">
          CampusHub: todo en uno
        </motion.h2>
        <motion.p variants={ITEM_VARIANTS} className="slide-subtitle" style={{ maxWidth: '600px' }}>
          Una única plataforma. Tres superficies nativas diseñadas para coexistir y potenciar la comunicación académica.
        </motion.p>

        <motion.div variants={ITEM_VARIANTS} className="solution-platforms" style={{ marginTop: '2.5rem' }}>
          {PLATFORMS.map((p, idx) => (
            <motion.div
              key={p.key}
              className={`platform-card ${p.key} glass-panel`}
              initial={{ opacity: 0, y: 30 }}
              animate={isActive ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + idx * 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="platform-icon-wrapper" style={{ 
                width: 60, height: 60, borderRadius: 16, 
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem',
                border: `1px solid ${p.iconColor}40`,
                background: `radial-gradient(circle at top left, ${p.iconColor}20, transparent)`,
                boxShadow: `0 8px 16px ${p.iconColor}15`
              }}>
                <p.Icon size={32} color={p.iconColor} strokeWidth={1.5} />
              </div>

              <div className="platform-name" style={{ fontSize: '1.6rem', fontWeight: 850, color: '#fff', textAlign: 'center' }}>{p.name}</div>
              <div className="platform-tech" style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '1.5rem', fontWeight: 600 }}>{p.tech}</div>
              
              <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${p.iconColor}40, transparent)`, margin: '1.5rem 0' }} />

              <ul className="platform-features" style={{ padding: '0 0.5rem', listStyle: 'none' }}>
                {p.feats.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'start', gap: '0.8rem', fontSize: '0.9rem', marginBottom: '0.75rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.iconColor, marginTop: '0.4rem', flexShrink: 0, boxShadow: `0 0 10px ${p.iconColor}` }} />
                    {f}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={ITEM_VARIANTS} className="solution-footer" style={{ marginTop: '2rem', opacity: 0.6 }}>
          <span style={{ color: '#3b82f6' }}>Firebase</span> unificado · <span style={{ color: '#10b981' }}>Cloudinary</span> media · <span style={{ color: '#f59e0b' }}>FCM</span> push
        </motion.div>
      </motion.div>
    </section>
  );
}
