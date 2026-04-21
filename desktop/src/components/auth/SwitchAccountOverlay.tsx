import React from 'react';
import { Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';

export function SwitchAccountOverlay() {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      backgroundColor: 'rgba(10, 10, 15, 0.8)',
      backdropFilter: 'blur(12px) saturate(180%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      {/* Background Glows */}
      <div style={{
        position: 'absolute',
        width: '400px',
        height: '400px',
        background: `radial-gradient(circle, ${colors.primary}20 0%, transparent 70%)`,
        borderRadius: '50%',
        filter: 'blur(60px)',
        zIndex: -1,
        animation: 'pulseGlow 4s ease-in-out infinite'
      }} />

      <div style={{ position: 'relative', width: 80, height: 80 }}>
        <Loader2 
          size={80} 
          className="animate-spin" 
          style={{ 
            color: colors.primary,
            filter: `drop-shadow(0 0 15px ${colors.primary}50)`
          }} 
        />
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          border: `2px solid ${colors.primary}20`,
          boxShadow: `inset 0 0 20px ${colors.primary}10`
        }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <span style={{ 
          color: '#fff', 
          fontSize: 20, 
          fontWeight: 800, 
          letterSpacing: '0.5px',
          textShadow: '0 2px 10px rgba(0,0,0,0.5)'
        }}>
          {t('manage_accounts.switching_account', { defaultValue: 'Cambiando de cuenta...' })}
        </span>
        <div style={{ 
          display: 'flex', 
          gap: 4, 
          height: 3, 
          width: 120, 
          backgroundColor: 'rgba(255,255,255,0.1)', 
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            height: '100%',
            width: '40%',
            backgroundColor: colors.primary,
            borderRadius: 2,
            animation: 'shimmerProgress 1.5s infinite linear'
          }} />
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pulseGlow {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.2); opacity: 0.8; }
        }
        @keyframes shimmerProgress {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
    </div>
  );
}
