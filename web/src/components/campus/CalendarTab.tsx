import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X, Trash2, BookOpen, Clock, PartyPopper, GraduationCap, AlertCircle, Megaphone, Users } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useCalendarEvents } from '../../hooks/campus/useCalendarEvents';
import type { CalendarEventType, CalendarEvent } from '../../types';

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const EVENT_TYPE_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
  exam:     { label: 'Examen',   color: '#FF3B30' },
  deadline: { label: 'Entrega',  color: '#FF9500' },
  holiday:  { label: 'Festivo',  color: '#34C759' },
  event:    { label: 'Evento',   color: '#007AFF' },
  class:    { label: 'Clase',    color: '#AF52DE' },
};

function EventTypeIcon({ type, size = 14, color: c }: { type: CalendarEventType; size?: number; color?: string }) {
  const color = c || EVENT_TYPE_CONFIG[type].color;
  if (type === 'exam') return <BookOpen size={size} color={color} strokeWidth={2} />;
  if (type === 'deadline') return <Clock size={size} color={color} strokeWidth={2} />;
  if (type === 'holiday') return <PartyPopper size={size} color={color} strokeWidth={2} />;
  if (type === 'class') return <GraduationCap size={size} color={color} strokeWidth={2} />;
  return <AlertCircle size={size} color={color} strokeWidth={2} />;
}

function getDaysInMonth(year: number, month: number) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year: number, month: number) { return (new Date(year, month, 1).getDay() + 6) % 7; }

interface CalendarTabProps {
  eventTypes: CalendarEventType[];
  department: string | null;
  subrole: string | null;
  currentUserId: string;
}

