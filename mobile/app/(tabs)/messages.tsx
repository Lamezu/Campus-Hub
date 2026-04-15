import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Platform, Modal, Pressable, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  PenSquare, Search, MessageSquare, Archive, ChevronRight,
  Bell, BellOff, Info, Star, Eraser, Ban, Trash2, UserPlus, UserMinus, Users,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { DMConversationItem } from '@/components/dm/DMConversationItem';
import { GroupConversationItem } from '@/components/dm/GroupConversationItem';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  subscribeToConversations,
  fetchConversationsOnce,
  archiveConversation,
  muteConversation,
  deleteConversation,
} from '@/services/dmService';
import { subscribeToGroupConversations, leaveGroup } from '@/services/groupDMService';
import {
  getContactSettings, updateContactSettings, blockUser, clearChat,
  getFriendStatus, sendFriendRequest,
} from '@/services/contactSettingsService';
import { toggleBestFriend, removeFriend, areFriendsBestFriends } from '@/services/friendsService';
import { notificationService } from '@/services/notificationService';
import { useTranslation } from '@/hooks/useTranslation';
import { avatarColor } from '@/utils/avatarColor';
import type { DMConversation, GroupConversation, MuteDuration } from '@/types';

type ListItem = DMConversation | GroupConversation;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  title: { 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  newButton: { padding: spacing.xs, marginLeft: spacing.xs },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    height: 48,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    gap: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500', includeFontPadding: false },
  archivedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  archivedLabel: { flex: 1, fontSize: 14, fontWeight: '600' },
  emptyWrapper: { flex: 1, paddingVertical: 100 },
  emptyComposeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 16,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  emptyComposeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  errorContainer: { padding: spacing.xl, alignItems: 'center' },
  errorText: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  errorSub: { fontSize: 14, textAlign: 'center' },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: 40 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingBottom: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: spacing.md },
  sheetAvatar: { width: 40, height: 40, borderRadius: 20 },
  sheetAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  sheetAvatarInitials: { fontSize: 15, fontWeight: '700', color: '#fff' },
  sheetName: { fontSize: 18, fontWeight: '700', flex: 1 },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  sheetRowText: { fontSize: 16, fontWeight: '500' },
  groupRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.sm },
  groupAvatar: { width: 50, height: 50, borderRadius: 25 },
  groupAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  groupInfo: { flex: 1, minWidth: 0 },
  groupTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  groupName: { flex: 1, fontSize: 14, fontWeight: '600' },
  groupTime: { fontSize: 11, marginLeft: spacing.xs },
  groupLastMsg: { fontSize: 12 },
  groupBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
  groupBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
});

