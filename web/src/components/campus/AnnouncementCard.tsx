import { Pin, CalendarDays, MoreVertical } from 'lucide-react';
import { useState } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { getCategoryConfig } from '../../constants/announcementCategories';
import type { Post } from '../../types';

interface AnnouncementCardProps {
  post: Post;
  onPress: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onPublishSocial?: () => void;
  highlighted?: boolean;
}

function getDateLabel(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function AnnouncementCard({ post, onPress, onEdit, onPin, onDelete, onPublishSocial, highlighted }: AnnouncementCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const hasOptions = !!(onEdit || onPin || onDelete);
  const category = getCategoryConfig(post.category);

  return (
    <div
      onClick={onPress}
      style={{
        borderRadius: 16,
        border: `${highlighted ? 2 : 1}px solid ${highlighted ? colors.primary : colors.border}`,
        overflow: 'hidden',
        marginBottom: 10,
        backgroundColor: colors.card,
        cursor: 'pointer',
        boxShadow: highlighted ? `0 0 10px ${colors.primary}66` : undefined,
        position: 'relative',
      }}
    >
      {post.imageUrl ? (
        <div style={{ width: '100%', height: 160, overflow: 'hidden' }}>
          <img
            src={post.imageUrl}
            alt=""
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: `center ${post.imageOffsetY ?? 50}%`,
              display: 'block',
            }}
          />
        </div>
      ) : (
        <div style={{ width: '100%', height: 6, backgroundColor: category.color + '18', position: 'relative' }}>
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: category.color }} />
        </div>
      )}

      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <div style={{ padding: '3px 8px', borderRadius: 6, backgroundColor: category.color + '18' }}>
            <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.5, color: category.color }}>
              {category.label.toUpperCase()}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {post.pinned && <Pin size={13} color={colors.primary} strokeWidth={2} />}
            {post.linkedEventId && <CalendarDays size={13} color={colors.textSecondary} strokeWidth={2} />}
            {hasOptions && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={e => { e.stopPropagation(); setMenuOpen(v => !v); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                >
                  <MoreVertical size={17} color={colors.textSecondary} strokeWidth={2} />
                </button>
                {menuOpen && (
                  <>
                    <div onClick={e => { e.stopPropagation(); setMenuOpen(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />
                    <div style={{
                      position: 'absolute', right: 0, top: '100%', zIndex: 20,
                      backgroundColor: colors.card, border: `1px solid ${colors.border}`,
                      borderRadius: 10, overflow: 'hidden', minWidth: 160,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    }}>
                      {onEdit && (
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onEdit(); }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: colors.text }}>
                          {t('campus.announcement.edit_announcement')}
                        </button>
                      )}
                      {onPin && (
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onPin(); }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: colors.text }}>
                          {post.pinned ? t('campus.announcement.unpin') : t('campus.announcement.pin_board')}
                        </button>
                      )}
                      {onPublishSocial && !post.socialId && (
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onPublishSocial(); }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: colors.text }}>
                          {t('campus.announcement.publish_as_post')}
                        </button>
                      )}
                      {onDelete && (
                        <button onClick={e => { e.stopPropagation(); setMenuOpen(false); onDelete(); }}
                          style={{ display: 'block', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, color: '#FF3B30' }}>
                          {t('campus.announcement.delete_announcement')}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, lineHeight: '22px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.title}
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: '20px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {post.content}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>{getDateLabel(post.createdAt)}</span>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>{post.authorName}</span>
        </div>
      </div>
    </div>
  );
}
