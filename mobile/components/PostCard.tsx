import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, TouchableOpacity } from 'react-native';
import { Heart, MessageCircle, Music2, Video, ChartNoAxesColumn, Bookmark, Share2, CalendarDays } from 'lucide-react-native';
import { router } from 'expo-router';
import { avatarColor } from '@/utils/avatarColor';
import { ThemedText } from './themed-text';
import { FloatingHeart } from './FloatingHeart';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { useTheme } from '@/contexts/ThemeContext';
import { LazyImage } from './LazyImage';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onDoubleTap?: () => void;
  currentUserId?: string;
  onSave?: () => void;
  onShare?: () => void;
}

function getTimeAgo(dateString: string, t: (key: string) => string): string {
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return t('common.now') || 'Now';
  const diff = Date.now() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return t('common.now') || 'Now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function getVideoThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const thumb = url
      .replace('/video/upload/', '/video/upload/so_0/')
      .replace(/\.(mp4|mov|webm|avi)(\?.*)?$/i, '.jpg');
    return thumb !== url ? thumb : null;
  } catch { return null; }
}

export const PostCard = React.memo(({ post, onPress, onDoubleTap, currentUserId, onSave, onShare }: PostCardProps) => {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const hasImage = post.mediaType === 'image' && !!post.mediaUrl;
  const hasVideo = post.mediaType === 'video';

  const videoThumbnail = React.useMemo(() => hasVideo ? getVideoThumbnail(post.mediaUrl) : null, [hasVideo, post.mediaUrl]);
  const timeAgo = React.useMemo(() => getTimeAgo(post.createdAt, t), [post.createdAt, t]);

  const hasSong = !!post.song;
  const isLiked = !!(currentUserId && post.likes?.includes(currentUserId));
  const isSaved = !!(currentUserId && post.savedBy?.includes(currentUserId));

  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const addHeart = React.useCallback((x: number, y: number) => {
    const id = Date.now();
    setHearts((prev) => [...prev, { id, x, y }]);
  }, []);

  const removeHeart = React.useCallback((id: number) => {
    setHearts((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const handlePress = React.useCallback((x: number, y: number) => {
    const now = Date.now();
    if (now - lastTapRef.current < 250) {
      lastTapRef.current = 0;
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      addHeart(x, y);
      if (!isLiked) onDoubleTap?.();
    } else {
      lastTapRef.current = now;
      tapTimerRef.current = setTimeout(() => {
        onPress();
      }, 250);
    }
  }, [isLiked, onDoubleTap, onPress, addHeart]);

  return (
    <Pressable
      style={[
        styles.container, 
        { 
          backgroundColor: colors.card + '90',
          borderColor: colors.border + '15'
        }
      ]}
      onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.authorRow} pointerEvents="none">
            <LazyImage
              source={post.authorPhoto ? { uri: post.authorPhoto } : undefined}
              style={styles.avatar}
              placeholderColor={avatarColor(post.authorId)}
              showLoader={false}
            />
            <View style={styles.authorMeta}>
              <ThemedText style={[styles.authorName, { color: colors.text }]}>{post.authorName}</ThemedText>
              <ThemedText style={[styles.timeAgo, { color: colors.textSecondary }]}>{timeAgo}</ThemedText>
            </View>
          </View>

          <View pointerEvents="none">
            <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {post.title}
            </ThemedText>

            <ThemedText style={[styles.content, { color: colors.textSecondary }]} numberOfLines={2}>
              {post.content}
            </ThemedText>
          </View>
        </View>

        {hasImage && (
          <View pointerEvents="none">
            <LazyImage
              source={{ uri: post.mediaUrl! }}
              containerStyle={styles.thumbnail}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          </View>
        )}
        {hasVideo && (
          <View style={[styles.thumbnail, styles.videoThumb, { backgroundColor: colors.backgroundSecondary }]} pointerEvents="none">
            {videoThumbnail ? (
              <LazyImage
                source={{ uri: videoThumbnail }}
                style={StyleSheet.absoluteFill}
                resizeMode="cover"
              />
            ) : null}
            <View style={styles.videoOverlay}>
              <Video size={18} color="#fff" strokeWidth={2} />
            </View>
          </View>
        )}
      </View>

      {!!post.linkedEventId && (
        <TouchableOpacity
          style={[styles.eventChip, { borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}
          onPress={() => router.push('/events' as never)}
          hitSlop={{ top: 4, bottom: 4 }}
        >
          <CalendarDays size={13} color={colors.primary} strokeWidth={2} />
          <ThemedText style={[styles.eventChipText, { color: colors.primary }]}>
            {t('events.view_in_events') || 'View in Events'}
          </ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.footer}>
        <View style={styles.stat}>
          <Heart
            size={14}
            color={isLiked ? '#FF3B30' : colors.textSecondary}
            fill={isLiked ? '#FF3B30' : 'transparent'}
            strokeWidth={1.8}
          />
          <ThemedText style={[styles.statText, { color: isLiked ? '#FF3B30' : colors.textSecondary }]}>
            {post.likesCount}
          </ThemedText>
        </View>
        <View style={styles.stat}>
          <MessageCircle size={14} color={colors.textSecondary} strokeWidth={1.8} />
          <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>{post.commentsCount}</ThemedText>
        </View>
        <View style={styles.stat}>
          <ChartNoAxesColumn size={14} color={colors.textSecondary} strokeWidth={1.8} />
          <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>{post.viewsCount ?? 0}</ThemedText>
        </View>
        {hasSong && (
          <View style={styles.stat}>
            <Music2 size={14} color={colors.primary} strokeWidth={1.8} />
          </View>
        )}
        <View style={styles.footerRight}>
          {onSave && (
            <TouchableOpacity onPress={onSave} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Bookmark
                size={14}
                color={isSaved ? colors.primary : colors.textSecondary}
                fill={isSaved ? colors.primary : 'transparent'}
                strokeWidth={1.8}
              />
            </TouchableOpacity>
          )}
          {onShare && (
            <TouchableOpacity onPress={onShare} style={styles.stat} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Share2 size={14} color={colors.textSecondary} strokeWidth={1.8} />
              {(post.sharesCount ?? 0) > 0 && (
                <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>{post.sharesCount}</ThemedText>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {hearts.map((heart) => (
        <FloatingHeart key={heart.id} x={heart.x} y={heart.y} onDone={() => removeHeart(heart.id)} />
      ))}
    </Pressable>
  );
}, (prev, next) => {
  return prev.post.id === next.post.id &&
    prev.post.likesCount === next.post.likesCount &&
    prev.post.commentsCount === next.post.commentsCount &&
    prev.post.viewsCount === next.post.viewsCount &&
    prev.post.likes?.length === next.post.likes?.length &&
    prev.post.savedBy?.length === next.post.savedBy?.length &&
    prev.post.sharesCount === next.post.sharesCount &&
    prev.post.linkedEventId === next.post.linkedEventId;
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: 24,
    marginHorizontal: spacing.md,
    marginVertical: 6,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  main: { flex: 1 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  authorMeta: { marginLeft: spacing.sm },
  authorName: { fontSize: 13, fontWeight: '700' },
  timeAgo: { fontSize: 11, opacity: 0.6, marginTop: 1 },
  title: { fontSize: 16, fontWeight: '800', marginBottom: 4, letterSpacing: -0.2 },
  content: { fontSize: 14, lineHeight: 20, marginBottom: spacing.md, opacity: 0.8 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  footerRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 13, fontWeight: '600' },
  thumbnail: { width: 84, height: 84, borderRadius: 16, flexShrink: 0 },
  videoThumb: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  videoOverlay: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  eventChip: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, marginBottom: spacing.sm },
  eventChipText: { fontSize: 12, fontWeight: '700' },
});
