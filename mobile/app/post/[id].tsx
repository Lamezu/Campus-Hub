import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import type { Post, Comment } from '@/types';
import { notificationService } from '@/services/notificationService';
import { forumService } from '@/services/shared';
import { sendPushNotification } from '@/utils/notifications';
import { LazyImage } from '@/components/LazyImage';

function getTimeAgo(dateString: string, t: any, language: string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return t('time_ago.now') || 'Ahora';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t('time_ago.now') || 'Ahora';
  if (minutes < 60) return t('time_ago.minutes', { count: minutes }) || `${minutes}m`;
  if (hours < 24) return t('time_ago.hours', { count: hours }) || `${hours}h`;
  if (days < 30) return t('time_ago.days', { count: days }) || `${days}d`;
  return date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' });
}

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { colors } = useTheme();
  return (
    <LazyImage
      source={uri ? { uri } : undefined}
      style={{ width: size, height: size, borderRadius: size / 2 }}
      placeholderColor={colors.primary}
      showLoader={false}
    />
  );
}

const CommentItem = React.memo(({
  comment,
  onReply,
  onLike,
  onDoubleTap,
  isLiked,
  t,
  language,
  colors,
  replies
}: {
  comment: Comment;
  onReply: () => void;
  onLike: () => void;
  onDoubleTap: () => void;
  isLiked: boolean;
  t: any;
  language: string;
  colors: any;
  replies: Comment[];
}) => {
  return (
    <View>
      <Pressable
        style={styles.commentRow}
        onPress={onDoubleTap}
      >
        <Avatar uri={comment.authorPhoto} name={comment.authorName} size={32} />
        <View style={[styles.commentBubble, { backgroundColor: colors.backgroundSecondary }]}>
          <ThemedText style={[styles.commentAuthor, { color: colors.text }]}>{comment.authorName}</ThemedText>
          <ThemedText style={[styles.commentContent, { color: colors.text }]}>{comment.content}</ThemedText>
          <View style={styles.commentFooter}>
            <ThemedText style={[styles.commentTime, { color: colors.textSecondary }]}>{getTimeAgo(comment.createdAt, t, language)}</ThemedText>
            <TouchableOpacity onPress={onReply} style={styles.commentReplyBtn}>
              <CornerDownRight size={12} color={colors.textSecondary} strokeWidth={2} />
              <ThemedText style={[styles.commentReplyText, { color: colors.textSecondary }]}>{t('post.reply') || 'Responder'}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity onPress={onLike} style={styles.commentLikeBtn} activeOpacity={0.7}>
              <Heart size={14} color={isLiked ? '#FF3B30' : colors.textSecondary} fill={isLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
              {(comment.likesCount ?? 0) > 0 && (
                <ThemedText style={[styles.commentLikeCount, { color: isLiked ? '#FF3B30' : colors.textSecondary }]}>{comment.likesCount}</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>

      {replies.map(reply => (
        <ReplyItem
          key={reply.id}
          reply={reply}
          onLike={() => onLike()} // Aquí debería ser toggleCommentLike(reply.id, reply.likes)
          onDoubleTap={() => onDoubleTap()}
          isLiked={(reply.likes ?? []).includes(auth.currentUser?.uid ?? '')}
          t={t}
          language={language}
          colors={colors}
        />
      ))}
    </View>
  );
});

const ReplyItem = React.memo(({ reply, onLike, onDoubleTap, isLiked, t, language, colors }: any) => (
  <View style={styles.replyRow}>
    <View style={[styles.replyLine, { backgroundColor: colors.border }]} />
    <Pressable style={[styles.commentRow, { flex: 1 }]} onPress={onDoubleTap}>
      <Avatar uri={reply.authorPhoto} name={reply.authorName} size={26} />
      <View style={[styles.commentBubble, { backgroundColor: colors.backgroundSecondary }]}>
        <ThemedText style={[styles.commentAuthor, { color: colors.text }]}>{reply.authorName}</ThemedText>
        <ThemedText style={[styles.commentContent, { color: colors.text }]}>{reply.content}</ThemedText>
        <View style={styles.commentFooter}>
          <ThemedText style={[styles.commentTime, { color: colors.textSecondary }]}>{getTimeAgo(reply.createdAt, t, language)}</ThemedText>
          <TouchableOpacity onPress={onLike} style={styles.commentLikeBtn} activeOpacity={0.7}>
            <Heart size={13} color={isLiked ? '#FF3B30' : colors.textSecondary} fill={isLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
            {(reply.likesCount ?? 0) > 0 && (
              <ThemedText style={[styles.commentLikeCount, { color: isLiked ? '#FF3B30' : colors.textSecondary }]}>{reply.likesCount}</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  </View>
));

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t, language } = useTranslation();
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

  const timeAgo = React.useMemo(() => {
    if (!post?.createdAt) return '';
    return getTimeAgo(post.createdAt, t, language);
  }, [post?.createdAt, t, language]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = forumService.subscribeToPost(id, (newPost: any) => {
      if (newPost) {
        setPost({
          id: newPost.id,
          ...newPost,
          createdAt: newPost.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: newPost.updatedAt?.toDate?.()?.toISOString() ?? null,
        } as Post);

        if (!viewCountedRef.current) {
          viewCountedRef.current = true;
          const isOwnPost = newPost.authorId === currentUser?.uid;
          const alreadyViewed = currentUser && (newPost.views ?? []).includes(currentUser.uid);
          if (!isOwnPost && !alreadyViewed && currentUser) {
            forumService.incrementViews(id, currentUser.uid);
          }
        }
      }
      setLoadingPost(false);
    });
    return typeof unsubscribe === 'function' ? unsubscribe : () => { };
  }, [id, currentUser?.uid]);

  useEffect(() => {
    if (!id) return;
    const unsubscribe = forumService.subscribeToComments(id, (newComments: any[]) => {
      setComments(
        newComments.map((data) => ({
          id: data.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        } as Comment)),
      );
    });
    return typeof unsubscribe === 'function' ? unsubscribe : () => { };
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
      await forumService.deletePost(post.id);
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

    try {
      await forumService.toggleLike(post.id, currentUser.uid);

      if (!isLiked && post.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || t('post.someone') || 'Alguien';
        notificationService.addNotification(post.authorId, {
          category: 'social',
          title: t('post.new_like') || 'Nuevo "me gusta"',
          body: t('post.liked_your_post', { name: myName }) || `A ${myName} le gustó tu publicación`,
          meta: { postId: post.id, userId: currentUser.uid }
        });

        // We still need to get the tag for push notification, 
        // using dynamic import to keep dependencies clean in the component.
        import('firebase/firestore').then(async ({ doc, getDoc }) => {
          const { db } = await import('@/config/firebase');
          const uSnap = await getDoc(doc(db, 'users', post.authorId));
          const token = uSnap.data()?.fcmToken;
          if (token) {
            sendPushNotification(token, 'CampusHub', `❤️ ${t('post.liked_your_post', { name: myName }) || `A ${myName} le gustó tu publicación`}: ${post.title}`, { postId: post.id });
          }
        });
      }
    } catch (error) {
      console.error('Like action failed:', error);
    } finally {
      setLikingPost(false);
    }
  };

  const getLikeText = () => {
    const count = post?.likesCount ?? 0;
    if (isLiked) {
      if (count <= 1) return t('post.likes.you_like') || 'Te gusta esto';
      if (count === 2) return t('post.likes.you_and_one') || 'Tú y 1 persona más';
      return t('post.likes.you_and_others', { count: count - 1 }) || `Tú y ${count - 1} personas más`;
    }
    if (count === 0) return '';
    if (count === 1) return t('post.likes.one_likes') || 'A 1 persona le gusta';
    return t('post.likes.others_like', { count }) || `${count} personas les gusta`;
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
    if (!currentUser || !id) return;
    const isLikedComment = likes.includes(currentUser.uid);
    await forumService.toggleCommentLike(id, commentId, currentUser.uid);

    if (!isLikedComment) {
      // Need to find the comment author for notification
      const comment = comments.find(c => c.id === commentId);
      if (comment && comment.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || t('post.someone') || 'Alguien';
        notificationService.addNotification(comment.authorId, {
          category: 'social',
          title: t('post.like_on_comment') || 'Me gusta en tu comentario',
          body: t('post.reacted_to_comment', { name: myName }) || `${myName} reaccionó a tu comentario`,
          meta: { postId: id, commentId }
        });
      }
    }
  };

  const isSaved = !!(currentUser && post?.savedBy?.includes(currentUser.uid));

  const toggleSave = async () => {
    if (!currentUser || !post) return;
    const isCurrentlySaved = isSaved;

    // Manual subcollection update for savedBy as it's not in forumService yet
    // I'll use Import for now to keep the hook clean
    import('firebase/firestore').then(async ({ doc, updateDoc, arrayUnion, arrayRemove }) => {
      const { db } = await import('@/config/firebase');
      const postRef = doc(db, 'posts', post.id);
      if (isCurrentlySaved) {
        await updateDoc(postRef, { savedBy: arrayRemove(currentUser.uid) });
      } else {
        await updateDoc(postRef, { savedBy: arrayUnion(currentUser.uid) });
      }
    });
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
        parentCommentId: replyingToComment?.id ?? null,
      };
      await forumService.addComment(post.id, commentData, currentUser.uid);

      if (post.authorId !== currentUser.uid) {
        const myName = currentUser.displayName || t('post.someone') || 'Alguien';
        notificationService.addNotification(post.authorId, {
          category: 'social',
          title: t('post.new_comment') || 'Nuevo comentario',
          body: t('post.commented_on_post', { name: myName, text: text.substring(0, 40) + (text.length > 40 ? '...' : '') }) || `${myName} comentó en tu publicación: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
          meta: { postId: post.id }
        });

        import('firebase/firestore').then(async ({ doc, getDoc }) => {
          const { db } = await import('@/config/firebase');
          const uSnap = await getDoc(doc(db, 'users', post.authorId));
          const token = uSnap.data()?.fcmToken;
          if (token) {
            sendPushNotification(token, t('post.new_comment') || 'Nuevo comentario', t('post.commented', { name: myName, text: text.substring(0, 60) }) || `${myName} comentó: ${text.substring(0, 60)}`, { postId: post.id });
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
          <ThemedText style={{ color: colors.textSecondary }}>{t('post.not_found') || 'Post no encontrado.'}</ThemedText>
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
          <ThemedText style={[styles.backText, { color: colors.primary }]}>{t('common.back') || 'Volver'}</ThemedText>
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

          <Pressable onPress={(e) => handlePostContentDoubleTap(e.nativeEvent.pageX, e.nativeEvent.pageY)}>
            <View style={styles.authorRow}>
              <Avatar uri={post.authorPhoto} name={post.authorName} size={50} />
              <View style={{ marginLeft: spacing.sm }}>
                <ThemedText style={[styles.authorName, { color: colors.text }]}>{post.authorName}</ThemedText>
                <ThemedText style={[styles.timeAgo, { color: colors.textSecondary }]}>
                  {timeAgo}
                </ThemedText>
              </View>
              {post.postType === 'announcement' && (
                <View style={[styles.announcementBadge, { backgroundColor: colors.primary + '15' }]}>
                  <Pin size={12} color={colors.primary} />
                  <ThemedText style={[styles.announcementBadgeText, { color: colors.primary }]}>{t('post.announcement') || 'Anuncio'}</ThemedText>
                </View>
              )}
              {post.tags?.includes('anuncio') && (
                <TouchableOpacity
                  style={[styles.announcementBadge, { backgroundColor: '#FF950015', marginLeft: spacing.xs }]}
                  onPress={() => router.push({ pathname: '/explore', params: { revealHighlight: post.id } } as any)}
                >
                  <Megaphone size={12} color="#FF9500" />
                  <ThemedText style={[styles.announcementBadgeText, { color: '#FF9500' }]}>{t('post.view_on_board') || 'Ver en Tablón'}</ThemedText>
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
                    <LazyImage source={{ uri: post.mediaUrl! }} style={styles.media} containerStyle={styles.mediaContainer} resizeMode="cover" />
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
            {t('post.comments_count', { count: comments.length }) || `Comentarios (${comments.length})`}
          </ThemedText>

          {comments.length === 0 ? (
            <ThemedText style={[styles.noComments, { color: colors.textSecondary }]}>
              {t('post.no_comments') || 'No hay comentarios aún. ¡Sé el primero!'}
            </ThemedText>
          ) : (
            comments
              .filter(c => !c.parentCommentId && !!c.content?.trim())
              .map((comment) => {
                const replies = comments.filter(c => c.parentCommentId === comment.id && !!c.content?.trim());
                const isCommentLiked = !!(currentUser && (comment.likes ?? []).includes(currentUser.uid));
                return (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    onReply={() => setReplyingToComment({ id: comment.id, authorName: comment.authorName })}
                    onLike={() => toggleCommentLike(comment.id, comment.likes ?? [])}
                    onDoubleTap={() => handleCommentDoubleTap(comment.id, comment.likes ?? [])}
                    isLiked={isCommentLiked}
                    t={t}
                    language={language}
                    colors={colors}
                    replies={replies}
                  />
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
                {t('post.replying_to') || 'Respondiendo a '}
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
            placeholder={t('post.add_comment') || "Añadir un comentario..."}
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
                {t('post.delete_title') || 'Eliminar post'}
              </ThemedText>
              <ThemedText style={[styles.deleteDialogSubtitle, { color: colors.textSecondary }]}>
                {t('post.delete_subtitle') || 'Esta acción no se puede deshacer.'}
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
                : <ThemedText style={[styles.deleteDialogBtnText, { color: '#FF3B30' }]}>{t('common.delete') || 'Eliminar'}</ThemedText>
              }
            </TouchableOpacity>
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.deleteDialogBtn}
              onPress={() => setShowDeleteConfirm(false)}
            >
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.primary, fontWeight: '600' }]}>
                {t('common.cancel') || 'Cancelar'}
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
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  statCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  likeText: {
    fontSize: 13,
    marginBottom: spacing.md,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.md,
  },
  commentsHeader: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  noComments: {
    fontSize: 14,
    textAlign: 'center',
    marginVertical: spacing.xl,
  },
  commentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  commentBubble: {
    flex: 1,
    padding: spacing.sm + 2,
    borderRadius: 12,
  },
  commentAuthor: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  commentContent: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 6,
  },
  commentFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  commentTime: {
    fontSize: 12,
  },
  commentReplyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentReplyText: {
    fontSize: 12,
    fontWeight: '600',
  },
  commentLikeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  commentLikeCount: {
    fontSize: 12,
    fontWeight: '600',
  },
  replyRow: {
    flexDirection: 'row',
    paddingLeft: 44,
  },
  replyLine: {
    width: 2,
    height: '100%',
    marginRight: spacing.sm,
    borderRadius: 1,
  },
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    maxHeight: 100,
    fontSize: 15,
  },
  sendButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBannerTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBannerLabel: {
    fontSize: 12,
  },
  replyBannerName: {
    fontSize: 12,
    fontWeight: '700',
  },
  announcementBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  announcementBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  deleteDialog: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  deleteDialogHeader: {
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
  },
  deleteDialogTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  deleteDialogSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  deleteDialogDivider: {
    height: StyleSheet.hairlineWidth,
  },
  deleteDialogBtn: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteDialogBtnText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
