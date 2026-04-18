import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar as CalendarIcon, Clock, Trash2, Share2, Users } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { EventModal } from './EventModal';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import type { CalendarEvent } from '@/types';

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam: '#FF3B30',
  deadline: '#FF9500',
  class: '#007AFF',
  holiday: '#AF52DE',
  event: '#34C759',
};

export function CalendarTab({ initialId, onConsumeId }: { initialId?: string, onConsumeId?: () => void }) {
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const { can } = useCurrentUser();
  const { allEvents, loading, saveEvent, deleteEvent, publishEventToSocial } = useCalendarEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  const monthsResult = t('calendar.months', { returnObjects: true });
  const months = (Array.isArray(monthsResult) ? monthsResult : [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ]) as unknown as string[];

  const daysResult = t('calendar.days_short', { returnObjects: true });
  const weekdays = (Array.isArray(daysResult) ? daysResult : ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]) as unknown as string[];

  React.useEffect(() => {
    if (initialId && allEvents.length > 0) {
      const found = allEvents.find((e: any) => e.id === initialId);
      if (found) {
        const d = new Date(found.date);
        setCurrentDate(d);
        setSelectedDay(d.getDate());
        onConsumeId?.();
      }
    }
  }, [initialId, allEvents, onConsumeId]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1);

  const [showSelector, setShowSelector] = useState(false);
  const [yearRangeStart, setYearRangeStart] = useState(new Date().getFullYear() - 5);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const years = useMemo(() => {
    const range = [];
    for (let i = yearRangeStart; i < yearRangeStart + 12; i++) range.push(i);
    return range;
  }, [yearRangeStart]);

  const monthName = months[month];
  const yearName = year.toString();

  const eventsInMonth = useMemo(() => {
    return allEvents.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === month && d.getFullYear() === year;
    });
  }, [allEvents, month, year]);

  const getEventsForDay = (day: number) => eventsInMonth.filter(e => new Date(e.date).getDate() === day);

  const handleSave = async (data: any) => {
    await saveEvent(data, editingEvent?.id);
    setShowModal(false);
    setEditingEvent(null);
  };

  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, color: colors.textSecondary }}>
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <>
    <div style={{ display: 'flex', gap: 40, height: '100%', overflow: 'hidden', padding: '0 10px' }}>
      {/* Left Column: Fixed Calendar Control */}
      <div style={{ width: 380, display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', backgroundColor: colors.backgroundSecondary, padding: '10px 20px', borderRadius: 20, border: `1px solid ${colors.border}`, justifyContent: 'space-between' }}>
          <button onClick={prevMonth} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex' }}><ChevronLeft size={22} /></button>
          <div onClick={() => setShowSelector(true)} style={{ fontWeight: 800, fontSize: 18, color: colors.text, textTransform: 'capitalize', cursor: 'pointer' }}>{monthName} <span style={{ opacity: 0.5 }}>{yearName}</span></div>
          <button onClick={nextMonth} style={{ padding: 8, background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex' }}><ChevronRight size={22} /></button>
        </div>

        <div style={{ backgroundColor: colors.card, borderRadius: 28, border: `1px solid ${colors.border}`, padding: 24, boxShadow: '0 10px 40px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 16 }}>
            {weekdays.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.textSecondary, opacity: 0.6 }}>{d}</div>)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
              const isSelected = selectedDay === day;
              const dayEvents = getEventsForDay(day);

              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDay(day)} 
                  style={{ 
                    aspectRatio: '1', 
                    borderRadius: 12, 
                    backgroundColor: isSelected ? colors.primary : isToday ? colors.backgroundSecondary : 'transparent', 
                    border: isSelected ? `none` : isToday ? `1px solid ${colors.primary}40` : `1px solid transparent`, 
                    cursor: 'pointer', 
                    transition: 'all 0.2s', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    position: 'relative'
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: isToday || isSelected ? '800' : '600', color: isSelected ? '#fff' : colors.text }}>{day}</div>
                  {dayEvents.length > 0 && !isSelected && (
                    <div style={{ position: 'absolute', bottom: 6, width: 4, height: 4, borderRadius: 2, backgroundColor: colors.primary }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {(can('createAcademicEvent') || can('createGeneralEvent')) && (
          <button onClick={() => { setEditingEvent(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px', borderRadius: 16, backgroundColor: colors.primary, color: '#fff', border: 'none', fontWeight: 800, cursor: 'pointer', boxShadow: `0 8px 20px ${colors.primary}40`, fontSize: 15, width: '100%', justifyContent: 'center' }}>
            <Plus size={20} /><span>{t('calendar.add_event')}</span>
          </button>
        )}
      </div>

      {/* Right Column: Scrollable Event List */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CalendarIcon size={20} color={colors.primary} />
            <ThemedText style={{ fontWeight: 800, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.7 }}>{t('calendar.upcoming_events')}</ThemedText>
          </div>
          {selectedDay && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <ThemedText style={{ fontSize: 32, fontWeight: '800' }}>{selectedDay}</ThemedText>
              <ThemedText style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>
                {t('calendar.date_format', { day: selectedDay, month: months[month] })}
              </ThemedText>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 12 }}>
          {selectedDayEvents.length === 0 ? (
            <div style={{ padding: '60px 40px', textAlign: 'center', borderRadius: 24, border: `2px dashed ${colors.border}`, opacity: 0.5, backgroundColor: colors.backgroundSecondary }}>
              <ThemedText style={{ fontSize: 15, fontWeight: '600' }}>{t('calendar.no_events_day')}</ThemedText>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {selectedDayEvents.map(event => {
                const color = EVENT_TYPE_COLORS[event.type] || colors.primary;
                const deptKey = event.departmentId?.toLowerCase().replace(/ /g, '_');
                const deptLabel = deptKey ? t(`common.departments.${deptKey}`, { defaultValue: event.departmentId }) : null;

                return (
                  <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 20, borderRadius: 20, backgroundColor: colors.backgroundSecondary, border: `1px solid ${colors.border}`, transition: 'all 0.2s', cursor: 'default' }}>
                    <div style={{ width: 4, height: 60, borderRadius: 10, backgroundColor: color, boxShadow: `0 0 10px ${color}40` }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <div style={{ padding: '4px 10px', borderRadius: 8, backgroundColor: color + '20', color: color, fontSize: 10, fontWeight: 900, textTransform: 'uppercase' }}>
                          {t(`calendar.event_types.${event.type?.toLowerCase()}`)}
                        </div>
                        {deptLabel && event.departmentId !== 'all' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 8, backgroundColor: colors.border + '30', color: colors.textSecondary, fontSize: 10, fontWeight: 800 }}>
                            <Users size={12} />
                            <span>{deptLabel}</span>
                          </div>
                        )}
                      </div>
                      <ThemedText style={{ fontWeight: '800', fontSize: 18, display: 'block', marginBottom: 8 }}>{event.title}</ThemedText>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, opacity: 0.6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Clock size={14} /><ThemedText style={{ fontSize: 13, fontWeight: '600' }}>{event.time || t('calendar.all_day')}</ThemedText></div>
                        <div style={{ marginLeft: 'auto', fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>{new Date(event.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'short' })}</div>
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(can('createAcademicEvent') || can('createGeneralEvent')) && (
                        <>
                          {!event.isPublished && (
                            <button onClick={() => publishEventToSocial(event)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', backgroundColor: colors.primary + '15', color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Share2 size={16} /></button>
                          )}
                          <button onClick={() => deleteEvent(event.id)} style={{ width: 34, height: 34, borderRadius: 10, border: 'none', backgroundColor: colors.danger + '15', color: colors.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>

      {showSelector && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: 340, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><ThemedText style={{ fontWeight: '800', fontSize: 18 }}>{t('calendar.select_date')}</ThemedText><button onClick={() => setShowSelector(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>{months.map((m, i) => <button key={m} onClick={() => { setCurrentDate(new Date(year, i, 1)); setShowSelector(false); }} style={{ padding: '10px 4px', borderRadius: 10, border: 'none', backgroundColor: month === i ? colors.primary : colors.backgroundSecondary, color: month === i ? '#fff' : colors.text, fontSize: 12, fontWeight: '700', cursor: 'pointer' }}>{m.slice(0, 3).toUpperCase()}</button>)}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}><button onClick={() => setYearRangeStart(yearRangeStart - 12)} style={{ padding: 6, background: 'none', border: 'none', color: colors.textSecondary }}><ChevronLeft size={18} /></button><div style={{ flex: 1, height: 1, backgroundColor: colors.border }} /><button onClick={() => setYearRangeStart(yearRangeStart + 12)} style={{ padding: 6, background: 'none', border: 'none', color: colors.textSecondary }}><ChevronRight size={18} /></button></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>{years.map(y => <button key={y} onClick={() => { setCurrentDate(new Date(y, month, 1)); setShowSelector(false); }} style={{ padding: '8px 4px', borderRadius: 8, border: 'none', backgroundColor: year === y ? colors.primary : 'transparent', color: year === y ? '#fff' : colors.text, fontSize: 11, fontWeight: '700', cursor: 'pointer' }}>{y}</button>)}</div>
          </div>
        </div>
      )}

      {showModal && (
        <EventModal
          isOpen={showModal}
          onClose={() => { setShowModal(false); setEditingEvent(null); }}
          onSave={handleSave}
          initialData={editingEvent || {
            date: `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay || new Date().getDate()).padStart(2, '0')}`,
          }}
        />
      )}
    </>
  );
}
