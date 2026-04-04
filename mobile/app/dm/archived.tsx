import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Platform, Modal, Pressable, Alert, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, Search, MessageSquare,
  Bell, BellOff, Info, Eraser, Trash2, ArchiveRestore,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { DMConversationItem } from '@/components/dm/DMConversationItem';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import {
  subscribeToConversations, archiveConversation, muteConversation, deleteConversation,
} from '@/services/dmService';
import { getContactSettings, clearChat } from '@/services/contactSettingsService';
import { avatarColor } from '@/utils/avatarColor';
import { useTranslation } from '@/hooks/useTranslation';
import type { DMConversation, MuteDuration } from '@/types';

export default function ArchivedConversationsScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [settingsMap, setSettingsMap] = useState<Map<string, { mute: MuteDuration; mutedUntil: string | null; archived: boolean; deleted: boolean }>>(new Map());
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const [contextTarget, setContextTarget] = useState<DMConversation | null>(null);

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    return subscribeToConversations(meId, setConversations);
  }, []);

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

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId || conversations.length === 0) return;
    Promise.all(
      conversations.map(async (c) => {
        const s = await getContactSettings(meId, c.participantId);
        return { id: c.participantId, mute: s.mute, mutedUntil: s.mutedUntil, archived: s.archived, deleted: s.deleted };
      })
    ).then(results => {
      setSettingsMap(new Map(results.map(r => [r.id, { mute: r.mute as MuteDuration, mutedUntil: r.mutedUntil, archived: r.archived, deleted: r.deleted }])));
    }).catch(() => {});
  }, [participantIdsKey]);

  const enriched: DMConversation[] = conversations.map(c => {
    const s = settingsMap.get(c.participantId);
    return {
      ...c,
      archived: s?.archived ?? false,
      contactSettings: {
        ...c.contactSettings,
        mute: s?.mute ?? 'off',
        mutedUntil: s?.mutedUntil ?? null,
      },
    };
  });

  const archivedList = enriched.filter(c => {
    const s = settingsMap.get(c.participantId);
    return c.archived && !(s?.deleted ?? false);
  });
  const filtered = query.trim()
    ? archivedList.filter(c => c.participantName.toLowerCase().includes(query.toLowerCase()))
    : archivedList;

  const handleConversationPress = useCallback((conversation: DMConversation) => {
    router.push(`/dm/${conversation.participantId}` as never);
  }, []);

  const handleUnarchive = useCallback(async (conv: DMConversation) => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    setSettingsMap(prev => {
      const next = new Map(prev);
      const existing = next.get(conv.participantId) ?? { mute: 'off' as MuteDuration, mutedUntil: null, archived: true, deleted: false };
      next.set(conv.participantId, { ...existing, archived: false });
      return next;
    });
    await archiveConversation(meId, conv.participantId, false);
  }, []);

  const handleContextMenu = useCallback((conv: DMConversation) => {
    setContextTarget(conv);
  }, []);

  const contextMuted = contextTarget ? (settingsMap.get(contextTarget.participantId)?.mute === 'always') : false;

  const handleMuteToggle = useCallback(async () => {
    const meId = auth.currentUser?.uid;
    if (!meId || !contextTarget) return;
    const next: MuteDuration = contextMuted ? 'off' : 'always';
    setSettingsMap(prev => {
      const map = new Map(prev);
      const existing = map.get(contextTarget.participantId) ?? { mute: 'off' as MuteDuration, mutedUntil: null, archived: true, deleted: false };
      map.set(contextTarget.participantId, { ...existing, mute: next, mutedUntil: null });
      return map;
    });
    setContextTarget(null);
    await muteConversation(meId, contextTarget.participantId, next);
  }, [contextTarget, contextMuted]);

  const handleClearChat = useCallback(() => {
    if (!contextTarget) return;
    const target = contextTarget;
    setContextTarget(null);
    Alert.alert(
      t('dm.clear_chat_title') || 'Clear Chat Title',
      t('dm.clear_chat_confirm', { name: target.participantName }) || `¿Vaciar el chat con ${target.participantName}?`,
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.clear_chat_action') || 'Clear Chat Action',
          style: 'destructive',
          onPress: async () => {
            const meId = auth.currentUser?.uid;
            if (!meId) return;
            const convSnap = conversations.find(c => c.participantId === target.participantId);
            if (convSnap?.id) await clearChat(convSnap.id, meId);
          },
        },
      ]
    );
  }, [contextTarget, conversations, t]);

  const handleDeleteChat = useCallback(() => {
    if (!contextTarget) return;
    const target = contextTarget;
    setContextTarget(null);
    Alert.alert(
      t('dm.delete_chat_title') || 'Delete Chat Title',
      t('dm.delete_chat_confirm', { name: target.participantName }) || `¿Eliminar el chat con ${target.participantName}?`,
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
              const existing = map.get(target.participantId) ?? { mute: 'off' as MuteDuration, mutedUntil: null, archived: true, deleted: false };
              map.set(target.participantId, { ...existing, deleted: true });
              return map;
            });
            await deleteConversation(meId, target.participantId);
          },
        },
      ]
    );
  }, [contextTarget, t]);

  const contextInitials = contextTarget?.participantName
    .split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase() ?? '';

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {t('dm.archived_title') || 'Archived Title'}
        </ThemedText>
        <View style={{ width: 36 }} />
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('dm.search_conversations') || 'Search Conversations'}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        scrollEnabled={listScrollEnabled}
        renderItem={({ item }) => (
          <DMConversationItem
            conversation={item}
            onPress={handleConversationPress}
            onArchive={handleUnarchive}
            onContextMenu={handleContextMenu}
            archiveLabel={t('dm.unarchive') || 'Unarchive'}
            archiveColor="#007AFF"
            onSwipeStart={() => setListScrollEnabled(false)}
            onSwipeEnd={() => setListScrollEnabled(true)}
          />
        )}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState icon={MessageSquare} title={t('dm.no_archived') || 'No Archived'} />
        }
      />

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

            <TouchableOpacity
              style={[styles.sheetRow, { borderBottomColor: colors.border }]}
              onPress={() => { if (contextTarget) handleUnarchive(contextTarget); setContextTarget(null); }}
              activeOpacity={0.7}
            >
              <ArchiveRestore size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.unarchive') || 'Unarchive'}
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sheetRow, { borderBottomColor: colors.border }]} onPress={handleClearChat} activeOpacity={0.7}>
              <Eraser size={20} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.sheetRowText, { color: colors.text }]}>
                {t('dm.clear_chat') || 'Clear Chat'}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, width: 36 },
  title: { fontSize: typography.sizes.xl, lineHeight: 28, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginVertical: spacing.sm,
    borderRadius: 12, paddingHorizontal: spacing.sm + 2,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.xs,
    gap: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm, lineHeight: 20, includeFontPadding: false },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 32 },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetAvatar: { width: 36, height: 36, borderRadius: 18 },
  sheetAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  sheetAvatarInitials: { fontSize: 13, fontWeight: '700', color: '#fff' },
  sheetName: { fontSize: typography.sizes.md, fontWeight: '600', flex: 1 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: typography.sizes.md, lineHeight: 20 },
});
