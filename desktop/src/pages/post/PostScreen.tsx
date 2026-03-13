import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  getDoc,
} from 'firebase/firestore';
import { ChevronLeft, Heart, Music2, Volume2, VolumeX, BarChart2, MessageCircle, Pencil, Trash2, Send, Play, Pause } from 'lucide-react';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import type { Post, Comment } from '@/types';

function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Ahora';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

export default function PostScreen() {
  const { id } = useParams<{ id: string }>();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const currentUser = auth.currentUser;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  const [isPlayingSong, setIsPlayingSong] = useState(false);

  useEffect(() => {
    if (post?.song?.audioUrl) {
      const audio = new Audio(post.song.audioUrl);
      audio.loop = true;
      audioRef.current = audio;
      
      const playSong = async () => {
        try {
          // Note: Browsers block auto-play until interaction.
          // We'll try to play and if it fails, we keep isPlayingSong false.
          await audio.play();
          setIsPlayingSong(true);
        } catch (e) {
          console.warn('Auto-play blocked');
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

  const handleAddComment = async () => {
    if (!currentUser || !post || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      await addDoc(collection(db, 'posts', post.id, 'comments'), {
        postId: post.id,
        content: commentText.trim(),
        authorId: currentUser.uid,
        authorName: currentUser.displayName ?? 'Usuario',
        authorPhoto: currentUser.photoURL ?? null,
        createdAt: serverTimestamp(),
        likes: [],
        likesCount: 0,
      });
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });
      setCommentText('');
    } finally {
      setSendingComment(false);
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
        <ThemedText style={{ color: colors.textSecondary }}>Post no encontrado.</ThemedText>
      </ThemedView>
    );
  }

  const isLiked = currentUser && post.likes.includes(currentUser.uid);

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
      {/* Header */}
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
          <span style={{ fontWeight: '600' }}>Volver</span>
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
          
          {/* Author info */}
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

          {/* Media */}
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

          {/* Stats */}
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
          </div>

          <div style={{ height: 1, backgroundColor: colors.border, marginBottom: spacing.lg }} />

          {/* Comments Section */}
          <div style={{ paddingBottom: 100 }}>
             <ThemedText style={{ fontSize: 18, fontWeight: 'bold', marginBottom: spacing.md, display: 'block' }}>
               Comentarios ({comments.length})
             </ThemedText>
             {comments.length === 0 ? (
               <ThemedText style={{ color: colors.textSecondary, textAlign: 'center', display: 'block', padding: '40px 0' }}>
                 No hay comentarios aún. ¡Sé el primero!
               </ThemedText>
             ) : (
               comments.map(comment => (
                 <div key={comment.id} style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
                   <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', flexShrink: 0 }}>
                      {comment.authorPhoto ? <img src={comment.authorPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontWeight: 'bold' }}>{comment.authorName[0]}</span>}
                   </div>
                   <div style={{ flex: 1, backgroundColor: colors.backgroundSecondary, borderRadius: 12, padding: spacing.sm }}>
                     <ThemedText style={{ fontWeight: '600', fontSize: 14, display: 'block', marginBottom: 2 }}>{comment.authorName}</ThemedText>
                     <ThemedText style={{ fontSize: 14, lineHeight: '20px' }}>{comment.content}</ThemedText>
                     <div style={{ marginTop: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                       <ThemedText style={{ fontSize: 11, opacity: 0.6 }}>{getTimeAgo(comment.createdAt)}</ThemedText>
                       <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.textSecondary }}>
                         <Heart size={12} />
                         <span style={{ fontSize: 11 }}>{comment.likesCount}</span>
                       </div>
                     </div>
                   </div>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>

      {/* Comment Input */}
      <div style={{
        padding: spacing.md, borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.card, display: 'flex', gap: spacing.sm, alignItems: 'center'
      }}>
        <input
          value={commentText}
          onChange={e => setCommentText(e.target.value)}
          placeholder="Añadir un comentario..."
          style={{
            flex: 1, borderRadius: 20, padding: '10px 16px',
            backgroundColor: colors.backgroundSecondary, color: colors.text,
            border: 'none', outline: 'none', fontSize: 14
          }}
          onKeyDown={e => e.key === 'Enter' && handleAddComment()}
        />
        <button
          onClick={handleAddComment}
          disabled={!commentText.trim() || sendingComment}
          style={{
            padding: '8px 16px', borderRadius: 20, backgroundColor: colors.primary,
            color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer',
            opacity: !commentText.trim() || sendingComment ? 0.5 : 1
          }}
        >
          {sendingComment ? '...' : 'Enviar'}
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 18, padding: spacing.lg, width: 300, textAlign: 'center' }}>
            <ThemedText style={{ fontSize: 18, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>Eliminar post</ThemedText>
            <ThemedText style={{ fontSize: 14, opacity: 0.7, display: 'block', marginBottom: spacing.lg }}>Esta acción no se puede deshacer.</ThemedText>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
              <button onClick={handleDeletePost} style={{ padding: '12px', borderRadius: 12, backgroundColor: colors.danger, color: '#FFF', border: 'none', fontWeight: '600', cursor: 'pointer' }}>Eliminar</button>
              <button onClick={() => setShowDeleteConfirm(false)} style={{ padding: '12px', borderRadius: 12, border: `1px solid ${colors.border}`, color: colors.text, cursor: 'pointer' }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </ThemedView>
  );
}
