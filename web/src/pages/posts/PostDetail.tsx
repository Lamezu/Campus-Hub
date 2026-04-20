import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  doc, getDoc, deleteDoc, onSnapshot, collection, query, orderBy,
  addDoc, serverTimestamp, updateDoc, arrayUnion, arrayRemove, increment,
} from 'firebase/firestore';
import { Pencil, Trash2, Bookmark, Send, Heart, CornerDownRight, X } from 'lucide-react';
import { unsavePost, savePost } from '../../services/firebase/savedItemsService';
import { notificationService } from '../../services/notificationService';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useTranslation } from '../../hooks/useTranslation';
import { PostCard } from '../../components/PostCards';
import SharePostModal from '../../components/SharePostModal';
import Layout from '../../components/Layout';
import type { Post, Comment } from '../../types';

function getTimeAgo(dateString: string, t: (key: string) => string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return t('post.now');
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t('post.now');
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

interface ReplyingTo {
  commentId: string;
  authorName: string;
  content: string;
}

export default function PostDetail() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const currentUser = auth.currentUser;
  const isDesktop = useWindowSize();
  const { t } = useTranslation();

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [showShare, setShowShare] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'posts', id)).then((snap) => {
      if (!snap.exists()) { navigate(-1); return; }
      const d = snap.data();
      const loaded = {
        id: snap.id, ...d,
        createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        updatedAt: d.updatedAt?.toDate?.()?.toISOString() ?? null,
      } as Post;
      setPost(loaded);
      if (auth.currentUser) {
        setBookmarked((d.savedBy ?? []).includes(auth.currentUser.uid));
      }
      setLoadingPost(false);
    });
  }, [id, navigate]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'posts', id, 'comments'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snap) => {
      setComments(snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id, ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        } as Comment;
      }));
    });
  }, [id]);

  const handleLike = async () => {
    if (!currentUser || !post || !id) return;
    const isLiked = post.likes.includes(currentUser.uid);
    setPost(prev => prev ? {
      ...prev,
      likes: isLiked ? prev.likes.filter(uid => uid !== currentUser.uid) : [...prev.likes, currentUser.uid],
      likesCount: prev.likesCount + (isLiked ? -1 : 1),
    } : prev);
    await updateDoc(doc(db, 'posts', id), {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: increment(isLiked ? -1 : 1),
    });
    if (!isLiked && post.authorId !== currentUser.uid) {
      notificationService.write(post.authorId, {
        category: 'social',
        title: currentUser.displayName ?? 'Alguien',
        body: `le dio like a tu post "${post.title}"`,
        meta: { postId: id },
      }).catch(() => {});
    }
  };

  const handleCommentLike = async (comment: Comment) => {
    if (!currentUser || !id) return;
    const isLiked = comment.likes?.includes(currentUser.uid);
    await updateDoc(doc(db, 'posts', id, 'comments', comment.id), {
      likes: isLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: increment(isLiked ? -1 : 1),
    });
  };

  const handleComment = async () => {
    if (!currentUser || !commentText.trim() || !id) return;
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'posts', id, 'comments'), {
        postId: id,
        content: commentText.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName ?? 'Usuario',
        authorPhoto: currentUser.photoURL ?? null,
        createdAt: serverTimestamp(),
        likes: [],
        likesCount: 0,
        ...(replyingTo ? { replyTo: { authorName: replyingTo.authorName, content: replyingTo.content } } : {}),
      });
      await updateDoc(doc(db, 'posts', id), { commentsCount: increment(1) });
      if (post?.authorId && post.authorId !== currentUser.uid) {
        notificationService.write(post.authorId, {
          category: 'social',
          title: currentUser.displayName ?? 'Alguien',
          body: t('post.commented_on', { title: post?.title ?? '' }),
          meta: { postId: id },
        }).catch(() => {});
      }
      setCommentText('');
      setReplyingTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm(t('post.delete_confirm'))) return;
    await deleteDoc(doc(db, 'posts', id));
    navigate('/explore');
  };

  const isAuthor = currentUser?.uid === post?.authorId;

  if (loadingPost || !post) {
    return (
      <Layout title="Post" showBackButton>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
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
      title="Post"
      showBackButton
      rightAction={
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={async () => {
              if (!currentUser || !id) return;
              const next = !bookmarked;
              setBookmarked(next);
              if (next) {
                await savePost(currentUser.uid, id);
              } else {
                await unsavePost(currentUser.uid, id);
              }
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px 6px' }}
          >
            <Bookmark
              size={20}
              color={bookmarked ? colors.primary : colors.textSecondary}
              fill={bookmarked ? colors.primary : 'transparent'}
            />
          </button>
          {isAuthor && (
            <>
              <button
                onClick={() => navigate(`/post/${id}/edit`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px 6px' }}
              >
                <Pencil size={20} color={colors.primary} />
              </button>
              <button
                onClick={handleDelete}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: '4px 6px' }}
              >
                <Trash2 size={20} color="#FF3B30" />
              </button>
            </>
          )}
        </div>
      }
    >
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <PostCard
          post={post}
          onPress={() => {}}
          onDoubleTap={handleLike}
          onLikePress={handleLike}
          onShare={() => setShowShare(true)}
          currentUserId={currentUser?.uid}
          hideMedia
        />

        {post.mediaType === 'image' && post.mediaUrl && (
          <img
            src={post.mediaUrl}
            alt="media"
            style={{ width: '100%', maxHeight: 500, objectFit: 'contain', display: 'block', backgroundColor: '#000' }}
          />
        )}

        {post.mediaType === 'video' && post.mediaUrl && (
          <video
            src={post.mediaUrl}
            controls
            muted={post.muteOriginalAudio}
            style={{ width: '100%', maxHeight: 500, display: 'block', backgroundColor: '#000' }}
          />
        )}

        <div style={{
          padding: '16px',
          borderTop: `1px solid ${colors.border}`,
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.background,
        }}>
          {replyingTo && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 16px', marginBottom: 8,
              backgroundColor: colors.backgroundSecondary,
              borderRadius: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <CornerDownRight size={13} color={colors.primary} />
                <span style={{ fontSize: 12, color: colors.primary, fontWeight: '600' }}>
                  {replyingTo.authorName}
                </span>
                <span style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {replyingTo.content}
                </span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexShrink: 0, padding: '0 0 0 8px' }}
              >
                <X size={16} color={colors.textSecondary} />
              </button>
            </div>
          )}
          
          <div style={{ display: 'flex', gap: 10 }}>
            {currentUser?.photoURL ? (
              <img 
                src={currentUser.photoURL} 
                alt="profile"
                style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
            ) : (
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                backgroundColor: colors.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#FFF', fontSize: 16, fontWeight: 'bold'
              }}>
                {currentUser?.displayName?.charAt(0).toUpperCase() || 'U'}
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder={replyingTo ? t('post.reply_to_placeholder', { name: replyingTo.authorName }) : t('post.add_comment')}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                style={{
                  flex: 1,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 24,
                  padding: '10px 16px',
                  outline: 'none',
                  background: colors.backgroundSecondary,
                  fontSize: 14,
                  color: colors.text,
                }}
              />
              <button
                onClick={handleComment}
                disabled={!commentText.trim() || submitting}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  border: 'none',
                  backgroundColor: commentText.trim() ? colors.primary : colors.backgroundSecondary,
                  cursor: commentText.trim() ? 'pointer' : 'not-allowed',
                  opacity: commentText.trim() ? 1 : 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Send size={16} color={commentText.trim() ? '#FFF' : colors.textSecondary} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '16px' }}>
          <div style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 16 }}>
            {t('post.comments_count', { count: comments.length })}
          </div>

          {comments.length === 0 && (
            <p style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', padding: '16px 0' }}>
              {t('post.no_comments')}
            </p>
          )}

          {comments.map((comment) => {
            const commentLiked = !!(currentUser && comment.likes?.includes(currentUser.uid));
            const replyTo = (comment as any).replyTo as { authorName: string; content: string } | undefined;
            return (
              <div key={comment.id} style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                {comment.authorPhoto ? (
                  <img src={comment.authorPhoto} alt={comment.authorName}
                    style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', backgroundColor: colors.primary,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <span style={{ color: '#FFF', fontWeight: 'bold', fontSize: 13 }}>
                      {comment.authorName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: '8px 12px' }}>
                    {replyTo && (
                      <div style={{
                        borderLeft: `3px solid ${colors.primary}`, paddingLeft: 8, marginBottom: 6,
                        opacity: 0.7,
                      }}>
                        <span style={{ fontSize: 11, fontWeight: '600', color: colors.primary }}>{replyTo.authorName}</span>
                        <p style={{ fontSize: 11, color: colors.textSecondary, margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {replyTo.content}
                        </p>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                      <span style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{comment.authorName}</span>
                      <span style={{ fontSize: 11, color: colors.textSecondary }}>{getTimeAgo(comment.createdAt, t)}</span>
                    </div>
                    <p style={{ fontSize: 14, color: colors.text, margin: 0, lineHeight: '20px' }}>{comment.content}</p>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 4, paddingLeft: 4 }}>
                    <button
                      onClick={() => handleCommentLike(comment)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', gap: 4,
                        color: commentLiked ? '#FF3B30' : colors.textSecondary, fontSize: 12,
                      }}
                    >
                      <Heart size={13} fill={commentLiked ? '#FF3B30' : 'transparent'} color={commentLiked ? '#FF3B30' : colors.textSecondary} strokeWidth={1.8} />
                      {(comment.likesCount ?? 0) > 0 && comment.likesCount}
                    </button>
                    <button
                      onClick={() => {
                        setReplyingTo({ commentId: comment.id, authorName: comment.authorName, content: comment.content });
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        display: 'flex', alignItems: 'center', gap: 4,
                        color: colors.textSecondary, fontSize: 12,
                      }}
                    >
                      <CornerDownRight size={13} strokeWidth={1.8} />
                      {t('post.reply')}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <SharePostModal isOpen={showShare} onClose={() => setShowShare(false)} post={post} />
    </Layout>
  );
}