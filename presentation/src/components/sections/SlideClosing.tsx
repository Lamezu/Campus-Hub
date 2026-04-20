import { motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { useEffect } from 'react';
import { Code as Github, GraduationCap } from 'lucide-react';
import { TEAM } from '../../data/team';
import { CLOSING_STATS } from '../../data/closingStats';
import type { ClosingStat } from '../../data/closingStats';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_Y_LARGE } from '../../types';
import type { SlideProps } from '../../types';

function Counter({ to, prefix = '', suffix = '', isActive }: ClosingStat & { isActive: boolean }) {
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) => Math.round(latest));
  const display = useTransform(rounded, (latest) => `${prefix}${latest}${suffix}`);

  useEffect(() => {
    if (isActive) {
      animate(count, to, { duration: 1.5, ease: 'easeOut' });
    } else {
      count.set(0);
    }
  }, [isActive, to, count]);

  return <motion.span>{display}</motion.span>;
}

export default function SlideClosing({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="slide-inner closing-wrap"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.div variants={ITEM_VARIANTS_Y_LARGE} style={{ marginBottom: '0.75rem' }}>
          <div style={{ width: 80, height: 80, borderRadius: 24, background: 'linear-gradient(135deg, #1A3A6B, #E87C1E)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 0 50px rgba(232,124,30,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <GraduationCap size={44} color="#fff" strokeWidth={1.5} />
          </div>
        </motion.div>

        <motion.h1 variants={ITEM_VARIANTS_Y_LARGE} className="closing-title">
          <span style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #E87C1E 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Campus</span>
          <span style={{ color: '#fff' }}>Hub</span>
        </motion.h1>

        <motion.p variants={ITEM_VARIANTS_Y_LARGE} className="closing-subtitle">Gracias por su atención</motion.p>

        <motion.div
          variants={ITEM_VARIANTS_Y_LARGE}
          className="closing-cards glass-panel interactive"
        >
          {CLOSING_STATS.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ textAlign: 'center', minWidth: 160 }}>
                <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{s.label}</div>
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={isActive ? { scale: 1 } : { scale: 0.8 }}
                  transition={{ duration: 0.5, delay: 0.2 }}
                  style={{ fontSize: '4.5rem', fontWeight: 900, background: 'linear-gradient(135deg, #1A3A6B, #E87C1E)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}
                >
                  <Counter {...s} isActive={isActive} />
                </motion.div>
              </div>
              {i < CLOSING_STATS.length - 1 && (
                <div style={{ width: 1, height: 60, background: 'rgba(232,124,30,0.3)', margin: '0 2.5rem' }} />
              )}
            </div>
          ))}
        </motion.div>

        <motion.p
          variants={ITEM_VARIANTS_Y_LARGE}
          style={{ maxWidth: 680, textAlign: 'center', fontSize: '0.9rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginTop: '1.5rem', marginBottom: '1rem' }}
        >
          CampusHub no es un prototipo académico. Es un ecosistema multiplataforma real con
          arquitectura de producción, seguridad en dos capas y capacidad de escalar a cualquier
          centro educativo.
        </motion.p>

        <motion.a 
          variants={ITEM_VARIANTS_Y_LARGE}
          whileHover={{ scale: 1.05, background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.3)' }}
          whileTap={{ scale: 0.95 }}
          href="https://github.com/Lamezu/Campus-Hub"
          target="_blank"
          rel="noopener noreferrer"
          style={{ 
            display: 'inline-flex', 
            alignItems: 'center', 
            gap: '0.75rem', 
            marginBottom: '1rem',
            padding: '0.8rem 1.5rem',
            borderRadius: '99px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            textDecoration: 'none',
            cursor: "url('/assets/custom_pointer.png') 16 0, pointer",
            transition: 'all 0.3s ease',
            boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
          }}
        >
          <Github size={20} color="rgba(255,255,255,0.9)" />
          <span style={{ fontSize: '0.95rem', color: 'rgba(255,255,255,0.9)', fontFamily: 'monospace', fontWeight: 600 }}>
            Lamezu / Campus-Hub
          </span>
        </motion.a>

        <motion.div variants={ITEM_VARIANTS_Y_LARGE}>
          <motion.div
            className="closing-questions"
            animate={isActive ? { opacity: [0.6, 1, 0.6] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            ¿Preguntas?
          </motion.div>
        </motion.div>

        <motion.div variants={ITEM_VARIANTS_Y_LARGE} className="closing-team-row">
          {TEAM.map((m, i) => (
            <div key={i} className="closing-member">
              <div className="closing-dot" style={{ background: m.gradient }}>
                {m.initial}
              </div>
              <span className="closing-member-name">{m.name}</span>
            </div>
          ))}
        </motion.div>
      </motion.div>

      <div
        aria-hidden="true"
        style={{
          position: 'absolute', width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle,rgba(232,124,30,0.1) 0%,transparent 70%)',
          top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none',
        }}
      />
    </section>
  );
}
