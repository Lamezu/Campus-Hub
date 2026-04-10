import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, increment, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Image as ImageIcon, Video as VideoIcon, Volume2, VolumeX, X, Music, Compass, PlusCircle } from 'lucide-react';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard } from '@/components/PostCard';
import { NotificationBell } from '@/components/NotificationBell';
import { spacing, typography } from '@/constants/styles';
import { AlertModal } from '@/components/AlertModal';
import { SongPicker } from '@/components/SongPicker';
import { uploadPostMedia } from '@/config/cloudinary';
import { toggleSavePost } from '@/services/savedItemsService';
import { SharePostModal } from '@/components/SharePostModal';
import type { Post, JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface MediaAsset {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [activeTab, setActiveTab] = useState<'discover' | 'publish'>('discover');
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [sharingPost, setSharingPost] = useState<Post | null>(null);

  // Publish state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);
  const [profile, setProfile] = useState<{ displayName: string; photoURL: string | null }>({ displayName: '', photoURL: null });
  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({ displayName: d.displayName ?? currentUser.displayName ?? '', photoURL: d.photoURL ?? null });
      }
    });
  }, [currentUser]);

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Post[] = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            ...d,
            createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
          } as Post;
        })
        .filter(p => p.postType !== 'announcement' || p.isPublished);
      setPosts(data);
      setPostsLoading(false);
    }, (error) => {
      console.error('Error listening to posts:', error);
      setPostsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleLike = async (postId: string) => {
    if (!currentUser) return;
    try {
      await updateDoc(doc(db, 'posts', postId), {
        likes: arrayUnion(currentUser.uid),
        likesCount: increment(1),
      });
    } catch (error) {
      console.error('Error liking post:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const type = file.type.startsWith('video/') ? 'video' : 'image';
    const preview = URL.createObjectURL(file);
    setMedia({ file, preview, type });
    if (type !== 'video') {
      setMuteOriginalAudio(false);
      setSong(null);
    }
  };

  const removeMedia = () => {
    if (media) URL.revokeObjectURL(media.preview);
    setMedia(null);
    setMuteOriginalAudio(false);
    setSong(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePublish = async () => {
    if (!currentUser || !title.trim()) return;
    setPublishLoading(true);
    try {
      let mediaUrl: string | null = null;
      if (media) {
        console.log('[Explore] Starting media upload flow...');
        const tempId = doc(collection(db, 'posts')).id;
        mediaUrl = await uploadPostMedia(media.file, media.type, tempId);
        console.log('[Explore] Media upload finished:', mediaUrl);
      }
      await addDoc(collection(db, 'posts'), {
        title: title.trim(),
        content: content.trim(),
        authorId: currentUser.uid,
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
      setActiveTab('discover');
    } catch (error: any) {
      console.error('Error publishing:', error);
      setAlertConfig({ isOpen: true, title: 'Error', message: error.message || 'No se pudo publicar el post. Inténtalo de nuevo.', type: 'error' });
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <ThemedText style={{ fontSize: 20, fontWeight: 'bold' }}>Explorar</ThemedText>
        <NotificationBell category="social" />
      </div>

      {/* Tab Bar */}
      <div style={{
        display: 'flex',
        backgroundColor: colors.card,
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 16px'
      }}>
        <button
          onClick={() => setActiveTab('discover')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === 'discover' ? colors.primary : 'transparent'}`,
            cursor: 'pointer', color: activeTab === 'discover' ? colors.primary : colors.textSecondary,
            fontWeight: activeTab === 'discover' ? '700' : '500', fontSize: 14,
          }}
        >
          <Compass size={18} />
          Descubrir
        </button>
        <button
          onClick={() => setActiveTab('publish')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px', background: 'none', border: 'none',
            borderBottom: `2px solid ${activeTab === 'publish' ? colors.primary : 'transparent'}`,
            cursor: 'pointer', color: activeTab === 'publish' ? colors.primary : colors.textSecondary,
            fontWeight: activeTab === 'publish' ? '700' : '500', fontSize: 14,
          }}
        >
          <PlusCircle size={18} />
          Publicar
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'discover' ? (
          <div style={{ padding: spacing.sm }}>
            {postsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 100 }}>
                <div style={{ width: 40, height: 40, border: `3px solid ${colors.backgroundSecondary}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : posts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: spacing.xl, opacity: 0.5, marginTop: 100 }}>
                <ThemedText style={{ fontSize: 14 }}>No hay publicaciones todavía.</ThemedText>
              </div>
            ) : (
              posts.map(post => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => navigate(`/post/${post.id}`)}
                  onDoubleTap={() => handleLike(post.id)}
                  onSave={() => currentUser && toggleSavePost(currentUser.uid, post.id)}
                  onShare={() => setSharingPost(post)}
                  currentUserId={currentUser?.uid}
                />
              ))
            )}
          </div>
        ) : (
          <div style={{ 
            padding: `${spacing.lg}px ${spacing.md}px`, 
            width: '100%',
            boxSizing: 'border-box',
            maxWidth: '100%'
          }}>
            {/* Post Creation Form */}
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: spacing.md, backgroundColor: colors.card, marginBottom: spacing.md, boxSizing: 'border-box' }}>
              <input
                type="text"
                placeholder="Título del post"
                value={title}
                onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
                style={{ width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: 16, fontWeight: '600', color: colors.text, marginBottom: 4, boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: colors.textSecondary }}>{title.length}/{TITLE_MAX}</div>
            </div>

            <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: spacing.md, backgroundColor: colors.card, marginBottom: spacing.md, boxSizing: 'border-box' }}>
              <textarea
                placeholder="Escribe tu post aquí..."
                value={content}
                onChange={e => setContent(e.target.value.slice(0, CONTENT_MAX))}
                style={{ width: '100%', minHeight: 150, border: 'none', outline: 'none', backgroundColor: 'transparent', fontSize: 14, color: colors.text, resize: 'none', boxSizing: 'border-box' }}
              />
              <div style={{ textAlign: 'right', fontSize: 10, color: colors.textSecondary }}>{content.length}/{CONTENT_MAX}</div>
            </div>

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" style={{ display: 'none' }} />

            <div
              onClick={() => !media && fileInputRef.current?.click()}
              style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: media ? 0 : spacing.xl, backgroundColor: colors.card, cursor: media ? 'default' : 'pointer', textAlign: 'center', position: 'relative', marginBottom: spacing.md, overflow: 'hidden' }}
            >
              {media ? (
                <div style={{ position: 'relative' }}>
                  {media.type === 'image' ? (
                    <img src={media.preview} alt="" style={{ width: '100%', maxHeight: 300, objectFit: 'contain' }} />
                  ) : (
                    <div style={{ height: 150, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.backgroundSecondary }}>
                      <VideoIcon size={32} />
                      <ThemedText style={{ fontSize: 12 }}>Vídeo seleccionado</ThemedText>
                      <button
                        onClick={(e) => { e.stopPropagation(); setMuteOriginalAudio(!muteOriginalAudio); }}
                        style={{ padding: '4px 12px', borderRadius: 12, border: 'none', backgroundColor: muteOriginalAudio ? colors.danger : colors.primary, color: '#fff', fontSize: 11, fontWeight: 'bold', cursor: 'pointer' }}
                      >
                        {muteOriginalAudio ? <VolumeX size={12} /> : <Volume2 size={12} />} {muteOriginalAudio ? 'Sin audio' : 'Con audio'}
                      </button>
                    </div>
                  )}
                  <button onClick={removeMedia} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,45,85,0.1)', border: 'none', padding: 4, borderRadius: '50%', cursor: 'pointer', color: colors.danger }}>
                    <X size={20} />
                  </button>
                </div>
              ) : (
                <div style={{ opacity: 0.5 }}>
                  <ImageIcon size={32} style={{ marginBottom: 8 }} />
                  <ThemedText style={{ fontSize: 13, display: 'block' }}>Añadir foto o vídeo</ThemedText>
                </div>
              )}
            </div>

            {media && (
              <div
                onClick={() => setShowSongPicker(true)}
                style={{ border: `1px solid ${song ? colors.primary : colors.border}`, borderRadius: 12, padding: spacing.md, backgroundColor: colors.card, cursor: 'pointer', marginBottom: spacing.xl, display: 'flex', alignItems: 'center', gap: 12 }}
              >
                {song ? (
                  <>
                    <img src={song.coverUrl} style={{ width: 36, height: 36, borderRadius: 4 }} alt="" />
                    <div style={{ flex: 1 }}>
                      <ThemedText style={{ fontSize: 13, fontWeight: 'bold', display: 'block' }}>{song.name}</ThemedText>
                      <ThemedText style={{ fontSize: 11, opacity: 0.6 }}>{song.artistName}</ThemedText>
                    </div>
                    <X size={18} onClick={(e) => { e.stopPropagation(); setSong(null); }} />
                  </>
                ) : (
                  <>
                    <Music size={20} style={{ opacity: 0.5 }} />
                    <ThemedText style={{ fontSize: 13, opacity: 0.5 }}>Añadir canción</ThemedText>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handlePublish}
              disabled={!title.trim() || publishLoading}
              style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', backgroundColor: title.trim() ? colors.primary : `${colors.primary}66`, color: '#fff', fontWeight: 'bold', cursor: title.trim() ? 'pointer' : 'default' }}
            >
              {publishLoading ? 'Publicando...' : 'Publicar'}
            </button>
          </div>
        )}
      </div>

      <SongPicker visible={showSongPicker} onClose={() => setShowSongPicker(false)} onSelect={setSong} selected={song} />
      <AlertModal isOpen={alertConfig.isOpen} title={alertConfig.title} message={alertConfig.message} type={alertConfig.type} onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))} />

      {sharingPost && (
        <SharePostModal
          post={sharingPost}
          onClose={() => setSharingPost(null)}
        />
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemedView>
  );
}
