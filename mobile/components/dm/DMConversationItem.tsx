import React, { useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, PanResponder } from 'react-native';
import { Archive, BellOff } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { DMConversation } from '@/types';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 90;


const ROLE_COLORS: Record<DMConversation['participantRole'], string> = {
  student: '#007AFF',
  teacher: '#30D158',
  admin: '#FF9500',
};

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }
  if (diffDays < 7) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
}

interface DMConversationItemProps {
  conversation: DMConversation;
  onPress: (conversation: DMConversation) => void;
}

export function DMConversationItem({ conversation, onPress }: DMConversationItemProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeDirection = useRef<'left' | 'right' | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy) * 2,
      onPanResponderMove: (_, gs) => {
        const clamped = Math.max(-MAX_SWIPE, Math.min(MAX_SWIPE, gs.dx));
        translateX.setValue(clamped);
        swipeDirection.current = gs.dx < 0 ? 'left' : 'right';
      },
      onPanResponderRelease: () => {
        swipeDirection.current = null;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start();
      },
      onPanResponderTerminate: () => {
        swipeDirection.current = null;
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const archiveOpacity = translateX.interpolate({
    inputRange: [-MAX_SWIPE, -SWIPE_THRESHOLD, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: 'clamp',
  });

  const muteOpacity = translateX.interpolate({
    inputRange: [0, SWIPE_THRESHOLD, MAX_SWIPE],
    outputRange: [0, 0.4, 1],
    extrapolate: 'clamp',
  });

  const initials = conversation.participantName
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      <Animated.View style={[styles.actionLeft, { opacity: muteOpacity }]}>
        <BellOff size={22} color="#fff" strokeWidth={2} />
        <ThemedText style={styles.actionLabel}>{t('dm.conversations.actions.mute') || 'Silenciar'}</ThemedText>
      </Animated.View>

      <Animated.View style={[styles.actionRight, { opacity: archiveOpacity }]}>
        <Archive size={22} color="#fff" strokeWidth={2} />
        <ThemedText style={styles.actionLabel}>{t('dm.conversations.actions.archive') || 'Archivar'}</ThemedText>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={[styles.container, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
          onPress={() => onPress(conversation)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrapper}>
            {conversation.participantPhoto ? (
              <Image source={{ uri: conversation.participantPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
              </View>
            )}
            {conversation.isOnline && (
              <View style={[styles.onlineDot, { borderColor: colors.card }]} />
            )}
          </View>

          <View style={styles.content}>
            <View style={styles.topRow}>
              <View style={styles.nameRow}>
                <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {conversation.participantName}
                </ThemedText>
                <View style={[styles.roleBadge, { backgroundColor: ROLE_COLORS[conversation.participantRole] + '22' }]}>
                  <ThemedText style={[styles.roleText, { color: ROLE_COLORS[conversation.participantRole] }]}>
                    {t(`roles.labels.${conversation.participantRole}`) || conversation.participantRole}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[styles.time, { color: colors.textSecondary }]}>
                {formatTime(conversation.lastMessageAt)}
              </ThemedText>
            </View>

            <View style={styles.bottomRow}>
              <ThemedText
                style={[
                  styles.lastMessage,
                  { color: conversation.unreadCount > 0 ? colors.text : colors.textSecondary },
                  conversation.unreadCount > 0 && styles.lastMessageUnread,
                ]}
                numberOfLines={1}
              >
                {conversation.lastMessage}
              </ThemedText>
              {conversation.unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.unreadText}>
                    {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    overflow: 'hidden',
  },
  actionLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MAX_SWIPE,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: MAX_SWIPE,
    backgroundColor: '#636366',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    lineHeight: 14,
    color: '#fff',
    fontWeight: '600',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm + 4,
  },
  avatarWrapper: {
    position: 'relative',
    flexShrink: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#30D158',
    borderWidth: 2,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
  },
  roleBadge: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    flexShrink: 0,
  },
  roleText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
  },
  time: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    flexShrink: 0,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  lastMessage: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    flex: 1,
  },
  lastMessageUnread: {
    fontWeight: '600',
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: '#fff',
    includeFontPadding: false,
  },
});
