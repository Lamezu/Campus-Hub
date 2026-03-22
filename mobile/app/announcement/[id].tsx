import { useState, useEffect } from 'react';
import {
  View, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform, Alert, Modal, Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
  doc, updateDoc, deleteDoc, addDoc, collection,
  onSnapshot, serverTimestamp, getDoc,
} from 'firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getCategoryConfig, ANNOUNCEMENT_CATEGORIES } from '@/constants/announcementCategories';
import { ChevronLeft, Pin, Megaphone, X, Pencil, Trash2, CalendarDays, ChevronRight, ImagePlus, FileText } from 'lucide-react-native';
import type { Post, CalendarEvent, CalendarEventType } from '@/types';
import { useCalendarEvents } from '@/hooks/explore/useCalendarEvents';
import { MiniDatePicker } from '@/components/MiniDatePicker';
import { TimePicker } from '@/components/TimePicker';
import { ImagePanPicker, imageOffsetStyle } from '@/components/ImagePanPicker';
import { uploadAnnouncementImage } from '@/config/cloudinary';

type PinDuration = 'permanent' | '1d' | '3d' | '1w' | '1m';

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { labelKey: string; color: string }> = {
  exam: { labelKey: 'explore.event_types.exam', color: '#FF3B30' },
  deadline: { labelKey: 'explore.event_types.deadline', color: '#FF9500' },
  holiday: { labelKey: 'explore.event_types.holiday', color: '#34C759' },
  event: { labelKey: 'explore.event_types.event', color: '#007AFF' },
  class: { labelKey: 'explore.event_types.class', color: '#AF52DE' },
};

const EVENT_TYPES: CalendarEventType[] = ['event', 'exam', 'deadline', 'class', 'holiday'];

function getPinExpiryText(pinnedUntil: string | null | undefined, t: (k: string, o?: any) => string): string | null {
  if (!pinnedUntil) return null;
  const remaining = new Date(pinnedUntil).getTime() - Date.now();
  if (remaining <= 0) return t('explore.pin_expiry.expired') || 'Fijado (expirado)';
  const days = Math.ceil(remaining / 86400000);
  if (days < 2) return t('explore.pin_expiry.today') || 'Fijado · expira hoy';
  if (days < 8) return t('explore.pin_expiry.days', { days }) || `Fijado · expira en ${days}d`;
  return t('explore.pin_expiry.weeks', { weeks: Math.ceil(days / 7) }) || `Fijado · expira en ${Math.ceil(days / 7)}sem`;
}

