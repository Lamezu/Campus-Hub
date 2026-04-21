import React from 'react';
import { Loader2, BookOpen } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';

export const PostLoadingScreen: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
      flexDirection: 'column',
      gap: 24,
      zIndex: 9999,
    }}>
      {/* Blurred background elements for aesthetic feel */}
      <div style={{
        position: 'absolute',
        width: '40%',
        height: '40%',
        top: '10%',
        left: '10%',
        backgroundColor: colors.primary + '15',
        filter: 'blur(100px)',
        borderRadius: '50%',
        zIndex: 0
      }} />
      <div style={{
        position: 'absolute',
        width: '40%',
        height: '40%',
        bottom: '10%',
        right: '10%',
        backgroundColor: colors.primary + '10',
        filter: 'blur(120px)',
        borderRadius: '50%',
        zIndex: 0
      }} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20
      }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          backgroundColor: colors.backgroundSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          position: 'relative',
          overflow: 'hidden',
          border: `1px solid ${colors.border}`
        }}>
          <BookOpen 
            size={40} 
            color={colors.primary} 
            style={{ 
              opacity: 0.8,
              animation: 'float 2s ease-in-out infinite'
            }} 
          />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(45deg, transparent, ${colors.primary}10, transparent)`,
            animation: 'shimmer 2s infinite'
          }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <ThemedText style={{
            fontSize: 20,
            fontWeight: '800',
            color: colors.text,
            letterSpacing: '-0.02em'
          }}>
            {t('common.loading')}
          </ThemedText>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '4px 12px',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 20,
            border: `1px solid ${colors.border}`
          }}>
            <Loader2 
              size={14} 
              color={colors.primary} 
              className="animate-spin" 
            />
            <ThemedText style={{
              fontSize: 12,
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              CampusHub Post
            </ThemedText>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(200%) rotate(45deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
