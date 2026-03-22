import React, { useState, useMemo, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, StatusBar, Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Image as ImageIcon, Film, File, Mic, Link as LinkIcon } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { getSharedMedia } from '@/services/contactSettingsService';
import { getConversationId } from '@/services/dmService';
import { auth } from '@/config/firebase';
import type { SharedMedia } from '@/types';

type Tab = 'image' | 'video' | 'file' | 'audio' | 'link';

const getTabs = (t: any): { key: Tab; label: string; icon: React.ReactNode }[] => [
  { key: 'image', label: t('dm.profile.media_tabs.image') || 'Imágenes', icon: null },
  { key: 'video', label: t('dm.profile.media_tabs.video') || 'Vídeos', icon: null },
  { key: 'file', label: t('dm.profile.media_tabs.file') || 'Archivos', icon: null },
  { key: 'audio', label: t('dm.profile.media_tabs.audio') || 'Audio', icon: null },
  { key: 'link', label: t('dm.profile.media_tabs.link') || 'Enlaces', icon: null },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - spacing.md * 2 - spacing.xs * 2) / 3;

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatDate(iso: string, locale: string = 'es-ES'): string {
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

function GridItem({ item, colors, userId }: { item: SharedMedia; colors: any; userId: string }) {
  return (
    <TouchableOpacity
      style={[styles.gridItem, { backgroundColor: colors.backgroundSecondary, width: GRID_ITEM_SIZE, height: GRID_ITEM_SIZE }]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: `/dm/${userId}`, params: { highlightId: item.id } } as any)}
    >
      <ImageIcon size={28} color={colors.textSecondary} strokeWidth={1.5} />
      <ThemedText style={[styles.gridLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {item.name}
      </ThemedText>
    </TouchableOpacity>
  );
}

function ListItem({ item, colors, icon, userId, language }: { item: SharedMedia; colors: any; icon: React.ReactNode; userId: string; language?: string }) {
  return (
    <TouchableOpacity
      style={[styles.listItem, { borderBottomColor: colors.border }]}
      activeOpacity={0.7}
      onPress={() => router.push({ pathname: `/dm/${userId}`, params: { highlightId: item.id } } as any)}
    >
      <View style={[styles.listIcon, { backgroundColor: colors.backgroundSecondary }]}>
        {icon}
      </View>
      <View style={styles.listInfo}>
        <ThemedText style={[styles.listName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <ThemedText style={[styles.listMeta, { color: colors.textSecondary }]}>
          {formatSize(item.size)}{item.size ? ' • ' : ''}{formatDate(item.createdAt, language)}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

export default function DMMediaScreen() {
  const { userId, tab: initialTab } = useLocalSearchParams<{ userId: string; tab?: string }>();
  const { colors, theme } = useTheme();
  const { t, language } = useTranslation();

  const meId = auth.currentUser?.uid ?? '';
  const conversationId = useMemo(() => (meId && userId) ? getConversationId(meId, userId) : '', [meId, userId]);
  const [allMedia, setAllMedia] = useState<SharedMedia[]>([]);

  const TABS = getTabs(t);

  useEffect(() => {
    if (!conversationId) return;
    getSharedMedia(conversationId).then(setAllMedia).catch(() => { });
  }, [conversationId]);

  const [activeTab, setActiveTab] = useState<Tab>(
    initialTab === 'starred' ? 'image' : ((initialTab as Tab) ?? 'image')
  );

  const filtered = useMemo(() => allMedia.filter(m => m.type === activeTab), [allMedia, activeTab]);

  const counts = useMemo(() => {
    const map: Record<Tab, number> = { image: 0, video: 0, file: 0, audio: 0, link: 0 };
    allMedia.forEach(m => { if (m.type in map) map[m.type as Tab]++; });
    return map;
  }, [allMedia]);

  const isGrid = activeTab === 'image' || activeTab === 'video';

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
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('dm.profile.media_links') || 'Archivos'}</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TABS}
          keyExtractor={t => t.key}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === item.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(item.key)}
              activeOpacity={0.7}
            >
              <ThemedText style={[
                styles.tabLabel,
                { color: activeTab === item.key ? colors.primary : colors.textSecondary },
              ]}>
                {item.label} {counts[item.key] > 0 ? `(${counts[item.key]})` : ''}
              </ThemedText>
            </TouchableOpacity>
          )}
        />
      </View>

      {filtered.length === 0 ? (
        <View style={styles.emptyContainer}>
          {activeTab === 'image' && <ImageIcon size={48} color={colors.textSecondary} strokeWidth={1.5} />}
          {activeTab === 'video' && <Film size={48} color={colors.textSecondary} strokeWidth={1.5} />}
          {activeTab === 'file' && <File size={48} color={colors.textSecondary} strokeWidth={1.5} />}
          {activeTab === 'audio' && <Mic size={48} color={colors.textSecondary} strokeWidth={1.5} />}
          {activeTab === 'link' && <LinkIcon size={48} color={colors.textSecondary} strokeWidth={1.5} />}
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('dm.profile.empty_media', { type: TABS.find(t => t.key === activeTab)?.label.toLowerCase() ?? (t('dm.profile.media_tabs.file') || 'archivos').toLowerCase() }) || `No hay ${TABS.find(t => t.key === activeTab)?.label.toLowerCase() ?? 'archivos'}`}
          </ThemedText>
        </View>
      ) : isGrid ? (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          numColumns={3}
          contentContainerStyle={styles.gridContainer}
          columnWrapperStyle={{ gap: spacing.xs }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          renderItem={({ item }) => <GridItem item={item} colors={colors} userId={userId} />}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingTop: spacing.sm }}
          renderItem={({ item }) => {
            let icon: React.ReactNode = <File size={20} color={colors.primary} strokeWidth={1.8} />;
            if (item.type === 'audio') icon = <Mic size={20} color={colors.primary} strokeWidth={1.8} />;
            if (item.type === 'link') icon = <LinkIcon size={20} color={colors.primary} strokeWidth={1.8} />;
            return <ListItem item={item} colors={colors} icon={icon} userId={userId} language={language} />;
          }}
        />
      )}
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
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.xs,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  gridContainer: {
    padding: spacing.md,
    gap: spacing.xs,
  },
  gridItem: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    overflow: 'hidden',
  },
  gridLabel: {
    fontSize: 10,
    lineHeight: 14,
    paddingHorizontal: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  listIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listInfo: { flex: 1 },
  listName: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  listMeta: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
  },
});
