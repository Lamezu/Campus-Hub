import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Loader2, Calendar as CalendarIcon, Clock, Tag, Trash2, Share2, Users } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
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

const DEPARTMENT_MAP: Record<string, string> = {
  'hospitality': 'Hostelería y Turismo',
  'health': 'Sanidad',
  'it_comms': 'Informática y Comunicaciones',
  'sports': 'Actividades Físicas y Deportivas',
  'admin_mgmt': 'Administración y Gestión',
  'social_services': 'Servicios Socioculturales',
  'energy_water': 'Energía y Agua',
  'wood_furniture': 'Madera, Mueble y Corcho',
  'security_env': 'Seguridad y Medio Ambiente',
  'languages': 'Idiomas',
  'fol': 'FOL',
  'counseling': 'Orientación',
  'innovation': 'Innovación y Calidad',
  'Todos': 'Todos'
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  exam: 'Examen',
  deadline: 'Entrega',
  class: 'Clase',
  holiday: 'Festivo',
  event: 'Evento',
};

const WEEKDAYS = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];

export function CalendarTab({ initialId, onConsumeId }: { initialId?: string, onConsumeId?: () => void }) {
  const { colors } = useTheme();
  const { can } = useCurrentUser();
  const { allEvents, loading, saveEvent, deleteEvent, publishEventToSocial } = useCalendarEvents();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

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

  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const monthName = currentDate.toLocaleString('es-ES', { month: 'long' });
  const yearName = currentDate.toLocaleString('es-ES', { year: 'numeric' });

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
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: colors.backgroundSecondary, padding: '6px 12px', borderRadius: 12, border: `1px solid ${colors.border}`, minWidth: 260, justifyContent: 'space-between' }}>
            <button onClick={prevMonth} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex' }}><ChevronLeft size={20} /></button>
            <div onClick={() => setShowSelector(true)} style={{ fontWeight: 800, fontSize: 16, color: colors.text, textTransform: 'capitalize', cursor: 'pointer' }}>{monthName} <span style={{ opacity: 0.5 }}>{yearName}</span></div>
            <button onClick={nextMonth} style={{ padding: 6, background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary, display: 'flex' }}><ChevronRight size={20} /></button>
          </div>
        </div>
        {(can('createAcademicEvent') || can('createGeneralEvent')) && (
          <button onClick={() => { setEditingEvent(null); setShowModal(true); }} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, backgroundColor: colors.primary, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', boxShadow: `0 4px 12px ${colors.primary}30`, fontSize: 14 }}>
            <Plus size={18} /><span>Nuevo Evento</span>
          </button>
        )}
      </div>

      <div style={{ backgroundColor: colors.card, borderRadius: 20, border: `1px solid ${colors.border}`, padding: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 12 }}>
          {WEEKDAYS.map(d => <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: '800', color: colors.textSecondary, opacity: 0.6 }}>{d}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {Array.from({ length: startOffset }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
            const isSelected = selectedDay === day;
            const dayEvents = getEventsForDay(day);

            return (
              <div key={day} onClick={() => setSelectedDay(day)} style={{ minHeight: 90, padding: 8, borderRadius: 12, backgroundColor: isSelected ? `${colors.primary}10` : isToday ? colors.backgroundSecondary : 'transparent', border: isSelected ? `1.5px solid ${colors.primary}` : `1px solid ${colors.border}44`, cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ fontSize: 14, fontWeight: isToday || isSelected ? '800' : '600', color: isSelected ? colors.primary : colors.text, opacity: isToday || isSelected ? 1 : 0.7 }}>{day}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {dayEvents.slice(0, 2).map(event => (
                    <div key={event.id} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, backgroundColor: `${EVENT_TYPE_COLORS[event.type]}15`, color: EVENT_TYPE_COLORS[event.type], fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{event.title}</div>
                  ))}
                  {dayEvents.length > 2 && <div style={{ fontSize: 9, fontWeight: 'bold', color: colors.textSecondary, paddingLeft: 6, marginTop: 1 }}>+ {dayEvents.length - 2} tareas</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <CalendarIcon size={18} color={colors.primary} />
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{selectedDay ? `Eventos para el ${selectedDay} de ${monthName}` : 'Selecciona un día'}</ThemedText>
        </div>
        {selectedDayEvents.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', borderRadius: 20, border: `2px dashed ${colors.border}`, opacity: 0.5 }}><ThemedText style={{ fontSize: 14 }}>No hay eventos programados para hoy</ThemedText></div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {selectedDayEvents.map(event => {
              const color = EVENT_TYPE_COLORS[event.type] || colors.primary;
              const deptLabel = event.departmentId ? (DEPARTMENT_MAP[event.departmentId] || event.departmentId) : null;

              return (
                <div key={event.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, borderRadius: 16, backgroundColor: colors.card, border: `1px solid ${colors.border}`, transition: 'transform 0.1s' }}>
                  <div style={{ width: 4, height: 60, borderRadius: 2, backgroundColor: color }} />
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditingEvent(event); setShowModal(true); }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <div style={{ 
                        padding: '2px 8px', 
                        borderRadius: 6, 
                        backgroundColor: color + '15', 
                        color: color,
                        fontSize: 9,
                        fontWeight: 900,
                        textTransform: 'uppercase'
                      }}>
                        {EVENT_TYPE_LABELS[event.type]}
                      </div>
                      {deptLabel && deptLabel !== 'Todos' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, backgroundColor: colors.backgroundSecondary, color: colors.textSecondary }}>
                          <Users size={10} />
                          <span style={{ fontSize: 9, fontWeight: 800 }}>{deptLabel}</span>
                        </div>
                      )}
                    </div>
                    <ThemedText style={{ fontWeight: '700', fontSize: 16, display: 'block', marginBottom: 6 }}>{event.title}</ThemedText>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: 0.6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Clock size={12} /><ThemedText style={{ fontSize: 12 }}>{event.time || 'Todo el día'}</ThemedText></div>
                      {event.location && <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Tag size={12} /><ThemedText style={{ fontSize: 12 }}>{event.location}</ThemedText></div>}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {!event.isPublished && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); publishEventToSocial(event); }}
                        style={{ width: 36, height: 36, borderRadius: 10, border: 'none', backgroundColor: colors.primary + '10', color: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                        title="Publicar en Descubrir"
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.primary + '20'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.primary + '10'; }}
                      >
                        <Share2 size={16} />
                      </button>
                    )}
                    <button 
                      onClick={(e) => { e.stopPropagation(); deleteEvent(event.id); }}
                      style={{ width: 36, height: 36, borderRadius: 10, border: 'none', backgroundColor: colors.danger + '10', color: colors.danger, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                      title="Eliminar evento"
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.danger + '20'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.danger + '10'; }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showSelector && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, backdropFilter: 'blur(4px)' }}>
          <div style={{ backgroundColor: colors.card, borderRadius: 24, padding: 24, width: 340, boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}><ThemedText style={{ fontWeight: '800', fontSize: 18 }}>Seleccionar fecha</ThemedText><button onClick={() => setShowSelector(false)} style={{ background: 'none', border: 'none', color: colors.textSecondary, cursor: 'pointer' }}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button></div>
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
    </div>
  );
}
