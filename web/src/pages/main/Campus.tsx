import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Images, Video, Music, X, VolumeX, Volume2 } from 'lucide-react';
import { auth, db } from '../../config/firebase';
import { uploadPostMedia } from '../../config/cloudinary';
import { useTheme } from '../../contexts/ThemeContext';
import { SongPicker } from '../../components/SongPicker';
import Layout from '../../components/Layout';
import type { JamendoTrack } from '../../types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface MediaAsset {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

interface UserProfile {
  displayName: string;
  photoURL: string | null;
}

export default function CreateScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', photoURL: null });

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

  useEffect(() => {
    return () => {
      if (media) URL.revokeObjectURL(media.previewUrl);
    };
  }, [media]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (media) URL.revokeObjectURL(media.previewUrl);

    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const previewUrl = URL.createObjectURL(file);
    setMedia({ file, previewUrl, type });
    setMuteOriginalAudio(false);
    if (type === 'image') setSong(null);

    e.target.value = '';
  };

  const removeMedia = () => {
    if (media) URL.revokeObjectURL(media.previewUrl);
    setMedia(null);
    setMuteOriginalAudio(false);
    setSong(null);
  };

  const handlePublish = async () => {
    const user = auth.currentUser;
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      const postRef = doc(collection(db, 'posts'));
      let mediaUrl: string | null = null;

      if (media) {
        mediaUrl = await uploadPostMedia(media.file, media.type, postRef.id);
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
      setMedia(null);
      setMuteOriginalAudio(false);
      setSong(null);
      navigate('/explore');
    } catch {
      alert('No se pudo publicar el post. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const canPublish = title.trim().length > 0 && !loading;

  return (
    <Layout title="Crear Post">
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 16px', backgroundColor: colors.card }}>
          <input
            type="text"
            placeholder="Título del post"
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
            placeholder="Escribe tu post aquí..."
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
          onClick={media ? undefined : () => fileInputRef.current?.click()}
          style={{
            border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden',
            minHeight: 120, cursor: media ? 'default' : 'pointer',
            backgroundColor: colors.card, position: 'relative',
          }}
        >
          {media ? (
            <>
              {media.type === 'image' ? (
                <img
                  src={media.previewUrl}
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
                  <span style={{ fontSize: 14, color: colors.textSecondary }}>Vídeo seleccionado</span>
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
                      ? <><VolumeX size={14} /><span>Sin audio</span></>
                      : <><Volume2 size={14} /><span>Con audio</span></>
                    }
                  </button>
                </div>
              )}
              <button
                onClick={removeMedia}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex',
                }}
              >
                <X size={26} color="#FF3B30" strokeWidth={2.5} />
              </button>
            </>
          ) : (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: 32, gap: 8,
            }}>
              <Images size={28} color={colors.textSecondary} />
              <span style={{ fontSize: 14, color: colors.textSecondary }}>Añadir foto o vídeo</span>
            </div>
          )}
        </div>

        {media && (
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
                <span style={{ fontSize: 14, color: colors.textSecondary }}>Añadir canción</span>
              </div>
            )}
          </button>
        )}

        <div style={{ padding: '8px 0', borderTop: `1px solid ${colors.border}` }}>
          <button
            onClick={handlePublish}
            disabled={!canPublish}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              backgroundColor: colors.primary, color: '#FFF', fontSize: 16,
              fontWeight: '600', cursor: canPublish ? 'pointer' : 'not-allowed',
              opacity: canPublish ? 1 : 0.5,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {loading ? (
              <div style={{
                width: 20, height: 20, borderRadius: '50%',
                border: '3px solid rgba(255,255,255,0.3)',
                borderTopColor: '#FFF',
                animation: 'spin 0.8s linear infinite',
              }} />
            ) : 'Publicar'}
          </button>
        </div>
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
