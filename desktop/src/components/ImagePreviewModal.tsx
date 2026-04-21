import React, { useEffect, useState } from 'react';
import { X, Send, Play, Image as ImageIcon } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { ThemedText } from './themed-text';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: () => void;
  file: File | null;
  type: 'image' | 'video';
  loading?: boolean;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  isOpen, onClose, onSend, file, type, loading
}) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (file && isOpen) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [file, isOpen]);

  if (!isOpen || !file) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      backgroundColor: 'rgba(0,0,0,0.85)',
      backdropFilter: 'blur(15px)',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <div style={{
        backgroundColor: colors.card,
        width: '100%',
        maxWidth: 500,
        borderRadius: 28,
        overflow: 'hidden',
        boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        border: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '16px 24px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: `1px solid ${colors.border}`,
          zIndex: 10
        }}>
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>
            {type === 'video' ? 'Previsualizar vídeo' : 'Previsualizar imagen'}
          </ThemedText>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
          >
            <X size={24} />
          </button>
        </div>

        {/* Media Preview */}
        <div style={{ 
          flex: 1, 
          backgroundColor: '#000', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: 300,
          position: 'relative',
          overflow: 'hidden'
        }}>
          {previewUrl && (
            type === 'video' ? (
              <video 
                src={previewUrl} 
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
                controls 
              />
            ) : (
              <img 
                src={previewUrl} 
                alt="Preview" 
                style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }} 
              />
            )
          )}
        </div>

        {/* Footer info */}
        <div style={{ padding: '16px 24px', backgroundColor: colors.backgroundSecondary, borderTop: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {type === 'video' ? <Play size={18} color={colors.primary} /> : <ImageIcon size={18} color={colors.primary} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <ThemedText style={{ fontSize: 14, fontWeight: 700, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {file.name}
              </ThemedText>
              <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>
                {(file.size / (1024 * 1024)).toFixed(2)} MB
              </ThemedText>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ padding: '20px 24px 24px', display: 'flex', gap: 12 }}>
          <button 
            onClick={onClose}
            style={{
              padding: '14px 24px',
              borderRadius: 16,
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
              borderRadius: 16,
              border: 'none',
              backgroundColor: colors.primary,
              color: '#fff',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
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
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
