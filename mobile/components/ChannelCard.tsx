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
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.touchable}>
      <View style={[styles.container, { 
        backgroundColor: colors.card + '90', 
        borderColor: tint + '20' 
      }]}>
        <View style={[styles.iconContainer, { backgroundColor: tint + '15' }]}>
          {channel.photoURL ? (
            <Image source={{ uri: channel.photoURL }} style={styles.image} />
          ) : (
            <Icon size={24} color={tint} strokeWidth={1.5} />
          )}
          {/* Subtle glow behind icon */}
          <View style={[styles.iconGlow, { backgroundColor: tint }]} />
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
        <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  container: {
    flexDirection: 'row',
    padding: spacing.md - 4,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.05,
  },
  image: { width: '100%', height: '100%' },
  content: { flex: 1, paddingVertical: 2 },
  name: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  description: { 
    fontSize: 13,
    opacity: 0.8,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginRight: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
    includeFontPadding: false,
  },
});
