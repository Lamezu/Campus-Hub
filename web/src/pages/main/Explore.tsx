import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, increment, addDoc, serverTimestamp, getDoc, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { Images, Video, Music, X, VolumeX, Volume2, Plus } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';
import { auth, db } from '../../config/firebase';
import { uploadPostMedia } from '../../config/firebaseStorage';
import { useTheme } from '../../contexts/ThemeContext';
import { SongPicker } from '../../components/SongPicker';
import { PostCard } from '../../components/PostCards';
import SharePostModal from '../../components/SharePostModal';
import Layout from '../../components/Layout';
import { notificationService } from '../../services/notificationService';
import type { JamendoTrack, Post } from '../../types';
import { useTranslation } from '../../hooks/useTranslation';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;
const POSTS_PER_PAGE = 10;

interface MediaAsset {
  file: File;
  previewUrl: string;
  type: 'image' | 'video';
}

interface UserProfile {
  displayName: string;
  photoURL: string | null;
}

export default function ExploreScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const currentUser = auth.currentUser;
  const [showCreate, setShowCreate] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [sharePost, setSharePost] = useState<Post | null>(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', photoURL: null });

  useEffect(() => {
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(POSTS_PER_PAGE));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Post[] = snapshot.docs
        .map((d) => {
          const post = d.data();
          return {
            id: d.id,
            ...post,
            createdAt: post.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            updatedAt: post.updatedAt?.toDate?.()?.toISOString() ?? null,
          } as Post;
        })
        .filter((p) => p.postType !== 'announcement');
      setPosts(data);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
      setLoading(false);
    }, () => {
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const q = query(
        collection(db, 'posts'),
        orderBy('createdAt', 'desc'),
        startAfter(lastDoc),
        limit(POSTS_PER_PAGE),
      );
      const snapshot = await getDocs(q);
      const newPosts: Post[] = snapshot.docs
        .map((d) => {
          const post = d.data();
          return {
            id: d.id,
            ...post,
            createdAt: post.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            updatedAt: post.updatedAt?.toDate?.()?.toISOString() ?? null,
          } as Post;
        })
        .filter((p) => p.postType !== 'announcement');
      setPosts((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        return [...prev, ...newPosts.filter((p) => !existingIds.has(p.id))];
      });
      setLastDoc(snapshot.docs[snapshot.docs.length - 1] ?? null);
      setHasMore(snapshot.docs.length === POSTS_PER_PAGE);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, lastDoc]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMorePosts(); },
      { threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts]);

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

  const handleDoubleTap = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    if (post?.likes?.includes(currentUser.uid)) return;
    await updateDoc(doc(db, 'posts', postId), {
      likes: arrayUnion(currentUser.uid),
      likesCount: increment(1),
    });
    if (post && post.authorId !== currentUser.uid) {
      notificationService.write(post.authorId, {
        category: 'social',
        title: currentUser.displayName ?? 'Alguien',
        body: `le dio like a tu post "${post.title}"`,
        meta: { postId },
      }).catch(() => { });
    }
  };

  const handleLikeToggle = async (postId: string) => {
    if (!currentUser) return;
    const post = posts.find(p => p.id === postId);
    const isLiked = post?.likes?.includes(currentUser.uid) ?? false;
    await updateDoc(doc(db, 'posts', postId), {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: increment(isLiked ? -1 : 1),
    });
    if (!isLiked && post && post.authorId !== currentUser.uid) {
      notificationService.write(post.authorId, {
        category: 'social',
        title: currentUser.displayName ?? 'Alguien',
        body: `le dio like a tu post "${post.title}"`,
        meta: { postId },
      }).catch(() => { });
    }
  };

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

    setPublishing(true);
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
      setShowCreate(false);
    } catch {
      alert(t('explore.publish_error'));
    } finally {
      setPublishing(false);
    }
  };

  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768);
  useEffect(() => {
    const handler = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  const sidebarSpacerRef = useRef<HTMLDivElement>(null);
  const [sidebarRight, setSidebarRight] = useState<number | null>(null);
  useEffect(() => {
    const update = () => {
      if (sidebarSpacerRef.current) {
        const rect = sidebarSpacerRef.current.getBoundingClientRect();
        setSidebarRight(document.documentElement.clientWidth - rect.right);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  const canPublish = title.trim().length > 0 && !publishing;

  const createForm = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileChange} style={{ display: 'none' }} />

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 14px', backgroundColor: colors.card }}>
        <input
          type="text"
          placeholder={t('explore.social_placeholders.post_title')}
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
          maxLength={TITLE_MAX}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: '600', color: colors.text, padding: '4px 0' }}
        />
        <div style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 2 }}>{title.length}/{TITLE_MAX}</div>
      </div>

      <div style={{ border: `1px solid ${colors.border}`, borderRadius: 12, padding: '8px 14px', backgroundColor: colors.card }}>
        <textarea
          placeholder={t('explore.social_placeholders.post_content')}
          value={content}
          onChange={(e) => setContent(e.target.value.slice(0, CONTENT_MAX))}
          maxLength={CONTENT_MAX}
          rows={2}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: colors.text, resize: 'vertical', lineHeight: '22px', padding: '4px 0', fontFamily: 'inherit' }}
        />
      </div>

      <div
        onClick={media ? undefined : () => fileInputRef.current?.click()}
        style={{ border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden', minHeight: 90, cursor: media ? 'default' : 'pointer', backgroundColor: colors.card, position: 'relative' }}
      >
        {media ? (
          <>
            {media.type === 'image' ? (
              <img src={media.previewUrl} alt="preview" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ height: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.backgroundSecondary }}>
                <Video size={20} color={colors.textSecondary} />
                <span style={{ fontSize: 13, color: colors.textSecondary }}>{t('explore.video_selected')}</span>
                <button
                  onClick={() => setMuteOriginalAudio(prev => !prev)}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', backgroundColor: muteOriginalAudio ? '#FF3B30' : colors.primary, color: '#FFF', fontSize: 12, fontWeight: '600' }}
                >
                  {muteOriginalAudio ? <><VolumeX size={13} /><span>{t('explore.mute_audio')}</span></> : <><Volume2 size={13} /><span>{t('explore.unmute_audio')}</span></>}
                </button>
              </div>
            )}
            <button onClick={removeMedia} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
              <X size={24} color="#FF3B30" strokeWidth={2.5} />
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 6 }}>
            <Images size={24} color={colors.textSecondary} />
            <span style={{ fontSize: 13, color: colors.textSecondary }}>{t('explore.add_media')}</span>
          </div>
        )}
      </div>

      {media && (
        <button
          onClick={() => setShowSongPicker(true)}
          style={{ border: `1px solid ${song ? colors.primary : colors.border}`, borderRadius: 12, padding: 8, cursor: 'pointer', backgroundColor: colors.card, width: '100%', textAlign: 'left' }}
        >
          {song ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {song.coverUrl
                ? <img src={song.coverUrl} alt={song.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover' }} />
                : <div style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={14} color={colors.textSecondary} /></div>
              }
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.name}</div>
                <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.artistName}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setSong(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}>
                <X size={18} color={colors.textSecondary} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Music size={20} color={colors.textSecondary} />
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{t('explore.add_song')}</span>
            </div>
          )}
        </button>
      )}

      <button
        onClick={handlePublish}
        disabled={!canPublish}
        style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', backgroundColor: colors.primary, color: '#FFF', fontSize: 14, fontWeight: '600', cursor: canPublish ? 'pointer' : 'not-allowed', opacity: canPublish ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: '4px', zIndex: 10 }}
      >
        {publishing
          ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.3)', borderTopColor: '#FFF', animation: 'spin 0.8s linear infinite' }} />
          : t('explore.publish_btn')
        }
      </button>
    </div>
  );

  const feed = (
    <>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, padding: 48 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.backgroundSecondary}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : posts.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
          <p style={{ fontSize: 16, color: colors.textSecondary, textAlign: 'center', lineHeight: '24px' }}>{t('explore.no_posts')}</p>
        </div>
      ) : (
        <>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onPress={() => navigate(`/post/${post.id}`)} onDoubleTap={() => handleDoubleTap(post.id)} onLikePress={() => handleLikeToggle(post.id)} onShare={() => setSharePost(post)} currentUserId={currentUser?.uid} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} style={{ display: 'flex', justifyContent: 'center', padding: 16 }}>
              {loadingMore && (
                <div style={{ width: 24, height: 24, borderRadius: '50%', border: `3px solid ${colors.backgroundSecondary}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
              )}
            </div>
          )}
        </>
      )}
    </>
  );

  return (
    <Layout title={t('tabs.explore')} rightAction={<NotificationBell categories={['social']} />}>
      <div style={{ position: 'relative', minHeight: '100%' }}>

        {isDesktop ? (
          <div style={{ display: 'flex', gap: 24, maxWidth: 1150, margin: '0 auto', padding: '16px 24px' }}>
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 40 }}>
              {feed}
            </div>
            <div ref={sidebarSpacerRef} style={{ width: 320, flexShrink: 0 }} />
            <div style={{ position: 'fixed', top: 125, right: sidebarRight ?? 24, width: 320, maxHeight: 'calc(100vh - 130px)', overflowY: 'hidden', backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '20px 20px', zIndex: 5, visibility: sidebarRight === null ? 'hidden' : 'visible' }}>
              <h2 style={{ fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 }}>{t('explore.create_post')}</h2>
              {createForm}
            </div>
          </div>
        ) : (
          !showCreate ? (
            <>
              <button
                onClick={() => setShowCreate(true)}
                style={{ position: 'fixed', bottom: '90px', right: '20px', width: '56px', height: '56px', borderRadius: '28px', backgroundColor: colors.primary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: 100 }}
              >
                <Plus size={28} color="#FFFFFF" />
              </button>
              <div style={{ maxWidth: 600, margin: '0 auto', paddingBottom: '80px' }}>
                {feed}
              </div>
            </>
          ) : (
            <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: '140px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h2 style={{ fontSize: 22, fontWeight: 'bold', color: colors.text }}>{t('explore.create_post')}</h2>
                <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: colors.textSecondary, padding: '4px 8px' }}>✕</button>
              </div>
              {createForm}
            </div>
          )
        )}

        <SongPicker visible={showSongPicker} onClose={() => setShowSongPicker(false)} onSelect={setSong} selected={song} />
      </div>
      <SharePostModal isOpen={!!sharePost} onClose={() => setSharePost(null)} post={sharePost} />
    </Layout>
  );
}