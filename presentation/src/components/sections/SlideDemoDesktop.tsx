import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import InteractiveMockup from '../ui/InteractiveMockup';
import { DESKTOP_SEQUENCE } from '../../data/demo';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_X_LEFT, ITEM_VARIANTS_FROM_RIGHT } from '../../types';
import type { SlideProps } from '../../types';

const FEATURES = [
  'Cliente nativo de escritorio multiplataforma',
  'Notificaciones flotantes integradas en el sistema',
  'Acceso rápido a herramientas de productividad',
  'Sincronización híbrida de archivos institucionales',
  'Consumo optimizado de recursos mediante Electron',
];

export default function SlideDemoDesktop({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="slide-inner demo-layout-wide"
        style={{ alignItems: 'center' }}
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <div>
          <motion.span variants={ITEM_VARIANTS_X_LEFT} className="slide-number">07 — Desktop</motion.span>
          <motion.h2 variants={ITEM_VARIANTS_X_LEFT} className="slide-heading">Cliente Corporativo</motion.h2>
          <motion.p variants={ITEM_VARIANTS_X_LEFT} className="slide-subtitle">
            Electron · React · Node.js
          </motion.p>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} className="demo-features-title">Capacidades Nativas</motion.div>
          <motion.ul variants={ITEM_VARIANTS_X_LEFT} className="feature-list">
            {FEATURES.map((f, i) => (
              <li key={i}>
                <span className="feature-check-icon"><Check size={10} strokeWidth={3} /></span>
                {f}
              </li>
            ))}
          </motion.ul>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {['Electron 36', 'IPC Communication', 'Native Blur', 'Tailwind'].map((t) => (
              <span key={t} className="chip purple">{t}</span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={ITEM_VARIANTS_FROM_RIGHT}>
          <InteractiveMockup type="desktop" images={DESKTOP_SEQUENCE} isActive={isActive} />
        </motion.div>
      </motion.div>
    </section>
  );
}
