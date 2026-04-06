import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, limit, Timestamp } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import Layout from '../../components/Layout';
import { useEvents } from '../../hooks/useEvents';

const SUPPORT_CHANNEL_ID = '4';
const EVENTS_CHANNEL_ID = '3';
import { ChannelCard } from '../../components/ChannelCard';
import type { Channel, StudyGroup, CalendarEventType } from '../../types';
import { Settings, MessagesSquare, CodeXml, Folders, CalendarFold, MessageCircleQuestion, Users, BookOpen, Clock, PartyPopper, GraduationCap, AlertCircle, ChevronRight, type LucideIcon } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';

const EVENT_CONFIG: Record<CalendarEventType, { label: string; color: string }> = {
  exam:     { label: 'Examen',  color: '#FF3B30' },
  deadline: { label: 'Entrega', color: '#FF9500' },
  holiday:  { label: 'Festivo', color: '#34C759' },
  event:    { label: 'Evento',  color: '#007AFF' },
  class:    { label: 'Clase',   color: '#AF52DE' },
};

function EventIcon({ type, size = 13, color }: { type: CalendarEventType; size?: number; color: string }) {
  if (type === 'exam') return <BookOpen size={size} color={color} strokeWidth={2} />;
  if (type === 'deadline') return <Clock size={size} color={color} strokeWidth={2} />;
  if (type === 'holiday') return <PartyPopper size={size} color={color} strokeWidth={2} />;
  if (type === 'class') return <GraduationCap size={size} color={color} strokeWidth={2} />;
  return <AlertCircle size={size} color={color} strokeWidth={2} />;
}

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  'messages-square': MessagesSquare,
  'code-xml': CodeXml,
  'folders': Folders,
  'calendar-fold': CalendarFold,
  'message-circle-question': MessageCircleQuestion,
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 20) return 'Buenas tardes';
  return 'Buenas noches';
}

