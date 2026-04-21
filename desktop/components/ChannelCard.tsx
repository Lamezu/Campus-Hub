import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import {
  MessagesSquare,
  CodeXml,
  Folders,
  CalendarFold,
  MessageCircleQuestion,
  type LucideIcon,
} from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
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
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.container, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Icon size={22} color={colors.primary} strokeWidth={1.8} />
        </View>

        <View style={styles.content}>
          <ThemedText style={[styles.name, { color: colors.text }]}>{channel.name}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]} numberOfLines={1}>
            {channel.description}
          </ThemedText>
        </View>

        <ChevronRight size={18} color={colors.textSecondary} strokeWidth={1.8} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
  },
});
