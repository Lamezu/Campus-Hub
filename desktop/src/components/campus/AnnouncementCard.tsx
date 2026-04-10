import React from 'react';
import { Pin, Share2, Calendar, User, Trash2, Edit2, ExternalLink } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '../themed-text';
import type { Post } from '@/types';

const CATEGORIES: Record<string, { label: string; color: string }> = {
  general:    { label: 'General',         color: '#8E8E93' },
  erasmus:    { label: 'Erasmus+',         color: '#007AFF' },
  matricula:  { label: 'Matrícula',        color: '#34C759' },
  eventos:    { label: 'Eventos',          color: '#AF52DE' },
  fct:        { label: 'Prácticas FCT',    color: '#FF6B35' },
  becas:      { label: 'Becas',            color: '#5AC8FA' },
  evaluacion: { label: 'Evaluación',       color: '#FF3B30' },
};

interface AnnouncementCardProps {
  post: Post;
  onPin?: () => void;
  onPublishSocial?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
}

export function AnnouncementCard({
  post,
  onPin,
  onPublishSocial,
  onEdit,
  onDelete,
  onPress
}: AnnouncementCardProps) {
  const { colors } = useTheme();
  const { isAdmin, firebaseUser } = useCurrentUser();
  const isAuthor = post.authorId === firebaseUser?.uid;
  const canManage = isAdmin || isAuthor;

  return (
    <div 
      onClick={onPress}
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 24,
        padding: 24,
        border: `1px solid ${post.pinned ? colors.primary + '50' : colors.border}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onPress ? 'pointer' : 'default',
        boxShadow: post.pinned ? `0 10px 30px ${colors.primary}15` : '0 4px 12px rgba(0,0,0,0.03)',
      }}
      onMouseEnter={e => {
        if (onPress) {
          e.currentTarget.style.transform = 'translateY(-4px)';
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.08)';
        }
      }}
      onMouseLeave={e => {
        if (onPress) {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = post.pinned ? `0 10px 30px ${colors.primary}15` : '0 4px 12px rgba(0,0,0,0.03)';
        }
      }}
    >
      {post.pinned && (
        <div style={{
          position: 'absolute',
          top: -12,
          left: 24,
          backgroundColor: colors.primary,
          color: '#fff',
          padding: '6px 14px',
          borderRadius: 12,
          fontSize: 11,
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: `0 8px 16px ${colors.primary}40`,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}>
          <Pin size={12} fill="#fff" />
          Fijado
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            backgroundColor: colors.primary + '15',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {post.authorPhoto ? (
              <img src={post.authorPhoto} alt={post.authorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <User size={22} color={colors.primary} />
            )}
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: colors.text }}>{post.authorName || 'Administración'}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: colors.textSecondary, fontSize: 12 }}>
              <Calendar size={12} />
              {new Date(post.createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
             {onPin && (
               <button 
                onClick={onPin}
                style={{ background: 'none', border: 'none', padding: 8, borderRadius: 12, color: post.pinned ? colors.primary : colors.textSecondary, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                title={post.pinned ? "Desfijar" : "Fijar"}
              >
                <Pin size={18} fill={post.pinned ? colors.primary : 'none'} />
              </button>
             )}
             {onEdit && (
               <button 
                onClick={onEdit}
                style={{ background: 'none', border: 'none', padding: 8, borderRadius: 12, color: colors.textSecondary, cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                title="Editar"
              >
                <Edit2 size={18} />
              </button>
             )}
              <button 
              onClick={onDelete}
              style={{ background: 'none', border: 'none', padding: 8, borderRadius: 12, color: '#FF3B30', cursor: 'pointer', transition: 'background 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF3B3010'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Eliminar"
            >
              <Trash2 size={18} />
            </button>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <ThemedText 
          style={{ 
            margin: 0, 
            fontSize: 18, 
            fontWeight: 800,
            color: colors.text,
            lineHeight: '1.3'
          }}
        >
          {post.title}
        </ThemedText>
        <ThemedText 
          numberOfLines={3}
          style={{ 
            margin: 0, 
            fontSize: 14, 
            lineHeight: '1.5', 
            color: colors.textSecondary,
            opacity: 0.8
          }}
        >
          {post.content}
        </ThemedText>
      </div>

      {post.imageUrl && (
        <div style={{
          width: '100%',
          height: 180,
          borderRadius: 16,
          overflow: 'hidden',
          backgroundColor: colors.border + '15',
          marginTop: 4,
        }}>
          <img 
            src={post.imageUrl} 
            alt="Announcement" 
            style={{ 
              width: '100%', 
              height: '100%', 
              objectFit: 'cover',
              marginTop: post.imageOffsetY ? `${post.imageOffsetY}px` : 0
            }} 
          />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        {post.category && (() => {
          const catKey = post.category.toLowerCase();
          const catInfo = CATEGORIES[catKey] || 
                         Object.values(CATEGORIES).find(c => c.label.toLowerCase() === catKey);
          
          return (
            <div style={{
              padding: '6px 12px',
              borderRadius: 10,
              backgroundColor: (catInfo?.color || colors.primary) + '10',
              color: catInfo?.color || colors.primary,
              fontSize: 11,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}>
              {catInfo?.label || post.category}
            </div>
          );
        })()}
        
        {onPress && (
          <div style={{ 
            display: 'flex', alignItems: 'center', gap: 6, 
            fontSize: 13, color: colors.primary, fontWeight: 700 
          }}>
            Leer más
            <ExternalLink size={14} />
          </div>
        )}
      </div>
    </div>
  );
}
