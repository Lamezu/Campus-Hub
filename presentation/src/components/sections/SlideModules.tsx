import { motion } from 'framer-motion';
import { MODULES } from '../../data/modules';
import type { } from '../../types';
import type { SlideProps } from '../../types';

const ITEM = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] } },
};

const CONTAINER = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};

export default function SlideModules({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="slide-inner"
        variants={CONTAINER}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.span variants={ITEM} className="slide-number">08 — Funcionalidades</motion.span>
        <motion.h2 variants={ITEM} className="slide-heading" style={{ marginBottom: '0.3rem' }}>
          Qué puede hacer CampusHub
        </motion.h2>
        <motion.p variants={ITEM} className="slide-subtitle" style={{ marginBottom: '1.5rem' }}>
          12 módulos funcionales listos para producción
        </motion.p>

        <div className="feature-bento-grid">
          {MODULES.map((m, i) => (
            <motion.div
              key={i}
              variants={ITEM}
              className="feature-bento-card glass-panel"
              style={{ position: 'relative', overflow: 'hidden' }}
              whileHover={{ borderColor: m.color + '80' }}
            >
              <div className="feature-bento-icon" style={{ background: m.bg }}>
                <m.Icon size={18} color={m.color} strokeWidth={1.8} />
              </div>
              <div className="feature-bento-name">{m.name}</div>
              <div className="feature-bento-description">{m.desc}</div>
              <motion.div
                initial={{ width: 0 }}
                whileHover={{ width: '100%' }}
                style={{ position: 'absolute', bottom: 0, left: 0, height: 2, background: m.color }}
              />
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
