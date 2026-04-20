import { motion } from 'framer-motion';
import { TEAM } from '../../data/team';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_Y_LARGE } from '../../types';
import type { SlideProps } from '../../types';

export default function SlideCover({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="cover-wrap"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.div variants={ITEM_VARIANTS_Y_LARGE} className="cover-badge">
          TFG · Desarrollo de Aplicaciones Multiplataforma · 2025–2026
        </motion.div>

        <motion.h1 variants={ITEM_VARIANTS_Y_LARGE} className="cover-logo">
          <span className="cover-logo-gradient">Campus</span>
          <span style={{ color: '#fff' }}>Hub</span>
        </motion.h1>

        <motion.p variants={ITEM_VARIANTS_Y_LARGE} className="cover-tagline">
          Plataforma de comunicación y bienestar para centros educativos
        </motion.p>

        <motion.div
          variants={ITEM_VARIANTS_Y_LARGE}
          style={{
            width: 120, height: 3,
            background: 'linear-gradient(90deg, #1A3A6B, #E87C1E)',
            borderRadius: 2,
            margin: '0 auto 2.5rem',
          }}
        />

        <motion.div variants={ITEM_VARIANTS_Y_LARGE} className="cover-team">
          {TEAM.map((m, i) => (
            <div key={i} className="cover-member">
              <div className="cover-avatar" style={{ background: m.avatarGradient }}>
                {m.initial}
              </div>
              <span className="cover-member-name">{m.name}</span>
              <span className="cover-member-role">{m.role}</span>
            </div>
          ))}
        </motion.div>

        <motion.div variants={ITEM_VARIANTS_Y_LARGE}>
          <motion.span
            animate={{ opacity: [0.3, 0.9, 0.3] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}
          >
            Presiona Espacio o ↓ para comenzar
          </motion.span>
        </motion.div>
      </motion.div>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute', width: 600, height: 600,
          borderRadius: '50%', border: '1px solid rgba(59,130,246,0.08)',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', width: 900, height: 900,
          borderRadius: '50%', border: '1px solid rgba(59,130,246,0.04)',
          top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        }}
      />
    </section>
  );
}
