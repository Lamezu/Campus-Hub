import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, 
  CheckCircle2, XCircle, Users, Calendar
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { useCalendarEvents } from '@/hooks/useCalendarEvents';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/contexts/LanguageContext';

const EVENT_TYPE_COLORS: Record<string, string> = {
  exam: '#FF3B30',
  deadline: '#FF9500',
  class: '#007AFF',
  holiday: '#AF52DE',
  event: '#34C759',
};

export function EventChannelView() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { userData } = useCurrentUser();
  const { allEvents, toggleRSVP, rsvpMap } = useCalendarEvents();
  
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const FILTERS = ['all', 'event', 'exam', 'deadline', 'holiday'];

  const filteredEvents = useMemo(() => {
    return allEvents
      .filter(event => {
        const isVisible = event.departmentId === 'Todos' || !event.departmentId || (userData?.department && event.departmentId === userData.department);
        if (!isVisible) return false;
        if (activeFilter === 'all') return true;
        return event.type === activeFilter;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [allEvents, activeFilter, userData?.department]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long' 
    }) + (dateStr.includes('T') ? ` · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : '');
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
      {/* Category Chips - Aligned to left as in mobile but for desktop */}
      <div style={{ 
        padding: '20px', 
        display: 'flex', 
        gap: 12, 
        overflowX: 'auto', 
        backgroundColor: colors.background,
        zIndex: 5
      }} className="hide-scrollbar">
        {FILTERS.map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            style={{
              padding: '10px 24px',
              borderRadius: 14,
              border: 'none',
              backgroundColor: activeFilter === filter ? colors.primary : colors.backgroundSecondary,
              color: activeFilter === filter ? '#fff' : colors.textSecondary,
              fontSize: 14,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              whiteSpace: 'nowrap',
              boxShadow: activeFilter === filter ? `0 4px 12px ${colors.primary}40` : 'none',
              transform: activeFilter === filter ? 'scale(1.05)' : 'scale(1)'
            }}
          >
            {t(`events_channel.filters.${filter}`)}
          </button>
        ))}
      </div>

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '10px 20px 40px',
        width: '100%'
      }} className="custom-scrollbar">
        {filteredEvents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%', opacity: 0.5, gap: 16 }}>
            <CalendarIcon size={64} color={colors.textSecondary} />
            <ThemedText style={{ fontSize: 16, fontWeight: '600' }}>{t('events_channel.no_events')}</ThemedText>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', 
            gap: 24, 
            maxWidth: 1400, 
            margin: '0 auto', 
            width: '100%'
          }}>
            {filteredEvents.map(event => {
              const color = EVENT_TYPE_COLORS[event.type] || colors.primary;
              const isUserDepartment = event.departmentId && userData?.department === event.departmentId;
              const eventDate = new Date(event.date);
              const isPast = eventDate.getTime() < Date.now();
              const rsvp = rsvpMap[event.id];

              return (
                <div 
                  key={event.id}
                  style={{
                    backgroundColor: colors.backgroundSecondary,
                    borderRadius: 24,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    position: 'relative',
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s',
                    border: `1px solid ${colors.border}`,
                    animation: 'fadeIn 0.4s ease-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-6px)';
                    e.currentTarget.style.boxShadow = '0 12px 24px rgba(0,0,0,0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Left Accent Border */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: color }} />
                  
                  <div style={{ padding: 24, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ 
                        padding: '6px 12px', 
                        borderRadius: 10, 
                        backgroundColor: color + '15', 
                        color: color,
                        fontSize: 11,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}>
                        <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
                        {t(`events_channel.filters.${event.type}`)}
                      </div>
                      {isUserDepartment && (
                        <div style={{ 
                          padding: '6px 14px', 
                          borderRadius: 20, 
                          backgroundColor: colors.primary, 
                          color: '#FFFFFF',
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6,
                          boxShadow: `0 4px 10px ${colors.primary}40`
                        }}>
                          <Users size={14} color="#FFFFFF" />
                          <span style={{ fontSize: 10, fontWeight: 800 }}>{t('events_channel.tu_departamento')}</span>
                        </div>
                      )}
                    </div>

                    <ThemedText style={{ fontSize: 24, fontWeight: 900, marginBottom: 8, color: colors.text, lineHeight: 1.2 }}>{event.title}</ThemedText>
                    
                    <ThemedText style={{ fontSize: 16, color: colors.primary, fontWeight: 700, marginBottom: 12 }}>
                      {formatDate(event.date)}
                    </ThemedText>

                    <div style={{ marginBottom: 20, flex: 1 }}>
                      <ThemedText style={{ fontSize: 11, fontWeight: 900, color: colors.primary, textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                        {t('events_channel.description') || 'Descripción'}
                      </ThemedText>
                      <ThemedText style={{ fontSize: 14, color: colors.textSecondary, lineHeight: 1.6 }}>
                        {event.description || t('events_channel.no_desc')}
                      </ThemedText>
                    </div>

                    {/* RSVP Buttons Styled like mobile */}
                    {!isPast && (
                      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                        <button 
                          onClick={() => toggleRSVP(event.id, 'going')}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '12px',
                            borderRadius: 16,
                            backgroundColor: rsvp === 'going' ? '#34C759' : 'transparent',
                            color: rsvp === 'going' ? '#fff' : '#34C759',
                            border: `2px solid ${rsvp === 'going' ? '#34C759' : '#34C759'}`,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: 14,
                            transition: '0.2s'
                          }}
                        >
                          <CheckCircle2 size={18} />
                          {t('events_channel.status_going')}
                        </button>
                        <button 
                          onClick={() => toggleRSVP(event.id, 'not_going')}
                          style={{
                            flex: 1,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                            padding: '12px',
                            borderRadius: 16,
                            backgroundColor: rsvp === 'not_going' ? colors.danger : 'transparent',
                            color: rsvp === 'not_going' ? '#fff' : colors.danger,
                            border: `2px solid ${rsvp === 'not_going' ? colors.danger : colors.danger}`,
                            fontWeight: 800,
                            cursor: 'pointer',
                            fontSize: 14,
                            transition: '0.2s'
                          }}
                        >
                          <XCircle size={18} />
                          {t('events_channel.status_not_going')}
                        </button>
                      </div>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: colors.background, borderRadius: 12 }}>
                        <Users size={16} color={colors.textSecondary} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: colors.textSecondary }}>
                          {event.attendeesCount === 1 ? t('events_channel.confirmed_count_one') : t('events_channel.confirmed_count', { count: event.attendeesCount || 0 })}
                        </span>
                      </div>
                      
                      <button 
                        onClick={() => navigate('/tabs/campus', { state: { tab: 'calendario', selectedId: event.id } })}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: 'none',
                          border: 'none',
                          color: colors.primary,
                          fontWeight: 700,
                          cursor: 'pointer',
                          fontSize: 14,
                          padding: '8px'
                        }}
                      >
                         <Calendar size={18} />
                         {t('events_channel.view_calendar')}
                      </button>
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
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
