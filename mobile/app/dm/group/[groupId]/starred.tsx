import React, { useState, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, StatusBar, Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Star } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/EmptyState';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { auth } from '@/config/firebase';
import { spacing, typography } from '@/constants/styles';
import {
  getStarredMessagesForGroup, unstarMessage,
  type StarredMessage,
} from '@/services/starredMessagesService';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function GroupStarredScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const meId = auth.currentUser?.uid ?? '';

  const [items, setItems] = useState<StarredMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStarred = useCallback(() => {
    if (!groupId || !meId) return;
    setLoading(true);
    getStarredMessagesForGroup(meId, groupId)
      .then(msgs => setItems(msgs))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId, meId]);

  useFocusEffect(loadStarred);

  const handleUnstar = async (item: StarredMessage) => {
    await unstarMessage(meId, item.id).catch(() => {});
    setItems(prev => prev.filter(m => m.id !== item.id));
  };

  const handleGoToMessage = (item: StarredMessage) => {
    router.navigate(`/dm/group/${groupId}?highlightId=${item.id}` as any);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {t('dm.group.starred') || 'Starred'}
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingBottom: 32, flexGrow: 1 }}
          ListEmptyComponent={
            <EmptyState icon={Star} title={t('chat.no_starred') || 'No Starred'} body={t('chat.no_starred_body') || 'No Starred Body'} fill />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.item, { borderBottomColor: colors.border }]}
              onPress={() => handleGoToMessage(item)}
              activeOpacity={0.7}
            >
              <View style={styles.itemHeader}>
                <ThemedText style={[styles.senderName, { color: colors.primary }]} numberOfLines={1}>
                  {item.senderId === meId ? (t('common.you') || 'You') : (item.senderName || t('common.user') || 'User')}
                </ThemedText>
                <ThemedText style={[styles.dateText, { color: colors.textSecondary }]}>
                  {formatDate(item.starredAt)}
                </ThemedText>
                <TouchableOpacity onPress={() => handleUnstar(item)} hitSlop={8}>
                  <Star size={18} color="#FFD60A" fill="#FFD60A" strokeWidth={2} />
                </TouchableOpacity>
              </View>
              {!!item.text && (
                <ThemedText style={[styles.msgText, { color: colors.text }]} numberOfLines={4}>
                  {item.text}
                </ThemedText>
              )}
              {!!item.poll && (
                <ThemedText style={[styles.attachLabel, { color: colors.textSecondary }]}>📊 {t('dm.reply_types.poll') || 'Poll'}: {item.poll.question}</ThemedText>
              )}
              {item.type === 'event' && item.metadata && (
                <ThemedText style={[styles.attachLabel, { color: colors.textSecondary }]}>📅 {t('dm.reply_types.event') || 'Event'}: {item.metadata.title}</ThemedText>
              )}
              {item.attachments?.some(a => a.type === 'image') && (
                <Image source={{ uri: item.attachments.find(a => a.type === 'image')!.url }} style={styles.thumb} resizeMode="cover" />
              )}
              {item.attachments?.some(a => a.type === 'audio') && (
                <ThemedText style={[styles.attachLabel, { color: colors.textSecondary }]}>🎤 {t('chat.voice_msg_preview') || 'Voice Msg Preview'}</ThemedText>
              )}
              {item.attachments?.some(a => a.type === 'file') && (
                <ThemedText style={[styles.attachLabel, { color: colors.textSecondary }]}>📎 {item.attachments.find(a => a.type === 'file')?.name}</ThemedText>
              )}
              {item.attachments?.some((a: any) => a.type === 'contact') && (
                <ThemedText style={[styles.attachLabel, { color: colors.textSecondary }]}>👤 {t('dm.reply_types.contact') || 'Contact'}: {(item.attachments.find((a: any) => a.type === 'contact') as any)?.name}</ThemedText>
              )}
            </TouchableOpacity>
          )}
        />
      )}
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
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', textAlign: 'center' },
  item: {
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 4,
  },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  senderName: { flex: 1, fontSize: typography.sizes.sm, fontWeight: '700' },
  dateText: { fontSize: typography.sizes.xs },
  msgText: { fontSize: typography.sizes.sm, lineHeight: 20 },
  attachLabel: { fontSize: typography.sizes.sm, marginTop: 2 },
  thumb: { width: 80, height: 80, borderRadius: 8, marginTop: 4 },
});
