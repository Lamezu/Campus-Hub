import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';
import { ThemedText } from './themed-text';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';

interface AlertModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  onConfirm2?: () => void;
  showCancelButton?: boolean;
  type?: 'info' | 'success' | 'error' | 'confirm';
  confirmText?: string;
  confirmText2?: string;
  cancelText?: string;
  confirmStyle?: React.CSSProperties;
  confirm2Style?: React.CSSProperties;
  cancelStyle?: React.CSSProperties;
}

export const AlertModal: React.FC<AlertModalProps> = ({
  isOpen,
  title,
  message,
  onClose,
    onConfirm,
    onConfirm2,
    showCancelButton = false,
    type = 'info',
    confirmText,
    confirmText2,
    cancelText,
    confirmStyle,
    confirm2Style,
    cancelStyle
  }) => {
    const { colors } = useTheme();
    const { t } = useTranslation();
    
    const finalConfirmText = confirmText || t('common.ok', { defaultValue: 'Entendido' });
    const finalCancelText = cancelText || t('common.cancel', { defaultValue: 'Cancelar' });
  
    if (!isOpen) return null;
  
    const getIcon = () => {
      switch (type) {
        case 'success': return <CheckCircle2 size={48} color={colors.success} />;
        case 'error': return <AlertCircle size={48} color={colors.danger} />;
        case 'confirm': return <Info size={48} color={colors.primary} />;
        default: return <Info size={48} color={colors.primary} />;
      }
    };
  
    return (
      <div style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        backdropFilter: 'blur(4px)',
        animation: 'fadeIn 0.2s ease-out'
      }}>
        <div style={{
          backgroundColor: colors.card,
          borderRadius: 24,
          padding: spacing.xl,
          width: 350,
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
          border: `1px solid ${colors.border}`,
          animation: 'scaleUp 0.2s ease-out'
        }}>
          <div style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
            {getIcon()}
          </div>
          
          <ThemedText style={{ fontSize: 20, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
            {title}
          </ThemedText>
          
          <ThemedText style={{ fontSize: 14, opacity: 0.7, display: 'block', marginBottom: spacing.xl }}>
            {message}
          </ThemedText>
  
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button
              onClick={onConfirm || onClose}
              autoFocus
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: 14,
                backgroundColor: colors.primary,
                color: '#FFFFFF',
                border: 'none',
                fontWeight: 'bold',
                cursor: 'pointer',
                fontSize: 15,
                transition: 'transform 0.1s',
                ...confirmStyle
              }}
              onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              {finalConfirmText}
            </button>
  
            {confirmText2 && (
              <button
                onClick={onConfirm2}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: 14,
                  backgroundColor: colors.danger,
                  color: '#FFFFFF',
                  border: 'none',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: 15,
                  transition: 'transform 0.1s',
                  ...confirm2Style
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.02)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                {confirmText2}
              </button>
            )}
  
            {(showCancelButton || cancelText) && (
              <button
                onClick={onClose}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 14,
                  backgroundColor: 'transparent',
                  color: colors.text,
                  border: 'none',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: 14,
                  opacity: 0.6,
                  ...cancelStyle
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}
              >
                {finalCancelText}
              </button>
            )}
          </div>
        </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
};
