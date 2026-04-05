import React, { useState, useCallback, useEffect, useMemo } from 'react';
import {
  View, SectionList, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, Modal, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Bell, MessageSquare, Heart,
  Users, Megaphone, UserCheck, UserX, CalendarDays, Hash,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { notificationService } from '@/services/notificationService';
import { acceptFriendRequest } from '@/services/contactSettingsService';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useTranslation } from '@/hooks/useTranslation';
import { CHANNELS } from '@/constants/channelData';
import type { NotificationItem, NotificationCategory } from '@/types';

function timeAgo(iso: string, t: any): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('time_ago.now') || 'ahora';
  if (diff < 3600) return t('time_ago.minutes', { count: Math.floor(diff / 60) }) || `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return t('time_ago.hours', { count: Math.floor(diff / 3600) }) || `${Math.floor(diff / 3600)}h`;
  return t('time_ago.days', { count: Math.floor(diff / 86400) }) || `${Math.floor(diff / 86400)}d`;
}

function resolveChannelName(channelId: string, metaName?: string, nameMap?: Record<string, string>): string {
  if (metaName) return metaName;
  if (nameMap?.[channelId]) return nameMap[channelId];
  const staticCh = CHANNELS.find(c => c.id === channelId);
  if (staticCh) return staticCh.name;
  return channelId ?? 'Canal';
}

type SectionKey = 'friend_request' | 'friend_accepted' | 'dm' | 'social_like' | 'social_comment' | 'campus';

interface SectionDef {
  key: SectionKey;
  category: NotificationCategory | null;
  filter: (n: NotificationItem) => boolean;
}

interface ChannelGroup {
  channelId: string;
  channelName: string;
  count: number;
  unreadCount: number;
  latest: NotificationItem;
}

interface CampusGroup {
  id: 'announcements' | 'events';
  name: string;
  items: NotificationItem[];
}

interface UserGroup {
  userId: string;
  userName: string;
  count: number;
  unreadCount: number;
  latest: NotificationItem;
}

const SECTION_DEFS: SectionDef[] = [
  { key: 'friend_request', category: 'friend', filter: (n) => n.category === 'friend' && n.meta?.isRequest === 'true' },
  { key: 'friend_accepted', category: 'friend', filter: (n) => n.category === 'friend' && n.meta?.type === 'accepted' },
  { key: 'dm', category: 'dm', filter: (n) => n.category === 'dm' },
  { key: 'social_like', category: 'social', filter: (n) => n.category === 'social' && (!!n.meta?.userId || !!n.meta?.commentId) },
  { key: 'social_comment', category: 'social', filter: (n) => n.category === 'social' && !n.meta?.userId && !n.meta?.commentId },
  { key: 'campus', category: 'campus', filter: (n) => n.category === 'campus' },
];

function NotificationIcon({ item, color }: { item: NotificationItem; color: string }) {
  const size = 20; const sw = 1.8;
  if (item.category === 'dm') return <MessageSquare size={size} color={color} strokeWidth={sw} />;
  if (item.category === 'social') return <Heart size={size} color={color} strokeWidth={sw} />;
  if (item.category === 'channel') return <Hash size={size} color={color} strokeWidth={sw} />;
  if (item.category === 'campus') {
    if (item.meta?.eventId) return <CalendarDays size={size} color={color} strokeWidth={sw} />;
    return <Megaphone size={size} color={color} strokeWidth={sw} />;
  }
  if (item.category === 'friend') {
    if (item.meta?.isRequest === 'true') return <Users size={size} color={color} strokeWidth={sw} />;
    return <UserCheck size={size} color={color} strokeWidth={sw} />;
  }
  return <Bell size={size} color={color} strokeWidth={sw} />;
}

function GroupCard({
  icon, name, subtitle, unreadCount, latestTime, onPress, colors,
}: {
  icon: React.ReactNode; name: string; subtitle: string;
  unreadCount: number; latestTime: string;
  onPress: () => void; colors: any;
}) {
  return (
    <TouchableOpacity
      style={[styles.groupCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.groupIcon, { backgroundColor: colors.primary + '20' }]}>{icon}</View>
      <View style={styles.groupInfo}>
        <ThemedText style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>{name}</ThemedText>
        <ThemedText style={[styles.groupSub, { color: colors.textSecondary }]} numberOfLines={1}>{subtitle}</ThemedText>
      </View>
      <View style={styles.groupRight}>
        {unreadCount > 0 && (
          <View style={[styles.badge, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.badgeText}>{unreadCount > 99 ? '99+' : String(unreadCount)}</ThemedText>
          </View>
        )}
        <ThemedText style={[styles.groupTime, { color: colors.textSecondary }]}>{latestTime}</ThemedText>
        <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
      </View>
    </TouchableOpacity>
  );
}

export default function NotificationsScreen() {
  const { category } = useLocalSearchParams<{ category?: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [friendRequestItem, setFriendRequestItem] = useState<NotificationItem | null>(null);
  const [drillGroupId, setDrillGroupId] = useState<string | null>(null);
  const [drillGroupName, setDrillGroupName] = useState<string>('');
  const [channelNameMap, setChannelNameMap] = useState<Record<string, string>>({});
  const [userNameMap, setUserNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (category !== 'social') return;
    const toResolve = [...new Set(
      notifications
        .filter(n => n.category === 'social' && n.meta?.userId && !n.meta?.userName)
        .map(n => n.meta!.userId!)
        .filter(id => !userNameMap[id])
    )];
    if (toResolve.length === 0) return;

    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(toResolve.map(async (userId) => {
        try {
          const snap = await getDoc(doc(db, 'users', userId));
          if (snap.exists()) updates[userId] = snap.data().displayName ?? userId;
        } catch {}
      }));
      if (Object.keys(updates).length > 0) setUserNameMap(prev => ({ ...prev, ...updates }));
    })();
  }, [notifications, category]);

  useEffect(() => {
    if (category !== 'channel') return;
    const toResolve = [...new Set(
      notifications
        .filter(n => n.category === 'channel' && n.meta?.channelId && !n.meta?.channelName)
        .map(n => n.meta!.channelId!)
        .filter(id => !CHANNELS.find(c => c.id === id) && !channelNameMap[id])
    )];
    if (toResolve.length === 0) return;

    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(toResolve.map(async (channelId) => {
        const groupId = channelId.startsWith('sg_') ? channelId.slice(3) : channelId;
        try {
          const snap = await getDoc(doc(db, 'studyGroups', groupId));
          if (snap.exists()) updates[channelId] = snap.data().name ?? channelId;
        } catch {}
      }));
      if (Object.keys(updates).length > 0) setChannelNameMap(prev => ({ ...prev, ...updates }));
    })();
  }, [notifications, category]);

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
    if (category !== 'channel' && category !== 'campus' && category !== 'dm' && category !== 'social') {
      notificationService.markAllRead(category as NotificationCategory | undefined);
    }
    return unsub;
  }, [category]);

  useEffect(() => {
    if (!drillGroupId || !category) return;
    if (category === 'channel') {
      notificationService.markChatRead('channel', drillGroupId);
    } else if (category === 'dm') {
      drillNotifications.filter(n => !n.read).forEach(n => notificationService.markRead(n.id));
    } else if (category === 'campus') {
      const toMark = notifications.filter(n =>
        drillGroupId === 'announcements' ? n.meta?.postId : n.meta?.eventId
      );
      toMark.forEach(n => notificationService.markRead(n.id));
    } else if (category === 'social') {
      notifications.filter(n => n.meta?.userId === drillGroupId && !n.read)
        .forEach(n => notificationService.markRead(n.id));
    }
  }, [drillGroupId]);

  const channelGroups: ChannelGroup[] = useMemo(() => {
    if (category !== 'channel') return [];
    const map = new Map<string, ChannelGroup>();
    for (const n of notifications) {
      const id = n.meta?.channelId ?? '';
      if (!id) continue;
      const name = resolveChannelName(id, n.meta?.channelName, channelNameMap);
      if (!map.has(id)) map.set(id, { channelId: id, channelName: name, count: 0, unreadCount: 0, latest: n });
      const g = map.get(id)!;
      g.count++;
      if (!n.read) g.unreadCount++;
      if (new Date(n.createdAt) > new Date(g.latest.createdAt)) g.latest = n;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );
  }, [notifications, category, channelNameMap]);

  const dmGroups: UserGroup[] = useMemo(() => {
    if (category !== 'dm') return [];
    const map = new Map<string, UserGroup>();
    for (const n of notifications) {
      const id = n.meta?.participantId ?? n.meta?.groupId ?? '';
      if (!id) continue;
      const name = n.title;
      if (!map.has(id)) map.set(id, { userId: id, userName: name, count: 0, unreadCount: 0, latest: n });
      const g = map.get(id)!;
      g.count++;
      if (!n.read) g.unreadCount++;
      if (new Date(n.createdAt) > new Date(g.latest.createdAt)) g.latest = n;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );
  }, [notifications, category]);

  const socialGroups: UserGroup[] = useMemo(() => {
    if (category !== 'social') return [];
    const map = new Map<string, UserGroup>();
    for (const n of notifications) {
      const id = n.meta?.userId ?? '';
      if (!id) continue;
      const name = n.meta?.userName ?? userNameMap[id] ?? id;
      if (!map.has(id)) map.set(id, { userId: id, userName: name, count: 0, unreadCount: 0, latest: n });
      const g = map.get(id)!;
      g.count++;
      if (!n.read) g.unreadCount++;
      if (new Date(n.createdAt) > new Date(g.latest.createdAt)) g.latest = n;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );
  }, [notifications, category, userNameMap]);

  const campusGroups: CampusGroup[] = useMemo(() => {
    if (category !== 'campus') return [];
    return [
      { id: 'announcements', name: t('explore.tabs.announcements') || 'Announcements', items: notifications.filter(n => n.meta?.postId) },
      { id: 'events', name: t('explore.tabs.events') || 'Events', items: notifications.filter(n => n.meta?.eventId) },
    ].filter(g => g.items.length > 0) as CampusGroup[];
  }, [notifications, category]);

  const drillNotifications: NotificationItem[] = useMemo(() => {
    if (!drillGroupId) return [];
    if (category === 'channel') return notifications.filter(n => n.meta?.channelId === drillGroupId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (category === 'campus') {
      return notifications
        .filter(n => drillGroupId === 'announcements' ? !!n.meta?.postId : !!n.meta?.eventId)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    if (category === 'dm') return notifications.filter(n =>
      n.meta?.participantId === drillGroupId || n.meta?.groupId === drillGroupId
    ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (category === 'social') return notifications.filter(n => n.meta?.userId === drillGroupId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return [];
  }, [notifications, drillGroupId, category]);

  const sections = useMemo(() => {
    const sortByDate = (a: NotificationItem, b: NotificationItem) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return SECTION_DEFS
      .filter(def => !category || def.category === category)
      .map(def => ({
        key: def.key,
        title: ({
          friend_request: t('notifications.groups.friend_request') || 'Friend Request',
          friend_accepted: t('notifications.groups.friend_accepted') || 'Friend Accepted',
          dm: t('notifications.groups.dm') || 'Dm',
          social_like: t('notifications.groups.social_like') || 'Social Like',
          social_comment: t('notifications.groups.social_comment') || 'Social Comment',
          campus: t('notifications.groups.campus') || 'Campus',
        } as Record<SectionKey, string>)[def.key],
        data: notifications.filter(def.filter).sort(sortByDate),
      }))
      .filter(s => s.data.length > 0);
  }, [notifications, category]);

  const handleBack = useCallback(() => {
    if (drillGroupId) { setDrillGroupId(null); setDrillGroupName(''); }
    else router.back();
  }, [drillGroupId]);

  const handleChannelGroupPress = useCallback((group: ChannelGroup) => {
    setDrillGroupId(group.channelId);
    setDrillGroupName(group.channelName);
  }, []);

  const handleCampusGroupPress = useCallback((group: CampusGroup) => {
    setDrillGroupId(group.id);
    setDrillGroupName(group.name);
  }, []);

  const handlePress = useCallback((item: NotificationItem) => {
    notificationService.markRead(item.id);
    if (item.category === 'friend' && item.meta?.isRequest === 'true' && item.meta?.fromUserId) {
      setFriendRequestItem(item); return;
    }
    if (item.category === 'dm') {
      if (item.meta?.groupId) router.push(`/dm/group/${item.meta.groupId}` as any);
      else if (item.meta?.participantId) router.push(`/dm/${item.meta.participantId}` as never);
    }
    if (item.category === 'social' && item.meta?.postId) {
      router.push(`/post/${item.meta.postId}` as never);
    }
    if (item.category === 'channel' && item.meta?.channelId) {
      const cid = item.meta.channelId;
      const navId = cid.startsWith('sg_') || CHANNELS.find(c => c.id === cid) ? cid : `sg_${cid}`;
      router.push({ pathname: '/chat/[id]', params: { id: navId } } as never);
    }
    if (item.category === 'campus') {
      if (item.meta?.postId) router.push(`/post/${item.meta.postId}` as never);
      else if (item.meta?.eventId) router.push(`/explore?tab=calendar&eventId=${item.meta.eventId}` as never);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (drillGroupId && category === 'channel') {
      notificationService.markChatRead('channel', drillGroupId);
    } else if (drillGroupId && category === 'dm') {
      notificationService.markChatRead('dm', drillGroupId);
    } else if (drillGroupId && category === 'social') {
      drillNotifications.filter(n => !n.read).forEach(n => notificationService.markRead(n.id));
    } else {
      await notificationService.markAllRead(category as NotificationCategory | undefined);
    }
  }, [category, drillGroupId, drillNotifications]);

  const handleAcceptRequest = useCallback(async () => {
    const fromUserId = friendRequestItem?.meta?.fromUserId;
    const notifId = friendRequestItem?.id;
    const meId = auth.currentUser?.uid;
    const myName = auth.currentUser?.displayName || (t('post.someone') || 'Someone');
    if (!fromUserId || !meId || !notifId) return;
    await acceptFriendRequest(meId, fromUserId).catch(() => {});
    await notificationService.deleteNotification(notifId).catch(() => {});
    await notificationService.addNotification(fromUserId, {
      category: 'friend',
      title: t('notifications.friend_accepted.title') || 'Title',
      body: t('notifications.friend_accepted.body', { name: myName }) || `${myName} aceptó tu solicitud de amistad.`,
      meta: { type: 'accepted', fromUserId: meId, fromUserName: myName },
    }).catch(() => {});
    setFriendRequestItem(null);
  }, [friendRequestItem, t]);

  const handleRejectRequest = useCallback(async () => {
    const notifId = friendRequestItem?.id;
    if (notifId) await notificationService.deleteNotification(notifId).catch(() => {});
    setFriendRequestItem(null);
  }, [friendRequestItem]);

  const categoryTitles: Record<string, string> = {
    social: t('notifications.social') || 'Social',
    dm: t('notifications.dm') || 'Dm',
    campus: t('notifications.campus') || 'Campus',
    friend: t('notifications.friend') || 'Friend',
    channel: t('common.channels') || 'Channels',
  };

  const screenTitle = drillGroupId
    ? drillGroupName
    : (category ? (categoryTitles[category] ?? (t('notifications.title') || 'Title')) : (t('notifications.title') || 'Title'));

  const activeNotifs = drillGroupId ? drillNotifications : notifications;
  const unreadCount = activeNotifs.filter(n => !n.read).length;

  const renderNotifItem = useCallback(({ item }: { item: NotificationItem }) => (
    <TouchableOpacity
      style={[styles.item, { borderBottomColor: colors.border }, !item.read && { backgroundColor: colors.primary + '0A' }]}
      onPress={() => handlePress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.backgroundSecondary }]}>
        <NotificationIcon item={item} color={colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={[styles.itemTitle, { color: colors.text }, !item.read && { fontWeight: '700' }]} numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.itemBody, { color: colors.textSecondary }]} numberOfLines={2}>
          {item.meta?.type === 'added_to_group'
            ? (t('dm.group.notification_added', { name: item.meta.adderName }) || `${item.meta.adderName} te añadió al grupo`)
            : item.body}
        </ThemedText>
      </View>
      <View style={styles.itemRight}>
        <ThemedText style={[styles.itemTime, { color: colors.textSecondary }]}>{timeAgo(item.createdAt, t)}</ThemedText>
        {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
      </View>
    </TouchableOpacity>
  ), [colors, handlePress, t]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{screenTitle}</ThemedText>
        {!drillGroupId && unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <ThemedText style={[styles.markAllText, { color: colors.primary }]}>
              {t('notifications.mark_all_read') || 'Mark All Read'}
            </ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 64 }} />
        )}
      </View>

      {category === 'channel' && !drillGroupId && (
        <FlatList
          data={channelGroups}
          keyExtractor={g => g.channelId}
          contentContainerStyle={styles.groupList}
          renderItem={({ item: g }) => (
            <GroupCard
              icon={<Hash size={20} color={colors.primary} strokeWidth={2} />}
              name={g.channelName}
              subtitle={g.latest.body}
              unreadCount={g.unreadCount}
              latestTime={timeAgo(g.latest.createdAt, t)}
              onPress={() => handleChannelGroupPress(g)}
              colors={colors}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      {category === 'campus' && !drillGroupId && (
        <FlatList
          data={campusGroups}
          keyExtractor={g => g.id}
          contentContainerStyle={styles.groupList}
          renderItem={({ item: g }) => (
            <GroupCard
              icon={
                g.id === 'events'
                  ? <CalendarDays size={20} color={colors.primary} strokeWidth={2} />
                  : <Megaphone size={20} color={colors.primary} strokeWidth={2} />
              }
              name={g.name}
              subtitle={g.items[0]?.title ?? ''}
              unreadCount={g.items.filter(n => !n.read).length}
              latestTime={g.items[0] ? timeAgo(g.items[0].createdAt, t) : ''}
              onPress={() => handleCampusGroupPress(g)}
              colors={colors}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      {category === 'dm' && !drillGroupId && (
        <FlatList
          data={dmGroups}
          keyExtractor={g => g.userId}
          contentContainerStyle={styles.groupList}
          renderItem={({ item: g }) => (
            <GroupCard
              icon={<MessageSquare size={20} color={colors.primary} strokeWidth={2} />}
              name={g.userName}
              subtitle={g.latest.body}
              unreadCount={g.unreadCount}
              latestTime={timeAgo(g.latest.createdAt, t)}
              onPress={() => { setDrillGroupId(g.userId); setDrillGroupName(g.userName); }}
              colors={colors}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      {category === 'social' && !drillGroupId && (
        <FlatList
          data={socialGroups}
          keyExtractor={g => g.userId}
          contentContainerStyle={styles.groupList}
          renderItem={({ item: g }) => (
            <GroupCard
              icon={<Heart size={20} color={colors.primary} strokeWidth={2} />}
              name={g.userName}
              subtitle={g.latest.body}
              unreadCount={g.unreadCount}
              latestTime={timeAgo(g.latest.createdAt, t)}
              onPress={() => { setDrillGroupId(g.userId); setDrillGroupName(g.userName); }}
              colors={colors}
            />
          )}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      {drillGroupId && (
        <FlatList
          data={drillNotifications}
          keyExtractor={item => item.id}
          renderItem={renderNotifItem}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      {category !== 'channel' && category !== 'campus' && category !== 'dm' && category !== 'social' && !drillGroupId && (
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
              <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>{section.title}</ThemedText>
            </View>
          )}
          renderItem={renderNotifItem}
          ListEmptyComponent={<EmptyState icon={Bell} title={t('notifications.no_notifications') || 'No Notifications'} />}
        />
      )}

      <Modal visible={!!friendRequestItem} transparent animationType="fade" onRequestClose={handleRejectRequest}>
        <Pressable style={styles.modalBackdrop} onPress={handleRejectRequest}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card }]} onPress={() => {}}>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
              {t('notifications.friend_request.title') || 'Title'}
            </ThemedText>
            <ThemedText style={[styles.modalBody, { color: colors.textSecondary }]}>
              {t('notifications.friend_request.body', {
                name: friendRequestItem?.meta?.fromUserName ?? (t('post.someone') || 'Body'),
              }) || `${friendRequestItem?.meta?.fromUserName ?? 'Alguien'} quiere ser tu amigo/a.`}
            </ThemedText>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                onPress={handleRejectRequest} activeOpacity={0.7}
              >
                <UserX size={18} color={colors.text} strokeWidth={1.8} />
                <ThemedText style={[styles.modalBtnText, { color: colors.text }]}>{t('common.reject') || 'Reject'}</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleAcceptRequest} activeOpacity={0.7}
              >
                <UserCheck size={18} color="#fff" strokeWidth={1.8} />
                <ThemedText style={[styles.modalBtnText, { color: '#fff' }]}>{t('common.accept') || 'Accept'}</ThemedText>
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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'space-between',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', lineHeight: 20, flex: 1, textAlign: 'center' },
  markAllBtn: { width: 64, alignItems: 'flex-end' },
  markAllText: { fontSize: typography.sizes.sm, fontWeight: '600', lineHeight: 18 },
  sectionHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.xs },
  sectionTitle: { fontSize: typography.sizes.xs, fontWeight: '700', lineHeight: 16, textTransform: 'uppercase', letterSpacing: 0.6 },
  item: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm,
  },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  itemContent: { flex: 1, gap: 2 },
  itemTitle: { fontSize: typography.sizes.md, lineHeight: 20 },
  itemBody: { fontSize: typography.sizes.sm, lineHeight: 18 },
  itemRight: { alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  itemTime: { fontSize: typography.sizes.xs, lineHeight: 16 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  groupList: { padding: spacing.md, gap: spacing.sm },
  groupCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth,
  },
  groupIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  groupInfo: { flex: 1, gap: 3 },
  groupName: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  groupSub: { fontSize: typography.sizes.sm, lineHeight: 18 },
  groupRight: { alignItems: 'flex-end', gap: 4, flexShrink: 0 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, justifyContent: 'center', alignItems: 'center' },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', lineHeight: 14 },
  groupTime: { fontSize: typography.sizes.xs, lineHeight: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  modalCard: { width: '100%', borderRadius: 16, padding: spacing.lg, gap: spacing.sm },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: '700', lineHeight: 24 },
  modalBody: { fontSize: typography.sizes.md, lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  modalBtn: { flex: 1, flexDirection: 'row', gap: 6, paddingVertical: spacing.sm + 2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  modalBtnText: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
});
