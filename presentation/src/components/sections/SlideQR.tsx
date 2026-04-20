import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import { QR_LINKS } from '../../data/qrLinks';
import { CONTAINER_VARIANTS, ITEM_VARIANTS } from '../../types';
import type { SlideProps } from '../../types';

export default function SlideQR({ isActive }: SlideProps) {
  return (
    <section className="slide">
      <motion.div
        className="slide-inner"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}
        variants={CONTAINER_VARIANTS}
        animate={isActive ? 'visible' : 'hidden'}
        initial={false}
      >
        <motion.span variants={ITEM_VARIANTS} className="slide-number">11 — Demo en vivo</motion.span>
        <motion.h2 variants={ITEM_VARIANTS} className="slide-heading">Prueba el ecosistema</motion.h2>
        <motion.p variants={ITEM_VARIANTS} className="slide-subtitle" style={{ maxWidth: 600 }}>
          Acceso instantáneo a las plataformas de producción. Escanea el QR para móvil o descarga los instaladores nativos para escritorio.
        </motion.p>

        <motion.div variants={ITEM_VARIANTS} style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginBottom: '2rem' }}>
          {QR_LINKS.map((l, i) => (
            <div
              key={i}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem',
                padding: '2rem 1.5rem', borderRadius: '1.25rem',
                border: `1px solid ${l.borderColor}40`,
                background: 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)', minWidth: 280,
                position: 'relative', overflow: 'hidden'
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: l.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <l.Icon size={28} color={l.iconColor} strokeWidth={1.6} />
              </div>

              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff', marginBottom: '0.25rem' }}>{l.title}</div>
                <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)' }}>{l.subtitle}</div>
              </div>

              {l.isDesktop ? (
                <div style={{ width: 220, height: 200, display: 'flex', flexDirection: 'column', gap: '0.75rem', justifyContent: 'center' }}>
                  <motion.a 
                    whileHover={{ scale: 1.05, background: 'rgba(59,130,246,0.15)', borderColor: '#3b82f6' }}
                    whileTap={{ scale: 0.95 }}
                    href="#" 
                    style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`, padding: '0.85rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}
                  >
                    <Download size={16} color="#3b82f6" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Windows (.exe)</span>
                  </motion.a>
                  <motion.a 
                    whileHover={{ scale: 1.05, background: 'rgba(139,92,246,0.15)', borderColor: '#8b5cf6' }}
                    whileTap={{ scale: 0.95 }}
                    href="#" 
                    style={{ textDecoration: 'none', background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.1)`, padding: '0.85rem', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'all 0.3s ease' }}
                  >
                    <Download size={16} color="#8b5cf6" />
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Linux (.app)</span>
                  </motion.a>
                </div>
              ) : l.qrImage ? (
                <div style={{ width: 220, height: 200, borderRadius: 12, background: '#fff', padding: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={l.qrImage} alt="QR Code" style={{ width: '100%', height: '100%' }} />
                </div>
              ) : (
                <div style={{ width: 220, height: 200, borderRadius: 12, border: `2px dashed ${l.iconColor}60`, background: `${l.iconColor}08`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                  <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', lineHeight: 1.6, textAlign: 'center', fontFamily: 'monospace' }}>
                    {l.qrText}
                  </span>
                </div>
              )}

              <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.04)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', width: '100%', maxWidth: 240, overflowWrap: 'anywhere', textAlign: 'center', lineHeight: 1.4 }}>
                {l.urlText}
              </div>
            </div>
          ))}
        </motion.div>

        <motion.p variants={ITEM_VARIANTS} style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>
          Los códigos QR estarán disponibles tras el build de producción
        </motion.p>
      </motion.div>
    </section>
  );
}
