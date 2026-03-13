import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { uploadPostMedia } from '@/config/cloudinary';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SongPicker } from '@/components/SongPicker';
import { ChevronLeft, Image as ImageIcon, Video as VideoIcon, Music, X, Volume2, VolumeX, Save } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import type { JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

export default function EditPostScreen() {
  const { colors } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | null>(null);
  const [newMedia, setNewMedia] = useState<{ file: File; type: 'image' | 'video'; preview: string } | null>(null);
  const [mediaRemoved, setMediaRemoved] = useState(false);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'confirm'; onConfirm?: () => void }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'confirm' = 'info', onConfirm?: () => void) => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm });
  };

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'posts', id)).then((snap) => {
      if (!snap.exists()) {
        showAlert('Error', 'Post no encontrado.', 'error', () => navigate(-1));
        return;
      }
      const d = snap.data();
      if (d.authorId !== auth.currentUser?.uid) {
        showAlert('Error', 'No tienes permiso para editar este post.', 'error', () => navigate(-1));
        return;
      }
      setTitle(d.title ?? '');
      setContent(d.content ?? '');
      setExistingMediaUrl(d.mediaUrl ?? null);
      setExistingMediaType(d.mediaType ?? null);
      setMuteOriginalAudio(d.muteOriginalAudio ?? false);
      setSong(d.song ?? null);
      setLoading(false);
    });
  }, [id, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      setNewMedia({ file, type, preview: URL.createObjectURL(file) });
      setMediaRemoved(false);
      if (type === 'video') {
        showAlert(
          'Audio del vídeo',
          '¿Quieres silenciar el audio original del vídeo?',
          'confirm',
          () => setMuteOriginalAudio(true)
        );
      }
    }
  };

  const handleSave = async () => {
    if (!id || !title.trim() || saving) return;
    setSaving(true);
    try {
      let finalMediaUrl: string | null = null;
      let finalMediaType: 'image' | 'video' | null = null;

      if (newMedia) {
        finalMediaUrl = await uploadPostMedia(newMedia.file, newMedia.type, id);
        finalMediaType = newMedia.type;
      } else if (!mediaRemoved && existingMediaUrl) {
        finalMediaUrl = existingMediaUrl;
        finalMediaType = existingMediaType;
      }

      await updateDoc(doc(db, 'posts', id), {
        title: title.trim(),
        content: content.trim(),
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        muteOriginalAudio: finalMediaType === 'video' ? muteOriginalAudio : false,
        song: song ?? null,
        updatedAt: serverTimestamp(),
      });

      navigate(-1);
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Error al guardar los cambios.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const currentMediaUri = newMedia?.preview ?? (mediaRemoved ? null : existingMediaUrl);
  const currentMediaType = newMedia?.type ?? (mediaRemoved ? null : existingMediaType);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTop: `2px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: colors.background }}>
      {/* Header */}
      <div style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        backgroundColor: colors.card,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}>
          <ChevronLeft size={24} />
        </button>
        <ThemedText style={{ fontWeight: 'bold' }}>Editar Post</ThemedText>
        <button
          onClick={handleSave}
          disabled={!title.trim() || saving}
          style={{
            backgroundColor: colors.primary, color: '#FFF', border: 'none', borderRadius: 20,
            padding: '6px 16px', fontWeight: 'bold', cursor: 'pointer', opacity: !title.trim() || saving ? 0.5 : 1,
            display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          {saving ? '...' : <Save size={18} />}
          <span>Guardar</span>
        </button>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: spacing.xl }}>
        
        {/* Title Input */}
        <div style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.substring(0, TITLE_MAX))}
            placeholder="Título del post"
            style={{ width: '100%', fontSize: 20, fontWeight: 'bold', border: 'none', outline: 'none', backgroundColor: 'transparent', color: colors.text }}
          />
          <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.5, marginTop: 4 }}>{title.length}/{TITLE_MAX}</div>
        </div>

        {/* Content Input */}
        <div style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: spacing.md, marginBottom: spacing.md }}>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value.substring(0, CONTENT_MAX))}
            placeholder="¿Qué estás pensando?"
            rows={6}
            style={{ width: '100%', fontSize: 16, border: 'none', outline: 'none', backgroundColor: 'transparent', color: colors.text, resize: 'none', fontFamily: 'inherit' }}
          />
          <div style={{ textAlign: 'right', fontSize: 12, opacity: 0.5, marginTop: 4 }}>{content.length}/{CONTENT_MAX}</div>
        </div>

        {/* Media Preview / Picker */}
        <div style={{ marginBottom: spacing.md }}>
          {currentMediaUri ? (
            <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
              {currentMediaType === 'video' ? (
                <video src={currentMediaUri} style={{ width: '100%', display: 'block' }} controls />
              ) : (
                <img src={currentMediaUri} style={{ width: '100%', display: 'block' }} alt="" />
              )}
              <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 8 }}>
                 <button onClick={() => fileInputRef.current?.click()} style={{ padding: '8px 12px', borderRadius: 20, backgroundColor: colors.primary, color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Cambiar</button>
                 <button onClick={() => { 
                   setMediaRemoved(true); 
                   setNewMedia(null); 
                   setExistingMediaUrl(null); 
                   setSong(null); // Clear song when media is removed
                 }} style={{ padding: '8px 12px', borderRadius: 20, backgroundColor: colors.danger, color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Eliminar</button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: '100%', padding: '40px', borderRadius: 12, border: `2px dashed ${colors.border}`,
                backgroundColor: colors.card, color: colors.textSecondary, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12
              }}
            >
              <ImageIcon size={32} />
              <ThemedText>Añadir foto o vídeo</ThemedText>
            </button>
          )}
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" style={{ display: 'none' }} />
        </div>

        {/* Song Picker */}
        {currentMediaUri && (
          <div style={{ marginBottom: spacing.xl }}>
            {song ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: spacing.md, backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 6, backgroundColor: colors.primary, overflow: 'hidden' }}>
                    {song.coverUrl ? <img src={song.coverUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <Music size={20} color="#FFF" style={{ margin: 12 }} />}
                </div>
                <div style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: 'bold', display: 'block' }}>{song.name}</ThemedText>
                  <ThemedText style={{ fontSize: 13, opacity: 0.6 }}>{song.artistName}</ThemedText>
                </div>
                <button onClick={() => setSong(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                   <X size={20} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSongPicker(true)}
                style={{
                  width: '100%', padding: '12px', borderRadius: 12, border: `1px solid ${colors.border}`,
                  backgroundColor: colors.card, color: colors.text, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                <Music size={18} />
                <span>Añadir música</span>
              </button>
            )}
          </div>
        )}

      </div>

      <SongPicker
        visible={showSongPicker}
        onClose={() => setShowSongPicker(false)}
        onSelect={setSong}
        selected={song}
      />
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onConfirm={alertConfig.onConfirm}
        showCancelButton={alertConfig.type === 'confirm'}
        confirmText={alertConfig.type === 'confirm' ? 'Sí' : 'Entendido'}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </ThemedView>
  );
}
