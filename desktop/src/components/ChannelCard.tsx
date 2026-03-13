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
}

export function ChannelCard({ channel, onPress }: ChannelCardProps) {
  const { colors } = useTheme();
  const Icon: LucideIcon = channel.icon ? (CHANNEL_ICONS[channel.icon] ?? MessagesSquare) : MessagesSquare;

  return (
    <button
      onClick={onPress}
      style={{
        display: 'flex',
        flexDirection: 'row',
        padding: spacing.md,
        borderBottom: `1px solid ${colors.border}`,
        alignItems: 'center',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        width: '100%',
        textAlign: 'left',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: colors.backgroundSecondary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.md,
          flexShrink: 0,
        }}
      >
        <Icon size={22} color={colors.primary} strokeWidth={1.8} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <ThemedText
          style={{
            fontSize: typography.sizes.md,
            fontWeight: '600',
            marginBottom: spacing.xs,
            display: 'block',
            color: colors.text,
          }}
        >
          {channel.name}
        </ThemedText>
        <ThemedText
          numberOfLines={1}
          style={{
            fontSize: typography.sizes.sm,
            color: colors.textSecondary,
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {channel.description}
        </ThemedText>
      </div>

      <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.8} />
    </button>
  );
}