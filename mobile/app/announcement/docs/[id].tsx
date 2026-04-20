import { useState, useEffect } from 'react';
import {
  View, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTranslation } from '@/hooks/useTranslation';
import { ChevronLeft, X, Pencil, MoreHorizontal, Search, Trash2, FileText } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { RichTextEditor } from '@/components/RichTextEditor';
import { RichTextViewer } from '@/components/RichTextViewer';
import type { Post } from '@/types';

export default function AnnouncementDocsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { role, subrole } = useCurrentUser();

  const [announcement, setAnnouncement] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [showMenu, setShowMenu] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCount, setSearchCount] = useState<number | null>(null);
  const [headerH, setHeaderH] = useState(52);

  const canEdit = role === 'admin' || subrole === 'coordinator';

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'posts', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setAnnouncement({
          id: snap.id, ...d,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: null,
        } as Post);
      }
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error(err);
      setLoading(false);
    });
  }, [id]);

  const stopSearch = () => {
    setSearching(false);
    setSearchQuery('');
    setSearchCount(null);
  };

  const startEdit = () => {
    stopSearch();
    setDraft(announcement?.docsContent ?? '');
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setDraft('');
  };

  const saveEdit = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const clean = draft
        .replace(/<button[^>]*class="tbl-del"[^>]*>[\s\S]*?<\/button>\s*/g, '')
        .replace(/<div[^>]*class="tbl-wrap">\s*/g, '')
        .replace(/(<\/table>)\s*<\/div>/g, '$1')
        .trim();
      await updateDoc(doc(db, 'posts', id), {
        docsContent: clean || null,
        updatedAt: serverTimestamp(),
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const clearContent = () => {
    Alert.alert(
      t('explore.documentation.alerts.clear_title') || 'Clear Title',
      t('explore.documentation.alerts.clear_msg') || 'Clear Msg',
      [
        { text: t('explore.documentation.header.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete', style: 'destructive', onPress: async () => {
            if (!id) return;
            await updateDoc(doc(db, 'posts', id), { docsContent: null, updatedAt: serverTimestamp() });
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!announcement) {
    return (
      <ThemedView style={styles.centered}>
        <Stack.Screen options={{ headerShown: false }} />
        <ThemedText style={{ color: colors.textSecondary }}>{t('explore.announcement_not_found') || 'Announcement Not Found'}</ThemedText>
      </ThemedView>
    );
  }

  const hasContent = !!(announcement.docsContent?.trim());
  const showMenuBtn = !editing && (canEdit || hasContent);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View
        style={[styles.header, { borderBottomColor: colors.border }]}
        onLayout={e => setHeaderH(e.nativeEvent.layout.height)}
      >
        <TouchableOpacity
          onPress={editing ? cancelEdit : () => router.back()}
          style={styles.backBtn}
        >
          {editing ? (
            <X size={24} color={colors.primary} strokeWidth={2} />
          ) : (
            <ChevronLeft size={28} color={colors.primary} strokeWidth={2} />
          )}
        </TouchableOpacity>

        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('explore.documentation.title') || 'Title'}</ThemedText>

        {editing ? (
          <TouchableOpacity onPress={saveEdit} disabled={saving} style={styles.actionBtn}>
            {saving
              ? <ActivityIndicator size="small" color={colors.primary} />
              : <ThemedText style={[styles.saveText, { color: colors.primary }]}>{t('explore.documentation.header.save') || 'Save'}</ThemedText>
            }
          </TouchableOpacity>
        ) : showMenuBtn ? (
          <TouchableOpacity onPress={() => setShowMenu(v => !v)} style={styles.actionBtn}>
            <MoreHorizontal size={22} color={showMenu ? colors.primary : colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 72 }} />
        )}
      </View>

      {showMenu && (
        <TouchableOpacity
          style={{ position: 'absolute', top: headerH, left: 0, right: 0, bottom: 0 }}
          onPress={() => setShowMenu(false)}
          activeOpacity={1}
        />
      )}

      {showMenu && (
        <View style={[styles.menuCard, { top: headerH + 4, backgroundColor: colors.card, borderColor: colors.border }]}>
          {canEdit && (
            <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMenu(false); startEdit(); }}>
              <Pencil size={15} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.menuRowText, { color: colors.text }]}>{t('explore.documentation.menu.edit') || 'Edit'}</ThemedText>
            </TouchableOpacity>
          )}
          {hasContent && canEdit && (
            <View style={[styles.menuSep, { backgroundColor: colors.border }]} />
          )}
          {hasContent && (
            <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMenu(false); setSearching(true); }}>
              <Search size={15} color={colors.text} strokeWidth={1.8} />
              <ThemedText style={[styles.menuRowText, { color: colors.text }]}>{t('explore.documentation.menu.search') || 'Search'}</ThemedText>
            </TouchableOpacity>
          )}
          {canEdit && hasContent && (
            <>
              <View style={[styles.menuSep, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuRow} onPress={() => { setShowMenu(false); clearContent(); }}>
                <Trash2 size={15} color="#FF3B30" strokeWidth={1.8} />
                <ThemedText style={[styles.menuRowText, { color: '#FF3B30' }]}>{t('explore.documentation.menu.clear') || 'Clear'}</ThemedText>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {searching && !editing && (
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
          <Search size={15} color={colors.textSecondary} strokeWidth={2} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('explore.documentation.search_placeholder') || 'Search Placeholder'}
            placeholderTextColor={colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchCount !== null && (
            <ThemedText style={[styles.searchCount, { color: colors.textSecondary }]}>
              {searchCount === 0 ? (t('explore.documentation.no_results') || 'No Results') : `${searchCount}`}
            </ThemedText>
          )}
          <TouchableOpacity onPress={stopSearch} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <X size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {editing ? (
          <RichTextEditor
            value={draft}
            onChange={setDraft}
            placeholder={t('explore.documentation.editor_placeholder') || 'Editor Placeholder'}
          />
        ) : hasContent ? (
          <ScrollView
            contentContainerStyle={styles.viewerContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText style={[styles.announcementRef, { color: colors.textSecondary }]} numberOfLines={2}>
              {announcement.title}
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <RichTextViewer
              html={announcement.docsContent!}
              searchQuery={searching ? searchQuery : ''}
              onSearchCount={setSearchCount}
            />
          </ScrollView>
        ) : (
          <EmptyState
            icon={FileText}
            title={t('explore.documentation.empty.title') || 'Title'}
            body={canEdit
              ? (t('explore.documentation.empty.body_admin') || 'Body Admin')
              : (t('explore.documentation.empty.body_user') || 'Body User')}
            action={canEdit ? { label: t('explore.documentation.add_btn') || 'Add Button', onPress: startEdit } : undefined}
            fill
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, minWidth: 80 },
  headerSideText: { fontSize: typography.sizes.md },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  actionBtn: { minWidth: 72, alignItems: 'flex-end', justifyContent: 'center', padding: spacing.xs },
  saveText: { fontSize: typography.sizes.md, fontWeight: '600' },
  menuCard: {
    position: 'absolute',
    right: spacing.md,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 100,
    minWidth: 172,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  menuRowText: { fontSize: typography.sizes.sm, fontWeight: '500' },
  menuSep: { height: StyleSheet.hairlineWidth },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm, paddingVertical: 2 },
  searchCount: { fontSize: typography.sizes.xs, fontWeight: '600' },
  viewerContent: { padding: spacing.md, paddingBottom: spacing.xl },
  announcementRef: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: spacing.lg },
});
