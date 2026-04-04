import React from 'react';
import { TouchableOpacity, StyleSheet, View, Image } from 'react-native';
import {
  MessagesSquare, CodeXml, Folders, CalendarFold, MessageCircleQuestion,
  Megaphone, Utensils, HeartPulse, Monitor, Dumbbell, Building2,
  Users, Zap, TreePine, ShieldCheck, Languages, Briefcase,
  Compass, Lightbulb, Hash,
  type LucideIcon,
} from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { Channel } from '@/types';

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  'messages-square': MessagesSquare,
  'code-xml': CodeXml,
  'folders': Folders,
  'calendar-fold': CalendarFold,
  'message-circle-question': MessageCircleQuestion,
  'megaphone': Megaphone,
  'utensils': Utensils,
  'heart-pulse': HeartPulse,
  'monitor': Monitor,
  'dumbbell': Dumbbell,
  'building-2': Building2,
  'users': Users,
  'zap': Zap,
  'tree-pine': TreePine,
  'shield-check': ShieldCheck,
  'languages': Languages,
  'briefcase': Briefcase,
  'compass': Compass,
  'lightbulb': Lightbulb,
  'hash': Hash,
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
  const tint = accentColor ?? colors.primary;

  const displayName = t(`predefined_channels.${channel.id}.name`) || channel.name;
  const displayDescription = t(`predefined_channels.${channel.id}.description`) || channel.description;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.container, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: tint + '18' }]}>
          {channel.photoURL ? (
            <Image source={{ uri: channel.photoURL }} style={styles.image} />
          ) : (
            <Icon size={22} color={tint} strokeWidth={1.8} />
          )}
        </View>

        <View style={styles.content}>
          <ThemedText style={[styles.name, { color: colors.text }]}>{displayName}</ThemedText>
          <ThemedText style={[styles.description, { color: colors.textSecondary }]} numberOfLines={1}>
            {displayDescription}
          </ThemedText>
        </View>

        {(channel.unreadCount ?? 0) > 0 && (
          <View style={[styles.badge, { backgroundColor: tint }]}>
            <ThemedText style={styles.badgeText}>{channel.unreadCount}</ThemedText>
          </View>
        )}
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
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden'
  },
  image: { width: '100%', height: '100%' },
  content: { flex: 1 },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  description: { fontSize: typography.sizes.sm },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginRight: spacing.xs,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    includeFontPadding: false,
  },
});
