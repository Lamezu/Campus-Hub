import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, ActivityIndicator, ScrollView, Modal, Image, Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, CalendarDays, BookOpen, Clock,
  PartyPopper, GraduationCap, AlertCircle, Users, Check, X, Info, Camera, CalendarFold,
} from 'lucide-react-native';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import * as ImagePicker from 'expo-image-picker';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/EmptyState';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUser } from '@/contexts/UserContext';
import { useEvents } from '@/hooks/useEvents';
import { notificationService } from '@/services/notificationService';
import { markChannelRead } from '@/services/channelReadService';
import type { CalendarEvent, CalendarEventType } from '@/types';

import { TextInput } from 'react-native';

function EventsInfoModal({ onClose, colors, t, isAdmin }: {
  onClose: () => void;
  colors: any;
  t: (k: string) => string;
  isAdmin: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [photoURL, setPhotoURL] = useState<string | null>(null);
  const [name, setName] = useState('Events & Activities');
  const [description, setDescription] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'channels', '3'), snap => {
      if (snap.exists()) {
        const data = snap.data();
        setPhotoURL(data.photoURL ?? null);
        setName(data.name ?? 'Events & Activities');
        const desc = data.description ?? '';
        setDescription(desc);
        setEditDesc(desc);
      }
    });
    return unsub;
  }, []);

  const handleSaveDescription = async () => {
    if (editDesc === description) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'channels', '3'), { description: editDesc });
      setDescription(editDesc);
    } catch {
      Alert.alert('Error', 'Could not save the description.');
      setEditDesc(description);
    } finally {
      setSaving(false);
    }
  };

  const handlePickPhoto = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setUploading(true);
    try {
      const url = await uploadChannelPhoto(result.assets[0].uri, '3');
      await updateDoc(doc(db, 'channels', '3'), { photoURL: url });
      setPhotoURL(url);
    } catch {
      Alert.alert('Error', 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[infoModalStyles.screen, { backgroundColor: colors.background }]}>
        <View style={[infoModalStyles.header, { borderBottomColor: colors.border, paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <X size={22} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <ThemedText style={[infoModalStyles.headerTitle, { color: colors.text }]}>
            {t('events.channel_info') || 'Channel info'}
          </ThemedText>
          <View style={{ width: 22 }} />
        </View>

        <ScrollView contentContainerStyle={infoModalStyles.content}>
          <View style={infoModalStyles.photoWrap}>
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={infoModalStyles.photo} />
            ) : (
              <View style={[infoModalStyles.photoPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                <CalendarFold size={48} color={colors.primary} strokeWidth={1.5} />
              </View>
            )}
            {isAdmin && (
              <TouchableOpacity
                style={[infoModalStyles.cameraBtn, { backgroundColor: colors.primary }]}
                onPress={handlePickPhoto}
                disabled={uploading}
                activeOpacity={0.8}
              >
                {uploading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Camera size={18} color="#fff" strokeWidth={2} />}
              </TouchableOpacity>
            )}
          </View>

          <ThemedText style={[infoModalStyles.channelName, { color: colors.text }]}>{name}</ThemedText>

          <View style={[infoModalStyles.descCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ThemedText style={[infoModalStyles.descLabel, { color: colors.textSecondary }]}>
              {t('support.channel_description') || 'Description'}
            </ThemedText>
            {isAdmin ? (
              <>
                <TextInput
                  style={[infoModalStyles.descInput, { color: colors.text, borderColor: colors.border }]}
                  value={editDesc}
                  onChangeText={setEditDesc}
                  multiline
                  placeholder={t('events.description_placeholder') || 'Add a channel description...'}
                  placeholderTextColor={colors.textSecondary}
                  onBlur={handleSaveDescription}
                />
                {editDesc !== description && (
                  <TouchableOpacity
                    style={[infoModalStyles.saveBtn, { backgroundColor: colors.primary }]}
                    onPress={handleSaveDescription}
                    disabled={saving}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={infoModalStyles.saveBtnText}>
                      {saving ? (t('common.loading') || 'Loading...') : (t('common.update') || 'Update')}
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <ThemedText style={[infoModalStyles.descText, { color: colors.text }]}>
                {description || (t('events.channel_info_hint') || 'Events, exams and activities channel.')}
              </ThemedText>
            )}
          </View>

          <View style={[infoModalStyles.infoRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <CalendarDays size={16} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[infoModalStyles.infoText, { color: colors.textSecondary }]}>
              {t('events.channel_info_hint') || 'Events, exams and activities channel for the school.'}
            </ThemedText>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const infoModalStyles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  content: { alignItems: 'center', padding: 24, gap: 16 },
  photoWrap: { position: 'relative', marginBottom: 4 },
  photo: { width: 100, height: 100, borderRadius: 50 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  cameraBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  channelName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
  descCard: { width: '100%', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, gap: 4 },
  descLabel: { fontSize: 12, fontWeight: '600' },
  descText: { fontSize: 14, lineHeight: 20 },
  descInput: { fontSize: 14, lineHeight: 20, borderWidth: 1, borderRadius: 8, padding: 8, minHeight: 70, textAlignVertical: 'top' },
  saveBtn: { borderRadius: 10, paddingVertical: 8, alignItems: 'center', marginTop: 6 },
  saveBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  infoRow: { width: '100%', borderRadius: 12, padding: 14, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  infoText: { fontSize: 13, lineHeight: 20, flex: 1 },
});

const EVENT_CONFIG: Record<CalendarEventType, { color: string; labelKey: string }> = {
  exam: { color: '#FF3B30', labelKey: 'explore.calendar.event_types.exam' },
  deadline: { color: '#FF9500', labelKey: 'explore.calendar.event_types.deadline' },
  holiday: { color: '#34C759', labelKey: 'explore.calendar.event_types.holiday' },
  event: { color: '#007AFF', labelKey: 'explore.calendar.event_types.event' },
  class: { color: '#AF52DE', labelKey: 'explore.calendar.event_types.class' },
};

function EventIcon({ type, size = 16, color }: { type: CalendarEventType; size?: number; color: string }) {
  if (type === 'exam') return <BookOpen size={size} color={color} strokeWidth={2} />;
  if (type === 'deadline') return <Clock size={size} color={color} strokeWidth={2} />;
  if (type === 'holiday') return <PartyPopper size={size} color={color} strokeWidth={2} />;
  if (type === 'class') return <GraduationCap size={size} color={color} strokeWidth={2} />;
  return <AlertCircle size={size} color={color} strokeWidth={2} />;
}

function formatEventDate(isoDate: string, time: string | null | undefined, allDay: boolean, locale = 'en-US'): string {
  const d = new Date(isoDate);
  const dateStr = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const capitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  if (allDay || !time) return capitalized;
  return `${capitalized} · ${time}`;
}

export default function EventsScreen() {
  const { colors, theme } = useTheme();
  const { t, language } = useTranslation();
  const locale = language === 'es' ? 'es-ES' : 'en-US';
  const { userData } = useCurrentUser();
  const [activeFilter, setActiveFilter] = useState<CalendarEventType | 'all'>('all');

  const { events, rsvpMap, rsvp, loading } = useEvents(userData?.department ? userData.department.toLowerCase() : null);
  const [showInfo, setShowInfo] = useState(false);

  const { firebaseUser, isAdmin } = useCurrentUser();

  useFocusEffect(useCallback(() => {
    notificationService.markAllRead('campus');
    notificationService.markChatRead('channel', '3');
    if (firebaseUser?.uid) {
      markChannelRead('3', firebaseUser.uid).catch(() => {});
    }
  }, [firebaseUser?.uid]));

  const FILTERS: Array<{ id: CalendarEventType | 'all'; labelKey: string }> = [
    { id: 'all', labelKey: 'common.all' },
    { id: 'event', labelKey: 'explore.calendar.event_types.event' },
    { id: 'exam', labelKey: 'explore.calendar.event_types.exam' },
    { id: 'deadline', labelKey: 'explore.calendar.event_types.deadline' },
    { id: 'holiday', labelKey: 'explore.calendar.event_types.holiday' },
    { id: 'class', labelKey: 'explore.calendar.event_types.class' },
  ];

  const filtered = useMemo(() =>
    activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter),
    [events, activeFilter]
  );

  const renderEvent = ({ item }: { item: CalendarEvent & { attendeesCount?: number } }) => {
    const cfg = EVENT_CONFIG[item.type];
    const myRsvp = rsvpMap[item.id] ?? null;
    const isPast = new Date(item.date) < new Date();

    return (
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.cardAccent, { backgroundColor: cfg.color }]} />

        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <View style={[styles.typeBadge, { backgroundColor: cfg.color + '22' }]}>
              <EventIcon type={item.type} size={13} color={cfg.color} />
              <ThemedText style={[styles.typeBadgeText, { color: cfg.color }]}>
                {t(cfg.labelKey) || item.type}
              </ThemedText>
            </View>
            {item.departmentId && (
              <View style={[styles.deptBadge, { backgroundColor: colors.backgroundSecondary }]}>
                <Users size={11} color={colors.textSecondary} strokeWidth={2} />
                <ThemedText style={[styles.deptBadgeText, { color: colors.textSecondary }]}>
                  {t('events.department_only') || 'Department Only'}
                </ThemedText>
              </View>
            )}
          </View>

          <ThemedText style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
            {item.title}
          </ThemedText>

          <ThemedText style={[styles.cardDate, { color: colors.textSecondary }]}>
            {formatEventDate(item.date, item.time, item.allDay, locale)}
          </ThemedText>

          {!!item.description && (
            <ThemedText style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
              {item.description}
            </ThemedText>
          )}

          {(() => {
            const count = (item as any).attendeesCount ?? 0;
            const iGo = myRsvp === 'going';
            const countLabel = count === 0
              ? (t('events.confirmed_zero') || '0 confirmed')
              : count === 1
                ? (t('events.confirmed_one') || '1 confirmed')
                : (t('events.confirmed_other') || `${count} confirmed`).replace('{{count}}', String(count));
            return (
              <View style={styles.rsvpSection}>
                <View style={styles.rsvpButtons}>
                  {!isPast && (
                    <>
                      <TouchableOpacity
                        style={[styles.rsvpBtn, { borderColor: '#34C759' }, iGo && { backgroundColor: '#34C759' }]}
                        onPress={() => rsvp(item.id, 'going')}
                        activeOpacity={0.7}
                      >
                        <Check size={14} color={iGo ? '#fff' : '#34C759'} strokeWidth={2.5} />
                        <ThemedText style={[styles.rsvpBtnText, { color: iGo ? '#fff' : '#34C759' }]}>
                          {t('events.rsvp_going') || 'Going'}
                        </ThemedText>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.rsvpBtn, { borderColor: '#FF3B30' }, myRsvp === 'not_going' && { backgroundColor: '#FF3B30' }]}
                        onPress={() => rsvp(item.id, 'not_going')}
                        activeOpacity={0.7}
                      >
                        <X size={14} color={myRsvp === 'not_going' ? '#fff' : '#FF3B30'} strokeWidth={2.5} />
                        <ThemedText style={[styles.rsvpBtnText, { color: myRsvp === 'not_going' ? '#fff' : '#FF3B30' }]}>
                          {t('events.rsvp_not_going') || 'Not going'}
                        </ThemedText>
                      </TouchableOpacity>
                    </>
                  )}
                  <View style={[styles.attendeesBadge, {
                    backgroundColor: iGo ? '#34C75918' : colors.backgroundSecondary,
                    borderColor: iGo ? '#34C75950' : colors.border,
                  }]}>
                    <Users size={12} color={iGo ? '#34C759' : colors.textSecondary} strokeWidth={2} />
                    <ThemedText style={[styles.attendeesBadgeText, { color: iGo ? '#34C759' : colors.textSecondary }]}>
                      {countLabel}
                    </ThemedText>
                  </View>
                </View>
              </View>
            );
          })()}

          <View style={styles.cardFooter}>
            <TouchableOpacity
              style={styles.calendarLink}
              onPress={() => router.push({
                pathname: '/(tabs)/explore',
                params: { tab: 'calendar', highlightDay: item.date.slice(0, 10) },
              } as never)}
              activeOpacity={0.7}
            >
              <CalendarDays size={14} color={colors.primary} strokeWidth={2} />
              <ThemedText style={[styles.calendarLinkText, { color: colors.primary }]}>
                {t('events.view_in_calendar') || 'View in calendar'}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {t('events.title') || 'Title'}
        </ThemedText>
        <TouchableOpacity onPress={() => setShowInfo(true)} style={styles.headerRight} activeOpacity={0.7}>
          <Info size={22} color={colors.text} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      <View style={[styles.filterBar, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBarContent}
        >
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={[
                styles.filterPill,
                { borderColor: activeFilter === f.id ? colors.primary : colors.border },
                activeFilter === f.id && { backgroundColor: colors.primary },
              ]}
              onPress={() => setActiveFilter(f.id)}
              activeOpacity={0.7}
            >
              <ThemedText style={[
                styles.filterPillText,
                { color: activeFilter === f.id ? '#fff' : colors.textSecondary },
              ]}>
                {t(f.labelKey) || f.id}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderEvent}
          contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.listEmpty]}
          ListEmptyComponent={
            <EmptyState
              icon={CalendarDays}
              title={t('events.empty_title') || 'Empty Title'}
              body={t('events.empty_body') || 'Empty Body'}
            />
          }
        />
      )}

      {showInfo && (
        <EventsInfoModal
          onClose={() => setShowInfo(false)}
          colors={colors}
          t={t}
          isAdmin={isAdmin}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, width: 36 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: typography.sizes.md, lineHeight: 22, fontWeight: '700' },
  headerRight: { width: 36, alignItems: 'flex-end', justifyContent: 'center' },
  filterBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  filterBarContent: { paddingHorizontal: spacing.md, paddingVertical: 10, gap: spacing.xs + 2, alignItems: 'center' },
  filterPill: {
    paddingHorizontal: spacing.md, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1,
  },
  filterPillText: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.md },
  listEmpty: { flexGrow: 1 },
  card: {
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden', flexDirection: 'row',
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: spacing.md, gap: spacing.xs },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  typeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  typeBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
  deptBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  deptBadgeText: { fontSize: 11, lineHeight: 14, fontWeight: '500' },
  cardTitle: { fontSize: typography.sizes.md, lineHeight: 22, fontWeight: '700', marginTop: 2 },
  cardDate: { fontSize: typography.sizes.xs, lineHeight: 16 },
  cardDesc: { fontSize: typography.sizes.sm, lineHeight: 20, marginTop: 2 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs, flexWrap: 'wrap', gap: spacing.xs },
  calendarLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  calendarLinkText: { fontSize: typography.sizes.xs, lineHeight: 16, fontWeight: '500' },
  rsvpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rsvpSection: { marginTop: spacing.xs },
  rsvpButtons: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs },
  attendeesText: { fontSize: typography.sizes.xs, lineHeight: 16 },
  attendeesBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1,
  },
  attendeesBadgeText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  rsvpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5,
  },
  rsvpBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
