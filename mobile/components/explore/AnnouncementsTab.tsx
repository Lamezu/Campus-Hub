import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Pin, ImagePlus, Megaphone, Search } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { useAnnouncements } from '../../hooks/explore/useAnnouncements';
import { ThemedText } from '../themed-text';
import { AnnouncementCard } from './AnnouncementCard';
import { spacing, typography } from '../../constants/styles';
import { ANNOUNCEMENT_CATEGORIES } from '../../constants/announcementCategories';
import { uploadAnnouncementImage } from '../../config/cloudinary';
import { ImagePanPicker } from '../ImagePanPicker';
import { router } from 'expo-router';
import { auth } from '../../config/firebase';
import { useTranslation } from '../../hooks/useTranslation';

type PinDuration = 'permanent' | '1d' | '3d' | '1w' | '1m';

interface AnnouncementsTabProps {
  canCreateAnnouncement: boolean;
  highlightId?: string | null;
}

interface FormState {
  title: string;
  content: string;
  pinned: boolean;
  pinnedUntil: PinDuration;
  category: string;
  imageUrl: string | null;
  imageLocalUri: string | null;
  imageOffsetY: number;
}

export function AnnouncementsTab({ canCreateAnnouncement, highlightId }: AnnouncementsTabProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const currentUser = auth.currentUser;
  const { announcements, loading, loadingMore, hasMore, loadMore, createAnnouncement, updateAnnouncement, togglePin, deleteAnnouncement, publishAsSocialPost } = useAnnouncements();
  const listRef = useRef<FlatList>(null);
  const [localHighlight, setLocalHighlight] = useState<string | null>(highlightId || null);

  useEffect(() => {
    if (highlightId && announcements.length > 0) {
      setLocalHighlight(highlightId);
      const index = announcements.findIndex(a => a.id === highlightId);
      if (index !== -1) {
        setTimeout(() => {
          listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
        }, 500);
        setTimeout(() => setLocalHighlight(null), 3500);
      }
    }
  }, [highlightId, announcements]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredAnnouncements = React.useMemo(() => {
    let result = announcements;
    if (activeCategory) result = result.filter(a => a.category === activeCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.title?.toLowerCase().includes(q) || a.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [announcements, activeCategory, searchQuery]);

  const [showCreate, setShowCreate] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageDragging, setImageDragging] = useState(false);
  const [form, setForm] = useState({
    title: '',
    content: '',
    pinned: false,
    pinnedUntil: 'permanent' as PinDuration,
    category: 'general',
    imageUrl: null as string | null,
    imageLocalUri: null as string | null,
    imageOffsetY: 50,
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setForm(f => ({ ...f, imageLocalUri: result.assets[0].uri, imageUrl: null }));
    }
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) return;

    let pinnedUntil: string | null = null;
    if (form.pinned) {
      if (form.pinnedUntil === '1d') pinnedUntil = new Date(Date.now() + 86400000).toISOString();
      else if (form.pinnedUntil === '3d') pinnedUntil = new Date(Date.now() + 3 * 86400000).toISOString();
      else if (form.pinnedUntil === '1w') pinnedUntil = new Date(Date.now() + 7 * 86400000).toISOString();
      else if (form.pinnedUntil === '1m') pinnedUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    }

    let imageUrl = form.imageUrl;
    if (form.imageLocalUri) {
      setUploadingImage(true);
      try {
        imageUrl = await uploadAnnouncementImage(form.imageLocalUri);
      } catch {
        imageUrl = null;
      } finally {
        setUploadingImage(false);
      }
    }

    const data = {
      title: form.title.trim(),
      content: form.content.trim(),
      pinned: form.pinned,
      pinnedUntil,
      category: form.category,
      imageUrl,
      imageOffsetY: imageUrl ? form.imageOffsetY : null,
    };

    if (editingPostId) {
      await updateAnnouncement(editingPostId, data);
    } else {
      await createAnnouncement(data);
    }
    closeModal();
  };

  const handleEdit = (post: any) => {
    setForm({
      title: post.title,
      content: post.content,
      pinned: !!post.pinned,
      pinnedUntil: (post.pinnedUntil || 'permanent') as PinDuration,
      category: post.category || 'general',
      imageUrl: post.imageUrl || null,
      imageLocalUri: null,
      imageOffsetY: post.imageOffsetY ?? 50,
    });
    setEditingPostId(post.id);
    setShowCreate(true);
  };

  const closeModal = () => {
    setForm({ title: '', content: '', pinned: false, pinnedUntil: 'permanent', category: 'general', imageUrl: null, imageLocalUri: null, imageOffsetY: 50 });
    setEditingPostId(null);
    setShowCreate(false);
  };

  return (
    <View style={{ flex: 1 }}>
      {canCreateAnnouncement && (
        <TouchableOpacity
          style={[styles.createBtn, { backgroundColor: colors.primary }]}
          onPress={() => {
            setEditingPostId(null);
            setForm({ title: '', content: '', pinned: false, pinnedUntil: 'permanent', category: 'general', imageUrl: null, imageLocalUri: null, imageOffsetY: 50 });
            setShowCreate(true);
          }}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          <ThemedText style={styles.createBtnText}>{t('explore.new_announcement') || 'New Announcement'}</ThemedText>
        </TouchableOpacity>
      )}

      {/* Barra de búsqueda */}
      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
        <Search size={15} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('explore.search_announcements') || 'Search Announcements'}
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <X size={15} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros por categoría */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryFiltersScroll}
        contentContainerStyle={styles.categoryFilters}
      >
        <TouchableOpacity
          style={[styles.filterChip, { backgroundColor: activeCategory === null ? colors.primary : colors.backgroundSecondary }]}
          onPress={() => setActiveCategory(null)}
        >
          <ThemedText numberOfLines={1} style={[styles.filterChipText, { color: activeCategory === null ? '#fff' : colors.textSecondary }]}>
            {t('explore.all_categories') || 'All Categories'}
          </ThemedText>
        </TouchableOpacity>
        {ANNOUNCEMENT_CATEGORIES.map(cat => {
          const active = activeCategory === cat.id;
          return (
            <TouchableOpacity
              key={cat.id}
              style={[styles.filterChip, { backgroundColor: active ? cat.color : colors.backgroundSecondary }]}
              onPress={() => setActiveCategory(active ? null : cat.id)}
            >
              <ThemedText numberOfLines={1} style={[styles.filterChipText, { color: active ? '#fff' : colors.textSecondary }]}>
                {t(`explore.categories.${cat.id}`) || cat.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        ref={listRef}
        style={{ flex: 1 }}
        data={filteredAnnouncements}
        keyExtractor={item => item.id}
        onScrollToIndexFailed={() => { }}
        renderItem={({ item }) => (
          <AnnouncementCard
            post={item}
            highlighted={item.id === localHighlight}
            onPress={() => router.push(`/announcement/${item.id}` as never)}
            onEdit={(currentUser?.uid === item.authorId || canCreateAnnouncement) ? () => handleEdit(item) : undefined}
            onPin={(currentUser?.uid === item.authorId || canCreateAnnouncement) ? () => togglePin(item.id, !!item.pinned) : undefined}
            onDelete={(currentUser?.uid === item.authorId || canCreateAnnouncement) ? () => deleteAnnouncement(item.id) : undefined}
            onPublishSocial={(currentUser?.uid === item.authorId || canCreateAnnouncement) ? () => publishAsSocialPost(item) : undefined}
          />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 20 }} color={colors.primary} /> : null}
        contentContainerStyle={styles.listPad}
        initialNumToRender={5}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews={true}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon={Megaphone}
              title={canCreateAnnouncement ? t('explore.create_first') : t('explore.no_announcements')}
            />
          ) : (
            <ActivityIndicator style={{ marginTop: 50 }} color={colors.primary} />
          )
        }
      />

      <Modal visible={showCreate} animationType="slide" onRequestClose={closeModal} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? insets.top : 0 }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={closeModal}>
                <X size={22} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                {editingPostId ? (t('explore.edit_announcement') || 'Edit Announcement') : (t('explore.new_announcement') || 'New Announcement')}
              </ThemedText>
              <TouchableOpacity onPress={handleSave} disabled={!form.title.trim() || !form.content.trim() || uploadingImage}>
                {uploadingImage
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <ThemedText style={[styles.modalAction, { color: form.title.trim() && form.content.trim() ? colors.primary : colors.textSecondary }]}>
                    {editingPostId ? (t('common.save') || 'Save') : (t('explore.publish') || 'Publish')}
                  </ThemedText>
                }
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" scrollEnabled={!imageDragging}>

              {(form.imageLocalUri || form.imageUrl) ? (
                <View>
                  <ImagePanPicker
                    uri={form.imageLocalUri ?? form.imageUrl!}
                    offsetY={form.imageOffsetY}
                    onOffsetChange={v => setForm(f => ({ ...f, imageOffsetY: v }))}
                    containerHeight={140}
                    onDragStart={() => setImageDragging(true)}
                    onDragEnd={() => setImageDragging(false)}
                  />
                  <TouchableOpacity
                    style={[styles.imageRemoveBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => setForm(f => ({ ...f, imageLocalUri: null, imageUrl: null, imageOffsetY: 50 }))}
                  >
                    <X size={14} color={colors.text} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.imagePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handlePickImage}
                  activeOpacity={0.8}
                >
                  <ImagePlus size={22} color={colors.textSecondary} strokeWidth={1.5} />
                  <ThemedText style={[styles.imagePickerLabel, { color: colors.textSecondary }]}>
                    {t('explore.add_cover') || 'Add Cover'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>{t('explore.category') || 'Category'}</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {ANNOUNCEMENT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.categoryChip,
                      {
                        backgroundColor: form.category === cat.id ? cat.color : colors.backgroundSecondary,
                        borderColor: form.category === cat.id ? cat.color : colors.border,
                      }
                    ]}
                    onPress={() => setForm(f => ({ ...f, category: cat.id }))}
                  >
                    <ThemedText style={[styles.categoryChipText, { color: form.category === cat.id ? '#fff' : colors.text }]}>
                      {t(`explore.categories.${cat.id}`) || cat.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <TextInput
                style={[styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]}
                placeholder={t('explore.title_placeholder') || 'Title Placeholder'}
                placeholderTextColor={colors.textSecondary}
                value={form.title}
                onChangeText={t => setForm(f => ({ ...f, title: t }))}
              />
              <TextInput
                style={[styles.contentInput, { color: colors.text }]}
                placeholder={t('explore.content_placeholder') || 'Content Placeholder'}
                placeholderTextColor={colors.textSecondary}
                value={form.content}
                onChangeText={t => setForm(f => ({ ...f, content: t }))}
                multiline
                textAlignVertical="top"
              />

              <View style={[styles.formRow, { borderTopColor: colors.border }]}>
                <View style={styles.formRowLeft}>
                  <Pin size={16} color={colors.text} strokeWidth={2} />
                  <ThemedText style={[styles.formRowLabel, { color: colors.text }]}>{t('explore.pin_announcement') || 'Pin Announcement'}</ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: form.pinned ? colors.primary : colors.border }]}
                  onPress={() => setForm(f => ({ ...f, pinned: !f.pinned }))}
                >
                  <View style={[styles.toggleKnob, { transform: [{ translateX: form.pinned ? 18 : 2 }] }]} />
                </TouchableOpacity>
              </View>

              {form.pinned && (
                <View style={[styles.pinDurationRow, { borderTopColor: colors.border }]}>
                  {(['1d', '3d', '1w', '1m', 'permanent'] as PinDuration[]).map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.durationChip, {
                        borderColor: form.pinnedUntil === opt ? colors.primary : colors.border,
                        backgroundColor: form.pinnedUntil === opt ? colors.primary + '15' : 'transparent',
                      }]}
                      onPress={() => setForm(f => ({ ...f, pinnedUntil: opt }))}
                    >
                      <ThemedText style={[styles.durationChipText, { color: form.pinnedUntil === opt ? colors.primary : colors.textSecondary }]}>
                        {t(`explore.pin_durations.${opt}`) || opt}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, margin: spacing.md, marginBottom: 0, paddingVertical: spacing.sm + 2, borderRadius: 10 },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: typography.sizes.sm },
  listPad: { padding: spacing.md, paddingBottom: 100, gap: spacing.sm },
  modalSafe: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  modalAction: { fontSize: typography.sizes.md, fontWeight: '600' },
  modalBody: { padding: spacing.md, gap: spacing.md },
  imagePicker: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, height: 140, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  imagePickerLabel: { fontSize: typography.sizes.sm },
  imageRemoveBtn: { position: 'absolute', top: 8, right: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 4 },
  sectionLabel: { fontSize: typography.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: -spacing.xs },
  categoryRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  categoryChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  categoryChipText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  titleInput: { fontWeight: '700', fontSize: typography.sizes.lg, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  contentInput: { minHeight: 120, lineHeight: 22, fontSize: typography.sizes.md },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  formRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formRowLabel: { fontSize: typography.sizes.sm, fontWeight: '500' },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  pinDurationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  durationChip: { alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1 },
  durationChipText: { fontSize: typography.sizes.xs, fontWeight: '600' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    paddingVertical: 0,
  },
  categoryFiltersScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  categoryFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    borderRadius: 20,
    flexShrink: 0,
    alignSelf: 'center',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: typography.sizes.xs + 2,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
});
