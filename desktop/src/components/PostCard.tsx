import React, { useRef, useState } from 'react';
import { Heart, MessageCircle, Music2, Video, BarChart2 } from 'lucide-react';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Post } from '@/types';

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onDoubleTap?: () => void;
  currentUserId?: string;
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

export function PostCard({ post, onPress, onDoubleTap, currentUserId }: PostCardProps) {
  const { colors } = useTheme();
  const hasImage = post.mediaType === 'image' && !!post.mediaUrl;
  const hasVideo = post.mediaType === 'video';
  const hasSong = !!post.song;
  const isLiked = !!(currentUserId && post.likes?.includes(currentUserId));
  const lastClickRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHeart, setShowHeart] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastClickRef.current < 280) {
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
        clickTimerRef.current = null;
      }
      if (!isLiked) {
        onDoubleTap?.();
        setShowHeart(true);
        setTimeout(() => setShowHeart(false), 800);
      }
    } else {
      clickTimerRef.current = setTimeout(() => {
        onPress();
      }, 280);
    }
    lastClickRef.current = now;
  };

  return (
    <div
      onClick={handleClick}
      style={{
        padding: `${spacing.md}px`,
        borderBottom: `1px solid ${colors.border}`,
        cursor: 'pointer',
        position: 'relative',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {showHeart && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 48,
            animation: 'heartPop 0.8s ease-out forwards',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          ❤️
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
        <div style={{ flex: 1 }}>
          {/* Author row */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
            {post.authorPhoto ? (
              <img
                src={post.authorPhoto}
                alt={post.authorName}
                style={{ width: 36, height: 36, borderRadius: 18, objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: colors.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <span style={{ color: '#FFFFFF', fontSize: typography.sizes.sm, fontWeight: 'bold' }}>
                  {post.authorName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div style={{ marginLeft: spacing.sm }}>
              <ThemedText style={{ fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, display: 'block' }}>
                {post.authorName}
              </ThemedText>
              <ThemedText style={{ fontSize: typography.sizes.xs, color: colors.textSecondary, display: 'block' }}>
                {getTimeAgo(post.createdAt)}
              </ThemedText>
            </div>
          </div>

          {/* Title */}
          <ThemedText
            numberOfLines={1}
            style={{ fontSize: typography.sizes.md, fontWeight: 'bold', color: colors.text, marginBottom: spacing.xs }}
          >
            {post.title}
          </ThemedText>

          {/* Content */}
          <div style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: spacing.sm,
          }}>
            <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary, lineHeight: '20px' }}>
              {post.content}
            </ThemedText>
          </div>

          {/* Footer stats */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Heart size={14} color={isLiked ? '#FF3B30' : colors.textSecondary} fill={isLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
              <ThemedText style={{ fontSize: typography.sizes.sm, color: isLiked ? '#FF3B30' : colors.textSecondary }}>
                {post.likesCount}
              </ThemedText>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <MessageCircle size={14} color={colors.textSecondary} strokeWidth={1.8} />
              <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>{post.commentsCount}</ThemedText>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <BarChart2 size={14} color={colors.textSecondary} strokeWidth={1.8} />
              <ThemedText style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>{post.viewsCount ?? 0}</ThemedText>
            </div>
            {hasSong && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Music2 size={14} color={colors.primary} strokeWidth={1.8} />
              </div>
            )}
          </div>
        </div>

        {/* Thumbnail */}
        {hasImage && (
          <img
            src={post.mediaUrl!}
            alt="media"
            style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
        )}
        {hasVideo && (
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              backgroundColor: colors.backgroundSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Video size={22} color={colors.textSecondary} strokeWidth={1.8} />
          </div>
        )}
      </div>
    </div>
  );
}