export default function MessagesScreen() {
  const { colors, theme } = useTheme();
  const { t, language } = useTranslation();
  const { firebaseUser } = useCurrentUser();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [settingsMap, setSettingsMap] = useState<Map<string, {
    mute: string; mutedUntil: string | null; archived: boolean; deleted: boolean; isBestFriend: boolean;
  }>>(new Map());
  const [contextTarget, setContextTarget] = useState<DMConversation | null>(null);
  const [muteTarget, setMuteTarget] = useState<DMConversation | null>(null);
  const [contextIsFriend, setContextIsFriend] = useState(false);
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const [groupContextTarget, setGroupContextTarget] = useState<GroupConversation | null>(null);
  const [groupMuteMap, setGroupMuteMap] = useState<Map<string, string>>(new Map());

  const convUnsubRef = useRef<(() => void) | null>(null);
  const groupUnsubRef = useRef<(() => void) | null>(null);
  const settingsMapRef = useRef(settingsMap);

  const startConvSubscription = useCallback(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    if (convUnsubRef.current) convUnsubRef.current();
    convUnsubRef.current = subscribeToConversations(meId, setConversations, (err) => {
      if (err.code === 'failed-precondition') {
        setError(t('dm.db_index_error') || 'Db Index Error');
      }
    });
  }, []);

  useEffect(() => {
    startConvSubscription();
    return () => { convUnsubRef.current?.(); convUnsubRef.current = null; };
  }, [startConvSubscription]);

  useEffect(() => {
    if (!firebaseUser?.uid) { setGroupConversations([]); return; }
    if (groupUnsubRef.current) groupUnsubRef.current();
    groupUnsubRef.current = subscribeToGroupConversations(
      firebaseUser.uid,
      setGroupConversations,
      () => setGroupConversations([]),
    );
    return () => { groupUnsubRef.current?.(); groupUnsubRef.current = null; };
  }, [firebaseUser?.uid]);

  const participantUnsubsRef = useRef<Map<string, () => void>>(new Map());
  const participantIdsKey = conversations.map(c => c.participantId).join(',');

  useEffect(() => {
    const ids = new Set(conversations.map(c => c.participantId).filter(Boolean));
    const tracked = participantUnsubsRef.current;
    for (const [id, unsub] of tracked) {
      if (!ids.has(id)) { unsub(); tracked.delete(id); }
    }
    for (const id of ids) {
      if (!tracked.has(id)) {
        const unsub = onSnapshot(doc(db, 'users', id), (snap) => {
          if (!snap.exists()) return;
          const { role } = snap.data() as any;
          setConversations(prev => prev.map(c =>
            c.participantId === id ? { ...c, participantRole: role || c.participantRole } : c
          ));
        });
        tracked.set(id, unsub);
      }
    }
    return () => { tracked.forEach(u => u()); tracked.clear(); };
  }, [participantIdsKey]);

  const loadSettings = useCallback(() => {
    const meId = auth.currentUser?.uid;
    if (!meId || conversations.length === 0) return;
    Promise.all(
      conversations.map(async (c) => {
        const [s, isBestFriend] = await Promise.all([
          getContactSettings(meId, c.participantId),
          areFriendsBestFriends(meId, c.participantId),
        ]);
        return {
          id: c.participantId,
          mute: s.mute,
          mutedUntil: s.mutedUntil,
          archived: s.archived,
          deleted: (s as any).deleted ?? false,
          isBestFriend,
        };
      })
    ).then(results => {
      setSettingsMap(new Map(results.map(r => [r.id, r])));
    }).catch(() => {});
  }, [participantIdsKey]);

  useEffect(() => {
    settingsMapRef.current = settingsMap;
  }, [settingsMap]);

  useEffect(() => { loadSettings(); }, [loadSettings]);

  useEffect(() => {
    return notificationService.subscribe(() => {
      const meId = auth.currentUser?.uid;
      if (!meId) return;
      const unreadDMs = notificationService.getAll().filter(
        n => !n.read && n.category === 'dm' && n.meta?.participantId && !n.meta?.groupId
      );
      for (const n of unreadDMs) {
        const pid = n.meta!.participantId!;
        const s = settingsMapRef.current.get(pid);
        if (s?.deleted) {
          updateContactSettings(meId, pid, { deleted: false } as any).catch(() => {});
          setSettingsMap(prev => {
            const next = new Map(prev);
            const existing = next.get(pid);
            if (existing) next.set(pid, { ...existing, deleted: false });
            return next;
          });
        }
      }
    });
  }, []);

  useFocusEffect(useCallback(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    loadSettings();
  }, [loadSettings]));

  const enriched: DMConversation[] = conversations.map(c => {
    const s = settingsMap.get(c.participantId);
    return {
      ...c,
      archived: s?.archived ?? false,
      isBestFriend: s?.isBestFriend ?? false,
      contactSettings: {
        ...c.contactSettings,
        mute: (s?.mute ?? 'off') as any,
        mutedUntil: s?.mutedUntil ?? null,
      },
    };
  });

  const active = enriched.filter(c => {
    const s = settingsMap.get(c.participantId);
    return !c.archived && !(s?.deleted ?? false);
  });
  const archivedCount = enriched.filter(c => {
    const s = settingsMap.get(c.participantId);
    return c.archived && !(s?.deleted ?? false);
  }).length;

  const filtered = query.trim()
    ? active.filter(c => c.participantName.toLowerCase().includes(query.toLowerCase()))
    : active;

  const formatTime = useCallback((iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return t('common.yesterday') || 'Ayer';
    if (diffDays < 7) return d.toLocaleDateString(language, { weekday: 'short' });
    return d.toLocaleDateString(language, { day: '2-digit', month: '2-digit' });
  }, [t, language]);

  const allFiltered = useMemo<ListItem[]>(() => {
    const q = query.trim().toLowerCase();
    const filteredGroups = q
      ? groupConversations.filter(g =>
          (g.name ?? '').toLowerCase().includes(q) ||
          Object.values(g.memberNames ?? {}).some(n => n.toLowerCase().includes(q))
        )
      : groupConversations;
    return [...filtered, ...filteredGroups].sort((a, b) => {
      const ta = a.lastMessageAt ?? '';
      const tb = b.lastMessageAt ?? '';
      return tb.localeCompare(ta);
    });
  }, [filtered, groupConversations, query]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadSettings();
    setTimeout(() => setRefreshing(false), 800);
  }, [loadSettings]);

  const handleConversationPress = useCallback((conversation: DMConversation) => {
    router.push(`/dm/${conversation.participantId}` as never);
  }, []);

  const handleArchive = useCallback(async (conv: DMConversation) => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    setSettingsMap(prev => {
      const next = new Map(prev);
      const existing = next.get(conv.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
      next.set(conv.participantId, { ...existing, archived: true });
      return next;
    });
    await archiveConversation(meId, conv.participantId, true);
  }, []);

  const handleContextMenu = useCallback((conv: DMConversation) => {
    setContextIsFriend(false);
    setContextTarget(conv);
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    getFriendStatus(meId, conv.participantId).then(s => setContextIsFriend(s.isFriend)).catch(() => {});
  }, []);

  const handleAddFriend = useCallback(async () => {
    const meId = auth.currentUser?.uid;
    const myName = auth.currentUser?.displayName || '';
    const myPhoto = auth.currentUser?.photoURL || null;
    if (!meId || !contextTarget) return;
    setContextTarget(null);
    await sendFriendRequest(meId, contextTarget.participantId, myName, myPhoto).catch(() => {});
  }, [contextTarget]);

  const handleMuteToggle = useCallback(async () => {
    const meId = auth.currentUser?.uid;
    if (!meId || !contextTarget) return;
    const current = settingsMap.get(contextTarget.participantId)?.mute ?? 'off';
    const next = current === 'always' ? 'off' : 'always';
    setSettingsMap(prev => {
      const map = new Map(prev);
      const existing = map.get(contextTarget.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
      map.set(contextTarget.participantId, { ...existing, mute: next, mutedUntil: null });
      return map;
    });
    setContextTarget(null);
    await muteConversation(meId, contextTarget.participantId, next as any);
  }, [contextTarget, settingsMap]);

  const handleMuteFromSwipe = useCallback((conv: DMConversation) => {
    const isMuted = settingsMap.get(conv.participantId)?.mute === 'always';
    if (isMuted) {
      const meId = auth.currentUser?.uid;
      if (!meId) return;
      setSettingsMap(prev => {
        const map = new Map(prev);
        const existing = map.get(conv.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
        map.set(conv.participantId, { ...existing, mute: 'off', mutedUntil: null });
        return map;
      });
      muteConversation(meId, conv.participantId, 'off' as any);
    } else {
      setMuteTarget(conv);
    }
  }, [settingsMap]);

  const handleMuteDuration = useCallback((dur: MuteDuration) => {
    const meId = auth.currentUser?.uid;
    if (!meId || !muteTarget) return;
    const target = muteTarget;
    setMuteTarget(null);
    setSettingsMap(prev => {
      const map = new Map(prev);
      const existing = map.get(target.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
      map.set(target.participantId, { ...existing, mute: dur, mutedUntil: null });
      return map;
    });
    muteConversation(meId, target.participantId, dur);
  }, [muteTarget]);

  const handleBestFriendToggle = useCallback(async () => {
    const meId = auth.currentUser?.uid;
    if (!meId || !contextTarget) return;
    setContextTarget(null);
    const next = await toggleBestFriend(meId, contextTarget.participantId);
    setSettingsMap(prev => {
      const map = new Map(prev);
      const existing = map.get(contextTarget.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
      map.set(contextTarget.participantId, { ...existing, isBestFriend: next });
      return map;
    });
  }, [contextTarget]);

  const handleRemoveFriend = useCallback(() => {
    if (!contextTarget) return;
    const target = contextTarget;
    setContextTarget(null);
    Alert.alert(
      t('dm.profile.remove_friend_title') || 'Remove Friend Title',
      t('dm.profile.remove_friend_confirm', { name: target.participantName }) || `Remove ${target.participantName} from your friends?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.profile.remove_friend_action') || 'Remove Friend Action',
          style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            if (!meId) return;
            await removeFriend(meId, target.participantId);
            setSettingsMap(prev => {
              const map = new Map(prev);
              const existing = map.get(target.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
              map.set(target.participantId, { ...existing, isBestFriend: false });
              return map;
            });
          },
        },
      ]
    );
  }, [contextTarget, t]);

  const handleClearChat = useCallback(() => {
    if (!contextTarget) return;
    setContextTarget(null);
    Alert.alert(
      t('dm.clear_chat_title') || 'Clear Chat Title',
      t('dm.clear_chat_confirm', { name: contextTarget.participantName }) || `Clear chat with ${contextTarget.participantName}? This cannot be undone.`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.clear_chat_action') || 'Clear Chat Action',
          style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            if (!meId) return;
            const convSnap = conversations.find(c => c.participantId === contextTarget.participantId);
            if (convSnap?.id) await clearChat(convSnap.id, meId);
          },
        },
      ]
    );
  }, [contextTarget, conversations, t]);

  const handleBlock = useCallback(() => {
    if (!contextTarget) return;
    const target = contextTarget;
    setContextTarget(null);
    Alert.alert(
      t('dm.block_title', { name: target.participantName }) || `Block ${target.participantName}`,
      t('dm.block_confirm') || 'Block Confirm',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.block_action') || 'Block Action',
          style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            if (!meId) return;
            await blockUser(meId, target.participantId);
          },
        },
      ]
    );
  }, [contextTarget, t]);

  const handleDeleteChat = useCallback(() => {
    if (!contextTarget) return;
    const target = contextTarget;
    setContextTarget(null);
    Alert.alert(
      t('dm.delete_chat_title') || 'Delete Chat Title',
      t('dm.delete_chat_confirm', { name: target.participantName }) || `Delete chat with ${target.participantName}?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.delete_chat_action') || 'Delete Chat Action',
          style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            if (!meId) return;
            setSettingsMap(prev => {
              const map = new Map(prev);
              const existing = map.get(target.participantId) ?? { mute: 'off', mutedUntil: null, archived: false, deleted: false, isBestFriend: false };
              map.set(target.participantId, { ...existing, deleted: true });
              return map;
            });
            await deleteConversation(meId, target.participantId);
          },
        },
      ]
    );
  }, [contextTarget, t]);

  const contextMuted = contextTarget ? (settingsMap.get(contextTarget.participantId)?.mute === 'always') : false;
  const contextIsBestFriend = contextTarget ? (settingsMap.get(contextTarget.participantId)?.isBestFriend ?? false) : false;

  const contextInitials = contextTarget?.participantName
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() ?? '';

  // --- Group context handlers ---
  const handleGroupContextMenu = useCallback((g: GroupConversation) => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    setGroupContextTarget(g);
    getContactSettings(meId, `group_${g.id}`).then(s => {
      setGroupMuteMap(prev => { const m = new Map(prev); m.set(g.id, s.mute); return m; });
    }).catch(() => {});
  }, []);

  const handleGroupMuteToggle = useCallback(async () => {
    const meId = auth.currentUser?.uid;
    if (!meId || !groupContextTarget) return;
    const current = groupMuteMap.get(groupContextTarget.id) ?? 'off';
    const next = current === 'always' ? 'off' : 'always';
    setGroupMuteMap(prev => { const m = new Map(prev); m.set(groupContextTarget.id, next); return m; });
    setGroupContextTarget(null);
    await updateContactSettings(meId, `group_${groupContextTarget.id}`, { mute: next as any }).catch(() => {});
  }, [groupContextTarget, groupMuteMap]);

  const handleGroupLeave = useCallback(() => {
    if (!groupContextTarget) return;
    const target = groupContextTarget;
    setGroupContextTarget(null);
    Alert.alert(
      t('dm.group.leave_group') || 'Leave Group',
      t('dm.group.leave_confirm') || 'Leave Confirm',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.group.leave_group') || 'Leave Group', style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            const myName = auth.currentUser?.displayName ?? '';
            if (!meId) return;
            await leaveGroup(target.id, meId, myName).catch(() => {});
            setGroupConversations(prev => prev.filter(g => g.id !== target.id));
          },
        },
      ]
    );
  }, [groupContextTarget, t]);

  const groupContextMuted = groupContextTarget ? (groupMuteMap.get(groupContextTarget.id) === 'always') : false;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: colors.text }]}>{t('dm.title') || 'Title'}</ThemedText>
        <View style={styles.headerActions}>
          <NotificationBell category="dm" />
          <TouchableOpacity onPress={() => router.push('/dm/compose' as never)} style={styles.newButton} activeOpacity={0.7}>
            <PenSquare size={24} color={colors.primary} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border + '30' }]}>
        <Search size={16} color={colors.textSecondary} strokeWidth={1.8} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('dm.search_conversations') || 'Search Conversations'}
          placeholderTextColor={colors.textSecondary + '70'}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={allFiltered}
        keyExtractor={item => item.id}
        scrollEnabled={listScrollEnabled}
        renderItem={({ item }) => {
          if ('isGroup' in item && item.isGroup) {
            const g = item as GroupConversation;
            const myName = auth.currentUser?.displayName ?? '';
            const isMuted = groupMuteMap.get(g.id) === 'always';
            return (
              <GroupConversationItem
                group={g}
                isMuted={isMuted}
                myName={myName}
                onPress={(grp) => router.push(`/dm/group/${grp.id}` as any)}
                onMute={(grp) => {
                  if (isMuted) {
                    const meId = auth.currentUser?.uid;
                    if (!meId) return;
                    setGroupMuteMap(prev => { const m = new Map(prev); m.set(grp.id, 'off'); return m; });
                    updateContactSettings(meId, `group_${grp.id}`, { mute: 'off' as any }).catch(() => {});
                  } else {
                    handleGroupContextMenu(grp);
                  }
                }}
                onContextMenu={handleGroupContextMenu}
                onSwipeStart={() => setListScrollEnabled(false)}
                onSwipeEnd={() => setListScrollEnabled(true)}
              />
            );
          }
          return (
            <DMConversationItem
              conversation={item as DMConversation}
              onPress={handleConversationPress}
              onArchive={handleArchive}
              onMute={handleMuteFromSwipe}
              onContextMenu={handleContextMenu}
              onSwipeStart={() => setListScrollEnabled(false)}
              onSwipeEnd={() => setListScrollEnabled(true)}
            />
          );
        }}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          archivedCount > 0 ? (
            <TouchableOpacity
              style={[styles.archivedBanner, { backgroundColor: colors.card, borderBottomColor: colors.border }]}
              onPress={() => router.push('/dm/archived' as never)}
              activeOpacity={0.7}
            >
              <Archive size={18} color={colors.textSecondary} strokeWidth={1.8} />
              <ThemedText style={[styles.archivedLabel, { color: colors.textSecondary }]}>
                {t('dm.archived_count', { count: archivedCount }) || `${archivedCount} archivada${archivedCount !== 1 ? 's' : ''}`}
              </ThemedText>
              <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          ) : null
        }
        ListEmptyComponent={
          error ? (
            <View style={styles.errorContainer}>
              <ThemedText style={[styles.errorText, { color: colors.danger ?? '#FF3B30' }]}>⚠️ {error}</ThemedText>
              <ThemedText style={[styles.errorSub, { color: colors.textSecondary }]}>{t('dm.db_index_help')}</ThemedText>
            </View>
          ) : (
            <View style={styles.emptyWrapper}>
              <EmptyState
                icon={MessageSquare}
                title={query ? t('dm.no_results') : t('dm.no_messages_title')}
                body={query ? t('dm.no_results_with', { query }) : t('dm.start_dm_help')}
              />
              {!query && (
                <TouchableOpacity
                  style={[styles.emptyComposeBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/dm/compose' as never)}
                  activeOpacity={0.8}
                >
                  <PenSquare size={20} color="#fff" strokeWidth={1.8} />
                  <ThemedText style={styles.emptyComposeBtnText}>
                    {t('dm.new_message') || 'New Message'}
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )
        }
      />

      {/* Mute duration picker — triggered by right swipe */}
      <Modal visible={!!muteTarget} transparent animationType="slide" onRequestClose={() => setMuteTarget(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setMuteTarget(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              <BellOff size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetName, { color: colors.text }]}>
                {t('dm.mute_title') || 'Mute Title'}
              </ThemedText>
            </View>
            {(['8h', '1w', 'always'] as MuteDuration[]).map((dur, i, arr) => (
              <TouchableOpacity
                key={dur}
                style={[styles.sheetRow, i < arr.length - 1 ? { borderBottomColor: colors.border } : {}]}
                onPress={() => handleMuteDuration(dur)}
                activeOpacity={0.7}
              >
                <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                  {t(`dm.mute_picker.${dur}`) || dur}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!contextTarget} transparent animationType="slide" onRequestClose={() => setContextTarget(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setContextTarget(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              {contextTarget?.participantPhoto ? (
                <Image source={{ uri: contextTarget.participantPhoto }} style={styles.sheetAvatar} />
              ) : (
                <View style={[styles.sheetAvatar, styles.sheetAvatarFallback, { backgroundColor: avatarColor(contextTarget?.participantId ?? '') }]}>
                  <ThemedText style={styles.sheetAvatarInitials}>{contextInitials}</ThemedText>
                </View>
              )}
              <ThemedText style={[styles.sheetName, { color: colors.text }]} numberOfLines={1}>
                {contextTarget?.participantName}
              </ThemedText>
            </View>

            <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleMuteToggle} activeOpacity={0.7}>
              {contextMuted
                ? <Bell size={20} color={colors.text} strokeWidth={1.8} />
                : <BellOff size={20} color={colors.text} strokeWidth={1.8} />}
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {contextMuted ? (t('dm.unmute') || 'Unmute') : (t('dm.mute') || 'Mute')}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetRow, { borderBottomColor: colors.border }]}
              onPress={() => { setContextTarget(null); router.push(`/dm/${contextTarget?.participantId}/profile` as never); }}
              activeOpacity={0.7}
            >
              <Info size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.contact_info') || 'Contact Info'}
              </ThemedText>
            </TouchableOpacity>

            {contextIsFriend ? (
              <>
                <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleBestFriendToggle} activeOpacity={0.7}>
                  <Star size={20} color={contextIsBestFriend ? '#FFD60A' : colors.text} strokeWidth={1.8} fill={contextIsBestFriend ? '#FFD60A' : 'none'} />
                  <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                    {contextIsBestFriend ? (t('dm.remove_best_friend') || 'Remove Best Friend') : (t('dm.add_best_friend') || 'Add Best Friend')}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleRemoveFriend} activeOpacity={0.7}>
                  <UserMinus size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
                  <ThemedText style={[styles.sheetRowText, { color: colors.danger ?? '#FF3B30' }]}>
                    {t('dm.profile.remove_friend') || 'Remove Friend'}
                  </ThemedText>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleAddFriend} activeOpacity={0.7}>
                <UserPlus size={20} color={colors.text} strokeWidth={1.8} />
                <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                  {t('dm.add_friend') || 'Add Friend'}
                </ThemedText>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleClearChat} activeOpacity={0.7}>
              <Eraser size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.clear_chat') || 'Clear Chat'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleBlock} activeOpacity={0.7}>
              <Ban size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.danger ?? '#FF3B30' }]}>
                {t('dm.block_user', { name: contextTarget?.participantName?.split(' ')[0] ?? '' }) || `Block ${contextTarget?.participantName?.split(' ')[0] ?? ''}`}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetRow, { borderBottomColor: colors.border }]}
              onPress={() => { if (contextTarget) handleArchive(contextTarget); setContextTarget(null); }}
              activeOpacity={0.7}
            >
              <Archive size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.archive') || 'Archive'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleDeleteChat} activeOpacity={0.7}>
              <Trash2 size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.danger ?? '#FF3B30' }]}>
                {t('dm.delete_chat') || 'Delete Chat'}
              </ThemedText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Group context sheet */}
      <Modal visible={!!groupContextTarget} transparent animationType="slide" onRequestClose={() => setGroupContextTarget(null)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setGroupContextTarget(null)}>
          <Pressable style={[styles.sheet, { backgroundColor: colors.card }]} onPress={() => {}}>
            <View style={[styles.sheetHeader, { borderBottomColor: colors.border }]}>
              {groupContextTarget?.photoURL
                ? <Image source={{ uri: groupContextTarget.photoURL }} style={styles.sheetAvatar} />
                : <View style={[styles.sheetAvatar, styles.sheetAvatarFallback, { backgroundColor: colors.primary + '22' }]}>
                    <Users size={20} color={colors.primary} strokeWidth={1.8} />
                  </View>
              }
              <ThemedText style={[styles.sheetName, { color: colors.text }]} numberOfLines={1}>
                {groupContextTarget?.name || t('dm.group.new_group') || 'New Group'}
              </ThemedText>
            </View>

            <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleGroupMuteToggle} activeOpacity={0.7}>
              {groupContextMuted
                ? <Bell size={20} color={colors.text} strokeWidth={1.8} />
                : <BellOff size={20} color={colors.text} strokeWidth={1.8} />}
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {groupContextMuted ? (t('dm.unmute') || 'Unmute') : (t('dm.mute') || 'Mute')}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.sheetRow, { borderBottomColor: colors.border }]}
              onPress={() => { setGroupContextTarget(null); router.push(`/dm/group/${groupContextTarget?.id}/info` as any); }}
              activeOpacity={0.7}
            >
              <Info size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.group.info_title') || 'Info Title'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={styles.sheetRow} onPress={handleGroupLeave} activeOpacity={0.7}>
              <Trash2 size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.danger ?? '#FF3B30' }]}>
                {t('dm.group.leave_group') || 'Leave Group'}
              </ThemedText>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}


