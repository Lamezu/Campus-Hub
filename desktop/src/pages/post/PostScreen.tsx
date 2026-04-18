import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  doc,
  updateDoc,
  deleteDoc,
  arrayUnion,
  arrayRemove,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  increment,
} from 'firebase/firestore';
import { ChevronLeft, Heart, Play, Pause, Bookmark, X, CornerDownRight, Share2, Pencil, Trash2, MessageCircle, BarChart2 } from 'lucide-react';
import { SharePostModal } from '@/components/SharePostModal';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Post, Comment } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';

export default function PostScreen() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [replyTo, setReplyTo] = useState<{ id: string; authorName: string } | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [isMuted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isPlayingSong, setIsPlayingSong] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const viewProcessed = useRef(false);

  const getTimeAgo = (dateString: string | undefined): string => {
    if (!dateString) return t('common.now');
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return t('common.now');
    const diff = Date.now() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return t('common.now');
    if (minutes < 60) return t('common.time_ago_min', { count: minutes });
    if (hours < 24) return t('common.time_ago_hour', { count: hours });
    if (days < 30) return t('common.time_ago_day', { count: days });
    return date.toLocaleDateString(t('common.locale_code'), { day: 'numeric', month: 'short' });
  };

  useEffect(() => {
    if (!id) return;
    const unsub = onSnapshot(doc(db, 'posts', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setPost({
          id: snap.id,
          ...d,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
        } as Post);
      }
      setLoadingPost(false);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser || !post || viewProcessed.current) return;
    
    const incrementView = async () => {
      const hasViewed = post.views?.includes(currentUser.uid);
      if (hasViewed) {
        viewProcessed.current = true;
        return;
      }

      viewProcessed.current = true;
      try {
        const postRef = doc(db, 'posts', id);
        await updateDoc(postRef, {
          views: arrayUnion(currentUser.uid),
          viewsCount: increment(1)
        });
      } catch (err) {
        console.warn('Silent skip of view increment');
      }
    };

    incrementView();
  }, [id, currentUser, post?.id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'posts', id, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setComments(
        snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          } as Comment;
        }),
      );
    });
  }, [id]);

  useEffect(() => {
    if (post?.song?.audioUrl) {
      const audio = new Audio(post.song.audioUrl);
      audio.loop = true;
      audioRef.current = audio;
      
      const playSong = async () => {
        try {
          await audio.play();
          setIsPlayingSong(true);
        } catch (e) {
          setIsPlayingSong(false);
        }
      };
      
      playSong();

      return () => {
        audio.pause();
        audioRef.current = null;
      };
    }
  }, [post?.song?.id]);

  const toggleSong = () => {
    if (!audioRef.current) return;
    if (isPlayingSong) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(console.error);
    }
    setIsPlayingSong(!isPlayingSong);
  };

  const handleToggleLike = async () => {
    if (!currentUser || !post) return;
    const postRef = doc(db, 'posts', post.id);
    const isLiked = post.likes.includes(currentUser.uid);
    await updateDoc(postRef, {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: increment(isLiked ? -1 : 1),
    });
  };

  const isPostSaved = !!(currentUser && post?.savedBy?.includes(currentUser.uid));

  const toggleSave = async () => {
    if (!currentUser || !post) return;
    try {
      const postRef = doc(db, 'posts', post.id);
      if (isPostSaved) {
        await updateDoc(postRef, { savedBy: arrayRemove(currentUser.uid) });
      } else {
        await updateDoc(postRef, { savedBy: arrayUnion(currentUser.uid) });
      }
    } catch (error) {
      console.error('Error toggling save:', error);
    }
  };

  const handleSendComment = async () => {
    if (!currentUser || !id || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await addDoc(collection(db, 'posts', id, 'comments'), {
        content: commentText.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName || t('profile.username_placeholder'),
        authorPhoto: currentUser.photoURL,
        createdAt: serverTimestamp(),
        parentCommentId: replyTo?.id || null,
        likes: [],
        likesCount: 0
      });
      await updateDoc(doc(db, 'posts', id), {
        commentsCount: increment(1)
      });
      setCommentText('');
      setReplyTo(null);
    } catch (err) {
      console.error('Error adding comment:', err);
    } finally {
      setSendingComment(false);
    }
  };

  const handleToggleCommentLike = async (commentId: string, likes: string[]) => {
    if (!currentUser || !id) return;
    const isLiked = (likes || []).includes(currentUser.uid);
    try {
      const commentRef = doc(db, 'posts', id, 'comments', commentId);
      await updateDoc(commentRef, {
        likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        likesCount: increment(isLiked ? -1 : 1)
      });
    } catch (error) {
      console.error('Error toggling comment like:', error);
    }
  };

  const handleDeletePost = async () => {
    if (!post) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      navigate(-1);
    } catch (error) {
       console.error(error);
    }
  };

  if (loadingPost) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </ThemedView>
    );
  }

  if (!post) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ThemedText style={{ color: colors.textSecondary }}>{t('post_screen.not_found')}</ThemedText>
      </ThemedView>
    );
  }

  const isLiked = currentUser && post.likes.includes(currentUser.uid);

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
      <div style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: colors.card,
      }}>
        <button onClick={() => navigate(-1)} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
          <ChevronLeft size={24} strokeWidth={2} />
          <span style={{ fontWeight: '600' }}>{t('common.back')}</span>
        </button>
        {currentUser?.uid === post.authorId && (
          <div style={{ display: 'flex', gap: spacing.xs }}>
             <button onClick={() => navigate(`/edit-post/${post.id}`)} style={{ padding: spacing.xs, background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
               <Pencil size={20} />
             </button>
             <button onClick={() => setShowDeleteConfirm(true)} style={{ padding: spacing.xs, background: 'none', border: 'none', cursor: 'pointer', color: colors.danger }}>
               <Trash2 size={20} />
             </button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: spacing.md }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: spacing.md }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
               {post.authorPhoto ? <img src={post.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ color: '#FFF', fontWeight: 'bold' }}>{post.authorName[0]}</span>}
            </div>
            <div style={{ marginLeft: spacing.sm }}>
              <ThemedText style={{ fontWeight: '600', display: 'block' }}>{post.authorName}</ThemedText>
              <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{getTimeAgo(post.createdAt)}</ThemedText>
            </div>
          </div>

          <ThemedText style={{ fontSize: 28, fontWeight: 'bold', marginBottom: spacing.md, lineHeight: '36px', display: 'block', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {post.title}
          </ThemedText>
          <ThemedText style={{ fontSize: 16, lineHeight: '24px', marginBottom: spacing.lg, display: 'block', overflowWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
            {post.content}
          </ThemedText>

          {post.mediaUrl && (
            <div style={{ borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', marginBottom: spacing.md, position: 'relative' }}>
              {post.mediaType === 'video' ? (
                <video
                  ref={videoRef}
                  src={post.mediaUrl}
                  style={{ width: '100%', maxHeight: 500, display: 'block' }}
                  controls
                  muted={isMuted || post.muteOriginalAudio}
                  autoPlay
                  loop
                />
              ) : (
                <img src={post.mediaUrl} style={{ width: '100%', height: 'auto', display: 'block' }} alt="" />
              )}
            </div>
          )}

          {post.song && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm, padding: '10px 16px',
              backgroundColor: colors.backgroundSecondary, borderRadius: 10, marginBottom: spacing.lg
            }}>
              <button 
                onClick={toggleSong}
                style={{ 
                  background: 'none', border: 'none', cursor: 'pointer', 
                  color: colors.primary, display: 'flex', alignItems: 'center' 
                }}
              >
                {isPlayingSong ? <Pause size={18} fill={colors.primary} /> : <Play size={18} fill={colors.primary} />}
              </button>
              <ThemedText style={{ fontSize: 14 }}>{post.song.name} · {post.song.artistName}</ThemedText>
            </div>
          )}

            <div style={{ display: 'flex', gap: spacing.md, marginBottom: spacing.lg }}>
              <button onClick={handleToggleLike} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20,
                border: `1px solid ${isLiked ? colors.danger : colors.border}`,
                backgroundColor: isLiked ? `${colors.danger}15` : 'transparent',
                cursor: 'pointer', color: isLiked ? colors.danger : colors.textSecondary
              }}>
                <Heart size={18} fill={isLiked ? colors.danger : 'transparent'} />
                <span style={{ fontWeight: '600' }}>{post.likesCount}</span>
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                <MessageCircle size={18} />
                <span style={{ fontWeight: '600' }}>{post.commentsCount}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                <BarChart2 size={18} />
                <span style={{ fontWeight: '600' }}>{post.viewsCount ?? 0}</span>
              </div>
              <button 
                onClick={() => setShowShareModal(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20,
                  border: `1px solid ${colors.border}`, background: 'transparent',
                  cursor: 'pointer', color: colors.textSecondary, transition: 'all 0.2s',
                }}
              >
                <Share2 size={18} />
                <span style={{ fontWeight: '600' }}>{post.sharesCount ?? 0}</span>
              </button>
              <button 
                onClick={toggleSave}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderRadius: 20,
                  backgroundColor: isPostSaved ? `${colors.primary}15` : 'transparent',
                  border: `1px solid ${isPostSaved ? colors.primary : colors.border}`,
                  cursor: 'pointer', color: isPostSaved ? colors.primary : colors.textSecondary,
                  transition: 'all 0.2s'
                }}
              >
                <Bookmark size={18} fill={isPostSaved ? colors.primary : 'none'} color={isPostSaved ? colors.primary : colors.textSecondary} />
                <span style={{ fontWeight: '600' }}>{isPostSaved ? t('post_screen.saved') : t('post_screen.save')}</span>
              </button>
            </div>

          <div style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.lg }} />

          <div style={{ paddingBottom: 100 }}>
             <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: spacing.md, display: 'block' }}>
               {t('post_screen.comments_title', { count: comments.length })}
             </ThemedText>
             {comments.length === 0 ? (
               <ThemedText style={{ color: colors.textSecondary, textAlign: 'center', display: 'block', padding: '40px 0' }}>
                 {t('post_screen.no_comments')}
               </ThemedText>
             ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing.xl }}>
            {comments
              .filter(comment => !comment.parentCommentId)
              .map((comment) => (
                <div key={comment.id} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: spacing.md }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', flexShrink: 0 }}>
                       {comment.authorPhoto ? <img src={comment.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{comment.authorName[0]}</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ backgroundColor: colors.backgroundSecondary, padding: '12px 16px', borderRadius: '0 16px 16px 16px', position: 'relative' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <ThemedText style={{ fontSize: 13, fontWeight: '800' }}>{comment.authorName}</ThemedText>
                          <ThemedText style={{ fontSize: 11, opacity: 0.5 }}>{getTimeAgo(comment.createdAt)}</ThemedText>
                        </div>
                        <ThemedText style={{ fontSize: 14, lineHeight: 1.5, display: 'block', marginBottom: 8 }}>{comment.content}</ThemedText>
                        
                        <div 
                          style={{ 
                            display: 'flex', alignItems: 'center', gap: 4, 
                            color: currentUser && (comment.likes || []).includes(currentUser.uid) ? colors.primary : colors.textSecondary,
                            cursor: 'pointer', width: 'fit-content'
                          }} 
                          onClick={() => handleToggleCommentLike(comment.id, comment.likes || [])}
                        >
                          <Heart size={14} fill={currentUser && (comment.likes || []).includes(currentUser.uid) ? colors.primary : 'none'} />
                          <span style={{ fontSize: 12, fontWeight: '700' }}>{comment.likesCount || 0}</span>
                        </div>
                      </div>
                      <div style={{ marginTop: 6, paddingLeft: 8 }}>
                        <button 
                          onClick={() => setReplyTo({ id: comment.id, authorName: comment.authorName })}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <CornerDownRight size={12} />
                          {t('post_screen.reply')}
                        </button>
                      </div>
                    </div>
                  </div>

                  {comments
                    .filter(reply => reply.parentCommentId === comment.id)
                    .map(reply => (
                      <div key={reply.id} style={{ position: 'relative', display: 'flex', gap: spacing.md, marginLeft: 52 }}>
                        <div style={{ position: 'absolute', left: -30, top: -20, bottom: 16, width: 2, backgroundColor: colors.border, borderRadius: 1, opacity: 0.5 }} />
                        <div style={{ position: 'absolute', left: -30, bottom: 16, width: 14, height: 2, backgroundColor: colors.border, borderRadius: 1, opacity: 0.5 }} />

                        <div style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', flexShrink: 0 }}>
                           {reply.authorPhoto ? <img src={reply.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{reply.authorName[0]}</span>}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ backgroundColor: colors.backgroundSecondary, padding: '10px 14px', borderRadius: '0 14px 14px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                              <ThemedText style={{ fontSize: 12, fontWeight: '800' }}>{reply.authorName}</ThemedText>
                              <ThemedText style={{ fontSize: 10, opacity: 0.5 }}>{getTimeAgo(reply.createdAt)}</ThemedText>
                            </div>
                            <ThemedText style={{ fontSize: 13, lineHeight: 1.4, display: 'block', marginBottom: 6 }}>{reply.content}</ThemedText>
                            
                            <div 
                              style={{ 
                                display: 'flex', alignItems: 'center', gap: 4, 
                                color: currentUser && (reply.likes || []).includes(currentUser.uid) ? colors.primary : colors.textSecondary,
                                cursor: 'pointer', width: 'fit-content'
                              }} 
                              onClick={() => handleToggleCommentLike(reply.id, reply.likes || [])}
                            >
                              <Heart size={12} fill={currentUser && (reply.likes || []).includes(currentUser.uid) ? colors.primary : 'none'} />
                              <span style={{ fontSize: 11, fontWeight: '700' }}>{reply.likesCount || 0}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
          </div>
             )}
          </div>
        </div>
      </div>

      <div style={{ 
        marginTop: 'auto', 
        padding: '24px 40px 40px 40px', 
        borderTop: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        backgroundColor: colors.card
      }}>
        {replyTo && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 8, 
            padding: '8px 12px', backgroundColor: colors.backgroundSecondary, 
            borderRadius: 12, width: 'fit-content' 
          }}>
            <CornerDownRight size={14} color={colors.primary} />
            <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>
              {t('post_screen.replying_to', { name: replyTo.authorName })}
            </ThemedText>
            <button onClick={() => setReplyTo(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: colors.textSecondary }}>
              <X size={14} />
            </button>
          </div>
        )}
        <div style={{ display: 'flex', gap: spacing.md }}>
          <input
            type="text"
            placeholder={t('post_screen.comment_placeholder')}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSendComment()}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              backgroundColor: colors.backgroundSecondary,
              color: colors.text,
              outline: 'none'
            }}
          />
          <button
            onClick={handleSendComment}
            disabled={!commentText.trim() || sendingComment}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: 'none',
              backgroundColor: commentText.trim() ? colors.primary : `${colors.primary}66`,
              color: '#fff',
              fontWeight: 'bold',
              cursor: commentText.trim() ? 'pointer' : 'default'
            }}
          >
            {sendingComment ? '...' : t('common.send')}
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 18, padding: spacing.lg, width: 300, textAlign: 'center' }}>
            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>{t('post_screen.delete.title')}</ThemedText>
            <ThemedText style={{ fontSize: 14, opacity: 0.7, display: 'block', marginBottom: spacing.lg }}>{t('post_screen.delete.confirm_msg')}</ThemedText>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <button onClick={handleDeletePost} style={{ padding: '12px', borderRadius: 12, backgroundColor: colors.danger, color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer' }}>{t('common.delete')}</button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '12px', borderRadius: 12, border: `1px solid ${colors.border}`, color: colors.text, cursor: 'pointer' }}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <SharePostModal
          post={post}
          onClose={() => setShowShareModal(false)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </ThemedView>
  );
}
