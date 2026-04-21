import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Image as ImageIcon, Video as VideoIcon, Volume2, VolumeX, X, Music, CheckCircle } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { auth, db } from '@/config/firebase';
import { uploadPostMedia } from '@/config/cloudinary';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { SongPicker } from '@/components/SongPicker';
import type { JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface MediaAsset {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface UserProfile {
  displayName: string;
  photoURL: string | null;
}

export default function CreateScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', photoURL: null });

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({ displayName: d.displayName ?? user.displayName ?? '', photoURL: d.photoURL ?? null });
      }
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const preview = URL.createObjectURL(file);

    setMedia({ file, preview, type });

    if (type === 'video') {
      // In a real desktop app, we might ask via a custom dialog, but here we can just default to keeping it
      // or show a simple toggle after selection.
      setMuteOriginalAudio(false);
    } else {
      setMuteOriginalAudio(false);
      setSong(null);
    }
  };

  const removeMedia = () => {
    if (media) URL.revokeObjectURL(media.preview);
    setMedia(null);
    setMuteOriginalAudio(false);
    setSong(null); // Clear song when media is removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = async () => {
    const user = auth.currentUser;
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      let mediaUrl: string | null = null;

      if (media) {
        // Generate a temporary ID or use a placeholder, the actual Doc ID is created by addDoc
        // But for consistency with mobile, we could use a pre-generated ID
        const tempId = doc(collection(db, 'posts')).id;
        mediaUrl = await uploadPostMedia(media.file, media.type, tempId);
      }

      await addDoc(collection(db, 'posts'), {
        title: title.trim(),
        content: content.trim(),
        authorId: user.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: null,
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        mediaUrl: mediaUrl ?? null,
        mediaType: media?.type ?? null,
        muteOriginalAudio: media?.type === 'video' ? muteOriginalAudio : false,
        song: song ?? null,
      });

      setTitle('');
      setContent('');
      if (media) URL.revokeObjectURL(media.preview);
      setMedia(null);
      setMuteOriginalAudio(false);
      setSong(null);
      navigate('/tabs/explore');
    } catch (error) {
      console.error('Error publishing post:', error);
      showAlert('Error', 'No se pudo publicar el post. Inténtalo de nuevo.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const canPublish = title.trim().length > 0 && !loading;

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{
        padding: spacing.md,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
      }}>
        <ThemedText style={{ fontSize: typography.sizes.xl, fontWeight: 'bold', color: colors.text }}>
          Crear Post
        </ThemedText>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ padding: spacing.md, maxWidth: 800, margin: '0 auto', width: '100%' }}>
          
          {/* Title Input */}
          <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: `${spacing.sm}px ${spacing.md}px`,
            backgroundColor: colors.card,
            marginBottom: spacing.md,
          }}>
            <input
              type="text"
              placeholder="Título del post"
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: typography.sizes.md,
                fontWeight: '600',
                color: colors.text,
                padding: `${spacing.xs}px 0`,
              }}
            />
            <div style={{ textAlign: 'right', fontSize: typography.sizes.xs, color: colors.textSecondary }}>
              {title.length}/{TITLE_MAX}
            </div>
          </div>

          {/* Content Input */}
          <div style={{
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: `${spacing.sm}px ${spacing.md}px`,
            backgroundColor: colors.card,
            marginBottom: spacing.md,
          }}>
            <textarea
              placeholder="Escribe tu post aquí..."
              value={content}
              onChange={e => setContent(e.target.value.slice(0, CONTENT_MAX))}
              style={{
                width: '100%',
                minHeight: 160,
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: typography.sizes.md,
                lineHeight: '22px',
                color: colors.text,
                resize: 'none',
                padding: `${spacing.xs}px 0`,
              }}
            />
            <div style={{ textAlign: 'right', fontSize: typography.sizes.xs, color: colors.textSecondary }}>
              {content.length}/{CONTENT_MAX}
            </div>
          </div>

          {/* Media Picker */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,video/*"
            style={{ display: 'none' }}
          />

          <div
            onClick={() => !media && fileInputRef.current?.click()}
            style={{
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              overflow: 'hidden',
              minHeight: 120,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              backgroundColor: colors.card,
              cursor: media ? 'default' : 'pointer',
              position: 'relative',
              marginBottom: spacing.md,
            }}
          >
            {media ? (
              <div style={{ position: 'relative' }}>
                {media.type === 'image' ? (
                  <img src={media.preview} alt="Preview" style={{ width: '100%', height: 'auto', maxHeight: 400, objectFit: 'contain', display: 'block' }} />
                ) : (
                  <div style={{
                    height: 200,
                    backgroundColor: colors.backgroundSecondary,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: spacing.sm,
                  }}>
                    <VideoIcon size={32} color={colors.textSecondary} />
                    <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>Vídeo seleccionado</ThemedText>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMuteOriginalAudio(!muteOriginalAudio); }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '4px 12px',
                        borderRadius: 12,
                        border: 'none',
                        backgroundColor: muteOriginalAudio ? colors.danger : colors.primary,
                        color: '#FFF',
                        fontSize: 12,
                        fontWeight: '600',
                        cursor: 'pointer',
                      }}
                    >
                      {muteOriginalAudio ? <VolumeX size={14} /> : <Volume2 size={14} />}
                      {muteOriginalAudio ? 'Sin audio' : 'Con audio'}
                    </button>
                  </div>
                )}
                <button
                  onClick={removeMedia}
                  style={{
                    position: 'absolute',
                    top: spacing.sm,
                    right: spacing.sm,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.danger,
                  }}
                >
                  <X size={26} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
                <ImageIcon size={28} color={colors.textSecondary} />
                <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>Añadir foto o vídeo</ThemedText>
              </div>
            )}
          </div>

          {/* Song Picker Button */}
          {media && (
            <div
              onClick={() => setShowSongPicker(true)}
              style={{
                border: `1px solid ${song ? colors.primary : colors.border}`,
                borderRadius: 12,
                padding: spacing.md,
                backgroundColor: colors.card,
                cursor: 'pointer',
                marginBottom: spacing.xl,
              }}
            >
              {song ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  {song.coverUrl ? (
                    <img src={song.coverUrl} alt="Cover" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Music size={18} color={colors.textSecondary} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText numberOfLines={1} style={{ fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, display: 'block' }}>{song.name}</ThemedText>
                    <ThemedText numberOfLines={1} style={{ fontSize: typography.sizes.xs, color: colors.textSecondary, display: 'block' }}>{song.artistName}</ThemedText>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setSong(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                  <Music size={22} color={colors.textSecondary} />
                  <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>Añadir canción</ThemedText>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{
        padding: spacing.md,
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        display: 'flex',
        justifyContent: 'center',
      }}>
        <button
          onClick={handlePublish}
          disabled={!canPublish}
          style={{
            maxWidth: 400,
            width: '100%',
            padding: '14px 0',
            borderRadius: 10,
            border: 'none',
            backgroundColor: canPublish ? colors.primary : `${colors.primary}60`,
            color: '#FFFFFF',
            fontSize: typography.sizes.md,
            fontWeight: '600',
            cursor: canPublish ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.2s',
          }}
        >
          {loading ? (
            <div style={{ width: 20, height: 20, border: '2px solid #FFF', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            'Publicar'
          )}
        </button>
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
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </ThemedView>
  );
}
