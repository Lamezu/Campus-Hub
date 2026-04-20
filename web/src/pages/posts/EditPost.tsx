import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Images, Video, Music, X, VolumeX, Volume2 } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { uploadPostMedia } from '../../config/cloudinary';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { SongPicker } from '../../components/SongPicker';
import Layout from '../../components/Layout';
import type { JamendoTrack } from '../../types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface NewMedia {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

export default function EditPostScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | null>(null);
  const [newMedia, setNewMedia] = useState<NewMedia | null>(null);
  const [mediaRemoved, setMediaRemoved] = useState(false);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'posts', id)).then((snap) => {
      if (!snap.exists()) {
        alert('Post no encontrado.');
        navigate(-1);
        return;
      }
      const d = snap.data();
      if (d.authorId !== auth.currentUser?.uid) {
        alert(t('post.no_permission'));
        navigate(-1);
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

  useEffect(() => {
    return () => {
      if (newMedia) URL.revokeObjectURL(newMedia.previewUrl);
    };
  }, [newMedia]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (newMedia) URL.revokeObjectURL(newMedia.previewUrl);

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    setNewMedia({ file, previewUrl, type });
    setMediaRemoved(false);
    if (type === 'image') {
      setMuteOriginalAudio(false);
      setSong(null);
    }

    e.target.value = '';
  };

  const removeMedia = () => {
    if (newMedia) URL.revokeObjectURL(newMedia.previewUrl);
    setNewMedia(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setMediaRemoved(true);
    setMuteOriginalAudio(false);
    setSong(null);
  };

  const handleSave = async () => {
    if (!id || !title.trim()) return;
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
    } catch {
      alert(t('post.save_error'));
    } finally {
      setSaving(false);
    }
  };

  const currentMediaPreview = newMedia?.previewUrl ?? (mediaRemoved ? null : existingMediaUrl);
  const currentMediaType = newMedia?.type ?? (mediaRemoved ? null : existingMediaType);
  const hasMedia = !!currentMediaPreview;
  const canSave = title.trim().length > 0 && !saving;

  if (loading) {
    return (
      <Layout title={t('common.edit')} showBackButton>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: `3px solid ${colors.backgroundSecondary}`,
            borderTopColor: colors.primary,
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title={t('common.edit')}
      showBackButton
      rightAction={
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{
            padding: '6px 16px', borderRadius: 16, border: 'none',
            backgroundColor: colors.primary, color: '#FFF',
            fontWeight: '600', fontSize: 14, cursor: canSave ? 'pointer' : 'not-allowed',
            opacity: canSave ? 1 : 0.5, minWidth: 72,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          {saving ? (
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.3)',
              borderTopColor: '#FFF',
              animation: 'spin 0.8s linear infinite',
            }} />
          ) : t('common.save')}
        </button>
      }
    >
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 16px', backgroundColor: colors.card }}>
          <input
            type="text"
            placeholder={t('post.title_placeholder')}
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            maxLength={TITLE_MAX}
            style={{
              width: '100%', border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, fontWeight: '600', color: colors.text, padding: '6px 0',
            }}
          />
          <div style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'right', marginTop: 4 }}>
            {title.length}/{TITLE_MAX}
          </div>
        </div>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 16px', backgroundColor: colors.card }}>
          <textarea
            placeholder={t('post.write_something')}
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
            maxLength={CONTENT_MAX}
            rows={6}
            style={{
              width: '100%', border: 'none', outline: 'none', background: 'transparent',
              fontSize: 16, color: colors.text, resize: 'vertical', lineHeight: '22px',
              padding: '6px 0', fontFamily: 'inherit',
            }}
          />
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />

        <div
          onClick={hasMedia ? undefined : () => fileInputRef.current?.click()}
          style={{
            border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden',
            minHeight: 120, cursor: hasMedia ? 'default' : 'pointer',
            backgroundColor: colors.card, position: 'relative',
          }}
        >
          {hasMedia ? (
            <>
              {currentMediaType === 'image' ? (
                <img
                  src={currentMediaPreview!}
                  alt="preview"
                  style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{
                  height: 160, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 8,
                  backgroundColor: colors.backgroundSecondary,
                }}>
                  <Video size={32} color={colors.textSecondary} />
                  <span style={{ fontSize: 14, color: colors.textSecondary }}>
                    {newMedia ? t('post.video_selected') : t('post.video_current')}
                  </span>
                  <button
                    onClick={() => setMuteOriginalAudio(prev => !prev)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4,
                      padding: '4px 12px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      backgroundColor: muteOriginalAudio ? '#FF3B30' : colors.primary,
                      color: '#FFF', fontSize: 12, fontWeight: '600',
                    }}
                  >
                    {muteOriginalAudio
                      ? <><VolumeX size={14} /><span>{t('post.mute_audio')}</span></>
                      : <><Volume2 size={14} /><span>{t('post.unmute_audio')}</span></>
                    }
                  </button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, padding: 8 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                    backgroundColor: colors.primary, color: '#FFF',
                    fontWeight: '600', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {t('common.change')}
                </button>
                <button
                  onClick={removeMedia}
                  style={{
                    flex: 1, padding: '6px 0', borderRadius: 8, border: 'none',
                    backgroundColor: '#FF3B30', color: '#FFF',
                    fontWeight: '600', fontSize: 14, cursor: 'pointer',
                  }}
                >
                  {t('common.delete')}
                </button>
              </div>
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: 32, gap: 8,
            }}>
              <Images size={28} color={colors.textSecondary} />
              <span style={{ fontSize: 14, color: colors.textSecondary }}>{t('post.add_media')}</span>
            </div>
          )}
        </div>

        {hasMedia && (
          <button
            onClick={() => setShowSongPicker(true)}
            style={{
              border: `1px solid ${song ? colors.primary : colors.border}`,
              borderRadius: 12, padding: 16, cursor: 'pointer',
              backgroundColor: colors.card, width: '100%', textAlign: 'left',
            }}
          >
            {song ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {song.coverUrl ? (
                  <img src={song.coverUrl} alt={song.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: 40, height: 40, borderRadius: 6,
                    backgroundColor: colors.backgroundSecondary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Music size={18} color={colors.textSecondary} />
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.name}
                  </div>
                  <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {song.artistName}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSong(null); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
                >
                  <X size={20} color={colors.textSecondary} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Music size={22} color={colors.textSecondary} />
                <span style={{ fontSize: 14, color: colors.textSecondary }}>{t('post.add_song')}</span>
              </div>
            )}
          </button>
        )}
      </div>

      <SongPicker
        visible={showSongPicker}
        onClose={() => setShowSongPicker(false)}
        onSelect={setSong}
        selected={song}
      />
    </Layout>
  );
}