export function CalendarTab({ eventTypes, department, subrole, currentUserId }: CalendarTabProps) {
  const { colors } = useTheme();
  const isDesktop = useWindowSize();
  const today = new Date();
  const { allEvents, saveEvent, deleteEvent } = useCalendarEvents();

  const visibleEvents = allEvents.filter(ev => {
    if (!ev.departmentId) return true;
    if (!department) return true;
    return ev.departmentId === department;
  });

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [formDate, setFormDate] = useState(today.toISOString().slice(0, 10));
  const [formTime, setFormTime] = useState('');
  const [form, setForm] = useState({ title: '', description: '', type: (eventTypes[0] ?? 'event') as CalendarEventType });

  const prevMonth = () => { setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; }); setSelectedDate(null); };
  const nextMonth = () => { setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; }); setSelectedDate(null); };

  const monthEvents = visibleEvents.filter(e => {
    const d = new Date(e.date);
    return d.getFullYear() === viewYear && d.getMonth() === viewMonth;
  });
  const eventDays = new Set(monthEvents.map(e => new Date(e.date).getDate()));

  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const selectedEvents = selectedDate
    ? monthEvents.filter(e => new Date(e.date).getDate() === parseInt(selectedDate))
    : visibleEvents.filter(e => new Date(new Date(e.date).getFullYear(), new Date(e.date).getMonth(), new Date(e.date).getDate()) >= todayStart).slice(0, 8);

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
  const calCells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  const openCreate = () => {
    const base = selectedDate ? `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${selectedDate.padStart(2, '0')}` : today.toISOString().slice(0, 10);
    setFormDate(base);
    setFormTime('');
    setForm({ title: '', description: '', type: eventTypes[0] ?? 'event' });
    setEditingEventId(null);
    setShowCreate(true);
  };

  const handleEditEvent = (ev: CalendarEvent) => {
    setForm({ title: ev.title, description: ev.description, type: ev.type });
    setFormDate(new Date(ev.date).toISOString().slice(0, 10));
    setFormTime(ev.time ?? '');
    setEditingEventId(ev.id);
    setShowCreate(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const date = new Date(formDate + (formTime ? `T${formTime}` : 'T00:00:00'));
    await saveEvent({
      title: form.title.trim(),
      description: form.description.trim(),
      startDate: Timestamp.fromDate(date),
      allDay: !formTime,
      time: formTime || null,
      category: form.type,
      departmentId: subrole === 'delegate' ? department : null,
    }, editingEventId);
    setShowCreate(false);
    setEditingEventId(null);
  };

  const canCreateEvent = eventTypes.length > 0;

  const calendarPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, border: `1px solid ${colors.border}`, padding: '12px 16px', backgroundColor: colors.card }}>
        <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: colors.text }}>{MONTH_NAMES[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}>
          <ChevronRight size={20} color={colors.text} strokeWidth={2} />
        </button>
      </div>

      <div style={{ borderRadius: 12, border: `1px solid ${colors.border}`, padding: isDesktop ? 12 : 8, backgroundColor: colors.card }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: isDesktop ? 4 : 0 }}>
          {DAY_NAMES.map(d => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 600, color: colors.textSecondary, paddingBottom: 6 }}>{d}</div>
          ))}
          {calCells.map((day, i) => {
            if (!day) return <div key={`e_${i}`} />;
            const isToday = viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate();
            const isSelected = selectedDate === String(day);
            const hasEvent = eventDays.has(day);
            return (
              <div
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : String(day))}
                style={{
                  aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  borderRadius: 8, cursor: 'pointer',
                  backgroundColor: isSelected ? colors.primary : isToday ? colors.primary + '20' : 'transparent',
                }}
              >
                <span style={{ fontSize: isDesktop ? 14 : 13, fontWeight: 500, color: isSelected ? '#fff' : isToday ? colors.primary : colors.text }}>{day}</span>
                {hasEvent && <div style={{ width: 4, height: 4, borderRadius: 2, marginTop: 2, backgroundColor: isSelected ? '#fff' : colors.primary }} />}
              </div>
            );
          })}
        </div>
      </div>

      {canCreateEvent && (
        <button
          onClick={openCreate}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '12px', borderRadius: 10, border: 'none', backgroundColor: colors.primary, color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
        >
          <Plus size={18} color="#fff" strokeWidth={2.5} />
          {subrole === 'delegate' && department ? `Evento para ${department}` : 'Añadir evento'}
        </button>
      )}
    </div>
  );

  const eventsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>
        {selectedDate ? `Eventos del día ${selectedDate}` : 'Próximos eventos'}
      </div>

      {selectedEvents.length === 0 ? (
        <div style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 14, padding: '24px 0' }}>Sin eventos</div>
      ) : (
        selectedEvents.map(ev => {
          const cfg = EVENT_TYPE_CONFIG[ev.type];
          const isAuthor = currentUserId === ev.authorId;
          return (
            <div
              key={ev.id}
              onClick={isAuthor ? () => handleEditEvent(ev) : undefined}
              style={{ borderRadius: 12, border: `1px solid ${colors.border}`, borderLeft: `4px solid ${cfg.color}`, padding: 14, display: 'flex', flexDirection: 'column', gap: 4, cursor: isAuthor ? 'pointer' : 'default', backgroundColor: colors.card }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, backgroundColor: cfg.color + '20' }}>
                    <EventTypeIcon type={ev.type} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  {ev.departmentId && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '3px 6px', borderRadius: 6, backgroundColor: colors.backgroundSecondary }}>
                      <Users size={10} color={colors.textSecondary} strokeWidth={2} />
                      <span style={{ fontSize: 10, fontWeight: 500, color: colors.textSecondary }}>{ev.departmentId}</span>
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {isAuthor && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteEvent(ev.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 4 }}
                    >
                      <Trash2 size={16} color={colors.textSecondary} />
                    </button>
                  )}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{new Date(ev.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</div>
                    {ev.time && <div style={{ fontSize: 10, fontWeight: 600, color: colors.textSecondary }}>{ev.time}</div>}
                  </div>
                </div>
              </div>
              <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{ev.title}</span>
              {!!ev.description && <span style={{ fontSize: 12, color: colors.textSecondary, lineHeight: '16px' }}>{ev.description}</span>}
              {ev.linkedAnnouncementId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingTop: 8, marginTop: 4, borderTop: `1px solid ${colors.border}` }}>
                  <Megaphone size={12} color={colors.primary} strokeWidth={2} />
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: colors.primary }}>Ver anuncio relacionado</span>
                  <ChevronRight size={12} color={colors.primary} strokeWidth={2} />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  return (
    <div style={isDesktop
      ? { display: 'flex', gap: 32, padding: '24px 32px', height: '100%', overflow: 'hidden' }
      : { overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }
    }>
      {isDesktop ? (
        <>
          <div style={{ width: 380, flexShrink: 0, overflowY: 'auto' }}>{calendarPanel}</div>
          <div style={{ flex: 1, overflowY: 'auto' }}>{eventsPanel}</div>
        </>
      ) : (
        <>
          {calendarPanel}
          {eventsPanel}
        </>
      )}

      {showCreate && (
        <div className="animate-fade-in" style={{ position: 'fixed', inset: 0, zIndex: 100, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div className="animate-sheet" style={{ backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, width: '100%', maxWidth: 560, maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${colors.border}` }}>
              <button onClick={() => { setShowCreate(false); setEditingEventId(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                <X size={20} color={colors.textSecondary} strokeWidth={2} />
              </button>
              <span style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>{editingEventId ? 'Editar evento' : 'Nuevo evento'}</span>
              <button
                onClick={handleSave}
                disabled={!form.title.trim()}
                style={{ padding: '8px 16px', borderRadius: 20, border: 'none', cursor: form.title.trim() ? 'pointer' : 'not-allowed', fontSize: 16, fontWeight: 700, color: colors.primary, background: 'none', opacity: form.title.trim() ? 1 : 0.5 }}
              >
                {editingEventId ? 'Guardar' : 'Crear'}
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 40px' }}>
              <div style={{ backgroundColor: colors.backgroundSecondary, borderRadius: 16, padding: '12px 16px', marginBottom: 16 }}>
                <input
                  autoFocus
                  type="text"
                  placeholder="Nombre del evento..."
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  style={{ fontSize: 20, fontWeight: 700, border: 'none', outline: 'none', background: 'transparent', color: colors.text, width: '100%', fontFamily: 'inherit', padding: '8px 0' }}
                />
                <div style={{ height: 1, backgroundColor: colors.border, marginBottom: 4 }} />
                <textarea
                  placeholder="Notas adicionales (opcional)"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={3}
                  style={{ fontSize: 16, border: 'none', outline: 'none', background: 'transparent', color: colors.text, width: '100%', resize: 'none', fontFamily: 'inherit', padding: '8px 0' }}
                />
              </div>

              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, color: colors.textSecondary, opacity: 0.6, marginBottom: 10 }}>Fecha y hora</div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <input
                  type="date"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
                />
                <input
                  type="time"
                  value={formTime}
                  onChange={e => setFormTime(e.target.value)}
                  style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, color: colors.text, fontSize: 15, fontFamily: 'inherit', outline: 'none' }}
                />
              </div>

              {subrole === 'delegate' && department && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 10, border: `1px solid ${colors.primary}30`, backgroundColor: colors.primary + '10', marginBottom: 16 }}>
                  <Users size={14} color={colors.primary} strokeWidth={2} />
                  <span style={{ fontSize: 14, fontWeight: 600, color: colors.primary }}>Visible para: {department}</span>
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {eventTypes.map(t => {
                  const cfg = EVENT_TYPE_CONFIG[t];
                  const active = form.type === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setForm(f => ({ ...f, type: t }))}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 12, border: `1px solid ${active ? cfg.color : colors.border}`, backgroundColor: active ? cfg.color : colors.backgroundSecondary, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: active ? '#fff' : colors.text }}
                    >
                      <EventTypeIcon type={t} size={14} color={active ? '#fff' : cfg.color} />
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
