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
import { useTheme } from '../contexts/ThemeContext';
import type { Channel } from '../types/index.ts';

const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400',
    semibold: '600',
    bold: 'bold',
  },
};

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
    <div
      onClick={onPress}
      style={{
        cursor: 'pointer',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          padding: spacing.md,
          borderBottom: `1px solid ${colors.border}`,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: spacing.md,
            backgroundColor: colors.backgroundSecondary,
            display: 'flex',
          }}
        >
          <Icon size={22} color={colors.primary} strokeWidth={1.8} />
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: typography.sizes.md,
              fontWeight: '600',
              marginBottom: spacing.xs,
              color: colors.text,
            }}
          >
            {channel.name}
          </div>
          <div
            style={{
              fontSize: typography.sizes.sm,
              color: colors.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {channel.description}
          </div>
        </div>

        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.8} />
      </div>
    </div>
  );
}
