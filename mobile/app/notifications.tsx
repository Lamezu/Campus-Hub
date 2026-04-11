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
  MessageCircle, Share2,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { notificationService } from '@/services/notificationService';
import { markAsRead as dmMarkAsRead } from '@/services/dmService';
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

function resolveChannelName(channelId: string, metaName?: string, nameMap?: Record<string, string>, t?: (k: string) => string): string {
  if (['1', '2', '3', '4'].includes(channelId) && t) {
    const translated = t(`predefined_channels.${channelId}.name`);
    if (translated) return translated;
  }
  if (nameMap?.[channelId]) return nameMap[channelId];
  if (metaName) return metaName;
  const staticCh = CHANNELS.find(c => c.id === channelId);
  if (staticCh) return staticCh.name;
  return channelId ?? 'Channel';
}

const ATTACHMENT_LABELS = ['Adjunto', '📎 Adjunto', 'Attachment', '📎 Attachment'];

function fixChannelBody(body: string, t?: (k: string) => string): string {
  if (ATTACHMENT_LABELS.includes(body)) return t?.('notifications.attachment') || '📎 Attachment';
  return body;
}

type SectionKey = 'friend_request' | 'friend_accepted' | 'dm' | 'social' | 'campus';

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

interface PostGroup {
  postId: string;
  postTitle: string;
  items: NotificationItem[];
  count: number;
  unreadCount: number;
  latest: NotificationItem;
}

const SECTION_DEFS: SectionDef[] = [
  { key: 'friend_request', category: 'friend', filter: (n) => n.category === 'friend' && n.meta?.isRequest === 'true' },
  { key: 'friend_accepted', category: 'friend', filter: (n) => n.category === 'friend' && n.meta?.type === 'accepted' },
  { key: 'dm', category: 'dm', filter: (n) => n.category === 'dm' },
  { key: 'social', category: 'social', filter: (n) => n.category === 'social' },
  { key: 'campus', category: 'campus', filter: (n) => n.category === 'campus' },
];

function socialIcon(type: string | undefined, color: string, size = 20) {
  const sw = 1.8;
  if (type === 'comment') return <MessageCircle size={size} color={color} strokeWidth={sw} />;
  if (type === 'share') return <Share2 size={size} color={color} strokeWidth={sw} />;
  return <Heart size={size} color={color} strokeWidth={sw} />;
}

