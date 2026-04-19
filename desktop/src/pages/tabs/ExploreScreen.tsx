import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, increment, addDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { Image as ImageIcon, Video as VideoIcon, Volume2, VolumeX, X, Music, Compass, PlusCircle } from 'lucide-react';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PostCard } from '@/components/PostCard';
import { NotificationBell } from '@/components/NotificationBell';
import { spacing } from '@/constants/styles';
import { AlertModal } from '@/components/AlertModal';
import { SongPicker } from '@/components/SongPicker';
import { uploadPostMedia } from '@/config/cloudinary';
import { toggleSavePost } from '@/services/savedItemsService';
import { SharePostModal } from '@/components/SharePostModal';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Post as ProjectPost, JamendoTrack } from '@/types/index';

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
  const { t } = useTranslation();
  const currentUser = auth.currentUser;

  const [activeTab, setActiveTab] = useState<'discover' | 'publish'>('discover');
  const [posts, setPosts] = useState<ProjectPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [sharingPost, setSharingPost] = useState<ProjectPost | null>(null);

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
      const data: ProjectPost[] = snapshot.docs
        .map((doc) => {
          const d = doc.data();
          let createdAtStr = new Date().toISOString();
          if (d.createdAt) {
            if (typeof d.createdAt === 'string') {
              createdAtStr = d.createdAt;
            } else if (typeof d.createdAt.toDate === 'function') {
              createdAtStr = d.createdAt.toDate().toISOString();
            } else if (d.createdAt.seconds) {
              createdAtStr = new Date(d.createdAt.seconds * 1000).toISOString();
            }
          }
          let updatedAtStr = null;
          if (d.updatedAt) {
            if (typeof d.updatedAt === 'string') {
               updatedAtStr = d.updatedAt;
            } else if (typeof d.updatedAt.toDate === 'function') {
               updatedAtStr = d.updatedAt.toDate().toISOString();
            } else if (d.updatedAt.seconds) {
               updatedAtStr = new Date(d.updatedAt.seconds * 1000).toISOString();
            }
          }
          return {
            id: doc.id,
            ...d,
            createdAt: createdAtStr,
            updatedAt: updatedAtStr,
          } as ProjectPost;
        })
        .filter((p: ProjectPost) => p.postType !== 'announcement' || p.isPublished);
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
        const tempId = doc(collection(db, 'posts')).id;
        mediaUrl = await uploadPostMedia(media.file, media.type, tempId);
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
      setAlertConfig({ isOpen: true, title: 'Error', message: error.message || t('explore.publish.error_msg'), type: 'error' });
    } finally {
      setPublishLoading(false);
    }
  };

  return (
    <ThemedView style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: `${spacing.lg}px ${spacing.md}px`,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <ThemedText style={{ fontSize: 32, fontWeight: '900', margin: 0 }}>{t('explore.title')}</ThemedText>
        <NotificationBell category="social" size={28} />
      </div>

      <div style={{
        display: 'flex',
        backgroundColor: colors.card + '80',
        backdropFilter: 'blur(10px)',
        borderBottom: `1px solid ${colors.border}`,
        padding: '0 24px',
        gap: 12
      }}>
        <button
          onClick={() => setActiveTab('discover')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px', background: 'none', border: 'none',
            borderBottom: `3px solid ${activeTab === 'discover' ? colors.primary : 'transparent'}`,
            cursor: 'pointer', color: activeTab === 'discover' ? colors.primary : colors.textSecondary,
            fontWeight: activeTab === 'discover' ? '800' : '600', fontSize: 15,
            transition: 'all 0.2s ease'
          }}
        >
          <Compass size={20} strokeWidth={activeTab === 'discover' ? 2.5 : 2} />
          {t('explore.tabs.discover')}
        </button>
        <button
          onClick={() => setActiveTab('publish')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '16px 24px', background: 'none', border: 'none',
            borderBottom: `3px solid ${activeTab === 'publish' ? colors.primary : 'transparent'}`,
            cursor: 'pointer', color: activeTab === 'publish' ? colors.primary : colors.textSecondary,
            fontWeight: activeTab === 'publish' ? '800' : '600', fontSize: 15,
            transition: 'all 0.2s ease'
          }}
        >
          <PlusCircle size={20} strokeWidth={activeTab === 'publish' ? 2.5 : 2} />
          {t('explore.tabs.publish')}
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
                <ThemedText style={{ fontSize: 14 }}>{t('explore.no_posts')}</ThemedText>
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
            padding: '40px 20px',
            width: '100%',
            maxWidth: 800,
            margin: '0 auto',
            boxSizing: 'border-box',
          }}>
            <div style={{
              backgroundColor: colors.card,
              borderRadius: 24,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column'
            }}>
              <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{
                    backgroundColor: colors.backgroundSecondary + '50',
                    borderRadius: 16,
                    padding: '20px',
                    border: `1px solid ${colors.border}`,
                    transition: 'all 0.2s ease',
                    position: 'relative'
                  }}>
                    <input
                      type="text"
                      placeholder={t('explore.publish.title_placeholder')}
                      value={title}
                      onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}
                      style={{ 
                        width: '100%', border: 'none', outline: 'none', backgroundColor: 'transparent', 
                        fontSize: 20, fontWeight: '800', color: colors.text, 
                        boxSizing: 'border-box', padding: 0
                      }}
                    />
                    <div style={{ 
                      position: 'absolute', right: 16, bottom: 8, 
                      fontSize: 10, fontWeight: '700', opacity: 0.4, color: colors.text 
                    }}>
                      {title.length}/{TITLE_MAX}
                    </div>
                  </div>
                </div>

                <div style={{
                  backgroundColor: colors.backgroundSecondary + '50',
                  borderRadius: 16,
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                  minHeight: 180,
                  position: 'relative'
                }}>
                  <textarea
                    placeholder={t('explore.publish.content_placeholder')}
                    value={content}
                    onChange={e => setContent(e.target.value.slice(0, CONTENT_MAX))}
                    style={{ 
                      width: '100%', minHeight: 140, border: 'none', outline: 'none', 
                      backgroundColor: 'transparent', fontSize: 15, color: colors.text, 
                      resize: 'none', boxSizing: 'border-box', padding: 0, fontWeight: '500',
                      lineHeight: '1.6'
                    }}
                  />
                  <div style={{ 
                    position: 'absolute', right: 16, bottom: 8, 
                    fontSize: 10, fontWeight: '700', opacity: 0.4, color: colors.text 
                  }}>
                    {content.length}/{CONTENT_MAX}
                  </div>
                </div>

                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*,video/*" style={{ display: 'none' }} />

                <div
                  onClick={() => !media && fileInputRef.current?.click()}
                  style={{ 
                    borderRadius: 20, 
                    padding: media ? 0 : '40px', 
                    backgroundColor: colors.backgroundSecondary + '80',
                    border: media ? 'none' : `2px dashed ${colors.border}`,
                    cursor: media ? 'default' : 'pointer', 
                    textAlign: 'center', 
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'all 0.3s ease',
                    minHeight: media ? 'auto' : 160,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {media ? (
                    <div style={{ position: 'relative', width: '100%' }}>
                      {media.type === 'image' ? (
                        <div style={{ width: '100%', position: 'relative', paddingTop: '56.25%', backgroundColor: '#000' }}>
                          <img 
                            src={media.preview} 
                            alt="" 
                            style={{ 
                              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
                              objectFit: 'contain' 
                            }} 
                          />
                        </div>
                      ) : (
                        <div style={{ padding: '60px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, backgroundColor: '#000' }}>
                          <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primary + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary }}>
                            <VideoIcon size={32} />
                          </div>
                          <ThemedText style={{ fontSize: 14, fontWeight: '700' }}>{t('explore.publish.video_selected')}</ThemedText>
                          <button
                            onClick={(e) => { e.stopPropagation(); setMuteOriginalAudio(!muteOriginalAudio); }}
                            style={{ 
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '8px 16px', borderRadius: 12, border: 'none', 
                              backgroundColor: muteOriginalAudio ? colors.danger : colors.primary, 
                              color: '#fff', fontSize: 13, fontWeight: '800', cursor: 'pointer' 
                            }}
                          >
                            {muteOriginalAudio ? <VolumeX size={16} /> : <Volume2 size={16} />} 
                            {muteOriginalAudio ? t('explore.publish.audio_off') : t('explore.publish.audio_on')}
                          </button>
                        </div>
                      )}
                      <button 
                        onClick={removeMedia} 
                        style={{ 
                          position: 'absolute', top: 16, right: 16, 
                          backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(10px)',
                          border: 'none', padding: 8, borderRadius: '50%', cursor: 'pointer', color: '#fff',
                          transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }}
                      >
                        <X size={20} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                      <div style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: colors.primary + '10', display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.primary }}>
                        <ImageIcon size={28} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ThemedText style={{ fontSize: 15, fontWeight: '800' }}>{t('explore.publish.add_media')}</ThemedText>
                        <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>{t('explore.gallery_permission_msg')}</ThemedText>
                      </div>
                    </div>
                  )}
                </div>

                {media && (
                  <div
                    onClick={() => setShowSongPicker(true)}
                    style={{ 
                      borderRadius: 16, 
                      padding: '16px 20px', 
                      backgroundColor: song ? colors.primary + '10' : colors.backgroundSecondary + '50',
                      border: `1px solid ${song ? colors.primary : colors.border}`,
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 16,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {song ? (
                      <>
                        <div style={{ position: 'relative', width: 48, height: 48 }}>
                          <img src={song.coverUrl} style={{ width: '100%', height: '100%', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }} alt="" />
                          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                            <Music size={16} />
                          </div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <ThemedText style={{ fontSize: 14, fontWeight: '800', display: 'block' }}>{song.name}</ThemedText>
                          <ThemedText style={{ fontSize: 12, opacity: 0.6, fontWeight: '600' }}>{song.artistName}</ThemedText>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSong(null); }}
                          style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer', padding: 8 }}
                        >
                          <X size={20} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}>
                          <Music size={20} />
                        </div>
                        <ThemedText style={{ fontSize: 14, opacity: 0.6, fontWeight: '700' }}>{t('explore.publish.add_song')}</ThemedText>
                      </>
                    )}
                  </div>
                )}

                <button
                  onClick={handlePublish}
                  disabled={!title.trim() || publishLoading}
                  style={{ 
                    width: '100%', padding: '18px', borderRadius: 16, border: 'none', 
                    backgroundColor: title.trim() ? colors.primary : colors.border, 
                    color: '#fff', fontSize: 16, fontWeight: '900', 
                    cursor: title.trim() && !publishLoading ? 'pointer' : 'default',
                    transition: 'all 0.3s ease',
                    boxShadow: title.trim() ? `0 10px 20px ${colors.primary}40` : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                  }}
                >
                  {publishLoading ? (
                    <div style={{ width: 20, height: 20, border: '3px solid rgba(255,255,255,0.3)', borderTop: '3px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  ) : (
                    <>
                      <PlusCircle size={20} />
                      {t('explore.publish.submit_btn')}
                    </>
                  )}
                </button>
              </div>
            </div>
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
