import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle, BookOpen, CalendarDays, Check,
  Clock, GraduationCap, PartyPopper, Users, X,
} from 'lucide-react';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { useTranslation } from '../../hooks/useTranslation';
import { useEvents } from '../../hooks/useEvents';
import { auth, db } from '../../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { DEPARTMENTS } from '../../constants/departments';
import type { CalendarEventType } from '../../types';

function EventIcon({ type, size = 14, color }: { type: CalendarEventType; size?: number; color: string }) {
  if (type === 'exam') return <BookOpen size={size} color={color} strokeWidth={2} />;
  if (type === 'deadline') return <Clock size={size} color={color} strokeWidth={2} />;
  if (type === 'holiday') return <PartyPopper size={size} color={color} strokeWidth={2} />;
  if (type === 'class') return <GraduationCap size={size} color={color} strokeWidth={2} />;
  return <AlertCircle size={size} color={color} strokeWidth={2} />;
}

function formatEventDate(date: string, time: string | null | undefined, allDay: boolean, language: string = 'es'): string {
  const d = new Date(date);
  const locale = language === 'en' ? 'en-US' : 'es-ES';
  const dateStr = d.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  if (allDay || !time) return dateStr;
  return `${dateStr} · ${time}`;
}

type FilterType = CalendarEventType | 'all';

export default function Events() {
  const { colors } = useTheme();
  const isDesktop = useWindowSize();
  const navigate = useNavigate();
  const { t, language } = useTranslation();

  const EVENT_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
    exam:     { label: t('events.types.exam'),     color: '#FF3B30' },
    deadline: { label: t('events.types.deadline'), color: '#FF9500' },
    holiday:  { label: t('events.types.holiday'),  color: '#34C759' },
    event:    { label: t('events.types.event'),    color: '#007AFF' },
    class:    { label: t('events.types.class'),    color: '#AF52DE' },
  };

  const FILTERS: { id: FilterType; label: string }[] = [
    { id: 'all', label: t('events.filter_all') },
    { id: 'event', label: t('events.types.event') },
    { id: 'exam', label: t('events.types.exam') },
    { id: 'deadline', label: t('events.types.deadline') },
    { id: 'holiday', label: t('events.types.holiday') },
    { id: 'class', label: t('events.types.class') },
  ];
  const [role, setRole] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const { events, rsvpMap, rsvp, loading } = useEvents(role);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then(snap => {
      if (snap.exists()) setRole(snap.data().role ?? 'student');
    });
  }, []);

  const filtered = useMemo(() =>
    activeFilter === 'all' ? events : events.filter(e => e.type === activeFilter),
    [events, activeFilter]
  );

  const filterBar = (
    <div style={{
      display: 'flex', gap: 8, padding: '12px 16px',
      borderBottom: `1px solid ${colors.border}`, overflowX: 'auto',
      flexShrink: 0,
    }}>
      {FILTERS.map(f => {
        const active = activeFilter === f.id;
        return (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            style={{
              flexShrink: 0, borderRadius: 20, padding: '7px 14px',
              border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              backgroundColor: active ? colors.primary : 'rgba(120,120,128,0.12)',
              color: active ? '#fff' : colors.textSecondary,
            }}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );

  const eventList = (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', border: `3px solid ${colors.backgroundSecondary}`, borderTopColor: colors.primary, animation: 'spin 0.8s linear infinite' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 32px', gap: 12 }}>
          <CalendarDays size={52} color={colors.textSecondary} strokeWidth={1.2} />
          <span style={{ fontSize: 17, fontWeight: 600, color: colors.text, textAlign: 'center' }}>
            {t('events.empty_title')}
          </span>
          <span style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: '22px' }}>
            {t('events.no_events_body')}
          </span>
        </div>
      ) : (
        <div style={{ padding: isDesktop ? '20px 24px' : '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, maxWidth: isDesktop ? 800 : undefined, margin: isDesktop ? '0 auto' : undefined, width: '100%', boxSizing: 'border-box' }}>
          {filtered.map(ev => {
            const cfg = EVENT_CONFIG[ev.type];
            const isPast = new Date(ev.date) < new Date();
            const myRsvp = rsvpMap[ev.id] ?? null;
            return (
              <div
                key={ev.id}
                style={{
                  borderRadius: 16, border: `1px solid ${colors.border}`,
                  backgroundColor: colors.background,
                  display: 'flex', overflow: 'hidden',
                }}
              >
                <div style={{ width: 4, flexShrink: 0, backgroundColor: cfg.color }} />
                <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, backgroundColor: cfg.color + '22' }}>
                      <EventIcon type={ev.type} size={12} color={cfg.color} />
                      <span style={{ fontSize: 11, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    {ev.departmentId && (() => {
                      const dept = DEPARTMENTS.find(d => d.id === ev.departmentId);
                      const deptLabel = dept ? (language === 'en' ? dept.en : dept.es) : ev.departmentId;
                      return (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 8, backgroundColor: colors.backgroundSecondary }}>
                          <Users size={10} color={colors.textSecondary} strokeWidth={2} />
                          <span style={{ fontSize: 11, fontWeight: 500, color: colors.textSecondary }}>{deptLabel}</span>
                        </div>
                      );
                    })()}
                  </div>

                  <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, lineHeight: '20px' }}>
                    {ev.title}
                  </div>

                  <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: '16px' }}>
                    {formatEventDate(ev.date, ev.time, ev.allDay, language)}
                  </div>

                  {!!ev.description && (
                    <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: '20px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {ev.description}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                    <button
                      onClick={() => navigate('/campus?tab=calendar')}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <CalendarDays size={13} color={colors.primary} strokeWidth={2} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: colors.primary }}>{t('events.view_in_calendar')}</span>
                    </button>

                    {!isPast && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {ev.attendeesCount > 0 && (
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>{t('events.going', { count: ev.attendeesCount })}</span>
                        )}
                        <button
                          className="btn-press"
                          onClick={() => rsvp(ev.id, 'going')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 20,
                            border: '1.5px solid #34C759',
                            backgroundColor: myRsvp === 'going' ? '#34C759' : 'transparent',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            color: myRsvp === 'going' ? '#fff' : '#34C759',
                          }}
                        >
                          <Check size={13} color={myRsvp === 'going' ? '#fff' : '#34C759'} strokeWidth={2.5} />
                          {t('events.rsvp_going')}
                        </button>
                        <button
                          className="btn-press"
                          onClick={() => rsvp(ev.id, 'not_going')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '5px 10px', borderRadius: 20,
                            border: '1.5px solid #FF3B30',
                            backgroundColor: myRsvp === 'not_going' ? '#FF3B30' : 'transparent',
                            cursor: 'pointer', fontSize: 12, fontWeight: 600,
                            color: myRsvp === 'not_going' ? '#fff' : '#FF3B30',
                          }}
                        >
                          <X size={13} color={myRsvp === 'not_going' ? '#fff' : '#FF3B30'} strokeWidth={2.5} />
                          {t('events.rsvp_not_going')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <Layout title={t('events.title')} showBackButton>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {filterBar}
        {eventList}
      </div>
    </Layout>
  );
}
