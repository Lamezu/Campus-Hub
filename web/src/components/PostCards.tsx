import React, { useRef, useState, useEffect } from 'react';
import { Heart, MessageCircle, Video, ChartNoAxesColumn, Play, Pause, Music2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Post } from '../types/index.ts';

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
const typography = {
  sizes: { xs: 12, sm: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
};

interface PostCardProps {
  post: Post;
  onPress: () => void;
  onDoubleTap?: () => void;
  currentUserId?: string;
  hideMedia?: boolean;
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

function FloatingHeart({ x, y, onDone }: { x: number; y: number; onDone: () => void }) {
  React.useEffect(() => {
    const timer = setTimeout(onDone, 1000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div style={{
      position: 'absolute', left: x, top: y,
      fontSize: 24, pointerEvents: 'none', zIndex: 1000,
      animation: 'floatUp 1s ease-out forwards',
    }}>
      ❤️
    </div>
  );
}

export function PostCard({ post, onPress, onDoubleTap, currentUserId, hideMedia = false }: PostCardProps) {
  const { colors } = useTheme();
  const hasImage = post.mediaType === 'image' && !!post.mediaUrl;
  const hasVideo = post.mediaType === 'video';
  const hasSong = !!post.song;
  const isLiked = !!(currentUserId && post.likes?.includes(currentUserId));

  const lastTapRef = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; x: number; y: number }>>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const toggleSong = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!post.song?.audioUrl) return;

    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(post.song.audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    audioRef.current.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  };

  const addHeart = (x: number, y: number) => {
    setHearts((prev) => [...prev, { id: Date.now(), x, y }]);
  };
  const removeHeart = (id: number) => setHearts((prev) => prev.filter((h) => h.id !== id));

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const now = Date.now();
    if (now - lastTapRef.current < 280) {
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null; }
      addHeart(x, y);
      if (!isLiked) onDoubleTap?.();
    } else {
      tapTimerRef.current = setTimeout(() => onPress(), 280);
    }
    lastTapRef.current = now;
  };

  const floatAnimation = `
    @keyframes floatUp {
      0% { opacity: 1; transform: translateY(0) scale(1); }
      100% { opacity: 0; transform: translateY(-50px) scale(1.5); }
    }
  `;

  return (
    <>
      <style>{floatAnimation}</style>
      <div
        style={{
          paddingLeft: spacing.md,
          paddingRight: spacing.md,
          paddingTop: spacing.md,
          paddingBottom: spacing.md,
          borderBottom: `1px solid ${colors.border}`,
          position: 'relative',
          cursor: 'pointer',
        }}
        onClick={handleClick}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
              {post.authorPhoto ? (
                <img src={post.authorPhoto} alt={post.authorName}
                  style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.primary,
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                }}>
                  <span style={{ color: '#FFF', fontSize: typography.sizes.sm, fontWeight: 'bold' }}>
                    {post.authorName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <div style={{ marginLeft: spacing.sm }}>
                <span style={{ fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text }}>
                  {post.authorName}
                </span>
                <div style={{ fontSize: typography.sizes.xs, marginTop: 1, color: colors.textSecondary }}>
                  {getTimeAgo(post.createdAt)}
                </div>
              </div>
            </div>

            <div style={{
              fontSize: typography.sizes.md,
              fontWeight: 'bold',
              marginBottom: spacing.xs,
              color: colors.text,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {post.title}
            </div>

            <div style={{
              fontSize: typography.sizes.sm,
              lineHeight: '20px',
              marginBottom: spacing.sm,
              color: colors.textSecondary,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-word',
            }}>
              {post.content}
            </div>

            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Heart size={14} color={isLiked ? '#FF3B30' : colors.textSecondary}
                  fill={isLiked ? '#FF3B30' : 'transparent'} strokeWidth={1.8} />
                <span style={{ fontSize: typography.sizes.sm, color: isLiked ? '#FF3B30' : colors.textSecondary }}>
                  {post.likesCount}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <MessageCircle size={14} color={colors.textSecondary} strokeWidth={1.8} />
                <span style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>
                  {post.commentsCount}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <ChartNoAxesColumn size={14} color={colors.textSecondary} strokeWidth={1.8} />
                <span style={{ fontSize: typography.sizes.sm, color: colors.textSecondary }}>
                  {post.viewsCount ?? 0}
                </span>
              </div>
            </div>
          </div>

          {!hideMedia && hasImage && (
            <img src={post.mediaUrl!} alt="Post thumbnail"
              style={{ width: 80, height: 80, borderRadius: 10, flexShrink: 0, objectFit: 'cover' }} />
          )}
          {!hideMedia && hasVideo && (
            <div style={{
              width: 80, height: 80, borderRadius: 10, flexShrink: 0,
              backgroundColor: colors.backgroundSecondary,
              display: 'flex', justifyContent: 'center', alignItems: 'center',
            }}>
              <Video size={22} color={colors.textSecondary} strokeWidth={1.8} />
            </div>
          )}
        </div>

        {hasSong && hasImage && (
          <div
            onClick={toggleSong}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: spacing.sm,
              padding: '6px 10px', borderRadius: 10,
              backgroundColor: colors.backgroundSecondary, cursor: 'pointer',
            }}
          >
            {post.song!.coverUrl ? (
              <img src={post.song!.coverUrl} alt={post.song!.name}
                style={{ width: 28, height: 28, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{
                width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                backgroundColor: colors.border,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Music2 size={14} color={colors.textSecondary} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 12, fontWeight: '600', color: colors.text,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {post.song!.name}
              </div>
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{post.song!.artistName}</div>
            </div>
            <div style={{ color: colors.primary, flexShrink: 0 }}>
              {isPlaying ? <Pause size={20} /> : <Play size={20} />}
            </div>
          </div>
        )}

        {hearts.map((heart) => (
          <FloatingHeart key={heart.id} x={heart.x} y={heart.y} onDone={() => removeHeart(heart.id)} />
        ))}
      </div>
    </>
  );
}