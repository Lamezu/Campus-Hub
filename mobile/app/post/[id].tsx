import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Keyboard,
} from 'react-native';
import { FloatingHeart } from '@/components/FloatingHeart';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useLocalSearchParams, Stack, router, useFocusEffect } from 'expo-router';
import { Audio, Video, ResizeMode, type AVPlaybackStatus } from 'expo-av';
import { ChevronLeft, Heart, Music2, Volume2, VolumeX, ChartNoAxesColumn, MessageCircle, Pencil, Trash2, Bookmark, CornerDownRight, X, Pin, Megaphone } from 'lucide-react-native';
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
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import type { Post, Comment } from '@/types';
import { notificationService } from '@/services/notificationService';
import { sendPushNotification } from '@/utils/notifications';
import { getDoc } from 'firebase/firestore';

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

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { colors } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText style={{ color: '#FFF', fontWeight: 'bold', fontSize: size * 0.4 }}>
        {name.charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const currentUser = auth.currentUser;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingPost, setLoadingPost] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [likingPost, setLikingPost] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingPost, setDeletingPost] = useState(false);
  const [replyingToComment, setReplyingToComment] = useState<{ id: string; authorName: string } | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const videoRef = useRef<Video>(null);
  const videoPlayingRef = useRef(false);
  const videoMutedRef = useRef(false);
  const viewCountedRef = useRef(false);
  const likeScale = useSharedValue(1);
  const likeAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: likeScale.value }] }));

  const postLastTapRef = useRef(0);
  const tapReadyRef = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => { tapReadyRef.current = true; }, 500);
    return () => clearTimeout(t);
  }, []);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const addHeart = (x: number, y: number) => {
    const id = Date.now();
    setHearts((prev) => [...prev, { id, x, y }]);
  };
  const removeHeart = (id: number) => setHearts((prev) => prev.filter((h) => h.id !== id));

  const commentLastTapRef = useRef<{ id: string; time: number }>({ id: '', time: 0 });

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

        if (!viewCountedRef.current) {
          viewCountedRef.current = true;
          const isOwnPost = d.authorId === currentUser?.uid;
          const alreadyViewed = currentUser && (d.views ?? []).includes(currentUser.uid);
          if (!isOwnPost && !alreadyViewed && currentUser) {
            updateDoc(snap.ref, { views: arrayUnion(currentUser.uid), viewsCount: increment(1) });
          }
        }
      }
      setLoadingPost(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('PostDetail Snapshot error:', error);
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
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Comments Snapshot error:', error);
      }
    });
  }, [id]);

  useEffect(() => {
    if (!post?.song) return;
    let mounted = true;

    const startAudio = async () => {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: false });
      if (!mounted) return;
      const { sound } = await Audio.Sound.createAsync(
        { uri: post.song!.audioUrl },
        { shouldPlay: false, isLooping: true },
      );
      if (!mounted) {
        sound.unloadAsync();
        return;
      }
      soundRef.current = sound;
      if (post?.mediaType !== 'video') {
        sound.playAsync();
      } else if (videoPlayingRef.current) {
        sound.playAsync();
      }
    };

    startAudio();
    return () => {
      mounted = false;
      soundRef.current?.unloadAsync();
      soundRef.current = null;
    };
  }, [post?.song?.id]);

  const handleVideoStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    if (status.isMuted !== videoMutedRef.current) {
      videoRef.current?.setStatusAsync({ isMuted: videoMutedRef.current });
    }

    if (soundRef.current) {
      if (status.isPlaying && !videoPlayingRef.current) {
        videoPlayingRef.current = true;
        soundRef.current.playAsync();
      } else if (!status.isPlaying && !status.isBuffering && videoPlayingRef.current) {
        videoPlayingRef.current = false;
        soundRef.current.pauseAsync();
      }
    }
  }, []);

  useFocusEffect(useCallback(() => {
    if (videoPlayingRef.current) {
      videoRef.current?.playAsync();
      soundRef.current?.playAsync();
    }
    return () => {
      videoRef.current?.pauseAsync();
      soundRef.current?.pauseAsync();
    };
  }, []));

  const handleDeletePost = async () => {
    if (!post || deletingPost) return;
    setDeletingPost(true);
    try {
      await deleteDoc(doc(db, 'posts', post.id));
      router.back();
    } catch (error) {
      console.error(error);
    } finally {
      setDeletingPost(false);
    }
  };

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
  }, []);

  const isLiked = !!(currentUser && post?.likes.includes(currentUser.uid));

  const toggleLike = async () => {
    if (!currentUser || !post || likingPost) return;
    setLikingPost(true);
    likeScale.value = withSpring(1.2, {}, () => { likeScale.value = withSpring(1); });
    const postRef = doc(db, 'posts', post.id);

    try {
      if (isLiked) {
        await updateDoc(postRef, {
          likes: arrayRemove(currentUser.uid),
          likesCount: increment(-1),
        });
      } else {
        await updateDoc(postRef, {
          likes: arrayUnion(currentUser.uid),
          likesCount: increment(1),
        });
      }

      if (!isLiked && post.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || 'Alguien';
        notificationService.addNotification(post.authorId, {
          category: 'social',
          title: 'Nuevo "me gusta"',
          body: `A ${myName} le gustó tu publicación`,
          meta: { postId: post.id, userId: currentUser.uid }
        });

        getDoc(doc(db, 'users', post.authorId)).then(uSnap => {
          const token = uSnap.data()?.fcmToken;
          if (token) {
            sendPushNotification(token, 'CampusHub', `❤️ A ${myName} le gustó tu publicación: ${post.title}`, { postId: post.id });
          }
        });
      }
    } catch (error) {
      console.error('Like transaction failed:', error);
    } finally {
      setLikingPost(false);
    }
  };

  const getLikeText = () => {
    const count = post?.likesCount ?? 0;
    if (isLiked) {
      if (count <= 1) return 'Te gusta esto';
      return `Tú y ${count - 1} persona${count - 1 === 1 ? '' : 's'} más`;
    }
    if (count === 0) return '';
    return `${count} persona${count === 1 ? '' : 's'} les gusta`;
  };

  const handlePostContentDoubleTap = (x: number, y: number) => {
    if (!tapReadyRef.current) return;
    Keyboard.dismiss();
    const now = Date.now();
    if (now - postLastTapRef.current < 280) {
      addHeart(x, y);
      if (!isLiked) toggleLike();
    }
    postLastTapRef.current = now;
  };

  const handleCommentDoubleTap = (commentId: string, likes: string[]) => {
    Keyboard.dismiss();
    const now = Date.now();
    const alreadyLiked = currentUser && likes.includes(currentUser.uid);
    if (commentLastTapRef.current.id === commentId && now - commentLastTapRef.current.time < 280) {
      if (!alreadyLiked) toggleCommentLike(commentId, likes);
      commentLastTapRef.current = { id: '', time: 0 };
    } else {
      commentLastTapRef.current = { id: commentId, time: now };
    }
  };

  const toggleCommentLike = async (commentId: string, likes: string[]) => {
    if (!currentUser) return;
    const commentRef = doc(db, 'posts', id, 'comments', commentId);
    const isLikedComment = likes.includes(currentUser.uid);
    await updateDoc(commentRef, {
      likes: isLikedComment ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
      likesCount: increment(isLikedComment ? -1 : 1),
    });

    if (!isLikedComment) {
      const commentSnap = await getDoc(commentRef);
      const commentData = commentSnap.data();
      if (commentData && commentData.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || 'Alguien';
        notificationService.addNotification(commentData.authorId, {
          category: 'social',
          title: 'Me gusta en tu comentario',
          body: `${myName} reaccionó a tu comentario`,
          meta: { postId: id, commentId }
        });
      }
    }
  };

  const isSaved = !!(currentUser && post?.savedBy?.includes(currentUser.uid));

  const toggleSave = async () => {
    if (!currentUser || !post) return;
    const postRef = doc(db, 'posts', post.id);
    if (isSaved) {
      await updateDoc(postRef, { savedBy: arrayRemove(currentUser.uid) });
      setPost(p => p ? { ...p, savedBy: (p.savedBy ?? []).filter(uid => uid !== currentUser.uid) } : p);
    } else {
      await updateDoc(postRef, { savedBy: arrayUnion(currentUser.uid) });
      setPost(p => p ? { ...p, savedBy: [...(p.savedBy ?? []), currentUser.uid] } : p);
    }
  };

  const addComment = async () => {
    if (!currentUser || !post || !commentText.trim() || sendingComment) return;
    setSendingComment(true);
    const text = commentText.trim();
    try {
      const commentData = {
        postId: post.id,
        content: text,
        authorId: currentUser.uid,
        authorName: currentUser.displayName ?? '',
        authorPhoto: currentUser.photoURL ?? null,
        createdAt: serverTimestamp(),
        likes: [],
        likesCount: 0,
        parentCommentId: replyingToComment?.id ?? null,
      };
      await addDoc(collection(db, 'posts', post.id, 'comments'), commentData);
      await updateDoc(doc(db, 'posts', post.id), { commentsCount: increment(1) });

      if (post.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || 'Alguien';
        notificationService.addNotification(post.authorId, {
          category: 'social',
          title: 'Nuevo comentario',
          body: `${myName} comentó en tu publicación: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
          meta: { postId: post.id }
        });

        getDoc(doc(db, 'users', post.authorId)).then(uSnap => {
          const token = uSnap.data()?.fcmToken;
          if (token) {
            sendPushNotification(token, 'Nuevo comentario', `${myName} comentó: ${text.substring(0, 60)}`, { postId: post.id });
          }
        });
      }

      setCommentText('');
      setReplyingToComment(null);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
    } finally {
      setSendingComment(false);
    }
  };

  if (loadingPost) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ThemedText style={{ color: colors.textSecondary }}>Post no encontrado.</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const hasSong = !!post.song;
  const hasMedia = !!post.mediaUrl;
  videoMutedRef.current = isMuted || !!post.muteOriginalAudio;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>Volver</ThemedText>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={toggleSave} style={styles.editBtn}>
            <Bookmark
              size={20}
              color={isSaved ? colors.primary : colors.textSecondary}
              fill={isSaved ? colors.primary : 'transparent'}
              strokeWidth={1.8}
            />
          </TouchableOpacity>
          {post && currentUser?.uid === post.authorId && (
            <>
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/edit-post', params: { id: post.id } } as any)}
                style={styles.editBtn}
              >
                <Pencil size={20} color={colors.primary} strokeWidth={1.8} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowDeleteConfirm(true)} style={styles.editBtn}>
                <Trash2 size={20} color="#FF3B30" strokeWidth={1.8} />
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <Pressable onPress={(e) => handlePostContentDoubleTap(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
            <View style={styles.authorRow}>
              <Avatar uri={post.authorPhoto} name={post.authorName} size={50} />
              <View style={{ marginLeft: spacing.sm }}>
                <ThemedText style={[styles.authorName, { color: colors.text }]}>{post.authorName}</ThemedText>
                <ThemedText style={[styles.timeAgo, { color: colors.textSecondary }]}>{getTimeAgo(post.createdAt)}</ThemedText>
              </View>
              {post.postType === 'announcement' && (
                <View style={[styles.announcementBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Pin size={12} color={colors.primary} />
                  <ThemedText style={[styles.announcementBadgeText, { color: colors.primary }]}>Anuncio</ThemedText>
                </View>
              )}
              {post.tags?.includes('anuncio') && (
                <TouchableOpacity
                  style={[styles.announcementBadge, { backgroundColor: '#FF950015', marginLeft: spacing.xs }]}
                  onPress={() => router.push({ pathname: '/explore', params: { revealHighlight: post.id } } as any)}
                >
                  <Megaphone size={12} color="#FF9500" />
                  <ThemedText style={[styles.announcementBadgeText, { color: '#FF9500' }]}>Ver en Tablón</ThemedText>
                </TouchableOpacity>
              )}
            </View>

            <ThemedText style={[styles.postTitle, { color: colors.text }]}>{post.title}</ThemedText>
            <ThemedText style={[styles.postContent, { color: colors.text }]}>{post.content}</ThemedText>

            {hasMedia && (
              <>
                <View style={[styles.mediaContainer, { marginBottom: hasSong ? spacing.xs : spacing.md }]}>
                  {post.mediaType === 'video' ? (
                    <Video
                      ref={videoRef}
                      source={{ uri: post.mediaUrl! }}
                      style={styles.media}
                      resizeMode={ResizeMode.CONTAIN}
                      shouldPlay
                      isLooping
                      isMuted={isMuted || !!post.muteOriginalAudio}
                      useNativeControls
                      onPlaybackStatusUpdate={handleVideoStatusUpdate}
                    />
                  ) : (
                    <Image source={{ uri: post.mediaUrl! }} style={styles.media} resizeMode="cover" />
                  )}

                  {(post.mediaType === 'video' && !post.muteOriginalAudio) && (
                    <TouchableOpacity style={styles.muteButton} onPress={toggleMute} activeOpacity={0.8}>
                      {isMuted
                        ? <VolumeX size={18} color="#FFFFFF" strokeWidth={2} />
                        : <Volume2 size={18} color="#FFFFFF" strokeWidth={2} />
                      }
                    </TouchableOpacity>
                  )}
                </View>

                {hasSong && (
                  <View style={[styles.songBar, { backgroundColor: colors.backgroundSecondary, marginBottom: spacing.md }]}>
                    {post.song!.coverUrl ? (
                      <Image source={{ uri: post.song!.coverUrl }} style={styles.songBarCover} />
                    ) : (
                      <Music2 size={14} color={colors.textSecondary} strokeWidth={1.8} />
                    )}
                    <ThemedText style={[styles.songBarText, { color: colors.text }]} numberOfLines={1}>
                      {post.song!.name} · {post.song!.artistName}
                    </ThemedText>
                  </View>
                )}
              </>
            )}

            <View style={styles.statsRow}>
              <TouchableOpacity
                style={[styles.likeButton, { borderColor: colors.border }]}
                onPress={toggleLike}
                disabled={likingPost}
                activeOpacity={0.7}
              >
                <Animated.View style={likeAnimatedStyle}>
                  <Heart
                    size={18}
                    color={isLiked ? '#FF3B30' : colors.textSecondary}
                    fill={isLiked ? '#FF3B30' : 'transparent'}
                    strokeWidth={1.8}
                  />
                </Animated.View>
                <ThemedText style={[styles.statCount, { color: isLiked ? '#FF3B30' : colors.textSecondary }]}>
                  {post.likesCount}
                </ThemedText>
              </TouchableOpacity>
              <View style={[styles.statChip, { borderColor: colors.border }]}>
                <MessageCircle size={18} color={colors.textSecondary} strokeWidth={1.8} />
                <ThemedText style={[styles.statCount, { color: colors.textSecondary }]}>{post.commentsCount}</ThemedText>
              </View>
              <View style={[styles.statChip, { borderColor: colors.border }]}>
                <ChartNoAxesColumn size={18} color={colors.textSecondary} strokeWidth={1.8} />
                <ThemedText style={[styles.statCount, { color: colors.textSecondary }]}>{post.viewsCount ?? 0}</ThemedText>
              </View>
            </View>

            {getLikeText() !== '' && (
              <ThemedText style={[styles.likeText, { color: colors.textSecondary }]}>
                {getLikeText()}
              </ThemedText>
            )}

          </Pressable>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <ThemedText style={[styles.commentsHeader, { color: colors.text }]}>
            Comentarios ({comments.length})
          </ThemedText>

          {comments.length === 0 ? (
            <ThemedText style={[styles.noComments, { color: colors.textSecondary }]}>
              No hay comentarios aún. ¡Sé el primero!
            </ThemedText>
          ) : (
            comments
              .filter(c => !c.parentCommentId && !!c.content?.trim())
              .map((comment) => {
                const replies = comments.filter(c => c.parentCommentId === comment.id && !!c.content?.trim());
                const isCommentLiked = !!(currentUser && (comment.likes ?? []).includes(currentUser.uid));
                return (
                  <View key={comment.id}>
                    <Pressable
                      style={styles.commentRow}
                      onPress={() => handleCommentDoubleTap(comment.id, comment.likes ?? [])}
                    >
                      <Avatar uri={comment.authorPhoto} name={comment.authorName} size={32} />
                      <View style={[styles.commentBubble, { backgroundColor: colors.backgroundSecondary }]}>
                        <ThemedText style={[styles.commentAuthor, { color: colors.text }]}>{comment.authorName}</ThemedText>
                        <ThemedText style={[styles.commentContent, { color: colors.text }]}>{comment.content}</ThemedText>
                        <View style={styles.commentFooter}>
                          <ThemedText style={[styles.commentTime, { color: colors.textSecondary }]}>{getTimeAgo(comment.createdAt)}</ThemedText>
                          <TouchableOpacity onPress={() => setReplyingToComment({ id: comment.id, authorName: comment.authorName })} style={styles.commentReplyBtn}>
                            <CornerDownRight size={12} color={colors.textSecondary} strokeWidth={2} />
                            <ThemedText style={[styles.commentReplyText, { color: colors.textSecondary }]}>Responder</ThemedText>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => toggleCommentLike(comment.id, comment.likes ?? [])} style={styles.commentLikeBtn} activeOpacity={0.7}>
                            <Heart size={14} color={isCommentLiked ? '#FF3B30' : colors.textSecondary} fill={isCommentLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
                            {(comment.likesCount ?? 0) > 0 && (
                              <ThemedText style={[styles.commentLikeCount, { color: isCommentLiked ? '#FF3B30' : colors.textSecondary }]}>{comment.likesCount}</ThemedText>
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </Pressable>

                    {replies.map(reply => {
                      const isReplyLiked = !!(currentUser && (reply.likes ?? []).includes(currentUser.uid));
                      return (
                        <View key={reply.id} style={styles.replyRow}>
                          <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
                          <Pressable style={[styles.commentRow, { flex: 1 }]} onPress={() => handleCommentDoubleTap(reply.id, reply.likes ?? [])}>
                            <Avatar uri={reply.authorPhoto} name={reply.authorName} size={26} />
                            <View style={[styles.commentBubble, { backgroundColor: colors.backgroundSecondary }]}>
                              <ThemedText style={[styles.commentAuthor, { color: colors.text }]}>{reply.authorName}</ThemedText>
                              <ThemedText style={[styles.commentContent, { color: colors.text }]}>{reply.content}</ThemedText>
                              <View style={styles.commentFooter}>
                                <ThemedText style={[styles.commentTime, { color: colors.textSecondary }]}>{getTimeAgo(reply.createdAt)}</ThemedText>
                                <TouchableOpacity onPress={() => toggleCommentLike(reply.id, reply.likes ?? [])} style={styles.commentLikeBtn} activeOpacity={0.7}>
                                  <Heart size={13} color={isReplyLiked ? '#FF3B30' : colors.textSecondary} fill={isReplyLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
                                  {(reply.likesCount ?? 0) > 0 && (
                                    <ThemedText style={[styles.commentLikeCount, { color: isReplyLiked ? '#FF3B30' : colors.textSecondary }]}>{reply.likesCount}</ThemedText>
                                  )}
                                </TouchableOpacity>
                              </View>
                            </View>
                          </Pressable>
                        </View>
                      );
                    })}
                  </View>
                );
              })
          )}
          <View style={{ height: spacing.xl }} />
        </ScrollView>

        {replyingToComment && (
          <View style={[styles.replyBanner, { backgroundColor: colors.backgroundSecondary, borderTopColor: colors.border }]}>
            <CornerDownRight size={14} color={colors.primary} strokeWidth={2} />
            <View style={styles.replyBannerTextRow}>
              <ThemedText style={[styles.replyBannerLabel, { color: colors.textSecondary }]}>
                Respondiendo a{' '}
              </ThemedText>
              <ThemedText style={[styles.replyBannerName, { color: colors.text }]} numberOfLines={1}>
                {replyingToComment.authorName}
              </ThemedText>
            </View>
            <TouchableOpacity onPress={() => setReplyingToComment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={15} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        )}
        <View style={[styles.inputBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.commentInput, { backgroundColor: colors.backgroundSecondary, color: colors.text }]}
            placeholder="Añadir un comentario..."
            placeholderTextColor={colors.textSecondary}
            value={commentText}
            onChangeText={setCommentText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }, (!commentText.trim() || sendingComment) && styles.sendButtonDisabled]}
            onPress={addComment}
            disabled={!commentText.trim() || sendingComment}
          >
            {sendingComment ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <ThemedText style={styles.sendButtonText}>Enviar</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {hearts.map((heart) => (
          <FloatingHeart key={heart.id} x={heart.x} y={heart.y} onDone={() => removeHeart(heart.id)} />
        ))}
      </View>

      <Modal
        visible={showDeleteConfirm}
        animationType="fade"
        transparent
        onRequestClose={() => setShowDeleteConfirm(false)}
      >
        <TouchableOpacity
          style={styles.deleteOverlay}
          activeOpacity={1}
          onPress={() => setShowDeleteConfirm(false)}
        >
          <View style={[styles.deleteDialog, { backgroundColor: colors.card }]}>
            <View style={styles.deleteDialogHeader}>
              <ThemedText style={[styles.deleteDialogTitle, { color: colors.text }]}>
                Eliminar post
              </ThemedText>
              <ThemedText style={[styles.deleteDialogSubtitle, { color: colors.textSecondary }]}>
                Esta acción no se puede deshacer.
              </ThemedText>
            </View>
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.deleteDialogBtn}
              onPress={() => { setShowDeleteConfirm(false); handleDeletePost(); }}
              disabled={deletingPost}
            >
              {deletingPost
                ? <ActivityIndicator color="#FF3B30" size="small" />
                : <ThemedText style={[styles.deleteDialogBtnText, { color: '#FF3B30' }]}>Eliminar</ThemedText>
              }
            </TouchableOpacity>
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.deleteDialogBtn}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.primary, fontWeight: '600' }]}>
                Cancelar
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  editBtn: { padding: spacing.xs },
  backText: { fontSize: typography.sizes.md },
  scrollContent: { padding: spacing.md },
  authorRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  authorName: { fontSize: typography.sizes.md, fontWeight: '600' },
  timeAgo: { fontSize: typography.sizes.xs, marginTop: 2 },
  postTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: spacing.md, lineHeight: 32 },
  postContent: { fontSize: typography.sizes.md, lineHeight: 24, marginBottom: spacing.lg },
  mediaContainer: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.md,
    backgroundColor: '#000',
  },
  media: {
    width: '100%',
    height: 320,
  },
  muteButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    padding: 8,
  },
  songBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
  },
  songBarCover: {
    width: 22,
    height: 22,
    borderRadius: 4,
  },
  songBarText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  statCount: { fontSize: typography.sizes.sm, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  commentsHeader: { fontSize: typography.sizes.md, fontWeight: '600', marginBottom: spacing.md },
  noComments: { fontSize: typography.sizes.sm, textAlign: 'center', paddingVertical: spacing.lg },
  commentRow: { flexDirection: 'row', marginBottom: spacing.md, alignItems: 'flex-start', paddingRight: spacing.sm },
  commentBubble: { flex: 1, marginLeft: spacing.sm, borderRadius: 12, padding: spacing.sm, minHeight: 40 },
  commentAuthor: { fontSize: typography.sizes.sm, fontWeight: '600', marginBottom: 2 },
  commentContent: { fontSize: typography.sizes.sm, lineHeight: 20 },
  commentTime: { fontSize: typography.sizes.xs, marginTop: 4 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  commentInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    maxHeight: 100,
  },
  sendButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, minWidth: 64, alignItems: 'center' },
  sendButtonDisabled: { opacity: 0.5 },
  sendButtonText: { color: '#FFF', fontWeight: '600', fontSize: typography.sizes.sm },
  deleteOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  deleteDialog: {
    width: 280,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  deleteDialogHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  deleteDialogTitle: { fontSize: typography.sizes.md, fontWeight: '700', marginBottom: 4 },
  deleteDialogSubtitle: { fontSize: typography.sizes.sm },
  deleteDialogDivider: { height: StyleSheet.hairlineWidth },
  deleteDialogBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  deleteDialogBtnText: { fontSize: typography.sizes.md },
  likeText: { fontSize: typography.sizes.sm, marginTop: -8, marginBottom: spacing.md },
  commentFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  commentLikeBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  commentLikeCount: { fontSize: typography.sizes.xs, fontWeight: '600' },
  commentReplyBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, padding: 4 },
  commentReplyText: { fontSize: typography.sizes.xs },
  replyRow: { flexDirection: 'row', paddingLeft: spacing.lg + spacing.sm },
  replyLine: { width: 2, borderRadius: 1, marginRight: spacing.sm, marginLeft: 4 },
  replyBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 40 },
  replyBannerTextRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  replyBannerLabel: { fontSize: typography.sizes.xs },
  replyBannerName: { fontSize: typography.sizes.xs, fontWeight: '600', flex: 1 },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 'auto',
  },
  announcementBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
});
