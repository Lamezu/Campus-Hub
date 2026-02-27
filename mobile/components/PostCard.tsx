import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Heart, MessageCircle, Music2, Video, ChartNoAxesColumn } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onPress: () => void;
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

export function PostCard({ post, onPress }: PostCardProps) {
  const { colors } = useTheme();
  const hasImage = post.mediaType === 'image' && !!post.mediaUrl;
  const hasVideo = post.mediaType === 'video';
  const hasSong = !!post.song;

  return (
    <TouchableOpacity
      style={[styles.container, { borderBottomColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
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
              <Heart size={14} color={colors.textSecondary} strokeWidth={1.8} />
              <ThemedText style={[styles.statText, { color: colors.textSecondary }]}>{post.likesCount}</ThemedText>
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
          </View>
        </View>

        {hasImage && (
          <Image source={{ uri: post.mediaUrl! }} style={styles.thumbnail} resizeMode="cover" />
        )}
        {hasVideo && (
          <View style={[styles.thumbnail, styles.videoThumb, { backgroundColor: colors.backgroundSecondary }]}>
            <Video size={22} color={colors.textSecondary} strokeWidth={1.8} />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  main: {
    flex: 1,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: 'bold',
  },
  authorMeta: {
    marginLeft: spacing.sm,
  },
  authorName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  timeAgo: {
    fontSize: typography.sizes.xs,
    marginTop: 1,
  },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: 'bold',
    marginBottom: spacing.xs,
  },
  content: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: typography.sizes.sm,
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 10,
    flexShrink: 0,
  },
  videoThumb: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
