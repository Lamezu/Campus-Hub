import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Image, Animated, PanResponder } from 'react-native';
import { BellOff, Bell, MoreHorizontal, LogOut, Users } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import type { GroupConversation } from '@/types';

const SWIPE_THRESHOLD = 45;
const REVEAL_WIDTH = 160;
const MUTE_WIDTH  = 80;
const VELOCITY_THRESHOLD = 0.35;

function formatTime(isoString: string, locale: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  if (diffDays < 7) return date.toLocaleDateString(locale, { weekday: 'short' });
  return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
}

interface GroupConversationItemProps {
  group: GroupConversation;
  isMuted?: boolean;
  onPress: (group: GroupConversation) => void;
  onMute?: (group: GroupConversation) => void;
  onContextMenu?: (group: GroupConversation) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  myName?: string;
}

export function GroupConversationItem({
  group,
  isMuted = false,
  onPress,
  onMute,
  onContextMenu,
  onSwipeStart,
  onSwipeEnd,
  myName = '',
}: GroupConversationItemProps) {
  const { colors } = useTheme();
  const { t, language } = useTranslation();

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

  const onMuteRef = useRef(onMute);
  const onContextMenuRef = useRef(onContextMenu);
  const groupRef = useRef(group);
  const onSwipeStartRef = useRef(onSwipeStart);
  const onSwipeEndRef = useRef(onSwipeEnd);
  useEffect(() => { onMuteRef.current = onMute; }, [onMute]);
  useEffect(() => { onContextMenuRef.current = onContextMenu; }, [onContextMenu]);
  useEffect(() => { groupRef.current = group; }, [group]);
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
        const swipedLeft  = gs.dx < -SWIPE_THRESHOLD || (gs.vx < -VELOCITY_THRESHOLD && gs.dx < -10);
        const swipedRight = gs.dx >  SWIPE_THRESHOLD || (gs.vx >  VELOCITY_THRESHOLD && gs.dx >  10);
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

  const title = group.name || Object.values(group.memberNames ?? {}).filter(n => n !== myName).slice(0, 3).join(', ') || t('chat.group.new_group') || 'New Group';
  const senderPrefix = group.lastMessageSenderName ? `${group.lastMessageSenderName.split(' ')[0]}: ` : '';
  const lastMsg = group.lastMessage ? `${senderPrefix}${group.lastMessage}` : '';

  return (
    <View style={styles.wrapper} {...panResponder.panHandlers}>
      {/* Left action — right swipe = mute */}
      <Animated.View style={[styles.actionsLeft, { opacity: actionsLeftOpacity }]}>
        <TouchableOpacity
          style={[styles.actionMute, { backgroundColor: isMuted ? '#007AFF' : '#FF9500' }]}
          onPress={() => { snapBack(); onMuteRef.current?.(groupRef.current); }}
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

      {/* Right actions — left swipe = more + leave */}
      <Animated.View style={[styles.actionsRight, { opacity: actionsOpacity }]}>
        <TouchableOpacity
          style={styles.actionMore}
          onPress={() => { snapBack(); onContextMenuRef.current?.(groupRef.current); }}
          activeOpacity={0.8}
        >
          <MoreHorizontal size={22} color="#fff" strokeWidth={2} />
          <ThemedText style={styles.actionLabel}>{t('common.more') || 'More'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionLeave}
          onPress={() => { snapBack(); onContextMenuRef.current?.(groupRef.current); }}
          activeOpacity={0.8}
        >
          <LogOut size={22} color="#fff" strokeWidth={2} />
          <ThemedText style={styles.actionLabel}>{t('dm.group.leave_group') || 'Leave Group'}</ThemedText>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }] }}>
        <TouchableOpacity
          style={[
            styles.container, 
            { 
              backgroundColor: group.unreadCount > 0 ? colors.primary + '11' : colors.card + '90',
              borderColor: group.unreadCount > 0 ? colors.primary + '30' : colors.border + '15'
            }
          ]}
          onPress={() => {
            if (isRevealedRef.current || isMuteRevealedRef.current) { snapBack(); return; }
            onPress(group);
          }}
          onLongPress={() => onContextMenu?.(group)}
          delayLongPress={420}
          activeOpacity={0.7}
        >
          {group.photoURL
            ? <Image source={{ uri: group.photoURL }} style={styles.avatar} />
            : <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary + '22' }]}>
                <Users size={22} color={colors.primary} />
              </View>
          }

          <View style={styles.content}>
            <View style={styles.topRow}>
              <View style={styles.nameRow}>
                <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {title}
                </ThemedText>
                {isMuted && <BellOff size={12} color={colors.textSecondary} strokeWidth={2} />}
              </View>
              {!!group.lastMessageAt && (
                <ThemedText style={[styles.time, { color: colors.textSecondary }]}>
                  {formatTime(group.lastMessageAt, language)}
                </ThemedText>
              )}
            </View>

            <View style={styles.bottomRow}>
              <ThemedText
                style={[
                  styles.lastMessage,
                  { color: group.unreadCount > 0 ? colors.text : colors.textSecondary },
                  group.unreadCount > 0 && styles.lastMessageUnread,
                ]}
                numberOfLines={1}
              >
                {lastMsg}
              </ThemedText>
              {group.unreadCount > 0 && (
                <View style={[styles.unreadBadge, { backgroundColor: colors.primary }]}>
                  <ThemedText style={styles.unreadText}>
                    {group.unreadCount > 99 ? '99+' : group.unreadCount}
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
    position: 'absolute', left: 0, top: 0, bottom: 0, width: MUTE_WIDTH, flexDirection: 'row',
  },
  actionsRight: {
    position: 'absolute', right: 0, top: 0, bottom: 0, width: REVEAL_WIDTH, flexDirection: 'row',
  },
  actionMute: {
    flex: 1, backgroundColor: '#FF9500',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  actionMore: {
    flex: 1, backgroundColor: '#636366',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  actionLeave: {
    flex: 1, backgroundColor: '#FF3B30',
    justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  actionLabel: {
    fontSize: 11, lineHeight: 14, color: '#fff', fontWeight: '600',
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
  avatar: { width: 54, height: 54, borderRadius: 27, flexShrink: 0 },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  content: { flex: 1, gap: 2, minWidth: 0 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  time: { fontSize: 12, opacity: 0.6, flexShrink: 0 },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  lastMessage: { fontSize: 14, lineHeight: 20, flex: 1 },
  lastMessageUnread: { fontWeight: '600' },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11,
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 6, flexShrink: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 3,
  },
  unreadText: { fontSize: 11, fontWeight: '800', color: '#fff', includeFontPadding: false },
});
