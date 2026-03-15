import React, { useRef, useState } from 'react';
import { View, Pressable, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Heart, MessageCircle, Music2, Video, ChartNoAxesColumn, Bookmark } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { FloatingHeart } from './FloatingHeart';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onDoubleTap?: () => void;
  currentUserId?: string;
  onSave?: () => void;
}

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

function getVideoThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const thumb = url
      .replace('/video/upload/', '/video/upload/so_0/')
      .replace(/\.(mp4|mov|webm|avi)(\?.*)?$/i, '.jpg');
    return thumb !== url ? thumb : null;
  } catch { return null; }
}

export function PostCard({ post, onPress, onDoubleTap, currentUserId, onSave }: PostCardProps) {
  const { colors } = useTheme();
  const hasImage = post.mediaType === 'image' && !!post.mediaUrl;
  const hasVideo = post.mediaType === 'video';
  const videoThumbnail = hasVideo ? getVideoThumbnail(post.mediaUrl) : null;
  const hasSong = !!post.song;
  const isLiked = !!(currentUserId && post.likes?.includes(currentUserId));
  const isSaved = !!(currentUserId && post.savedBy?.includes(currentUserId));

  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const addHeart = (x: number, y: number) => {
    const id = Date.now();
    setHearts((prev) => [...prev, { id, x, y }]);
  };
  const removeHeart = (id: number) => setHearts((prev) => prev.filter((h) => h.id !== id));

  const handlePress = (x: number, y: number) => {
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (tapTimerRef.current) {
        clearTimeout(tapTimerRef.current);
        tapTimerRef.current = null;
      }
      addHeart(x, y);
      if (!isLiked) onDoubleTap?.();
    } else {
      tapTimerRef.current = setTimeout(() => {
        onPress();
      }, 280);
    }
    lastTapRef.current = now;
  };

  return (
    <Pressable
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={(e) => handlePress(e.nativeEvent.locationX, e.nativeEvent.locationY)}
    >
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.authorRow}>
            {post.authorPhoto ? (
              <Image source={{ uri: post.authorPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.avatarInitial}>
                  {post.authorName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
            )}
            <View style={styles.authorMeta}>
              <ThemedText style={[styles.authorName, { color: colors.text }]}>{post.authorName}</ThemedText>
              <ThemedText style={[styles.timeAgo, { color: colors.textSecondary }]}>{getTimeAgo(post.createdAt)}</ThemedText>
            </View>
          </View>

          <ThemedText style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {post.title}
          </ThemedText>

          <ThemedText style={[styles.content, { color: colors.textSecondary }]} numberOfLines={2}>
            {post.content}
          </ThemedText>

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
            {onSave && (
              <TouchableOpacity onPress={onSave} style={styles.saveBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Bookmark
                  size={14}
                  color={isSaved ? colors.primary : colors.textSecondary}
                  fill={isSaved ? colors.primary : 'transparent'}
                  strokeWidth={1.8}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {hasImage && (
          <Image source={{ uri: post.mediaUrl! }} style={styles.thumbnail} resizeMode="cover" />
        )}
        {hasVideo && (
          <View style={[styles.thumbnail, styles.videoThumb, { backgroundColor: colors.backgroundSecondary }]}>
            {videoThumbnail ? (
              <Image source={{ uri: videoThumbnail }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
            <View style={styles.videoOverlay}>
              <Video size={18} color="#fff" strokeWidth={2} />
            </View>
          </View>
        )}
      </View>

      {hearts.map((heart) => (
        <FloatingHeart key={heart.id} x={heart.x} y={heart.y} onDone={() => removeHeart(heart.id)} />
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    overflow: 'visible',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  main: { flex: 1 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#FFFFFF', fontSize: typography.sizes.sm, fontWeight: 'bold' },
  authorMeta: { marginLeft: spacing.sm },
  authorName: { fontSize: typography.sizes.sm, fontWeight: '600' },
  timeAgo: { fontSize: typography.sizes.xs, marginTop: 1 },
  title: { fontSize: typography.sizes.md, fontWeight: 'bold', marginBottom: spacing.xs },
  content: { fontSize: typography.sizes.sm, lineHeight: 20, marginBottom: spacing.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  saveBtn: { marginLeft: 'auto' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { fontSize: typography.sizes.sm },
  thumbnail: { width: 80, height: 80, borderRadius: 10, flexShrink: 0 },
  videoThumb: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  videoOverlay: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
});
