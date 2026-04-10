import React, { useState, useEffect } from 'react';
import { X, Pin, Image as ImageIcon, Check, Loader2, Trash2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAlert } from '@/contexts/AlertContext';
import { uploadAnnouncementMedia } from '@/config/cloudinary';

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData?: any;
}

const CATEGORIES = [
  { id: 'general',    label: 'General',         color: '#8E8E93' },
  { id: 'erasmus',    label: 'Erasmus+',         color: '#007AFF' },
  { id: 'matricula',  label: 'Matrícula',        color: '#34C759' },
  { id: 'eventos',    label: 'Eventos',          color: '#AF52DE' },
  { id: 'fct',        label: 'Prácticas FCT',    color: '#FF6B35' },
  { id: 'becas',      label: 'Becas',            color: '#5AC8FA' },
  { id: 'evaluacion', label: 'Evaluación',       color: '#FF3B30' },
];

export function AnnouncementModal({ isOpen, onClose, onSave, initialData }: AnnouncementModalProps) {
  const { colors } = useTheme();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    pinned: false,
    category: 'general',
    imageUrl: '',
  });

  useEffect(() => {
    if (initialData) {
      setForm({
        title: initialData.title || '',
        content: initialData.content || '',
        pinned: initialData.pinned || false,
        category: initialData.category || 'general',
        imageUrl: initialData.imageUrl || '',
      });
    } else {
      setForm({ title: '', content: '', pinned: false, category: 'general', imageUrl: '' });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!form.title || !form.content) return;
    setLoading(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Error al guardar el anuncio', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      console.log('Starting image upload for file:', file.name);
      const url = await uploadAnnouncementMedia(file, initialData?.id || 'new');
      console.log('Upload successful, URL:', url);
      setForm(prev => ({ ...prev, imageUrl: url }));
    } catch (err) {
      console.error(err);
      showAlert({ title: 'Error', message: 'Error al subir la imagen', type: 'error' });
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 600,
        backgroundColor: colors.background,
        borderRadius: 24,
        boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: colors.text }}>
            {initialData ? 'Editar Anuncio' : 'Nuevo Anuncio'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 32, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Category Selection */}
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: colors.textSecondary, marginBottom: 12, textTransform: 'uppercase' }}>
              Categoría
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setForm({ ...form, category: cat.id })}
                  style={{
                    padding: '8px 16px',
                    borderRadius: 12,
                    border: `2px solid ${form.category === cat.id ? cat.color : colors.border}`,
                    backgroundColor: form.category === cat.id ? cat.color + '15' : 'transparent',
                    color: form.category === cat.id ? cat.color : colors.textSecondary,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>Título</label>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Introduce un título impactante..."
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                fontSize: 16,
                outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>Contenido</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              placeholder="¿Qué quieres anunciar?"
              rows={6}
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundSecondary,
                color: colors.text,
                fontSize: 15,
                outline: 'none',
                resize: 'none',
              }}
            />
          </div>

          {/* Image Upload Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary, textTransform: 'uppercase' }}>Imagen de Portada (Opcional)</label>
            
            {form.imageUrl ? (
              <div style={{ position: 'relative', width: '100%', height: 200, borderRadius: 16, overflow: 'hidden', border: `1px solid ${colors.border}` }}>
                <img src={form.imageUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button 
                  onClick={() => setForm({ ...form, imageUrl: '' })}
                  style={{
                    position: 'absolute', top: 12, right: 12,
                    backgroundColor: 'rgba(255,59,48,0.9)', color: '#fff',
                    border: 'none', borderRadius: '50%', width: 32, height: 32,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById('announcement-image-input')?.click();
                }}
                disabled={uploadingImage}
                style={{
                  width: '100%', height: 120, borderRadius: 16,
                  border: `2px dashed ${colors.border}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 8, cursor: 'pointer', backgroundColor: colors.backgroundSecondary,
                  transition: 'background 0.2s', color: colors.textSecondary
                }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.border + '15'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
              >
                {uploadingImage ? (
                  <Loader2 className="animate-spin" size={24} color={colors.primary} />
                ) : (
                  <>
                    <ImageIcon size={24} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Cargar imagen</span>
                  </>
                )}
              </button>
            )}
            <input 
              id="announcement-image-input"
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageUpload}
            />
          </div>

          <div 
            onClick={() => setForm({ ...form, pinned: !form.pinned })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderRadius: 16,
              backgroundColor: form.pinned ? colors.primary + '10' : colors.backgroundSecondary,
              cursor: 'pointer',
              border: `1px solid ${form.pinned ? colors.primary : 'transparent'}`,
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Pin size={20} color={form.pinned ? colors.primary : colors.textSecondary} fill={form.pinned ? colors.primary : 'none'} />
              <div>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 700, color: colors.text }}>Fijar anuncio</span>
                <span style={{ display: 'block', fontSize: 12, color: colors.textSecondary }}>Aparecerá destacado al principio del tablón</span>
              </div>
            </div>
            <div style={{
              width: 44, height: 24, borderRadius: 12,
              backgroundColor: form.pinned ? colors.primary : colors.border,
              position: 'relative', transition: 'all 0.2s',
            }}>
              <div style={{
                position: 'absolute', top: 2, left: form.pinned ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff',
                transition: 'all 0.2s',
              }} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '24px 32px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 12,
        }}>
          <button onClick={onClose} style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: 'none',
            backgroundColor: colors.backgroundSecondary,
            color: colors.text,
            fontWeight: 700,
            cursor: 'pointer',
          }}>
            Cancelar
          </button>
          <button 
            onClick={handleSave}
            disabled={!form.title || !form.content || loading}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: colors.primary,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
              opacity: (!form.title || !form.content || loading) ? 0.5 : 1,
            }}
          >
            {loading ? 'Guardando...' : initialData ? 'Guardar Cambios' : 'Publicar Anuncio'}
          </button>
        </div>
      </div>
    </div>
  );
}