function NotificationIcon({ item, color }: { item: NotificationItem; color: string }) {
  const size = 20; const sw = 1.8;
  if (item.category === 'dm') return <MessageSquare size={size} color={color} strokeWidth={sw} />;
  if (item.category === 'social') return socialIcon(item.meta?.type, color, size);
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
  const [postTitleMap, setPostTitleMap] = useState<Record<string, string>>({});

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
    if (category !== 'channel' && category !== 'dm' && category !== 'social') {
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
      notificationService.markChatRead('social', drillGroupId);
    }
  }, [drillGroupId]);

  const channelGroups: ChannelGroup[] = useMemo(() => {
    if (category !== 'channel') return [];
    const map = new Map<string, ChannelGroup>();
    for (const n of notifications) {
      const id = n.meta?.channelId ?? '';
      if (!id) continue;
      const name = resolveChannelName(id, n.meta?.channelName, channelNameMap, t);
      if (!map.has(id)) map.set(id, { channelId: id, channelName: name, count: 0, unreadCount: 0, latest: n });
      const g = map.get(id)!;
      g.count++;
      if (!n.read) g.unreadCount++;
      if (new Date(n.createdAt) > new Date(g.latest.createdAt)) g.latest = n;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );
  }, [notifications, category, channelNameMap, t]);

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

  const postGroups: PostGroup[] = useMemo(() => {
    if (category !== 'social') return [];
    const map = new Map<string, PostGroup>();
    for (const n of notifications) {
      const postId = n.meta?.postId ?? '';
      if (!postId || !n.meta?.fromUserId) continue;
      if (!map.has(postId)) {
        map.set(postId, { postId, postTitle: n.meta?.postTitle ?? '', items: [], count: 0, unreadCount: 0, latest: n });
      }
      const g = map.get(postId)!;
      g.items.push(n);
      g.count++;
      if (!n.read) g.unreadCount++;
      if (new Date(n.createdAt) > new Date(g.latest.createdAt)) g.latest = n;
      if (!g.postTitle && n.meta?.postTitle) g.postTitle = n.meta.postTitle;
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.latest.createdAt).getTime() - new Date(a.latest.createdAt).getTime()
    );
  }, [notifications, category]);

  useEffect(() => {
    if (category !== 'social') return;
    const toResolve = postGroups
      .filter(g => !g.postTitle && !postTitleMap[g.postId])
      .map(g => g.postId);
    if (toResolve.length === 0) return;
    (async () => {
      const updates: Record<string, string> = {};
      await Promise.all(toResolve.map(async (postId) => {
        try {
          const snap = await getDoc(doc(db, 'posts', postId));
          if (snap.exists()) updates[postId] = snap.data().title ?? '';
        } catch {}
      }));
      if (Object.keys(updates).length > 0) setPostTitleMap(prev => ({ ...prev, ...updates }));
    })();
  }, [postGroups, category]);

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
    if (category === 'social') return notifications.filter(n => n.meta?.postId === drillGroupId)
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
          friend_request: t('notifications.groups.friend_request') || 'Friend requests',
          friend_accepted: t('notifications.groups.friend_accepted') || 'New friends',
          dm: t('notifications.groups.dm') || 'Direct messages',
          social: t('notifications.social') || 'Social activity',
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

  const handleMarkAllRead = useCallback(() => {
    const meId = auth.currentUser?.uid;

    if (drillGroupId && category === 'channel') {
      notificationService.markChatRead('channel', drillGroupId);
    } else if (drillGroupId && category === 'dm') {
      notificationService.markChatRead('dm', drillGroupId);
      // Also reset the conversation's unread count and message read status
      if (meId) {
        const conversationId = drillNotifications[0]?.meta?.conversationId
          || [meId, drillGroupId].sort().join('_');
        dmMarkAsRead(conversationId, meId).catch(() => {});
      }
    } else if (drillGroupId && category === 'social') {
      notificationService.markChatRead('social', drillGroupId);
    } else {
      notificationService.markAllRead(category as NotificationCategory | undefined);
      // If marking DM notifications, also reset each conversation's unread count
      if (meId && (!category || category === 'dm')) {
        const dmNotifs = notificationService.getByCategory('dm');
        const convIds = new Set(dmNotifs.map(n => n.meta?.conversationId).filter(Boolean) as string[]);
        convIds.forEach(cid => dmMarkAsRead(cid, meId).catch(() => {}));
      }
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
      body: t('notifications.friend_accepted.body', { name: myName }) || `${myName} accepted your friend request.`,
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

  const renderNotifItem = useCallback(({ item }: { item: NotificationItem }) => {
    let displayTitle = item.title;
    let displayBody = item.body;

    if (item.category === 'channel') {
      const subtype = item.meta?.notifSubtype as string | undefined;
      if (subtype && item.meta?.ticketId) {
        // Ticket notification: compose from i18n so it's always in the user's language
        const name = item.meta?.senderName || '';
        const title = item.meta?.ticketTitle || '';
        if (subtype === 'ticket_reply_staff') {
          displayTitle = t('notifications.ticket_reply_staff') || 'Support replied to your ticket';
          displayBody = fixChannelBody(item.body, t);
        } else if (subtype === 'ticket_reply_user') {
          displayTitle = (t('notifications.ticket_reply_user') || '{{name}} replied on their ticket').replace('{{name}}', name);
          displayBody = fixChannelBody(item.body, t);
        } else if (subtype === 'ticket_new') {
          displayTitle = (t('notifications.ticket_new') || '{{name}} opened a support ticket').replace('{{name}}', name);
          displayBody = item.body;
        } else if (subtype === 'ticket_status_in_progress') {
          displayTitle = t('notifications.ticket_status_in_progress_title') || 'Ticket in progress';
          displayBody = (t('notifications.ticket_status_body_in_progress') || 'Your ticket "{{title}}" is being reviewed').replace('{{title}}', title);
        } else if (subtype === 'ticket_status_resolved') {
          displayTitle = t('notifications.ticket_status_resolved_title') || 'Ticket resolved';
          displayBody = (t('notifications.ticket_status_body_resolved') || 'Your ticket "{{title}}" has been resolved').replace('{{title}}', title);
        } else if (subtype === 'ticket_status_open') {
          displayTitle = t('notifications.ticket_status_open_title') || 'Ticket reopened';
          displayBody = (t('notifications.ticket_status_body_open') || 'Your ticket "{{title}}" has been reopened').replace('{{title}}', title);
        } else {
          displayTitle = item.title;
          displayBody = item.body;
        }
      } else {
        // Regular channel message: compose sender + channel name
        const channelId = item.meta?.channelId ?? '';
        const resolvedName = resolveChannelName(channelId, item.meta?.channelName, channelNameMap, t);
        const senderName = item.meta?.senderName
          || (() => {
              const storedCh = item.meta?.channelName ?? resolvedName;
              const stripped = item.title
                .replace(` in ${storedCh}`, '')
                .replace(` en ${storedCh}`, '')
                .trim();
              return stripped || item.title;
            })();
        displayTitle = `${senderName} ${t('notifications.channel_in') || 'in'} ${resolvedName}`;
        displayBody = fixChannelBody(item.body, t);
      }
    } else if (item.category === 'friend') {
      const personName = item.meta?.fromUserName ?? (t('post.someone') || 'Someone');
      displayTitle = personName;
      displayBody = item.meta?.isRequest === 'true'
        ? (t('notifications.friend_request.action') || 'wants to be your friend')
        : (t('notifications.friend_accepted.action') || 'accepted your friend request');
    }

    return (
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
            {displayTitle}
          </ThemedText>
          <ThemedText style={[styles.itemBody, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.meta?.type === 'added_to_group'
              ? (t('dm.group.notification_added', { name: item.meta.adderName }) || `${item.meta.adderName} added you to the group`)
              : item.category === 'social'
                ? (item.meta?.type === 'comment'
                    ? (t('notifications.social_comment_body') || 'commented on your post')
                    : item.meta?.type === 'share'
                      ? (t('notifications.social_share_body') || 'shared your post')
                      : (t('notifications.social_like_body') || 'liked your post'))
                : displayBody}
          </ThemedText>
        </View>
        <View style={styles.itemRight}>
          <ThemedText style={[styles.itemTime, { color: colors.textSecondary }]}>{timeAgo(item.createdAt, t)}</ThemedText>
          {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
        </View>
      </TouchableOpacity>
    );
  }, [colors, handlePress, t, channelNameMap]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{screenTitle}</ThemedText>
        {unreadCount > 0 ? (
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
              subtitle={fixChannelBody(g.latest.body, t)}
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
          data={postGroups}
          keyExtractor={g => g.postId}
          contentContainerStyle={styles.groupList}
          renderItem={({ item: g }) => {
            const type = g.latest.meta?.type;
            const latestName = g.latest.meta?.fromUserName ?? g.latest.title ?? '?';
            const uniqueActors = new Set(g.items.map(n => n.meta?.fromUserId)).size;
            const actionText = type === 'comment'
              ? (t('notifications.social_comment_body') || 'commented on your post')
              : type === 'share'
                ? (t('notifications.social_share_body') || 'shared your post')
                : (t('notifications.social_like_body') || 'liked your post');
            const subtitle = uniqueActors > 1
              ? `${latestName} ${t('notifications.and_others', { count: uniqueActors - 1 }) || `and ${uniqueActors - 1} more`}`
              : `${latestName} ${actionText}`;
            const postTitle = g.postTitle || postTitleMap[g.postId] || (t('notifications.your_post') || 'Your post');
            return (
              <GroupCard
                icon={socialIcon(type, colors.primary, 20)}
                name={postTitle}
                subtitle={subtitle}
                unreadCount={g.unreadCount}
                latestTime={timeAgo(g.latest.createdAt, t)}
                onPress={() => { setDrillGroupId(g.postId); setDrillGroupName(postTitle); }}
                colors={colors}
              />
            );
          }}
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
              }) || `${friendRequestItem?.meta?.fromUserName ?? 'Someone'} wants to be your friend.`}
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
