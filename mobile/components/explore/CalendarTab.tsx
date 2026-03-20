import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, StyleSheet, Animated } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, BookOpen, Clock, PartyPopper, GraduationCap, AlertCircle, Megaphone, Users } from 'lucide-react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { useCurrentUser } from '../../contexts/UserContext';
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

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
  exam: { label: 'Examen', color: '#FF3B30' },
  deadline: { label: 'Entrega', color: '#FF9500' },
  holiday: { label: 'Festivo', color: '#34C759' },
  event: { label: 'Evento', color: '#007AFF' },
  class: { label: 'Clase', color: '#AF52DE' },
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
}

export function CalendarTab({ eventTypes, highlightDay }: CalendarTabProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;
  const { userData, subrole } = useCurrentUser();
  const [today, setToday] = useState(new Date());

  const { allEvents, saveEvent, deleteEvent } = useCalendarEvents();

  const userDepartment = userData?.department ?? null;

  const visibleEvents = useMemo(() => {
    return allEvents.filter(ev => {
      if (!ev.departmentId) return true;
      if (!userDepartment) return true;
      return ev.departmentId === userDepartment;
    });
  }, [allEvents, userDepartment]);

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [ghostDay, setGhostDay] = useState<number | null>(null);
  const ghostAnim = useRef(new Animated.Value(0)).current;
  const [showCreate, setShowCreate] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [formDate, setFormDate] = useState<Date>(today);
  const [formTime, setFormTime] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: (eventTypes[0] ?? 'event') as CalendarEventType,
    allDay: true,
  });

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
      departmentId: subrole === 'delegate' ? userDepartment : null,
    }, editingEventId);

    setForm({ title: '', description: '', type: (eventTypes[0] ?? 'event'), allDay: true });
    setFormDate(today);
    setFormTime('');
    setEditingEventId(null);
    setShowCreate(false);
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setForm({ title: ev.title, description: ev.description, type: ev.type, allDay: ev.allDay });
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
    setForm({ title: '', description: '', type: (eventTypes[0] ?? 'event'), allDay: true });
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
          {DAY_NAMES.map(d => (
            <ThemedText key={d} style={[styles.calDayName, { color: colors.textSecondary }]}>{d}</ThemedText>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <View key={`e_${i}`} style={styles.calCell} />;
            const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
            const isSelected = selectedDate === String(day);
            const isGhost = ghostDay === day;
            const hasEvent = eventDays.has(day);
            return (
              <TouchableOpacity
                key={day}
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
              {subrole === 'delegate' && userDepartment ? `Evento para ${userDepartment}` : 'Añadir evento'}
            </ThemedText>
          </TouchableOpacity>
        )}

        <ThemedText style={[styles.calSectionTitle, { color: colors.textSecondary }]}>
          {selectedDate ? `Eventos del día ${selectedDate}` : 'Próximos eventos'}
        </ThemedText>

        {selectedEvents.length === 0 ? (
          <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>Sin eventos</ThemedText>
        ) : (
          selectedEvents.map((ev: CalendarEvent) => {
            const cfg = EVENT_TYPE_CONFIG[ev.type];
            const isAuthor = currentUser?.uid === ev.authorId;
            return (
              <TouchableOpacity
                key={ev.id}
                style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border, borderLeftColor: cfg.color }]}
                onPress={isAuthor ? () => handleEditEvent(ev) : undefined}
                activeOpacity={0.7}
              >
                <View style={styles.eventCardTop}>
                  <View style={styles.eventCardTopLeft}>
                    <View style={[styles.eventTypeBadge, { backgroundColor: cfg.color + '20' }]}>
                      <EventTypeIcon type={ev.type} />
                      <ThemedText style={[styles.eventTypeBadgeText, { color: cfg.color }]}>{cfg.label}</ThemedText>
                    </View>
                    {ev.departmentId && (
                      <View style={[styles.deptBadge, { backgroundColor: colors.backgroundSecondary }]}>
                        <Users size={10} color={colors.textSecondary} strokeWidth={2} />
                        <ThemedText style={[styles.deptBadgeText, { color: colors.textSecondary }]}>{ev.departmentId}</ThemedText>
                      </View>
                    )}
                  </View>
                  <View style={styles.eventCardActions}>
                    {isAuthor && (
                      <TouchableOpacity onPress={() => deleteEvent(ev.id)} style={styles.eventDeleteBtn}>
                        <Trash2 size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                    <View style={styles.eventDateBlock}>
                      <ThemedText style={[styles.eventDate, { color: colors.textSecondary }]}>
                        {new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
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
                    <ThemedText style={[styles.announcementLinkText, { color: colors.primary }]}>Ver anuncio relacionado</ThemedText>
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
                  {editingEventId ? 'Editar evento' : 'Nuevo evento'}
                </ThemedText>
                <TouchableOpacity onPress={handleSave} disabled={!form.title.trim()} style={[styles.modalHeaderAction, !form.title.trim() && { opacity: 0.5 }]}>
                  <ThemedText style={[styles.modalActionText, { color: colors.primary }]}>
                    {editingEventId ? 'Guardar' : 'Crear'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.formSection}>
                  <View style={[styles.inputGroup, { backgroundColor: colors.backgroundSecondary, borderRadius: 16, padding: spacing.sm }]}>
                    <TextInput
                      style={[styles.premiumTitleInput, { color: colors.text }]}
                      placeholder="Nombre del evento..."
                      placeholderTextColor={colors.textSecondary}
                      value={form.title}
                      onChangeText={t => setForm(f => ({ ...f, title: t }))}
                      autoFocus
                    />
                    <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                    <TextInput
                      style={[styles.premiumDescInput, { color: colors.text }]}
                      placeholder="Notas adicionales (opcional)"
                      placeholderTextColor={colors.textSecondary}
                      value={form.description}
                      onChangeText={t => setForm(f => ({ ...f, description: t }))}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </View>

                <View style={styles.formSection}>
                  <ThemedText style={[styles.premiumLabel, { color: colors.textSecondary }]}>Fecha y hora</ThemedText>
                  <View style={styles.dateTimeRow}>
                    <View style={{ flex: 1 }}>
                      <MiniDatePicker value={formDate} onChange={setFormDate} label="Fecha" />
                    </View>
                    <TimePicker value={formTime} onChange={setFormTime} label="Hora" />
                  </View>

                  {subrole === 'delegate' && userDepartment && (
                    <View style={[styles.deptInfo, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '30' }]}>
                      <Users size={14} color={colors.primary} strokeWidth={2} />
                      <ThemedText style={[styles.deptInfoText, { color: colors.primary }]}>
                        Visible para: {userDepartment}
                      </ThemedText>
                    </View>
                  )}

                  <View style={styles.typeGrid}>
                    {eventTypes.map(t => {
                      const cfg = EVENT_TYPE_CONFIG[t];
                      const active = form.type === t;
                      return (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.premiumTypeChip,
                            { backgroundColor: active ? cfg.color : colors.backgroundSecondary, borderColor: active ? cfg.color : colors.border }
                          ]}
                          onPress={() => setForm(f => ({ ...f, type: t }))}
                        >
                          <EventTypeIcon type={t} size={14} color={active ? '#fff' : cfg.color} />
                          <ThemedText style={[styles.premiumTypeLabel, { color: active ? '#fff' : colors.text }]}>{cfg.label}</ThemedText>
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
  emptyText: { textAlign: 'center', marginTop: spacing.xl, fontSize: typography.sizes.sm },
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
});
