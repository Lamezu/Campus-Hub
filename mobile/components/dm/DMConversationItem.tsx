import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, PanResponder } from 'react-native';
import { Archive, Bell, BellOff, MoreHorizontal } from 'lucide-react-native';
import { avatarColor } from '@/utils/avatarColor';
import { ThemedText } from '@/components/themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { DMConversation } from '@/types';

const SWIPE_THRESHOLD = 45;
const REVEAL_WIDTH = 160;
const MUTE_WIDTH = 80;
const VELOCITY_THRESHOLD = 0.35;

function formatTime(isoString: string, locale: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

interface DMConversationItemProps {
  conversation: DMConversation;
  onPress: (conversation: DMConversation) => void;
  onArchive?: (conversation: DMConversation) => void;
  onMute?: (conversation: DMConversation) => void;
  onContextMenu?: (conversation: DMConversation) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  archiveLabel?: string;
  archiveColor?: string;
}

export function DMConversationItem({
  conversation,
  onPress,
  onArchive,
  onMute,
  onContextMenu,
  onSwipeStart,
  onSwipeEnd,
  archiveLabel,
  archiveColor = '#34C759',
}: DMConversationItemProps) {
  const { colors } = useTheme();
  const { t, language } = useTranslation();

  const roleColor = conversation.participantRole === 'admin' ? '#AF52DE'
    : conversation.participantRole === 'teacher' ? '#007AFF'
    : '#34C759';

  const translateX = useRef(new Animated.Value(0)).current;
  const isRevealedRef = useRef(false);
  const isMuteRevealedRef = useRef(false);

  const actionsOpacity = translateX.interpolate({
    inputRange: [-REVEAL_WIDTH, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const actionsLeftOpacity = translateX.interpolate({
    inputRange: [0, MUTE_WIDTH],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const onArchiveRef = useRef(onArchive);
  const onMuteRef = useRef(onMute);
  const onContextMenuRef = useRef(onContextMenu);
  const conversationRef = useRef(conversation);
  const onSwipeStartRef = useRef(onSwipeStart);
  const onSwipeEndRef = useRef(onSwipeEnd);
  useEffect(() => { onArchiveRef.current = onArchive; }, [onArchive]);
  useEffect(() => { onMuteRef.current = onMute; }, [onMute]);
  useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
  useEffect(() => { conversationRef.current = conversation; }, [conversation]);
  useEffect(() => { onSwipeStartRef.current = onSwipeStart; }, [onSwipeStart]);
  useEffect(() => { onSwipeEndRef.current = onSwipeEnd; }, [onSwipeEnd]);

  const snapBack = () => {
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 100, friction: 12 }).start(() => {
      isRevealedRef.current = false;
      isMuteRevealedRef.current = false;
    });
  };

  const snapReveal = () => {
    Animated.spring(translateX, { toValue: -REVEAL_WIDTH, useNativeDriver: true, tension: 120, friction: 14 }).start(() => {
      isRevealedRef.current = true;
    });
  };

  const snapMuteReveal = () => {
    Animated.spring(translateX, { toValue: MUTE_WIDTH, useNativeDriver: true, tension: 120, friction: 14 }).start(() => {
      isMuteRevealedRef.current = true;
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 6 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.5,
      onPanResponderGrant: () => { onSwipeStartRef.current?.(); },
      onPanResponderMove: (_, gs) => {
        if (isRevealedRef.current) {
          translateX.setValue(Math.max(-REVEAL_WIDTH, Math.min(0, -REVEAL_WIDTH + gs.dx)));
        } else if (isMuteRevealedRef.current) {
          translateX.setValue(Math.max(0, Math.min(MUTE_WIDTH, MUTE_WIDTH + gs.dx)));
        } else {
          translateX.setValue(Math.max(-REVEAL_WIDTH, Math.min(MUTE_WIDTH, gs.dx)));
        }
      },
      onPanResponderRelease: (_, gs) => {
        onSwipeEndRef.current?.();
        if (isRevealedRef.current) {
          if (gs.dx > 20 || gs.vx > VELOCITY_THRESHOLD) snapBack();
          else snapReveal();
          return;
        }
        if (isMuteRevealedRef.current) {
          if (gs.dx < -20 || gs.vx < -VELOCITY_THRESHOLD) snapBack();
          else snapMuteReveal();
          return;
        }
        const swipedLeft = gs.dx < -SWIPE_THRESHOLD || (gs.vx < -VELOCITY_THRESHOLD && gs.dx < -10);
        const swipedRight = gs.dx > SWIPE_THRESHOLD || (gs.vx > VELOCITY_THRESHOLD && gs.dx > 10);
        if (swipedLeft) snapReveal();
        else if (swipedRight) snapMuteReveal();
        else snapBack();
      },
      onPanResponderTerminate: () => {
        onSwipeEndRef.current?.();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => {
          isRevealedRef.current = false;
          isMuteRevealedRef.current = false;
        });
      },
    })
  ).current;

  const isMuted = conversation.contactSettings?.mute === 'always';

  const initials = conversation.participantName
    .split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      {/* Left action - visible on right swipe */}
      <Animated.View style={[styles.actionsLeft, { opacity: actionsLeftOpacity }]}>
        <TouchableOpacity
          style={[styles.actionMute, { backgroundColor: isMuted ? '#007AFF' : '#FF9500' }]}
          onPress={() => { snapBack(); onMuteRef.current?.(conversationRef.current); }}
          activeOpacity={0.8}
        >
          {isMuted
            ? <Bell size={22} color="#fff" strokeWidth={2} />
            : <BellOff size={22} color="#fff" strokeWidth={2} />}
          <ThemedText style={styles.actionLabel}>
            {isMuted ? (t('dm.unmute') || 'Unmute') : (t('dm.mute') || 'Mute')}
          </ThemedText>
        </TouchableOpacity>
      </Animated.View>

      {/* Right actions - visible on left swipe */}
      <Animated.View style={[styles.actionsRight, { opacity: actionsOpacity }]}>
        <TouchableOpacity
          style={styles.actionMore}
          onPress={() => { snapBack(); onContextMenuRef.current?.(conversationRef.current); }}
          activeOpacity={0.8}
        >
          <MoreHorizontal size={22} color="#fff" strokeWidth={2} />
          <ThemedText style={styles.actionLabel}>{t('common.more') || 'More'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionArchive, { backgroundColor: archiveColor }]}
          onPress={() => { snapBack(); onArchiveRef.current?.(conversationRef.current); }}
          activeOpacity={0.8}
        >
          <Archive size={22} color="#fff" strokeWidth={2} />
          <ThemedText style={styles.actionLabel}>{archiveLabel || t('dm.conversations.actions.archive') || 'Archive'}</ThemedText>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={[
            styles.container, 
            { 
              backgroundColor: conversation.unreadCount > 0 ? colors.primary + '11' : colors.card + '90',
              borderColor: conversation.unreadCount > 0 ? colors.primary + '30' : colors.border + '15'
            }
          ]}
          onPress={() => {
            if (isRevealedRef.current || isMuteRevealedRef.current) { snapBack(); return; }
            onPress(conversation);
          }}
          onLongPress={() => onContextMenu?.(conversation)}
          delayLongPress={420}
          activeOpacity={0.7}
        >
          <View style={styles.avatarWrapper}>
            {conversation.participantPhoto ? (
              <Image source={{ uri: conversation.participantPhoto }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: avatarColor(conversation.participantId) }]}>
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
                <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
                  <ThemedText style={[styles.roleText, { color: roleColor }]}>
                    {t(`roles.labels.${conversation.participantRole}`) || conversation.participantRole}
                  </ThemedText>
                </View>
              </View>
              <View style={styles.timeRow}>
                {isMuted && <BellOff size={12} color={colors.textSecondary} strokeWidth={2} />}
                <ThemedText style={[styles.time, { color: colors.textSecondary }]}>
                  {formatTime(conversation.lastMessageAt, language)}
                </ThemedText>
              </View>
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
  wrapper: { position: 'relative', overflow: 'hidden' },
  actionsLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MUTE_WIDTH,
    flexDirection: 'row',
  },
  actionsRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    flexDirection: 'row',
  },
  actionMute: {
    flex: 1,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionMore: {
    flex: 1,
    backgroundColor: '#636366',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  actionArchive: {
    flex: 1,
    backgroundColor: '#34C759',
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
    paddingVertical: spacing.md,
    borderRadius: 20,
    marginHorizontal: spacing.md,
    marginVertical: 4,
    gap: spacing.md,
    borderWidth: 1,
  },
  avatarWrapper: { position: 'relative', flexShrink: 0 },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 20, fontWeight: '800', color: '#fff' },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: '#30D158', borderWidth: 2.5,
  },
  content: { flex: 1, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  roleBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, flexShrink: 0 },
  roleText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  time: { fontSize: 12, opacity: 0.6 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  lastMessage: { fontSize: 14, lineHeight: 20, flex: 1 },
  lastMessageUnread: { fontWeight: '600' },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, flexShrink: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadText: { fontSize: 11, fontWeight: '800', color: '#fff', includeFontPadding: false },
});