function studyGroupToChannel(g: StudyGroup): Channel {
  return {
    id: `sg_${g.id}`,
    name: g.name,
    description: `${g.subject} · ${g.memberCount} miembro${g.memberCount !== 1 ? 's' : ''}`,
    type: g.isPrivate ? 'private' : 'public',
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    memberCount: g.memberCount,
    lastMessageAt: null,
    departmentRestricted: false,
    allowedDepartments: [],
    photoURL: g.photoURL ?? null,
  };
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Channel[]>(MOCK_CHANNELS);
  const [channelUnreads, setChannelUnreads] = useState<Record<string, number>>(
    () => Object.fromEntries(MOCK_CHANNELS.map(ch => [ch.id, ch.unreadCount ?? 0]))
  );
  const [channelLastMessages, setChannelLastMessages] = useState<Record<string, string>>({});
  const [department, setDepartment] = useState<string | null>(null);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const isDesktop = useWindowSize();
  const { events: allEvents } = useEvents(department);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/login');
        setLoading(false);
        return;
      }
      setUser(currentUser);
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
          setDepartment(userDoc.data().department ?? null);
        }
      } catch {}
      finally { setLoading(false); }
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    const unsubs = MOCK_CHANNELS.map(ch =>
      onSnapshot(doc(db, 'channels', ch.id), snap => {
        if (!snap.exists()) return;
        const data = snap.data();
        setChannels(prev => prev.map(c =>
          c.id === ch.id
            ? { ...c, photoURL: data.photoURL ?? null, name: data.name ?? c.name, description: data.description ?? c.description, icon: data.icon ?? c.icon }
            : c
        ));
      })
    );
    return () => unsubs.forEach(u => u());
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    const q = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, snap => {
      setMyGroups(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? '',
          description: data.description ?? '',
          subject: data.subject ?? '',
          createdBy: data.createdBy ?? '',
          createdByName: data.createdByName ?? '',
          memberIds: data.memberIds ?? [],
          memberCount: data.memberCount ?? 0,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          color: data.color ?? '#007AFF',
          isPrivate: data.isPrivate ?? false,
          photoURL: data.photoURL ?? null,
        } as StudyGroup;
      }));
    }, (error) => {
    });
  }, [user?.uid]);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    let active = true;
    const unsubs: (() => void)[] = [];

    (async () => {
      for (const channel of MOCK_CHANNELS) {
        const memberSnap = await getDoc(doc(db, 'channels', channel.id, 'members', currentUser.uid));
        if (!active) return;
        const lastRead: Timestamp | null = memberSnap.exists() ? memberSnap.data().lastRead ?? null : null;

        const msgsQuery = query(
          collection(db, 'channels', channel.id, 'messages'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const unsub = onSnapshot(msgsQuery, snap => {
          const count = snap.docs.filter(d => {
            const data = d.data();
            if (data.senderId === currentUser.uid) return false;
            if (!lastRead) return false;
            const createdAt = data.createdAt as Timestamp;
            return createdAt && createdAt.seconds > lastRead.seconds;
          }).length;
          setChannelUnreads(prev => ({ ...prev, [channel.id]: count }));

          if (snap.docs.length > 0) {
            const last = snap.docs[0].data();
            const text = last.attachments?.length
              ? '📎 Archivo adjunto'
              : last.text || '';
            setChannelLastMessages(prev => ({ ...prev, [channel.id]: text }));
          }
        });
        unsubs.push(unsub);
      }
    })();

    return () => { active = false; unsubs.forEach(u => u()); };
  }, [user?.uid]);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (!user) return null;

  const displayName = userData?.displayName || user.displayName || 'User';
  const totalUnread = channels.reduce((sum, ch) => sum + (channelUnreads[ch.id] ?? 0), 0);
  const now = new Date();
  const upcomingEvents = allEvents
    .filter(ev => new Date(ev.date) >= now)
    .slice(0, 3);

  if (!isDesktop) {
    return (
      <Layout
        title={`Bienvenido, ${displayName}!`}
        rightAction={
          <>
            <NotificationBell categories={['channel', 'campus']} />
            <button className="settings-button" onClick={() => navigate('/settings')} style={{ fontSize: '24px' }}>
              <Settings />
            </button>
          </>
        }
      >
        <div style={{ padding: '0 16px' }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, padding: '12px 0 4px' }}>Canales</div>
            {channels.map((channel) => (
              <ChannelCard key={channel.id} channel={channel} onPress={() => channel.id === SUPPORT_CHANNEL_ID ? navigate('/support') : channel.id === EVENTS_CHANNEL_ID ? navigate('/events') : navigate(`/chat/${channel.id}`)} />
            ))}
          </div>
          {myGroups.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, padding: '12px 0 4px' }}>Mis grupos</div>
              {myGroups.map((group) => (
                <div key={group.id} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 36, borderRadius: '0 4px 4px 0', backgroundColor: group.color, zIndex: 1 }} />
                  <ChannelCard channel={studyGroupToChannel(group)} onPress={() => navigate(`/chat/sg_${group.id}`)} />
                </div>
              ))}
            </div>
          )}
          <div style={{ paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0 8px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary }}>Próximos eventos</div>
              <button onClick={() => navigate('/events')} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: colors.primary }}>Ver todos</span>
                <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
              </button>
            </div>
            {upcomingEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: colors.textSecondary }}>Sin eventos próximos</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcomingEvents.map(ev => {
                  const cfg = EVENT_CONFIG[ev.type];
                  return (
                    <div
                      key={ev.id}
                      onClick={() => navigate('/events')}
                      style={{ display: 'flex', overflow: 'hidden', borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.background, cursor: 'pointer' }}
                    >
                      <div style={{ width: 4, flexShrink: 0, backgroundColor: cfg.color }} />
                      <div style={{ flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 6, backgroundColor: cfg.color + '22' }}>
                            <EventIcon type={ev.type} color={cfg.color} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                          </div>
                        </div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{ev.title}</span>
                        <span style={{ fontSize: 12, color: colors.textSecondary }}>
                          {new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                          {ev.time ? ` · ${ev.time}` : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      title="Inicio"
      rightAction={
        <>
          <NotificationBell categories={['channel', 'campus']} />
          <button className="settings-button" onClick={() => navigate('/settings')} style={{ fontSize: '24px' }}>
            <Settings />
          </button>
        </>
      }
    >
      <div style={{ padding: '32px 32px 40px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        <div style={{
          borderRadius: 20,
          padding: '28px 32px',
          background: `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.primary}08 100%)`,
          border: `1px solid ${colors.primary}22`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: colors.text }}>
              {getGreeting()}, {displayName.split(' ')[0]}!
            </div>
            <div style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4 }}>
              {totalUnread > 0
                ? `Tienes ${totalUnread} mensaje${totalUnread !== 1 ? 's' : ''} sin leer`
                : 'Estás al día con todos los mensajes'}
            </div>
          </div>
          {(userData?.photoURL || user?.photoURL) ? (
            <img
              src={userData?.photoURL || user?.photoURL}
              alt=""
              style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${colors.primary}44` }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 800, color: '#fff',
            }}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>

          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 14 }}>
              Canales
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {channels.map((channel) => {
                const Icon = CHANNEL_ICONS[channel.icon ?? ''] ?? MessagesSquare;
                return (
                  <div
                    key={channel.id}
                    onClick={() => channel.id === SUPPORT_CHANNEL_ID ? navigate('/support') : channel.id === EVENTS_CHANNEL_ID ? navigate('/events') : navigate(`/chat/${channel.id}`)}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 16,
                      padding: '18px 20px',
                      cursor: 'pointer',
                      backgroundColor: colors.background,
                      display: 'flex', flexDirection: 'column', gap: 12,
                      transition: 'background-color 0.15s, border-color 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = colors.backgroundSecondary; e.currentTarget.style.borderColor = colors.primary + '66'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = colors.background; e.currentTarget.style.borderColor = colors.border; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: colors.primary + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {channel.photoURL
                          ? <img src={channel.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Icon size={20} color={colors.primary} strokeWidth={1.8} />
                        }
                      </div>
                      {(channelUnreads[channel.id] ?? 0) > 0 && (
                        <div style={{ backgroundColor: colors.primary, borderRadius: 10, minWidth: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 6px' }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{channelUnreads[channel.id]}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 3 }}>{channel.name}</div>
                      <div style={{ fontSize: 13, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel.description}</div>
                    </div>
                    {channelLastMessages[channel.id] && channel.id !== '3' && channel.id !== '4' && (
                      <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingTop: 8, borderTop: `1px solid ${colors.border}` }}>
                        {channelLastMessages[channel.id]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ width: 320, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 28 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary, marginBottom: 14 }}>
                Mis grupos
              </div>
              {myGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 24px', border: `1px dashed ${colors.border}`, borderRadius: 16, color: colors.textSecondary, fontSize: 14 }}>
                  <Users size={32} strokeWidth={1.2} color={colors.border} style={{ marginBottom: 8, display: 'block', margin: '0 auto 12px' }} />
                  No perteneces a ningún grupo todavía
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {myGroups.map((group) => (
                    <div
                      key={group.id}
                      onClick={() => navigate(`/chat/sg_${group.id}`)}
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderLeft: `4px solid ${group.color}`,
                        borderRadius: 14,
                        padding: '14px 18px',
                        cursor: 'pointer',
                        backgroundColor: colors.background,
                        display: 'flex', alignItems: 'center', gap: 14,
                        transition: 'background-color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.background)}
                    >
                      <div style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: group.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                        {group.photoURL
                          ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <Users size={18} color={group.color} strokeWidth={2} />
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{group.name}</div>
                        <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{group.subject} · {group.memberCount} miembro{group.memberCount !== 1 ? 's' : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: colors.textSecondary }}>
                  Próximos eventos
                </div>
                <button
                  onClick={() => navigate('/events')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2, padding: 0 }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: colors.primary }}>Ver todos</span>
                  <ChevronRight size={14} color={colors.primary} strokeWidth={2.5} />
                </button>
              </div>
              {upcomingEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 16px', border: `1px dashed ${colors.border}`, borderRadius: 16, color: colors.textSecondary, fontSize: 13 }}>
                  Sin eventos próximos
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {upcomingEvents.map(ev => {
                    const cfg = EVENT_CONFIG[ev.type];
                    return (
                      <div
                        key={ev.id}
                        onClick={() => navigate('/events')}
                        style={{ display: 'flex', overflow: 'hidden', borderRadius: 14, border: `1px solid ${colors.border}`, backgroundColor: colors.background, cursor: 'pointer', transition: 'background-color 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = colors.background)}
                      >
                        <div style={{ width: 4, flexShrink: 0, backgroundColor: cfg.color }} />
                        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, backgroundColor: cfg.color + '22', alignSelf: 'flex-start' }}>
                            <EventIcon type={ev.type} color={cfg.color} />
                            <span style={{ fontSize: 10, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>{ev.title}</span>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>
                            {new Date(ev.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}
                            {ev.time ? ` · ${ev.time}` : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </Layout>
  );
}
