import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, BookOpen, Clock, PartyPopper, GraduationCap, AlertCircle, Megaphone, Users, Calendar, Check } from 'lucide-react-native';
import { EmptyState } from '../EmptyState';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentUser } from '../../contexts/UserContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useCalendarEvents } from '../../hooks/explore/useCalendarEvents';
import { ThemedText } from '../themed-text';
import { MiniDatePicker } from '../MiniDatePicker';
import { TimePicker } from '../TimePicker';
import { spacing, typography } from '../../constants/styles';
import { auth } from '../../config/firebase';
import { Timestamp } from 'firebase/firestore';
import { router } from 'expo-router';
import type { CalendarEventType, CalendarEvent } from '../../types';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const DEPT_SECTIONS: Array<{ titleKey: string; items: string[] }> = [
  { titleKey: 'explore.groups.categories.departments', items: ['hospitality', 'health', 'it_comms', 'sports', 'admin_mgmt', 'social_services', 'energy_water', 'wood_furniture', 'security_env', 'languages', 'fol', 'counseling', 'innovation'] },
  { titleKey: 'explore.groups.categories.cfgm', items: ['admin_mgmt_cycle', 'cooking', 'restaurant_services', 'smr', 'tcae', 'pharmacy'] },
  { titleKey: 'explore.groups.categories.cfgs', items: ['fitness', 'tseas', 'finance_insurance', 'management_assistance', 'energy_efficiency', 'water_management', 'kitchen_management', 'restaurant_management', 'hotel_management', 'tourist_guide', 'asir', 'dam', 'daw', 'dietetics', 'hygiene', 'emergencies'] },
];

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { labelKey: string; color: string }> = {
  exam: { labelKey: 'explore.calendar.event_types.exam', color: '#FF3B30' },
  deadline: { labelKey: 'explore.calendar.event_types.deadline', color: '#FF9500' },
  holiday: { labelKey: 'explore.calendar.event_types.holiday', color: '#34C759' },
  event: { labelKey: 'explore.calendar.event_types.event', color: '#007AFF' },
  class: { labelKey: 'explore.calendar.event_types.class', color: '#AF52DE' },
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

function EventTypeIcon({ type, size = 14, color: customColor }: { type: CalendarEventType; size?: number; color?: string }) {
  const color = customColor || EVENT_TYPE_CONFIG[type].color;
  if (type === 'exam') return <BookOpen size={size} color={color} strokeWidth={2} />;
  if (type === 'deadline') return <Clock size={size} color={color} strokeWidth={2} />;
  if (type === 'holiday') return <PartyPopper size={size} color={color} strokeWidth={2} />;
  if (type === 'class') return <GraduationCap size={size} color={color} strokeWidth={2} />;
  return <AlertCircle size={size} color={color} strokeWidth={2} />;
}

interface CalendarTabProps {
  eventTypes: CalendarEventType[];
  highlightDay?: string | null;
  highlightEventId?: string | null;
}

export function CalendarTab({ eventTypes, highlightDay, highlightEventId }: CalendarTabProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;
  const { userData, subrole } = useCurrentUser();

  const MONTH_NAMES = (t('explore.calendar.months', { returnObjects: true }) as unknown) as string[] || ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const DAY_NAMES = (t('explore.calendar.days_short', { returnObjects: true }) as unknown) as string[] || ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const [today, setToday] = useState(new Date());

  const { allEvents, saveEvent, deleteEvent, publishEventToChannel } = useCalendarEvents();

  const userDepartment = userData?.department ? userData.department.toLowerCase() : null;

  // Cycle → family map (same as useEvents)
  const CYCLE_TO_FAMILY: Record<string, string> = {
    smr: 'it_comms', asir: 'it_comms', dam: 'it_comms', daw: 'it_comms',
    cooking: 'hospitality', restaurant_services: 'hospitality', kitchen_management: 'hospitality',
    restaurant_management: 'hospitality', hotel_management: 'hospitality', tourist_guide: 'hospitality',
    tcae: 'health', pharmacy: 'health', dietetics: 'health', hygiene: 'health', emergencies: 'health',
    fitness: 'sports', tseas: 'energy_water', energy_efficiency: 'energy_water', water_management: 'energy_water',
    admin_mgmt_cycle: 'admin_mgmt', finance_insurance: 'admin_mgmt', management_assistance: 'admin_mgmt',
  };
  const FAMILY_TO_CYCLES: Record<string, string[]> = {
    it_comms: ['smr', 'asir', 'dam', 'daw'],
    hospitality: ['cooking', 'restaurant_services', 'kitchen_management', 'restaurant_management', 'hotel_management', 'tourist_guide'],
    health: ['tcae', 'pharmacy', 'dietetics', 'hygiene', 'emergencies'],
    sports: ['fitness', 'tseas'], admin_mgmt: ['admin_mgmt_cycle', 'finance_insurance', 'management_assistance'],
    energy_water: ['energy_efficiency', 'water_management', 'tseas'],
  };

  const visibleEvents = useMemo(() => {
    return allEvents.filter(ev => {
      const evDept = ev.departmentId ? ev.departmentId.toLowerCase() : null;
      if (!evDept) return true;
      if (!userDepartment) return true;
      if (evDept === userDepartment) return true;
      if (CYCLE_TO_FAMILY[userDepartment] === evDept) return true;
      if (FAMILY_TO_CYCLES[userDepartment]?.includes(evDept)) return true;
      return false;
    });
  }, [allEvents, userDepartment]);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ghostDay, setGhostDay] = useState<number | null>(null);
  const ghostAnim = useRef(new Animated.Value(0)).current;
  const [showCreate, setShowCreate] = useState(false);
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState<Date>(today);
  const [formTime, setFormTime] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: (eventTypes[0] ?? 'event') as CalendarEventType,
    allDay: true,
    departmentId: null as string | null,
  });

  useEffect(() => {
    if (!highlightEventId || allEvents.length === 0) return;
    const ev = allEvents.find(e => e.id === highlightEventId);
    if (!ev) return;
    const d = new Date(ev.date);
    if (isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(String(d.getDate()));
    setGhostDay(d.getDate());
    ghostAnim.setValue(0);
    Animated.sequence([
      Animated.timing(ghostAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(ghostAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setGhostDay(null));
  }, [highlightEventId, allEvents]);

  useEffect(() => {
    if (!highlightDay) return;
    const d = new Date(highlightDay);
    if (isNaN(d.getTime())) return;
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setSelectedDate(String(d.getDate()));
    setGhostDay(d.getDate());
    ghostAnim.setValue(0);
    Animated.sequence([
      Animated.timing(ghostAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.delay(2000),
      Animated.timing(ghostAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start(() => setGhostDay(null));
  }, [highlightDay]);

  const monthEvents = useMemo(() => {
    return visibleEvents.filter(e => {
      const d = new Date(e.date);
      return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
    });
  }, [visibleEvents, viewYear, viewMonth]);

  const eventDays = useMemo(() => {
    return new Set(monthEvents.map(e => new Date(e.date).getDate()));
  }, [monthEvents]);

  const selectedEvents = useMemo(() => {
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (selectedDate) {
      return monthEvents.filter(e => new Date(e.date).getDate() === parseInt(selectedDate));
    }
    return visibleEvents.filter(e => {
      const d = new Date(e.date);
      const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      return eventDay >= todayStart;
    }).slice(0, 10);
  }, [selectedDate, monthEvents, visibleEvents, today.toDateString()]);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calCells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
    setSelectedDate(null);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    await saveEvent({
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: Timestamp.fromDate(formDate),
      allDay: !formTime,
      time: formTime || null,
      category: form.type,
      departmentId: form.departmentId,
    }, editingEventId);

    setForm({ title: '', description: '', type: (eventTypes[0] ?? 'event'), allDay: true, departmentId: subrole === 'delegate' ? userDepartment : null });
    setFormDate(today);
    setFormTime('');
    setEditingEventId(null);
    setShowCreate(false);
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setForm({ title: ev.title, description: ev.description, type: ev.type, allDay: ev.allDay, departmentId: ev.departmentId ?? null });
    setFormDate(new Date(ev.date));
    setFormTime(ev.time ?? '');
    setEditingEventId(ev.id);
    setShowCreate(true);
  };

  const openCreate = () => {
    const base = selectedDate
      ? new Date(viewYear, viewMonth, parseInt(selectedDate))
      : today;
    setFormDate(base);
    setFormTime('');
    setForm({ title: '', description: '', type: (eventTypes[0] ?? 'event'), allDay: true, departmentId: subrole === 'delegate' ? userDepartment : null });
    setEditingEventId(null);
    setShowCreate(true);
  };

  const canCreateEvent = eventTypes.length > 0;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.calContainer, { paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.calHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity onPress={prevMonth} style={styles.calNavBtn}>
            <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <ThemedText style={[styles.calMonthTitle, { color: colors.text }]}>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </ThemedText>
          <TouchableOpacity onPress={nextMonth} style={styles.calNavBtn}>
            <ChevronRight size={20} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <View style={[styles.calGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {DAY_NAMES.map((d, i) => (
            <ThemedText key={i} style={[styles.calDayName, { color: colors.textSecondary }]}>{d}</ThemedText>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <View key={`e_${i}`} style={styles.calCell} />;
            const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
            const isSelected = selectedDate === String(day);
            const isGhost = ghostDay === day;
            const hasEvent = eventDays.has(day);
            return (
              <TouchableOpacity
                key={`d_${i}`}
                style={[
                  styles.calCell,
                  isSelected && { backgroundColor: colors.primary },
                  isToday && !isSelected && { backgroundColor: colors.primary + '20' },
                ]}
                onPress={() => setSelectedDate(isSelected ? null : String(day))}
                activeOpacity={0.7}
              >
                {isGhost && (
                  <Animated.View style={[
                    StyleSheet.absoluteFill,
                    { borderRadius: 8, backgroundColor: colors.primary + '40', opacity: ghostAnim },
                  ]} />
                )}
                <ThemedText style={[styles.calDayNum, { color: isSelected ? '#fff' : isToday ? colors.primary : colors.text }]}>
                  {day}
                </ThemedText>
                {hasEvent && <View style={[styles.calDot, { backgroundColor: isSelected ? '#fff' : colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </View>

        {canCreateEvent && (
          <TouchableOpacity style={[styles.createBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
            <Plus size={18} color="#fff" strokeWidth={2.5} />
            <ThemedText style={styles.createBtnText}>
              {subrole === 'delegate' && userDepartment ? `${t('explore.calendar.event_for') || 'Event For'} ${userDepartment}` : (t('explore.calendar.add_event') || 'Add Event')}
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedText style={[styles.calSectionTitle, { color: colors.textSecondary }]}>
          {selectedDate ? `${t('explore.calendar.day_events') || 'Day Events'} ${selectedDate}` : (t('explore.calendar.upcoming_events') || 'Upcoming Events')}
        </ThemedText>

        {selectedEvents.length === 0 ? (
          <EmptyState icon={Calendar} title={t('explore.calendar.no_events') || 'No Events'} />
        ) : (
          selectedEvents.map((ev: CalendarEvent) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type];
            const isAuthor = currentUser?.uid === ev.authorId;
            const isAdminOrCoord = userData?.role === 'admin' || userData?.subrole === 'coordinator';
            const canManage = isAuthor || isAdminOrCoord;

            return (
              <TouchableOpacity
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: cfg.color }]}
                onPress={canManage ? () => handleEditEvent(ev) : undefined}
                activeOpacity={0.7}
              >
                <View style={styles.eventCardTop}>
                  <View style={styles.eventCardTopLeft}>
                    <View style={[styles.eventTypeBadge, { backgroundColor: cfg.color + '20' }]}>
                      <EventTypeIcon type={ev.type} />
                      <ThemedText style={[styles.eventTypeBadgeText, { color: cfg.color }]}>{t(cfg.labelKey)}</ThemedText>
                    </View>
                    {ev.departmentId && (
                      <View style={[styles.deptBadge, { backgroundColor: colors.backgroundSecondary }]}>
                        <Users size={10} color={colors.textSecondary} strokeWidth={2} />
                        <ThemedText style={[styles.deptBadgeText, { color: colors.textSecondary }]}>{t(`explore.groups.subjects_list.${ev.departmentId}`) || ev.departmentId}</ThemedText>
                      </View>
                    )}
                    {ev.publishedInChannel && (
                      <View style={[styles.deptBadge, { backgroundColor: '#FF3B3015' }]}>
                        <Megaphone size={10} color="#FF3B30" strokeWidth={2} />
                        <ThemedText style={[styles.deptBadgeText, { color: '#FF3B30' }]}>
                          {t('explore.calendar.notified') || 'Notified'}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.eventCardActions}>
                    {canManage && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {!ev.publishedInChannel && (
                          <TouchableOpacity onPress={() => publishEventToChannel(ev)} style={styles.eventDeleteBtn}>
                            <Megaphone size={16} color={colors.primary} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity onPress={() => deleteEvent(ev.id)} style={styles.eventDeleteBtn}>
                          <Trash2 size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    )}
                    <View style={styles.eventDateBlock}>
                      <ThemedText style={[styles.eventDate, { color: colors.textSecondary }]}>
                        {(() => {
                          const tag = t('common.locale_code');
                          // Evitar RangeError si i18n devuelve el nombre de la clave
                          const safeTag = (tag && tag.includes('-')) ? tag : 'es-ES';
                          return new Date(ev.date).toLocaleDateString(safeTag, { day: 'numeric', month: 'short' });
                        })()}
                      </ThemedText>
                      {ev.time && (
                        <ThemedText style={[styles.eventTime, { color: colors.textSecondary }]}>{ev.time}</ThemedText>
                      )}
                    </View>
                  </View>
                </View>
                <ThemedText style={[styles.eventTitle, { color: colors.text }]}>{ev.title}</ThemedText>
                {!!ev.description && (
                  <ThemedText style={[styles.eventDesc, { color: colors.textSecondary }]} numberOfLines={2}>{ev.description}</ThemedText>
                )}
                {ev.linkedAnnouncementId && (
                  <TouchableOpacity
                    style={[styles.announcementLink, { borderTopColor: colors.border }]}
                    onPress={() => router.push(`/announcement/${ev.linkedAnnouncementId}` as never)}
                  >
                    <Megaphone size={12} color={colors.primary} strokeWidth={2} />
                    <ThemedText style={[styles.announcementLinkText, { color: colors.primary }]}>{t('explore.calendar.related_announcement') || 'Related Announcement'}</ThemedText>
                    <ChevronRight size={12} color={colors.primary} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      <Modal visible={showCreate} animationType="fade" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalContent}>
            <View style={[styles.premiumSheet, { backgroundColor: colors.card }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => { setShowCreate(false); setEditingEventId(null); }} style={styles.modalHeaderClose}>
                  <X size={20} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
                <ThemedText style={[styles.modalTitle, { color: colors.text }]}>
                  {editingEventId ? (t('explore.calendar.edit_event') || 'Edit Event') : (t('explore.calendar.new_event') || 'New Event')}
                </ThemedText>
                <TouchableOpacity onPress={handleSave} disabled={!form.title.trim()} style={[styles.modalHeaderAction, !form.title.trim() && { opacity: 0.5 }]}>
                  <ThemedText style={[styles.modalActionText, { color: colors.primary }]}>
                    {editingEventId ? (t('common.save') || 'Save') : (t('common.create') || 'Create')}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.formSection}>
                  <View style={[styles.inputGroup, { backgroundColor: colors.backgroundSecondary, borderRadius: 16, padding: spacing.sm }]}>
                    <TextInput
                      style={[styles.premiumTitleInput, { color: colors.text }]}
                      placeholder={t('explore.calendar.placeholders.title') || 'Title'}
                      placeholderTextColor={colors.textSecondary}
                      value={form.title}
                      onChangeText={t => setForm(f => ({ ...f, title: t }))}
                      autoFocus
                    />
                    <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                    <TextInput
                      style={[styles.premiumDescInput, { color: colors.text }]}
                      placeholder={t('explore.calendar.placeholders.desc') || 'Desc'}
                      placeholderTextColor={colors.textSecondary}
                      value={form.description}
                      onChangeText={t => setForm(f => ({ ...f, description: t }))}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={[styles.premiumLabel, { color: colors.textSecondary }]}>{t('explore.calendar.date_time') || 'Date Time'}</ThemedText>
                  <View style={styles.dateTimeRow}>
                    <View style={{ flex: 1 }}>
                      <MiniDatePicker value={formDate} onChange={setFormDate} label={t('explore.calendar.date') || 'Date'} />
                    </View>
                    <TimePicker value={formTime} onChange={setFormTime} label={t('explore.calendar.time') || 'Time'} />
                  </View>

                  <View>
                    <ThemedText style={[styles.premiumLabel, { color: colors.textSecondary, marginBottom: spacing.xs }]}>
                      {t('explore.calendar.department_visibility') || 'Department Visibility'}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.deptSelector, { backgroundColor: colors.backgroundSecondary, borderColor: form.departmentId ? colors.primary : colors.border }]}
                      onPress={() => subrole !== 'delegate' && setShowDeptModal(true)}
                      activeOpacity={subrole === 'delegate' ? 1 : 0.7}
                    >
                      <Users size={14} color={form.departmentId ? colors.primary : colors.textSecondary} strokeWidth={2} />
                      <ThemedText style={[styles.deptSelectorText, { color: form.departmentId ? colors.primary : colors.textSecondary, flex: 1 }]}>
                        {form.departmentId
                          ? (t(`explore.groups.subjects_list.${form.departmentId}`) || form.departmentId)
                          : (t('common.all') || 'All')}
                      </ThemedText>
                      {subrole !== 'delegate' && (
                        <ChevronRight size={14} color={colors.textSecondary} strokeWidth={2} />
                      )}
                    </TouchableOpacity>
                    {subrole === 'delegate' && (
                      <ThemedText style={[styles.deptHint, { color: colors.textSecondary }]}>
                        {t('explore.calendar.dept_auto_assigned') || 'Dept Auto Assigned'}
                      </ThemedText>
                    )}
                  </View>

                  <View style={styles.typeGrid}>
                    {eventTypes.map(t_id => {
                      const cfg = EVENT_TYPE_CONFIG[t_id];
                      const active = form.type === t_id;
                      return (
                        <TouchableOpacity
                          key={t_id}
                          style={[
                            styles.premiumTypeChip,
                            { backgroundColor: active ? cfg.color : colors.backgroundSecondary, borderColor: active ? cfg.color : colors.border }
                          ]}
                          onPress={() => setForm(f => ({ ...f, type: t_id }))}
                        >
                          <EventTypeIcon type={t_id} size={14} color={active ? '#fff' : cfg.color} />
                          <ThemedText style={[styles.premiumTypeLabel, { color: active ? '#fff' : colors.text }]}>{t(cfg.labelKey)}</ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>

        <Modal
          visible={showDeptModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowDeptModal(false)}
        >
          <View style={styles.deptModalOverlay}>
            <View style={[styles.deptModalSheet, { backgroundColor: colors.card }]}>
              <View style={[styles.deptModalHeader, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.deptModalTitle, { color: colors.text }]}>
                  {t('explore.calendar.department_visibility') || 'Department Visibility'}
                </ThemedText>
                <TouchableOpacity onPress={() => setShowDeptModal(false)} hitSlop={10}>
                  <X size={20} color={colors.textSecondary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
              <ScrollView contentContainerStyle={styles.deptModalContent}>
                <TouchableOpacity
                  style={[styles.deptModalRow, { borderBottomColor: colors.border }]}
                  onPress={() => { setForm(f => ({ ...f, departmentId: null })); setShowDeptModal(false); }}
                  activeOpacity={0.7}
                >
                  <ThemedText style={[styles.deptModalRowText, { color: !form.departmentId ? colors.primary : colors.text, fontWeight: !form.departmentId ? '700' : '500' }]}>
                    {t('common.all') || 'All'}
                  </ThemedText>
                  {!form.departmentId && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
                {DEPT_SECTIONS.map(section => (
                  <View key={section.titleKey}>
                    <ThemedText style={[styles.deptSectionLabel, { color: colors.textSecondary }]}>
                      {t(section.titleKey) || section.titleKey}
                    </ThemedText>
                    {section.items.map(dep => {
                      const isActive = form.departmentId === dep;
                      const label = t(`explore.groups.subjects_list.${dep}`) || dep;
                      return (
                        <TouchableOpacity
                          key={dep}
                          style={[styles.deptModalRow, { borderBottomColor: colors.border }]}
                          onPress={() => { setForm(f => ({ ...f, departmentId: dep })); setShowDeptModal(false); }}
                          activeOpacity={0.7}
                        >
                          <ThemedText style={[styles.deptModalRowText, { color: isActive ? colors.primary : colors.text, fontWeight: isActive ? '700' : '500' }]}>
                            {label}
                          </ThemedText>
                          {isActive && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  calContainer: { padding: spacing.md, gap: spacing.md },
  calHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: spacing.md },
  calNavBtn: { padding: 4 },
  calMonthTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  calGrid: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: spacing.sm, flexDirection: 'row', flexWrap: 'wrap' },
  calDayName: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '600', paddingVertical: 4 },
  calCell: { width: `${100 / 7}%`, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
  calDayNum: { fontSize: 13, fontWeight: '500' },
  calDot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, paddingVertical: spacing.sm + 2, borderRadius: 10 },
  createBtnText: { color: '#fff', fontWeight: '600', fontSize: typography.sizes.sm },
  calSectionTitle: { fontSize: typography.sizes.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  eventCard: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 4, padding: spacing.md, gap: 4, marginBottom: spacing.sm },
  eventCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventCardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flex: 1, flexWrap: 'wrap' },
  eventCardActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eventDeleteBtn: { padding: 4 },
  eventDateBlock: { alignItems: 'flex-end' },
  eventDate: { fontSize: typography.sizes.xs },
  eventTime: { fontSize: 10, fontWeight: '600', marginTop: 1 },
  eventTypeBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  eventTypeBadgeText: { fontSize: 11, fontWeight: '600' },
  deptBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  deptBadgeText: { fontSize: 10, fontWeight: '500' },
  eventTitle: { fontSize: typography.sizes.sm, fontWeight: '700' },
  eventDesc: { fontSize: typography.sizes.xs, lineHeight: 16 },
  announcementLink: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: spacing.sm, marginTop: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth },
  announcementLinkText: { flex: 1, fontSize: typography.sizes.xs, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { flex: 1, justifyContent: 'flex-end' },
  premiumSheet: { borderTopLeftRadius: 30, borderTopRightRadius: 30, height: '85%', overflow: 'hidden' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 4, borderBottomWidth: StyleSheet.hairlineWidth },
  modalHeaderClose: { padding: 4 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHeaderAction: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  modalActionText: { fontSize: 16, fontWeight: '700' },
  modalScroll: { flex: 1 },
  formSection: { padding: spacing.lg, paddingBottom: 0, gap: spacing.sm },
  premiumLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6 },
  inputGroup: { overflow: 'hidden' },
  premiumTitleInput: { fontSize: 20, fontWeight: '700', paddingVertical: spacing.sm },
  inputDivider: { height: StyleSheet.hairlineWidth, marginVertical: 4 },
  premiumDescInput: { fontSize: 16, paddingVertical: spacing.sm, minHeight: 80, textAlignVertical: 'top' },
  dateTimeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'stretch' },
  deptInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: 10, borderWidth: 1 },
  deptInfoText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  premiumTypeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  premiumTypeLabel: { fontSize: 13, fontWeight: '600' },
  deptHint: { fontSize: 12, marginTop: 6, opacity: 0.7 },
  deptSelector: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm + 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  deptSelectorText: { fontSize: 14, fontWeight: '600' },
  deptModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  deptModalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  deptModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  deptModalTitle: { fontSize: 16, fontWeight: '700' },
  deptModalContent: { paddingBottom: spacing.xl },
  deptSectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  deptModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  deptModalRowText: { fontSize: 15 },
});
