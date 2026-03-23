import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Pin, ImagePlus } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useAnnouncements } from '../../hooks/campus/useAnnouncements';
import { AnnouncementCard } from './AnnouncementCard';
import { ANNOUNCEMENT_CATEGORIES } from '../../constants/announcementCategories';
import { uploadAnnouncementImage } from '../../config/cloudinary';
import { auth } from '../../config/firebase';

type PinDuration = 'permanent' | '1d' | '3d' | '1w' | '1m';

interface AnnouncementsTabProps {
  canCreateAnnouncement: boolean;
  highlightId?: string | null;
}

const PIN_DURATION_LABELS: Record<PinDuration, string> = {
  '1d': '1 día', '3d': '3 días', '1w': '1 sem', '1m': '1 mes', permanent: 'Siempre',
};

export function AnnouncementsTab({ canCreateAnnouncement, highlightId }: AnnouncementsTabProps) {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;
  const isDesktop = useWindowSize();
  const { announcements, loading, createAnnouncement, updateAnnouncement, togglePin, deleteAnnouncement, publishAsSocialPost } = useAnnouncements();

  const [showCreate, setShowCreate] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editingSocialId, setEditingSocialId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    title: '',
    content: '',
    pinned: false,
    pinnedUntil: 'permanent' as PinDuration,
    category: 'general',
    imageUrl: null as string | null,
    imageFile: null as File | null,
    imageOffsetY: 50,
  });

  const resetForm = () => setForm({ title: '', content: '', pinned: false, pinnedUntil: 'permanent', category: 'general', imageUrl: null, imageFile: null, imageOffsetY: 50 });

  const closeModal = () => { resetForm(); setEditingPostId(null); setEditingSocialId(null); setShowCreate(false); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm(f => ({ ...f, imageFile: file, imageUrl: URL.createObjectURL(file) }));
    e.target.value = '';
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;

    let pinnedUntil: string | null = null;
    if (form.pinned) {
      const durations: Record<string, number> = { '1d': 86400000, '3d': 3 * 86400000, '1w': 7 * 86400000, '1m': 30 * 86400000 };
      if (durations[form.pinnedUntil]) pinnedUntil = new Date(Date.now() + durations[form.pinnedUntil]).toISOString();
    }

    let imageUrl = form.imageFile ? null : form.imageUrl;
    if (form.imageFile) {
      setUploadingImage(true);
      try { imageUrl = await uploadAnnouncementImage(form.imageFile); }
      catch { imageUrl = null; }
      finally { setUploadingImage(false); }
    }

    const data = {
      title: form.title.trim(),
      content: form.content.trim(),
      pinned: form.pinned,
      pinnedUntil,
      category: form.category,
      imageUrl,
      imageOffsetY: imageUrl ? form.imageOffsetY : null,
    };

    if (editingPostId) {
      await updateAnnouncement(editingPostId, data, editingSocialId);
    } else {
      await createAnnouncement(data);
    }
    closeModal();
  };

  const handleEdit = (post: any) => {
    setForm({
      title: post.title,
      content: post.content,
      pinned: !!post.pinned,
      pinnedUntil: (post.pinnedUntil || 'permanent') as PinDuration,
      category: post.category || 'general',
      imageUrl: post.imageUrl || null,
      imageFile: null,
      imageOffsetY: post.imageOffsetY ?? 50,
    });
    setEditingPostId(post.id);
    setEditingSocialId(post.socialId ?? null);
    setShowCreate(true);
  };

  const canSave = form.title.trim().length > 0 && form.content.trim().length > 0 && !uploadingImage;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
      {isDesktop ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '16px 32px 8px' }}>
          {canCreateAnnouncement && (
            <button
              onClick={() => { resetForm(); setEditingPostId(null); setShowCreate(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 18px', borderRadius: 10, border: 'none',
                backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              Nuevo anuncio
            </button>
          )}
        </div>
      ) : (
        canCreateAnnouncement && (
          <button
            onClick={() => { resetForm(); setEditingPostId(null); setShowCreate(true); }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              margin: '12px 16px 0', padding: '12px', borderRadius: 10, border: 'none',
              backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            Nuevo anuncio
          </button>
        )
      )}

      <div style={{
        padding: isDesktop ? '8px 32px 32px' : 16,
        display: isDesktop ? 'grid' : 'flex',
        gridTemplateColumns: isDesktop ? 'repeat(2, 1fr)' : undefined,
        flexDirection: isDesktop ? undefined : 'column',
        gap: isDesktop ? 16 : 10,
        overflowY: 'auto',
        flex: 1,
        alignItems: isDesktop ? 'start' : undefined,
      }}>
        {loading && <div style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40, gridColumn: '1 / -1' }}>Cargando...</div>}
        {!loading && announcements.length === 0 && (
          <div style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40, fontSize: 14, gridColumn: '1 / -1' }}>
            {canCreateAnnouncement ? 'Crea el primer anuncio.' : 'No hay anuncios aún.'}
          </div>
        )}
        {announcements.map(item => (
          <AnnouncementCard
            key={item.id}
            post={item}
            highlighted={item.id === highlightId}
            onPress={() => navigate(`/campus/announcement/${item.id}`)}
            onEdit={currentUser?.uid === item.authorId ? () => handleEdit(item) : undefined}
            onPin={currentUser?.uid === item.authorId ? () => togglePin(item.id, !!item.pinned) : undefined}
            onDelete={currentUser?.uid === item.authorId ? () => deleteAnnouncement(item.id) : undefined}
            onPublishSocial={currentUser?.uid === item.authorId ? () => publishAsSocialPost(item) : undefined}
          />
        ))}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ backgroundColor: colors.background, borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 16, fontWeight: 700, color: colors.text }}>{editingPostId ? 'Editar anuncio' : 'Nuevo anuncio'}</span>
              <button
                onClick={handleSave}
                disabled={!canSave}
                style={{ background: 'none', border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 16, fontWeight: 600, color: canSave ? colors.primary : colors.textSecondary }}
              >
                {uploadingImage ? '...' : editingPostId ? 'Guardar' : 'Publicar'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />

              {form.imageUrl ? (
                <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', height: 140 }}>
                  <img src={form.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => setForm(f => ({ ...f, imageUrl: null, imageFile: null }))}
                    style={{ position: 'absolute', top: 8, right: 8, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 8, cursor: 'pointer', padding: 4, display: 'flex' }}
                  >
                    <X size={14} color={colors.text} strokeWidth={2.5} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ border: `1px solid ${colors.border}`, borderRadius: 12, height: 100, backgroundColor: colors.backgroundSecondary, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <ImagePlus size={22} color={colors.textSecondary} strokeWidth={1.5} />
                  <span style={{ fontSize: 13, color: colors.textSecondary }}>Añadir imagen de portada (opcional)</span>
                </button>
              )}

              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, marginBottom: 8 }}>Categoría</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {ANNOUNCEMENT_CATEGORIES.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: `1px solid ${form.category === cat.id ? cat.color : colors.border}`,
                        backgroundColor: form.category === cat.id ? cat.color : colors.backgroundSecondary,
                        color: form.category === cat.id ? '#fff' : colors.text,
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <input
                type="text"
                placeholder="Título del anuncio"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                style={{ fontSize: 18, fontWeight: 700, border: 'none', borderBottom: `1px solid ${colors.border}`, outline: 'none', background: 'transparent', color: colors.text, padding: '8px 0', fontFamily: 'inherit' }}
              />

              <textarea
                placeholder="Escribe el contenido del anuncio..."
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={5}
                style={{ fontSize: 15, border: 'none', outline: 'none', background: 'transparent', color: colors.text, resize: 'vertical', fontFamily: 'inherit', lineHeight: '22px' }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTop: `1px solid ${colors.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pin size={16} color={colors.text} strokeWidth={2} />
                  <span style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>Fijar anuncio</span>
                </div>
                <button
                  onClick={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                  style={{
                    width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    backgroundColor: form.pinned ? colors.primary : colors.border,
                    position: 'relative', transition: 'background-color 0.2s',
                  }}
                >
                  <div style={{
                    width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
                    position: 'absolute', top: 2, left: form.pinned ? 20 : 2, transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {form.pinned && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
                  {(['1d', '3d', '1w', '1m', 'permanent'] as PinDuration[]).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setForm(f => ({ ...f, pinnedUntil: opt }))}
                      style={{
                        padding: '6px 12px', borderRadius: 8, border: `1px solid ${form.pinnedUntil === opt ? colors.primary : colors.border}`,
                        backgroundColor: form.pinnedUntil === opt ? colors.primary + '15' : 'transparent',
                        color: form.pinnedUntil === opt ? colors.primary : colors.textSecondary,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      {PIN_DURATION_LABELS[opt]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
