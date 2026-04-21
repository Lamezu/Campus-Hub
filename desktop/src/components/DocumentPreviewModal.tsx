import React from 'react';
import { X, FileText, Send, Download } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { ThemedText } from './themed-text';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  file: File | null;
  loading?: boolean;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen, onClose, onSend, file, loading
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();

  if (!isOpen || !file) return null;

  const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
  const fileExtension = file.name.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(10px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: colors.card,
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
        boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
        border: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '20px 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <ThemedText style={{ fontWeight: 800, fontSize: 18 }}>Confirmar envío</ThemedText>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <div style={{
            width: 100,
            height: 100,
            borderRadius: 30,
            backgroundColor: colors.primary + '15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative'
          }}>
            <FileText size={48} color={colors.primary} />
            <div style={{
              position: 'absolute',
              bottom: -5,
              right: -5,
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: 10,
              fontWeight: 800,
              padding: '4px 8px',
              borderRadius: 8,
              boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
            }}>{fileExtension}</div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <ThemedText style={{ 
              fontWeight: 700, 
              fontSize: 16, 
              display: 'block', 
              marginBottom: 4,
              wordBreak: 'break-all'
            }}>
              {file.name}
            </ThemedText>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 13 }}>
              {fileSizeMB} MB
            </ThemedText>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px 24px', display: 'flex', gap: 12 }}>
          <button 
            onClick={onClose}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 14,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Cancelar
          </button>
          <button 
            onClick={onSend}
            disabled={loading}
            style={{
              flex: 1,
              padding: '14px',
              borderRadius: 14,
              border: 'none',
              backgroundColor: colors.primary,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: loading ? 0.6 : 1,
              boxShadow: `0 8px 16px ${colors.primary}40`
            }}
          >
            {loading ? (
              <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%' }} />
            ) : (
              <>
                <Send size={18} />
                Enviar
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
