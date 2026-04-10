import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  CheckCircle2, XCircle, Users, ExternalLink,
  ChevronRight, Filter, User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useStudyGroups } from '@/hooks/useStudyGroups';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { ACADEMIC_CATEGORIES } from '@/constants/academic';
import type { CalendarEvent } from '@/types';

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam: '#FF3B30',
  deadline: '#FF9500',
  class: '#007AFF',
  holiday: '#AF52DE',
  event: '#34C759',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  exam: 'Examen',
  deadline: 'Entrega',
  class: 'Clase',
  holiday: 'Festivo',
  event: 'Evento',
};

type FilterType = 'Todos' | 'Evento' | 'Examen' | 'Entrega' | 'Festivo';

const FILTERS: FilterType[] = ['Todos', 'Evento', 'Examen', 'Entrega', 'Festivo'];

export function EventChannelView() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { firebaseUser, userData } = useCurrentUser();
  const { allEvents, toggleRSVP, rsvpMap } = useCalendarEvents();
  const { groups } = useStudyGroups();
  
  const [activeFilter, setActiveFilter] = useState<FilterType>('Todos');

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(event => {
        // 1. Department visibility logic
        // If event is for everyone or user matches the department
        const isVisible = event.departmentId === 'Todos' || !event.departmentId || (userData?.department && event.departmentId === userData.department);
        if (!isVisible) return false;

        // 2. Type filter logic
        if (activeFilter === 'Todos') return true;
        return EVENT_TYPE_LABELS[event.type] === activeFilter;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allEvents, activeFilter, userData?.department]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }) + (dateStr.includes('T') ? ` · ${date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : '');
  };

  return (
    <div style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      backgroundColor: colors.background,
      height: '100%',
      width: '100%',
      overflow: 'hidden'
    }}>
      {/* Category Chips */}
      <div style={{ 
        padding: '16px 20px', 
        display: 'flex', 
        justifyContent: 'center',
        gap: 10, 
        overflowX: 'auto', 
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        backdropFilter: 'blur(10px)',
        zIndex: 5
      }} className="hide-scrollbar">
        {FILTERS.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '8px 20px',
              borderRadius: 20,
              border: 'none',
              backgroundColor: activeFilter === filter ? colors.primary : colors.backgroundSecondary,
              color: activeFilter === filter ? '#fff' : colors.textSecondary,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
              boxShadow: activeFilter === filter ? `0 4px 10px ${colors.primary}40` : 'none'
            }}
          >
            {filter}
          </button>
        ))}
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px 20px',
        width: '100%'
      }} className="custom-scrollbar">
        {filteredEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', opacity: 0.5, gap: 16 }}>
            <CalendarIcon size={64} color={colors.textSecondary} />
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>No hay eventos disponibles para esta selección</ThemedText>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', 
            gap: 20, 
            maxWidth: 1200, 
            margin: '0 auto', 
            width: '100%',
            paddingBottom: 40
          }}>
            {filteredEvents.map(event => {
              const color = EVENT_TYPE_COLORS[event.type] || colors.primary;
              const isUserDepartment = event.departmentId && userData?.department === event.departmentId;
              const eventDate = new Date(event.date);
              const isPast = eventDate.getTime() < Date.now();

              return (
                <div 
                  key={event.id}
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 24,
                    border: `1px solid ${colors.border}`,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                    position: 'relative',
                    transition: 'transform 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-4px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {/* Top Color Bar */}
                  <div style={{ height: 6, width: '100%', backgroundColor: color }} />
                  
                  <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        <div style={{ 
                          padding: '4px 10px', 
                          borderRadius: 8, 
                          backgroundColor: color + '15', 
                          color: color,
                          fontSize: 10,
                          fontWeight: 800,
                          textTransform: 'uppercase'
                        }}>
                          {EVENT_TYPE_LABELS[event.type]}
                        </div>
                        {isUserDepartment && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, backgroundColor: colors.primary + '10', color: colors.primary }}>
                            <Users size={12} />
                            <span style={{ fontSize: 10, fontWeight: 800 }}>TU DEPARTAMENTO</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <ThemedText style={{ fontSize: 22, fontWeight: 900, marginBottom: 8, color: colors.text, lineHeight: 1.2 }}>{event.title}</ThemedText>
                    
                    <ThemedText style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 20, lineHeight: 1.5, flex: 1 }}>
                      {event.description || 'Sin descripción adicional.'}
                    </ThemedText>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, padding: '16px', backgroundColor: colors.backgroundSecondary, borderRadius: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.text }}>
                        <Clock size={16} color={colors.primary} />
                        <span style={{ fontSize: 13, fontWeight: 700 }}>{formatDate(event.date)}</span>
                      </div>
                      {event.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: colors.textSecondary }}>
                          <MapPin size={16} />
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{event.location}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <button 
                        onClick={() => navigate('/tabs/campus', { state: { tab: 'calendario', selectedId: event.id } })}
                        style={{
                          flex: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 10,
                          padding: '14px',
                          borderRadius: 16,
                          backgroundColor: colors.background,
                          color: colors.text,
                          border: `1px solid ${colors.border}`,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 13
                        }}
                      >
                        <CalendarIcon size={16} />
                        Calendario
                      </button>

                      {!isPast && (
                        <div style={{ display: 'flex', gap: 8, flex: 1.5 }}>
                           <button 
                            onClick={() => toggleRSVP(event.id, 'going')}
                            style={{
                              flex: 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                              padding: '14px',
                              borderRadius: 16,
                              backgroundColor: rsvpMap[event.id] === 'going' ? '#34C759' : '#34C75915',
                              color: rsvpMap[event.id] === 'going' ? '#fff' : '#34C759',
                              border: 'none',
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontSize: 13,
                              transition: 'all 0.2s'
                            }}
                          >
                            <CheckCircle2 size={16} />
                            Voy
                          </button>
                          <button 
                            onClick={() => toggleRSVP(event.id, 'not_going')}
                            style={{
                              padding: '14px',
                              borderRadius: 16,
                              backgroundColor: rsvpMap[event.id] === 'not_going' ? colors.danger : colors.danger + '15',
                              color: rsvpMap[event.id] === 'not_going' ? '#fff' : colors.danger,
                              border: 'none',
                              fontWeight: 700,
                              cursor: 'pointer',
                              fontSize: 13,
                              transition: 'all 0.2s'
                            }}
                          >
                            <XCircle size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, opacity: 0.8 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                         {[...Array(Math.min(3, event.attendeesCount || 0))].map((_, i) => (
                           <div key={i} style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: colors.backgroundSecondary, border: `2px solid ${colors.card}`, marginLeft: i === 0 ? 0 : -8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                             <User size={12} color={colors.textSecondary} />
                           </div>
                         ))}
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>{event.attendeesCount || 0} alumnos van</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
