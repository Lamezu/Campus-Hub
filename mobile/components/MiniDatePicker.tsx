import React, { useState } from 'react';
import { View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { ThemedText } from './themed-text';
import { useTheme } from '../contexts/ThemeContext';
import { spacing, typography } from '../constants/styles';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return (new Date(year, month, 1).getDay() + 6) % 7;
}

interface MiniDatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  label?: string;
}

export function MiniDatePicker({ value, onChange, label }: MiniDatePickerProps) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(value.getFullYear());
  const [viewMonth, setViewMonth] = useState(value.getMonth());

  const today = new Date();
  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const selectDay = (day: number) => {
    onChange(new Date(viewYear, viewMonth, day));
    setOpen(false);
  };

  const isSelected = (day: number) =>
    value.getFullYear() === viewYear && value.getMonth() === viewMonth && value.getDate() === day;

  const isToday = (day: number) =>
    today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === day;

  const formattedDate = value.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <TouchableOpacity
        style={[styles.trigger, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
        onPress={() => {
          setViewYear(value.getFullYear());
          setViewMonth(value.getMonth());
          setOpen(true);
        }}
        activeOpacity={0.8}
      >
        <CalendarDays size={16} color={colors.primary} strokeWidth={2} />
        <View style={styles.triggerText}>
          {label && <ThemedText style={[styles.triggerLabel, { color: colors.textSecondary }]}>{label}</ThemedText>}
          <ThemedText style={[styles.triggerValue, { color: colors.text }]}>{formattedDate}</ThemedText>
        </View>
        <ChevronRight size={14} color={colors.textSecondary} strokeWidth={2} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} onPress={e => e.stopPropagation()}>
            <View style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
                  <ChevronLeft size={18} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <ThemedText style={[styles.monthLabel, { color: colors.text }]}>
                  {MONTH_NAMES[viewMonth]} {viewYear}
                </ThemedText>
                <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
                  <ChevronRight size={18} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              <View style={styles.grid}>
                {DAY_NAMES.map(d => (
                  <ThemedText key={d} style={[styles.dayName, { color: colors.textSecondary }]}>{d}</ThemedText>
                ))}
                {cells.map((day, i) => {
                  if (!day) return <View key={`e_${i}`} style={styles.cell} />;
                  const selected = isSelected(day);
                  const todayMark = isToday(day);
                  return (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.cell,
                        selected && { backgroundColor: colors.primary },
                        !selected && todayMark && { backgroundColor: colors.primary + '22' },
                      ]}
                      onPress={() => selectDay(day)}
                      activeOpacity={0.7}
                    >
                      <ThemedText style={[
                        styles.dayNum,
                        { color: selected ? '#fff' : todayMark ? colors.primary : colors.text },
                        selected && { fontWeight: '700' },
                      ]}>
                        {day}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  triggerText: { flex: 1 },
  triggerLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  triggerValue: { fontSize: typography.sizes.sm, fontWeight: '600', marginTop: 1 },
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: spacing.lg,
  },
  sheet: {
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md, width: 300,
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  navBtn: { padding: 6 },
  monthLabel: { fontSize: typography.sizes.md, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayName: {
    width: `${100 / 7}%`, textAlign: 'center',
    fontSize: 11, fontWeight: '600', paddingVertical: 4,
  },
  cell: {
    width: `${100 / 7}%`, aspectRatio: 1,
    justifyContent: 'center', alignItems: 'center', borderRadius: 8,
  },
  dayNum: { fontSize: 13 },
});
