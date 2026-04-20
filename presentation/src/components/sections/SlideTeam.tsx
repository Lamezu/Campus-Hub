import { motion } from 'framer-motion';
import { TEAM } from '../../data/team';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_Y_LARGE } from '../../types';
import type { SlideProps } from '../../types';

export default function SlideTeam({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <div style={{ position: 'absolute', top: '10%', right: '5%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(232,124,30,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div
        className="slide-inner"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.span variants={ITEM_VARIANTS_Y_LARGE} className="slide-number">10 — Equipo</motion.span>
        <motion.h2 variants={ITEM_VARIANTS_Y_LARGE} className="slide-heading">El equipo de desarrollo</motion.h2>
        <motion.p variants={ITEM_VARIANTS_Y_LARGE} className="slide-subtitle" style={{ marginBottom: '2.5rem' }}>
          Tres pilares fundamentales, tres plataformas nativas, una visión compartida.
        </motion.p>

        <div className="team-grid" style={{ gap: '2rem' }}>
          {TEAM.map((m, i) => (
            <motion.div
              key={i}
              variants={ITEM_VARIANTS_Y_LARGE}
              className="team-card glass-panel"
              whileHover={{ y: -8, border: `2px solid ${m.roleColor}80` }}
              style={{ 
                border: `2px solid rgba(255,255,255,0.1)`, 
                background: 'rgba(255,255,255,0.02)',
                backdropFilter: 'blur(20px)',
                transition: 'all 0.4s cubic-bezier(0.22, 1, 0.36, 1)'
              }}
            >
              <div style={{
                width: 90, height: 90, borderRadius: '50%',
                margin: '0 auto 1.5rem',
                border: `3px solid ${m.roleColor}`,
                background: `linear-gradient(135deg, ${m.roleColor}30, transparent)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', overflow: 'hidden',
                boxShadow: `0 0 20px ${m.roleColor}30`
              }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff', textShadow: `0 0 10px ${m.roleColor}` }}>{m.initial}</span>
              </div>

              <div className="team-name" style={{ fontSize: '1.2rem', fontWeight: 800, color: '#fff' }}>{m.name}</div>
              <div className="team-role" style={{ color: m.roleColor, fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.5rem' }}>{m.role}</div>
              <div className="team-stack" style={{ fontSize: '0.75rem', opacity: 0.5 }}>{m.stack}</div>

              <div style={{ height: '1px', width: '40%', background: `linear-gradient(90deg, transparent, ${m.roleColor}60, transparent)`, margin: '1rem auto' }} />

              <div className="team-chips" style={{ justifyContent: 'center', gap: '0.4rem' }}>
                {m.chips.map((c, j) => (
                  <span key={j} className={`chip ${c.color}`} style={{ fontSize: '0.65rem', padding: '0.2rem 0.6rem', opacity: 0.9 }}>{c.label}</span>
                ))}
              </div>

              <div style={{ marginTop: '1.5rem', textAlign: 'left', width: '100%', padding: '0 0.5rem' }}>
                {m.highlights.map((h, j) => (
                  <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: m.roleColor, marginTop: '7px', flexShrink: 0 }} />
                    {h}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
