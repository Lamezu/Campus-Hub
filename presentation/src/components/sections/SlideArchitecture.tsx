import { motion } from 'framer-motion';
import { CLIENTS, FIREBASE, EXTERNAL } from '../../data/architecture';
import { CONTAINER_VARIANTS } from '../../types';
import type { SlideProps, ArchNode } from '../../types';

const ITEM = {
  hidden: { opacity: 0, scale: 0.95, y: 10 },
  visible: { 
    opacity: 1, scale: 1, y: 0, 
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as any } 
  },
};

function NodeCard({ n, color }: { n: ArchNode; color: string }) {
  return (
    <motion.div 
      variants={ITEM}
      className="arch-node glass-panel"
      style={{ 
        flex: 1,
        padding: '1rem 0.6rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.6rem',
        border: `1px solid ${color}40`,
        background: 'rgba(0,0,0,0.5)',
        minWidth: 0,
        borderRadius: '12px',
        position: 'relative',
        overflow: 'hidden'
      }}
      whileHover={{ scale: 1.05, borderColor: color, background: 'rgba(0,0,0,0.6)', boxShadow: `0 0 20px ${color}30` }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: `radial-gradient(circle at 50% 0%, ${color}15 0%, transparent 70%)` }} />
      
      <div style={{ position: 'relative', zIndex: 1, color: color, filter: `drop-shadow(0 0 8px ${color}40)` }}>
        <n.icon size={26} strokeWidth={1.5} />
      </div>
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#fff', whiteSpace: 'nowrap' }}>{n.name}</div>
        <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.01em' }}>{n.tech}</div>
      </div>
    </motion.div>
  );
}

function Connector({ isActive, color }: { isActive: boolean; color: string }) {
  return (
    <div style={{ height: 50, position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <svg width="2" height="50" viewBox="0 0 2 50" fill="none">
        <motion.line
          x1="1" y1="0" x2="1" y2="50"
          stroke={color}
          strokeWidth="2"
          strokeDasharray="50"
          initial={{ strokeDashoffset: 50 }}
          animate={isActive ? { strokeDashoffset: 0 } : { strokeDashoffset: 50 }}
          transition={{ duration: 1, ease: "easeInOut" }}
          style={{ opacity: 0.4 }}
        />
        {isActive && (
          <motion.circle
            r="1.5"
            fill={color}
            initial={{ cy: 0 }}
            animate={{ cy: 50 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          >
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
          </motion.circle>
        )}
      </svg>
      <motion.div 
        animate={isActive ? { opacity: [0, 0.2, 0] } : {}}
        transition={{ duration: 2, repeat: Infinity }}
        style={{ 
          position: 'absolute', width: 40, height: 1, background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          filter: 'blur(4px)'
        }}
      />
    </div>
  );
}

export default function SlideArchitecture({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div 
        animate={isActive ? { opacity: [0.3, 0.5, 0.3], scale: [1, 1.1, 1] } : {}}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '70%', height: '70%', background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)', pointerEvents: 'none', filter: 'blur(40px)' }} 
      />

      <motion.div
        className="slide-inner"
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
        style={{ maxWidth: 900, margin: '0 auto' }}
      >
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <motion.span variants={ITEM} className="slide-number">04 — Arquitectura Técnica</motion.span>
          <motion.h2 variants={ITEM} className="slide-heading" style={{ margin: '0.4rem 0', fontSize: '2.5rem' }}>Ecosistema Cloud</motion.h2>
          <motion.p variants={ITEM} className="slide-subtitle" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Flujo de datos en tiempo real entre interfaces, lógica y servicios.
          </motion.p>
        </div>

        <div className="arch-flow" style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '0' }}>
          <div style={{ zIndex: 2 }}>
            <div className="arch-layer-label-mini">Capa de Presentación</div>
            <div className="arch-grid">
              {CLIENTS.map((n) => <NodeCard key={n.name} n={n} color="#3b82f6" />)}
            </div>
          </div>

          <Connector isActive={isActive} color="#3b82f6" />

          <div style={{ zIndex: 1 }}>
            <div className="arch-layer-label-mini" style={{ color: '#f59e0b' }}>Núcleo Firebase</div>
            <div className="arch-grid">
              {FIREBASE.map((n) => <NodeCard key={n.name} n={n} color="#f59e0b" />)}
            </div>
          </div>

          <Connector isActive={isActive} color="#f59e0b" />

          <div>
            <div className="arch-layer-label-mini" style={{ color: '#10b981' }}>Servicios de Terceros</div>
            <div className="arch-grid">
              {EXTERNAL.map((n) => <NodeCard key={n.name} n={n} color="#10b981" />)}
            </div>
          </div>
        </div>

        <motion.div variants={ITEM} style={{ marginTop: '3.5rem', display: 'flex', gap: '0.8rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            'TypeScript 5.7', 'React 19', 'Expo SDK 54', 'Electron 36', 
            'Firestore Security Rules', 'FCM Engine', 'WebRTC P2P', 'Jamendo V3'
          ].map((t) => (
            <span key={t} style={{ 
              fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em',
              padding: '0.4rem 0.9rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
              backdropFilter: 'blur(4px)'
            }}>
              {t}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}
