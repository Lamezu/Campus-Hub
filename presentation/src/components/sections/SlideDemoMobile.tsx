import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import InteractiveMockup from '../ui/InteractiveMockup';
import { MOBILE_SEQUENCE } from '../../data/demo';
import { CONTAINER_VARIANTS, ITEM_VARIANTS_X_LEFT, ITEM_VARIANTS_FROM_RIGHT } from '../../types';
import type { SlideProps } from '../../types';

const FEATURES = [
  'Feed social dinámico con Jamendo API',
  'Chat en tiempo real con hilos asíncronos',
  'Mensajería de voz de alta calidad con Expo AV',
  'Sincronización instantánea con Firebase',
  'Sistema de temas adaptativo y accesible',
  'Gestión multi-cuenta integrada',
];

export default function SlideDemoMobile({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="slide-inner demo-layout"
        style={{ alignItems: 'center' }}
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <div>
          <motion.span variants={ITEM_VARIANTS_X_LEFT} className="slide-number">05 — Aplicación</motion.span>
          <motion.h2 variants={ITEM_VARIANTS_X_LEFT} className="slide-heading">Ecosistema Móvil</motion.h2>
          <motion.p variants={ITEM_VARIANTS_X_LEFT} className="slide-subtitle">
            React Native · Expo SDK 54 · iOS & Android
          </motion.p>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} className="demo-features-title">Experiencia de Usuario</motion.div>
          <motion.ul variants={ITEM_VARIANTS_X_LEFT} className="feature-list">
            {FEATURES.map((f, i) => (
              <li key={i}>
                <span className="feature-check-icon"><Check size={10} strokeWidth={3} /></span>
                {f}
              </li>
            ))}
          </motion.ul>

          <motion.div variants={ITEM_VARIANTS_X_LEFT} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
            {['TypeScript', 'Firebase', 'Framer Motion', 'Cloudinary'].map((t) => (
              <span key={t} className="chip blue">{t}</span>
            ))}
          </motion.div>
        </div>

        <motion.div variants={ITEM_VARIANTS_FROM_RIGHT}>
          <InteractiveMockup type="mobile" images={MOBILE_SEQUENCE} isActive={isActive} />
        </motion.div>
      </motion.div>
    </section>
  );
}
