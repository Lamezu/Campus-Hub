import React from 'react';
import {
  MessagesSquare,
  CodeXml,
  Folders,
  CalendarFold,
  MessageCircleQuestion,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Channel } from '@/types';

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  'messages-square': MessagesSquare,
  'code-xml': CodeXml,
  'folders': Folders,
  'calendar-fold': CalendarFold,
  'message-circle-question': MessageCircleQuestion,
};

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
  accentColor?: string;
}

export function ChannelCard({ channel, onPress, accentColor }: ChannelCardProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const Icon: LucideIcon = channel.icon ? (CHANNEL_ICONS[channel.icon] ?? MessagesSquare) : MessagesSquare;
  const unreadCount = channel.unreadCount || 0;

  // Attempt to localize mock channels
  const name = t(`predefined_channels.${channel.id}.name`, { defaultValue: channel.name });
  const description = t(`predefined_channels.${channel.id}.description`, { defaultValue: channel.description });

  return (
    <button
      id={`channel-card-${channel.id}`}
      onClick={onPress}
      style={{
        display: 'flex',
        flexDirection: 'row',
        padding: spacing.md,
        borderRadius: 20,
        alignItems: 'center',
        backgroundColor: colors.card,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 12px 24px ${colors.primary}10`;
        e.currentTarget.style.borderColor = colors.primary + '40';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 18,
          backgroundColor: (accentColor || colors.primary) + '15',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
          flexShrink: 0,
          overflow: 'hidden'
        }}
      >
        {channel.photoURL ? (
          <img src={channel.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Icon size={24} color={accentColor || colors.primary} strokeWidth={1.8} />
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <ThemedText style={{ fontSize: 17, fontWeight: 700, color: colors.text }}>
            {name}
          </ThemedText>
          {unreadCount > 0 && (
            <div style={{
              backgroundColor: colors.primary,
              color: '#fff',
              fontSize: 11,
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: 10,
              minWidth: 20,
              textAlign: 'center',
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
        <ThemedText
          numberOfLines={1}
          style={{
            fontSize: 14,
            color: colors.textSecondary,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            opacity: 0.8,
          }}
        >
          {t(`common.departments.${channel.description}`, { 
            defaultValue: t(`groups.subjects_list.${channel.description}`, { 
              defaultValue: t(`groups.cycles_list.${channel.description}`, {
                defaultValue: description 
              })
            }) 
          })}
        </ThemedText>
      </div>

      <div style={{
        width: 32, height: 32, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.backgroundSecondary,
        color: colors.textSecondary, transition: 'all 0.2s'
      }}>
        <ChevronRight size={18} strokeWidth={2.5} />
      </div>
    </button>
  );
}