export default function AnnouncementDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { userData, can } = useCurrentUser();
  const currentUser = auth.currentUser;
  const { createLinkedEvent } = useCalendarEvents();

  const [announcement, setAnnouncement] = useState<Post | null>(null);
  const [linkedEvent, setLinkedEvent] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const [showEdit, setShowEdit] = useState(false);
  const [uploadingEditImage, setUploadingEditImage] = useState(false);
  const [editImageLocalUri, setEditImageLocalUri] = useState<string | null>(null);
  const [editImageOffsetY, setEditImageOffsetY] = useState(50);
  const [editImageDragging, setEditImageDragging] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '', content: '', pinned: false,
    pinnedUntil: 'permanent' as PinDuration, category: 'general', imageUrl: null as string | null,
  });

  const [showCreateEvent, setShowCreateEvent] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const today = new Date();
  const [eventDate, setEventDate] = useState<Date>(today);
  const [eventTime, setEventTime] = useState('');
  const [eventForm, setEventForm] = useState({
    title: '',
    type: 'event' as CalendarEventType,
  });

  useEffect(() => {
    if (!id) return;
    return onSnapshot(doc(db, 'posts', id), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        const ann = {
          id: snap.id, ...d,
          createdAt: d.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: null,
        } as Post;
        setAnnouncement(ann);
        setEditForm({
          title: ann.title, content: ann.content, pinned: !!ann.pinned,
          pinnedUntil: (ann.pinnedUntil as PinDuration) || 'permanent',
          category: ann.category || 'general', imageUrl: ann.imageUrl || null,
        });
        setEditImageLocalUri(null);
        setEditImageOffsetY(ann.imageOffsetY ?? 50);
        setEventForm(f => ({ ...f, title: ann.title }));
      }
      setLoading(false);
    }, (err) => {
      if (err.code !== 'permission-denied') console.error(err);
      setLoading(false);
    });
  }, [id]);

  useEffect(() => {
    if (!announcement?.socialId) return;
    const checkSocial = async () => {
      const snap = await getDoc(doc(db, 'posts', announcement.socialId!));
      if (!snap.exists()) {
        await updateDoc(doc(db, 'posts', id!), { socialId: null });
      }
    };
    checkSocial();
  }, [announcement?.socialId]);

  useEffect(() => {
    if (!announcement?.linkedEventId) { setLinkedEvent(null); return; }
    getDoc(doc(db, 'events', announcement.linkedEventId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setLinkedEvent({
          id: snap.id,
          title: data.title ?? '',
          description: data.description ?? '',
          date: data.startDate instanceof Timestamp
            ? data.startDate.toDate().toISOString()
            : new Date().toISOString(),
          endDate: null,
          allDay: data.allDay ?? true,
          time: data.time ?? null,
          type: (data.category ?? data.type ?? 'event') as CalendarEventType,
          authorId: data.creatorId ?? '',
          authorName: data.authorName ?? '',
          createdAt: new Date().toISOString(),
          linkedAnnouncementId: id,
        });
      }
    }).catch(() => { });
  }, [announcement?.linkedEventId]);

  const isAuthor = !!(currentUser && announcement?.authorId === currentUser.uid);
  const canManage = isAuthor || can('createAnnouncement');
  const canLinkEvent = canManage && (can('createAcademicEvent') || can('createGeneralEvent'));

  const handleDelete = () => {
    Alert.alert(t('explore.delete_confirm') || 'Eliminar anuncio', t('explore.delete_confirm_msg') || '¿Seguro que quieres eliminar este anuncio?', [
      { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
      {
        text: t('common.delete') || 'Eliminar', style: 'destructive', onPress: async () => {
          await deleteDoc(doc(db, 'posts', id!));
          router.back();
        }
      },
    ]);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title.trim() || !editForm.content.trim()) return;
    let pinnedUntil: string | null = null;
    if (editForm.pinned) {
      if (editForm.pinnedUntil === '1d') pinnedUntil = new Date(Date.now() + 86400000).toISOString();
      else if (editForm.pinnedUntil === '3d') pinnedUntil = new Date(Date.now() + 3 * 86400000).toISOString();
      else if (editForm.pinnedUntil === '1w') pinnedUntil = new Date(Date.now() + 7 * 86400000).toISOString();
      else if (editForm.pinnedUntil === '1m') pinnedUntil = new Date(Date.now() + 30 * 86400000).toISOString();
    }
    let imageUrl = editForm.imageUrl;
    if (editImageLocalUri) {
      setUploadingEditImage(true);
      try { imageUrl = await uploadAnnouncementImage(editImageLocalUri); }
      catch { imageUrl = editForm.imageUrl; }
      finally { setUploadingEditImage(false); }
    }
    await updateDoc(doc(db, 'posts', id!), {
      title: editForm.title.trim(), content: editForm.content.trim(),
      pinned: editForm.pinned, pinnedUntil, category: editForm.category,
      imageUrl: imageUrl ?? null,
      imageOffsetY: imageUrl ? editImageOffsetY : null,
      updatedAt: serverTimestamp(),
    });
    setEditImageLocalUri(null);
    setShowEdit(false);
  };

  const handlePublishSocial = async () => {
    if (!currentUser || !announcement) return;
    Alert.alert(t('explore.publish_social') || 'Publicar como post', t('explore.social_confirm') || 'Se publicará este anuncio como post en el feed social.', [
      { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
      {
        text: t('explore.publish') || 'Publicar', onPress: async () => {
          const docRef = await addDoc(collection(db, 'posts'), {
            title: announcement.title, content: announcement.content,
            authorId: announcement.authorId, authorName: announcement.authorName,
            authorPhoto: announcement.authorPhoto ?? null,
            postType: 'post', likes: [], likesCount: 0, commentsCount: 0,
            viewsCount: 0, views: [], createdAt: serverTimestamp(), updatedAt: null,
            tags: ['anuncio'],
            mediaUrl: announcement.imageUrl ?? null,
            mediaType: announcement.imageUrl ? 'image' : null,
            imageOffsetY: announcement.imageUrl ? announcement.imageOffsetY : null,
            originalAnnouncementId: announcement.id,
          });
          await updateDoc(doc(db, 'posts', id!), { socialId: docRef.id });
        }
      },
    ]);
  };

  const handlePickEditImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setEditImageLocalUri(result.assets[0].uri);
      setEditForm(f => ({ ...f, imageUrl: null }));
    }
  };

  const handleCreateEvent = async () => {
    if (!eventForm.title.trim()) return;
    setSavingEvent(true);
    const time = eventTime.length >= 4 ? eventTime : null;
    await createLinkedEvent(id!, {
      title: eventForm.title.trim(),
      date: eventDate,
      time,
      type: eventForm.type,
      departmentId: userData?.department ?? null,
    });
    setSavingEvent(false);
    setShowCreateEvent(false);
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
        <ThemedText style={{ color: colors.textSecondary }}>{t('explore.announcement_not_found') || 'Anuncio no encontrado.'}</ThemedText>
      </ThemedView>
    );
  }

  const category = getCategoryConfig(announcement.category);
  const pinExpiry = getPinExpiryText(announcement.pinnedUntil, t);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
          <ThemedText style={[styles.backText, { color: colors.primary }]}>{t('explore.bulletin_board') || 'Tablón'}</ThemedText>
        </TouchableOpacity>
        {canManage && (
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={() => setShowEdit(true)} style={styles.iconBtn}>
              <Pencil size={19} color={colors.primary} strokeWidth={1.8} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDelete} style={styles.iconBtn}>
              <Trash2 size={19} color="#FF3B30" strokeWidth={1.8} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        <View style={[styles.metaStrip, { borderBottomColor: colors.border }]}>
          <ThemedText style={[styles.metaStripText, { color: colors.textSecondary }]}>
            {(t('explore.administration') || 'Administración') + ' · '}
            {new Date(announcement.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
          </ThemedText>
        </View>

        {announcement.imageUrl ? (
          <View style={styles.headerImage}>
            <Image source={{ uri: announcement.imageUrl }} style={imageOffsetStyle(announcement.imageOffsetY, 220)} resizeMode="cover" />
          </View>
        ) : (
          <View style={[styles.categoryBar, { backgroundColor: category.color }]} />
        )}

        <View style={styles.body}>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: category.color + '18' }]}>
              <ThemedText style={[styles.badgeText, { color: category.color }]}>
                {category.label.toUpperCase()}
              </ThemedText>
            </View>
            {announcement.pinned && (
              <View style={[styles.badge, { backgroundColor: colors.primary + '12' }]}>
                <Pin size={10} color={colors.primary} strokeWidth={2} />
                <ThemedText style={[styles.badgeText, { color: colors.primary }]}>
                  {pinExpiry ?? (t('explore.pinned') || 'FIJADO')}
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={[styles.title, { color: colors.text }]}>{announcement.title}</ThemedText>

          <View style={[styles.contentBox, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <ThemedText style={[styles.content, { color: colors.text }]}>{announcement.content}</ThemedText>
          </View>

          {linkedEvent ? (
            <TouchableOpacity
              style={[styles.eventCard, { backgroundColor: EVENT_TYPE_CONFIG[linkedEvent.type].color + '10', borderColor: EVENT_TYPE_CONFIG[linkedEvent.type].color + '30' }]}
              onPress={() => router.push({ pathname: '/(tabs)/explore', params: { tab: 'Calendario', highlightDay: linkedEvent.date } } as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.eventTypeBadge, { backgroundColor: EVENT_TYPE_CONFIG[linkedEvent.type].color + '20' }]}>
                <CalendarDays size={13} color={EVENT_TYPE_CONFIG[linkedEvent.type].color} strokeWidth={2} />
                <ThemedText style={[styles.eventTypeBadgeText, { color: EVENT_TYPE_CONFIG[linkedEvent.type].color }]}>
                  {(t(EVENT_TYPE_CONFIG[linkedEvent.type].labelKey) || linkedEvent.type).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.eventCardBody}>
                <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{linkedEvent.title}</ThemedText>
                <ThemedText style={[styles.eventDate, { color: colors.textSecondary }]}>
                  {new Date(linkedEvent.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
                  {linkedEvent.time ? ` · ${linkedEvent.time}` : ''}
                </ThemedText>
              </View>
              <ChevronRight size={16} color={EVENT_TYPE_CONFIG[linkedEvent.type].color} strokeWidth={2} />
            </TouchableOpacity>
          ) : canLinkEvent ? (
            <TouchableOpacity
              style={[styles.linkEventBtn, { borderColor: colors.primary + '50', backgroundColor: colors.primary + '08' }]}
              onPress={() => setShowCreateEvent(true)}
              activeOpacity={0.8}
            >
              <CalendarDays size={16} color={colors.primary} strokeWidth={2} />
              <ThemedText style={[styles.linkEventBtnText, { color: colors.primary }]}>{t('explore.link_event') || 'Vincular evento al calendario'}</ThemedText>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={[styles.docsCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
            onPress={() => router.push(`/announcement/docs/${id}` as any)}
            activeOpacity={0.8}
          >
            <View style={[styles.docsIconBox, { backgroundColor: colors.primary + '15' }]}>
              <FileText size={18} color={colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.docsLabel, { color: colors.text }]}>{t('explore.documentation.title') || 'Documentación'}</ThemedText>
              <ThemedText style={[styles.docsSub, { color: colors.textSecondary }]}>
                {announcement.docsContent ? (t('explore.with_docs') || 'Con documentación adjunta') : (t('explore.no_docs') || 'Sin contenido aún')}
              </ThemedText>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>

          {canManage && (
            announcement.socialId ? (
              <View style={[styles.sharedBadge, { backgroundColor: '#FF950012', borderColor: '#FF950040' }]}>
                <Megaphone size={13} color="#FF9500" strokeWidth={2} />
                <ThemedText style={[styles.sharedBadgeText, { color: '#FF9500' }]}>{t('explore.already_published') || 'Ya publicado como post'}</ThemedText>
              </View>
            ) : (
              <TouchableOpacity style={[styles.shareBtn, { backgroundColor: colors.primary }]} onPress={handlePublishSocial} activeOpacity={0.85}>
                <Megaphone size={16} color="#fff" strokeWidth={2} />
                <ThemedText style={styles.shareBtnText}>{t('explore.publish_social') || 'Publicar como post'}</ThemedText>
              </TouchableOpacity>
            )
          )}
        </View>

        <View style={{ height: spacing.xl * 2 }} />
      </ScrollView>

      <Modal visible={showEdit} animationType="slide" onRequestClose={() => setShowEdit(false)} statusBarTranslucent>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flex: 1, paddingTop: Platform.OS === 'ios' ? insets.top : 0 }}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <TouchableOpacity onPress={() => setShowEdit(false)}><X size={22} color={colors.text} strokeWidth={2} /></TouchableOpacity>
              <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('explore.edit_announcement') || 'Editar anuncio'}</ThemedText>
              <TouchableOpacity onPress={handleSaveEdit} disabled={!editForm.title.trim() || !editForm.content.trim() || uploadingEditImage}>
                {uploadingEditImage
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <ThemedText style={[styles.modalAction, { color: editForm.title.trim() && editForm.content.trim() ? colors.primary : colors.textSecondary }]}>
                    {t('common.save') || 'Guardar'}
                  </ThemedText>
                }
              </TouchableOpacity>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled" scrollEnabled={!editImageDragging}>

              {(editImageLocalUri || editForm.imageUrl) ? (
                <View>
                  <ImagePanPicker
                    uri={editImageLocalUri ?? editForm.imageUrl!}
                    offsetY={editImageOffsetY}
                    onOffsetChange={setEditImageOffsetY}
                    containerHeight={140}
                    onDragStart={() => setEditImageDragging(true)}
                    onDragEnd={() => setEditImageDragging(false)}
                  />
                  <TouchableOpacity
                    style={[styles.imageRemoveBtn, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                    onPress={() => { setEditImageLocalUri(null); setEditForm(f => ({ ...f, imageUrl: null })); }}
                  >
                    <X size={14} color={colors.text} strokeWidth={2.5} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.imagePicker, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                  onPress={handlePickEditImage}
                  activeOpacity={0.8}
                >
                  <ImagePlus size={22} color={colors.textSecondary} strokeWidth={1.5} />
                  <ThemedText style={[styles.imagePickerLabel, { color: colors.textSecondary }]}>
                    {t('explore.image_picker_label') || 'Imagen de portada (opcional)'}
                  </ThemedText>
                </TouchableOpacity>
              )}

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
                {ANNOUNCEMENT_CATEGORIES.map(cat => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.catChip, {
                      backgroundColor: editForm.category === cat.id ? cat.color : colors.backgroundSecondary,
                      borderColor: editForm.category === cat.id ? cat.color : colors.border,
                    }]}
                    onPress={() => setEditForm(f => ({ ...f, category: cat.id }))}
                  >
                    <ThemedText style={[styles.catChipText, { color: editForm.category === cat.id ? '#fff' : colors.text }]}>
                      {cat.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TextInput
                style={[styles.modalTitleInput, { color: colors.text, borderBottomColor: colors.border }]}
                placeholder={t('explore.title_placeholder') || 'Título'} placeholderTextColor={colors.textSecondary}
                value={editForm.title} onChangeText={t => setEditForm(f => ({ ...f, title: t }))}
              />
              <TextInput
                style={[styles.modalContentInput, { color: colors.text }]}
                placeholder={t('explore.content_placeholder') || 'Contenido...'} placeholderTextColor={colors.textSecondary}
                value={editForm.content} onChangeText={t => setEditForm(f => ({ ...f, content: t }))}
                multiline textAlignVertical="top"
              />
              <View style={[styles.formRow, { borderTopColor: colors.border }]}>
                <View style={styles.formRowLeft}>
                  <Pin size={16} color={colors.text} strokeWidth={2} />
                  <ThemedText style={[styles.formRowLabel, { color: colors.text }]}>{t('explore.pin_announcement') || 'Fijar anuncio'}</ThemedText>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, { backgroundColor: editForm.pinned ? colors.primary : colors.border }]}
                  onPress={() => setEditForm(f => ({ ...f, pinned: !f.pinned }))}
                >
                  <View style={[styles.toggleKnob, { transform: [{ translateX: editForm.pinned ? 18 : 2 }] }]} />
                </TouchableOpacity>
              </View>
              {editForm.pinned && (
                <View style={[styles.pinDurationRow, { borderTopColor: colors.border }]}>
                  {(['1d', '3d', '1w', '1m', 'permanent'] as PinDuration[]).map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[styles.durationChip, {
                        borderColor: editForm.pinnedUntil === opt ? colors.primary : colors.border,
                        backgroundColor: editForm.pinnedUntil === opt ? colors.primary + '15' : 'transparent',
                      }]}
                      onPress={() => setEditForm(f => ({ ...f, pinnedUntil: opt }))}
                    >
                      <ThemedText style={[styles.durationChipText, { color: editForm.pinnedUntil === opt ? colors.primary : colors.textSecondary }]}>
                        {t(`explore.pin_durations.${opt}`) || (opt === '1d' ? '1 día' : opt === '3d' ? '3 días' : opt === '1w' ? '1 sem' : opt === '1m' ? '1 mes' : 'Siempre')}
                      </ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showCreateEvent} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreateEvent(false)}>
        <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top']}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => setShowCreateEvent(false)}><X size={22} color={colors.text} strokeWidth={2} /></TouchableOpacity>
            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('explore.link_event_title') || 'Vincular evento'}</ThemedText>
            <TouchableOpacity onPress={handleCreateEvent} disabled={!eventForm.title.trim() || savingEvent}>
              {savingEvent
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <ThemedText style={[styles.modalAction, { color: eventForm.title.trim() ? colors.primary : colors.textSecondary }]}>{t('common.create') || 'Crear'}</ThemedText>
              }
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <TextInput
              style={[styles.modalTitleInput, { color: colors.text, borderBottomColor: colors.border }]}
              placeholder={t('explore.event_name') || 'Nombre del evento'}
              placeholderTextColor={colors.textSecondary}
              value={eventForm.title}
              onChangeText={t => setEventForm(f => ({ ...f, title: t }))}
            />

            <View style={styles.dateTimeRow}>
              <View style={{ flex: 1 }}>
                <MiniDatePicker value={eventDate} onChange={setEventDate} label={t('common.date') || 'Fecha'} />
              </View>
              <TimePicker value={eventTime} onChange={setEventTime} label={t('common.time') || 'Hora'} />
            </View>

            <ThemedText style={[styles.formLabel, { color: colors.textSecondary }]}>Tipo</ThemedText>
            <View style={styles.typeGrid}>
              {EVENT_TYPES.map(type => {
                const cfg = EVENT_TYPE_CONFIG[type];
                const active = eventForm.type === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.typeChip, { backgroundColor: active ? cfg.color : colors.backgroundSecondary, borderColor: active ? cfg.color : colors.border }]}
                    onPress={() => setEventForm(f => ({ ...f, type }))}
                  >
                    <ThemedText style={[styles.typeChipText, { color: active ? '#fff' : colors.text }]}>{(t(cfg.labelKey) || type).toUpperCase()}</ThemedText>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { fontSize: typography.sizes.md },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  iconBtn: { padding: spacing.xs },
  headerImage: { width: '100%', height: 220, overflow: 'hidden' },
  categoryBar: { height: 5 },
  body: { padding: spacing.md, gap: spacing.md },
  scrollContent: { paddingBottom: 40 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
  title: { fontSize: 24, fontWeight: '800', lineHeight: 32 },
  metaStrip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  metaStripText: { fontSize: typography.sizes.xs, fontWeight: '500' },
  contentBox: { borderRadius: 12, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth },
  content: { fontSize: typography.sizes.md, lineHeight: 26 },
  eventCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 12, borderWidth: 1, padding: spacing.md },
  eventTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  eventTypeBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  eventCardBody: { flex: 1 },
  eventTitle: { fontSize: typography.sizes.sm, fontWeight: '700' },
  eventDate: { fontSize: typography.sizes.xs, marginTop: 2 },
  linkEventBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', paddingVertical: spacing.sm + 4 },
  linkEventBtnText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  docsCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  docsIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  docsLabel: { fontSize: typography.sizes.sm, fontWeight: '700' },
  docsSub: { fontSize: typography.sizes.xs, marginTop: 2 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm + 2, borderRadius: 10 },
  shareBtnText: { color: '#fff', fontWeight: '600', fontSize: typography.sizes.sm },
  sharedBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 10, borderWidth: 1 },
  sharedBadgeText: { fontSize: typography.sizes.xs, fontWeight: '600' },
  modalSafe: { flex: 1 },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  modalTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  modalAction: { fontSize: typography.sizes.md, fontWeight: '600' },
  modalBody: { padding: spacing.md, gap: spacing.md },
  modalTitleInput: { fontWeight: '700', fontSize: typography.sizes.lg, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  modalContentInput: { minHeight: 120, lineHeight: 22, fontSize: typography.sizes.md },
  categoryRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: 2 },
  catChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  catChipText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  formRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  formRowLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  formRowLabel: { fontSize: typography.sizes.sm, fontWeight: '500' },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: 'center' },
  toggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  pinDurationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
  durationChip: { alignItems: 'center', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, borderRadius: 8, borderWidth: 1 },
  durationChipText: { fontSize: typography.sizes.xs, fontWeight: '600' },
  formLabel: { fontSize: typography.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  imagePicker: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, height: 140, alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  imagePickerLabel: { fontSize: typography.sizes.sm },
  imageRemoveBtn: { position: 'absolute', top: 8, right: 8, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, padding: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  typeChipText: { fontSize: typography.sizes.sm, fontWeight: '600' },
});
