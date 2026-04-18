import React from 'react';
import { Loader2 } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';

export const ChatLoadingOverlay: React.FC = () => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background + '80',
      backdropFilter: 'blur(20px)',
      flexDirection: 'column',
      gap: 20,
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        position: 'relative',
        width: 60,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Loader2 
          size={50} 
          color={colors.primary} 
          style={{ animation: 'spin 1.2s linear infinite' }} 
        />
      </div>
      <ThemedText style={{
        fontSize: 18,
        fontWeight: '700',
        color: colors.text,
        letterSpacing: '0.02em'
      }}>
        {t('dm.loading_chat')}
      </ThemedText>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};
