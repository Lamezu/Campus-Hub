import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, StatusBar, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Bell, MessageSquare, Heart, Users, Megaphone } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { notificationService } from '@/services/notificationService';
import { acceptFriendRequest } from '@/services/contactSettingsService';
import { auth } from '@/config/firebase';
import { useTranslation } from '@/hooks/useTranslation';
import type { NotificationItem, NotificationCategory } from '@/types';

function timeAgo(iso: string, t: any): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('time_ago.now') || 'ahora';
  if (diff < 3600) return t('time_ago.minutes', { count: Math.floor(diff / 60) }) || `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return t('time_ago.hours', { count: Math.floor(diff / 3600) }) || `${Math.floor(diff / 3600)}h`;
  return t('time_ago.days', { count: Math.floor(diff / 86400) }) || `${Math.floor(diff / 86400)}d`;
}

function CategoryIcon({ category, color }: { category: NotificationCategory; color: string }) {
  const size = 20;
  const sw = 1.8;
  if (category === 'dm') return <MessageSquare size={size} color={color} strokeWidth={sw} />;
  if (category === 'social') return <Heart size={size} color={color} strokeWidth={sw} />;
  if (category === 'friend') return <Users size={size} color={color} strokeWidth={sw} />;
  if (category === 'campus') return <Megaphone size={size} color={color} strokeWidth={sw} />;
  return <Bell size={size} color={color} strokeWidth={sw} />;
}

export default function NotificationsScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [friendRequestItem, setFriendRequestItem] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const updateNotifs = () => {
      setNotifications(
        category
          ? notificationService.getByCategory(category as NotificationCategory)
          : notificationService.getAll()
      );
    };

    updateNotifs();
    const unsub = notificationService.subscribe(updateNotifs);

    notificationService.markAllRead(category as NotificationCategory | undefined);

    return unsub;
  }, [category]);

  const categoryTitles: Record<string, string> = {
    social: t('notifications.social') || 'Notificaciones sociales',
    dm: t('notifications.dm') || 'Mensajes',
    campus: t('notifications.campus') || 'Campus',
    friend: t('notifications.friend') || 'Amigos',
  };

  const title = category ? (categoryTitles[category] ?? (t('notifications.title') || 'Notificaciones')) : (t('notifications.title') || 'Notificaciones');

  const groupedNotifications = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {};

    notifications.forEach(n => {
      let groupKey = n.id;
      if (n.category === 'dm' && n.meta?.conversationId) {
        groupKey = `dm_${n.meta.conversationId}`;
      } else if (n.category === 'social' && n.meta?.postId) {
        groupKey = `social_${n.meta.postId}`;
      }

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(n);
    });

    return Object.values(groups).map(items => {
      const latest = items[0];
      const unreadItems = items.filter(i => !i.read);
      return {
        ...latest,
        read: unreadItems.length === 0,
        count: items.length,
        body: items.length > 1
          ? (t('notifications.new_notifications', { count: items.length }) || `${items.length} notificaciones nuevas`)
          : latest.body
      };
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notifications]);

  const handleMarkAllRead = useCallback(async () => {
    await notificationService.markAllRead(category as NotificationCategory | undefined);
  }, [category]);

  const markRead = useCallback(async (id: string) => {
    await notificationService.markRead(id);
  }, []);

  const handlePress = useCallback((item: NotificationItem) => {
    markRead(item.id);
    if (item.category === 'friend' && item.meta?.isRequest === 'true' && item.meta?.fromUserId) {
      setFriendRequestItem(item);
      return;
    }
    if (item.category === 'dm' && item.meta?.participantId) {
      router.push(`/dm/${item.meta.participantId}` as never);
    }
  }, [markRead]);

  const handleAcceptRequest = useCallback(() => {
    const fromUserId = friendRequestItem?.meta?.fromUserId;
    const meId = auth.currentUser?.uid;
    if (!fromUserId || !meId) return;
    acceptFriendRequest(meId, fromUserId).catch(() => { });
    setFriendRequestItem(null);
  }, [friendRequestItem]);

  const handleRejectRequest = useCallback(() => {
    setFriendRequestItem(null);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{title}</ThemedText>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <ThemedText style={[styles.markAllText, { color: colors.primary }]}>{t('notifications.mark_all_read') || 'Leer todo'}</ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      <FlatList
        data={groupedNotifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[
              styles.item,
              { borderBottomColor: colors.border },
              !item.read && { backgroundColor: colors.primary + '0A' },
            ]}
            onPress={() => handlePress(item as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.backgroundSecondary }]}>
              <CategoryIcon category={item.category} color={colors.primary} />
            </View>
            <View style={styles.itemContent}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <ThemedText style={[styles.itemTitle, { color: colors.text }, !item.read && { fontWeight: '700' }]} numberOfLines={1}>
                  {item.title}
                </ThemedText>
                {item.count > 1 && (
                  <View style={[styles.countBadge, { backgroundColor: colors.primary + '20' }]}>
                    <ThemedText style={[styles.countText, { color: colors.primary }]}>{item.count}</ThemedText>
                  </View>
                )}
              </View>
              <ThemedText style={[styles.itemBody, { color: colors.textSecondary }]} numberOfLines={2}>
                {item.body}
              </ThemedText>
            </View>
            <View style={styles.itemRight}>
              <ThemedText style={[styles.itemTime, { color: colors.textSecondary }]}>
                {timeAgo(item.createdAt, t)}
              </ThemedText>
              {!item.read && (
                <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
              )}
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Bell size={48} color={colors.textSecondary} strokeWidth={1.5} />
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('notifications.no_notifications') || 'No hay notificaciones'}
            </ThemedText>
          </View>
        }
      />

      <Modal
        visible={!!friendRequestItem}
        transparent
        animationType="fade"
        onRequestClose={handleRejectRequest}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleRejectRequest}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => { }}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              {t('notifications.friend_request.title') || 'Solicitud de amistad'}
            </ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.textSecondary }]}>
              {t('notifications.friend_request.body', { name: friendRequestItem?.meta?.fromUserName ?? (t('post.someone') || 'Alguien') }) || `${friendRequestItem?.meta?.fromUserName ?? 'Alguien'} quiere ser tu amigo/a.`}
            </ThemedText>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={handleRejectRequest}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.modalBtnText, { color: colors.text }]}>{t('common.reject') || 'Rechazar'}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleAcceptRequest}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.modalBtnText, { color: '#fff' }]}>{t('common.accept') || 'Aceptar'}</ThemedText>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
    textAlign: 'center',
  },
  markAllBtn: { width: 64, alignItems: 'flex-end' },
  markAllText: { fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: 18 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: { fontSize: typography.sizes.md, lineHeight: 20 },
  itemBody: { fontSize: typography.sizes.sm, lineHeight: 18 },
  itemRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemTime: { fontSize: typography.sizes.xs, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: { fontSize: typography.sizes.md, lineHeight: 20 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: '700', lineHeight: 24 },
  modalBody: { fontSize: typography.sizes.md, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalBtnText: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
