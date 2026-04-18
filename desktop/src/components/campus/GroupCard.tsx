import React from 'react';
import { Users, BookOpen, Trash2, Edit2, LogOut, Info } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import type { StudyGroup } from '@/types';
import { useCurrentUser } from '@/contexts/UserContext';

interface GroupCardProps {
  group: StudyGroup;
  userId: string;
  onJoin: () => void;
  onLeave: () => void;
  onNavigate: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function GroupCard({
  group,
  userId,
  onJoin,
  onLeave,
  onNavigate,
  onEdit,
  onDelete
}: GroupCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const isMember = group.memberIds.includes(userId);
  const isCreatorOrAdmin = group.createdBy === userId || isAdmin;

  // Resolve subject translation
  const subjectLabel = t(`groups.subjects_list.${group.subject.toLowerCase()}`, { defaultValue: group.subject });

  return (
    <div 
      onClick={() => isMember ? onNavigate() : null}
      style={{
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 16,
        padding: 24,
        border: `1px solid ${colors.border}`,
        cursor: isMember ? 'pointer' : 'default',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        opacity: isMember ? 1 : 0.9,
        '&:hover': isMember ? {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
        } : {}
      } as any}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          backgroundColor: group.color + '20',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: group.color,
          boxShadow: `0 4px 12px ${group.color}20`,
        }}>
          <Users size={28} />
        </div>

        <div style={{ display: 'flex', gap: 4 }}>
          {isCreatorOrAdmin && onEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              style={{ background: 'none', border: 'none', padding: 8, borderRadius: '50%', color: colors.textSecondary, cursor: 'pointer' }}
              title={t('common.edit')}
            >
              <Edit2 size={18} />
            </button>
          )}
          {isCreatorOrAdmin && onDelete && (
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              style={{ background: 'none', border: 'none', padding: 8, borderRadius: '50%', color: '#FF3B30', cursor: 'pointer' }}
              title={t('common.delete')}
            >
              <Trash2 size={18} />
            </button>
          )}
        </div>
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{
            padding: '2px 8px',
            borderRadius: 6,
            backgroundColor: colors.primary + '10',
            color: colors.primary,
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {subjectLabel}
          </span>
          {group.isPrivate && (
             <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 600 }}>{t('groups.card.private')}</span>
          )}
        </div>
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: colors.text }}>{group.name}</h3>
        
        {/* Department and Cycle tags */}
        {((group.departments && group.departments.length > 0) || (group.cycles && group.cycles.length > 0)) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0 4px' }}>
            {group.departments?.map(dept => (
              <div key={dept} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                <Users size={10} />
                <span style={{ fontSize: 9, fontWeight: 800 }}>{t(`common.departments.${dept}`, { defaultValue: dept })}</span>
              </div>
            ))}
            {group.cycles?.map(cycle => (
              <div key={cycle} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 4, backgroundColor: colors.background, border: `1px solid ${colors.border}`, color: colors.textSecondary }}>
                <BookOpen size={10} />
                <span style={{ fontSize: 9, fontWeight: 800 }}>{t(`groups.cycles_list.${cycle}`, { defaultValue: cycle })}</span>
              </div>
            ))}
          </div>
        )}

        <p style={{ 
          margin: '8px 0 0', 
          fontSize: 14, 
          color: colors.textSecondary, 
          lineHeight: '1.5',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {group.description || t('groups.card.no_description')}
        </p>
      </div>

      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginTop: 'auto',
        paddingTop: 16,
        borderTop: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: colors.textSecondary }}>
          <Users size={16} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{t('groups.card.member_count', { count: group.memberCount })}</span>
        </div>

        {isMember ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 13, color: colors.primary, fontWeight: 700 }}>{t('groups.card.member_status')}</span>
            <button 
              onClick={(e) => { e.stopPropagation(); onLeave(); }}
              style={{ 
                background: colors.border + '40', 
                border: 'none', 
                padding: '6px 12px', 
                borderRadius: 8, 
                color: colors.text, 
                fontSize: 12, 
                fontWeight: 600, 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <LogOut size={14} />
              {t('groups.card.leave')}
            </button>
          </div>
        ) : (
          <button 
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            style={{ 
              backgroundColor: colors.primary, 
              border: 'none', 
              padding: '8px 16px', 
              borderRadius: 10, 
              color: '#fff', 
              fontSize: 13, 
              fontWeight: 700, 
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
          >
            {t('groups.card.join')}
          </button>
        )}
      </div>
    </div>
  );
}
