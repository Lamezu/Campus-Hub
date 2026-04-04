import React, { useState, useMemo } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity,
  StatusBar, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, CalendarDays, BookOpen, Clock,
  PartyPopper, GraduationCap, AlertCircle, Users, Check, X,
} from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/EmptyState';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useCurrentUser } from '@/contexts/UserContext';
import { useEvents } from '@/hooks/useEvents';
import type { CalendarEvent, CalendarEventType } from '@/types';

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

function formatEventDate(isoDate: string, time: string | null | undefined, allDay: boolean, t: any): string {
  const d = new Date(isoDate);
  const dateStr = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  if (allDay || !time) return dateStr;
  return `${dateStr} · ${time}`;
}

export default function EventsScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { userData } = useCurrentUser();
  const [activeFilter, setActiveFilter] = useState<CalendarEventType | 'all'>('all');

  const { events, rsvpMap, rsvp, loading } = useEvents(userData?.department ?? null);

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
            {formatEventDate(item.date, item.time, item.allDay, t)}
          </ThemedText>

          {!!item.description && (
            <ThemedText style={[styles.cardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
              {item.description}
            </ThemedText>
          )}

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
                {t('events.view_in_calendar') || 'View In Calendar'}
              </ThemedText>
            </TouchableOpacity>

            {!isPast && (
              <View style={styles.rsvpRow}>
                {(item as any).attendeesCount > 0 && (
                  <ThemedText style={[styles.attendeesText, { color: colors.textSecondary }]}>
                    {(item as any).attendeesCount} {t('events.going') || 'van'}
                  </ThemedText>
                )}
                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    { borderColor: '#34C759' },
                    myRsvp === 'going' && { backgroundColor: '#34C759' },
                  ]}
                  onPress={() => rsvp(item.id, 'going')}
                  activeOpacity={0.7}
                >
                  <Check size={14} color={myRsvp === 'going' ? '#fff' : '#34C759'} strokeWidth={2.5} />
                  <ThemedText style={[styles.rsvpBtnText, { color: myRsvp === 'going' ? '#fff' : '#34C759' }]}>
                    {t('events.rsvp_going') || 'Rsvp Going'}
                  </ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.rsvpBtn,
                    { borderColor: '#FF3B30' },
                    myRsvp === 'not_going' && { backgroundColor: '#FF3B30' },
                  ]}
                  onPress={() => rsvp(item.id, 'not_going')}
                  activeOpacity={0.7}
                >
                  <X size={14} color={myRsvp === 'not_going' ? '#fff' : '#FF3B30'} strokeWidth={2.5} />
                  <ThemedText style={[styles.rsvpBtnText, { color: myRsvp === 'not_going' ? '#fff' : '#FF3B30' }]}>
                    {t('events.rsvp_not_going') || 'Rsvp Not Going'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
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
        <View style={styles.headerRight} />
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
  headerRight: { width: 36 },
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
  attendeesText: { fontSize: typography.sizes.xs, lineHeight: 16 },
  rsvpBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1.5,
  },
  rsvpBtnText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
});
