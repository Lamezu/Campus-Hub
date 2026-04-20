import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import InteractiveMockup from '../ui/InteractiveMockup';
import { WEB_SEQUENCE } from '../../data/demo';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_X_LEFT, ITEM_VARIANTS_FROM_RIGHT } from '../../types';
import type { SlideProps } from '../../types';

const FEATURES = [
  'Panel de administración institucional centralizado',
  'Gestión de usuarios, departamentos y roles',
  'Moderación de contenidos y auditoría de eventos',
  'Configuración global del centro y soporte técnico',
  'Analíticas en tiempo real del ecosistema CampusHub',
  'Interfaz responsive con React 19 y Vite',
];

export default function SlideDemoWeb({ isActive }: SlideProps) {
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
          <motion.span variants={ITEM_VARIANTS_X_LEFT} className="slide-number">06 — Admin Web</motion.span>
          <motion.h2 variants={ITEM_VARIANTS_X_LEFT} className="slide-heading">Gestión Institucional</motion.h2>
          <motion.p variants={ITEM_VARIANTS_X_LEFT} className="slide-subtitle">
            React 19 · Vite · Firebase Cloud Functions
          </motion.p>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} className="demo-features-title">Control y Moderación</motion.div>
          <motion.ul variants={ITEM_VARIANTS_X_LEFT} className="feature-list">
            {FEATURES.map((f, i) => (
              <li key={i}>
                <span className="feature-check-icon"><Check size={10} strokeWidth={3} /></span>
                {f}
              </li>
            ))}
          </motion.ul>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {['React Router', 'Lucide Icons', 'Zustand', 'EAS Analytics'].map((t) => (
              <span key={t} className="chip green">{t}</span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={ITEM_VARIANTS_FROM_RIGHT}>
          <InteractiveMockup type="web" images={WEB_SEQUENCE} isActive={isActive} />
        </motion.div>
      </motion.div>
    </section>
  );
}
