import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Hash, Users, Sparkles } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChannelCard } from '@/components/ChannelCard';
import { NotificationBell } from '@/components/NotificationBell';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, collection, query, orderBy } from 'firebase/firestore';
import { useTheme } from '@/contexts/ThemeContext';
import { useStudyGroups } from '@/hooks/useStudyGroups';
import { subscribeToChannelUnread } from '@/services/channelReadService';
import { useTranslation } from '@/contexts/LanguageContext';
import type { Channel, UserRole } from '@/types';
import { subscribeToIncomingConferences, createConference } from '@/services/studyGroupConferenceService';
import { useCall } from '@/contexts/CallContext';
import { Video, Phone, Users as UsersIcon } from 'lucide-react';

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [channels, setChannels] = useState<Channel[]>([]);
  const { groups } = useStudyGroups();
  const { setActiveConference, setActiveConferenceId, activeConference } = useCall();
  const [activeConferences, setActiveConferences] = useState<any[]>([]);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        navigate('/auth/login', { replace: true });
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const userRef = doc(db, 'users', currentUser.uid);
      unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
        }
        setLoading(false);
      }, (error) => {
        console.error('Error listening to user data:', error);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [navigate]);

  useEffect(() => {
    const q = query(collection(db, 'channels'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, snap => {
      const loaded: Channel[] = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
      } as Channel));
      setChannels(loaded);
    }, err => {
      if (err.code !== 'permission-denied') console.error('Error loading channels:', err);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToIncomingConferences(user.uid, (conference) => {
      // For the home screen, we might want to see ALL active conferences in our groups, 
      // not just "incoming" ones. But subscribeToIncomingConferences is a good start.
      // Actually, let's just use it to show a "Join" button if one is active.
      setActiveConferences(conference ? [conference] : []);
    });
    return unsub;
  }, [user?.uid]);

  const handleStartConference = async (group: any, type: 'audio' | 'video') => {
    if (!user) return;
    const members = group.memberIds || [user.uid];
    const participantData: Record<string, any> = {};
    members.forEach((m: string) => {
      participantData[m] = {
        name: m === user.uid ? (userData?.displayName || user.displayName || 'User') : 'Member',
        photo: m === user.uid ? (userData?.photoURL || user.photoURL || null) : null
      };
    });

    const callId = await createConference(
      group.id, group.name, group.photoURL || null,
      user.uid,
      userData?.displayName || user.displayName || 'Usuario',
      userData?.photoURL || user.photoURL || null,
      type, members, participantData
    );
    setActiveConferenceId(callId);
    setActiveConference({
      callId, groupName: group.name, groupPhoto: group.photoURL || null,
      myUid: user.uid,
      myName: userData?.displayName || user.displayName || 'Usuario',
      myPhoto: userData?.photoURL || user.photoURL || null,
      isInitiator: true, type
    } as any);
  };

  useEffect(() => {
    if (!user?.uid || channels.length === 0) return;

    const channelsToTrack = [...channels.map(c => c.id), ...groups.map(g => `sg_${g.id}`)];
    const unsubs: Array<() => void> = [];

    channelsToTrack.forEach(id => {
      const unsub = subscribeToChannelUnread(id, user.uid, (count) => {
        setUnreadCounts(prev => ({ ...prev, [id]: count }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user?.uid, channels.length, groups.length]);

  const handleChannelPress = (channel: any) => {
    navigate(`/chat/${channel.id}`);
  };

  const myGroups = groups.filter(g => g.memberIds.includes(user?.uid || ''));

  if (!user && !loading) return null;

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      <div style={{
        padding: '32px 40px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        background: `linear-gradient(135deg, ${colors.card} 0%, ${colors.backgroundSecondary} 100%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <ThemedText style={{ fontSize: 32, fontWeight: 800, color: colors.text, letterSpacing: '-0.5px', display: 'block' }}>
              {t('home.greeting', { name: userData?.displayName || user?.displayName || 'Usuario' })}
            </ThemedText>
            <ThemedText style={{ marginTop: 4, fontSize: 16, color: colors.textSecondary, fontWeight: 500, display: 'block' }}>
              {t('home.question')}
            </ThemedText>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell category="channel" />
            <button
              onClick={() => navigate('/settings')}
              style={{
                background: 'none',
                border: `1px solid ${colors.border}`,
                cursor: 'pointer',
                width: 48, height: 48,
                color: colors.text,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 16,
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                backgroundColor: colors.background,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.backgroundColor = colors.backgroundSecondary;
                e.currentTarget.style.transform = 'rotate(30deg) scale(1.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.backgroundColor = colors.background;
                e.currentTarget.style.transform = 'rotate(0) scale(1)';
              }}
            >
              <Settings size={24} strokeWidth={1.8} />
            </button>
          </div>
        </div>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '32px 40px',
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}>
        {activeConferences.length > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 12, 
                backgroundColor: '#22c55e15', 
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Video size={20} color="#22c55e" />
              </div>
              <ThemedText style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>Sesiones en vivo</ThemedText>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: 16 }}>
              {activeConferences.map(conf => (
                <div key={conf.id} style={{ 
                  padding: '20px 24px', backgroundColor: colors.card, borderRadius: 24, 
                  border: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.05)'
                }}>
                  <div style={{ position: 'relative' }}>
                    {conf.groupPhoto ? (
                      <img src={conf.groupPhoto} alt="" style={{ width: 56, height: 56, borderRadius: 18, objectFit: 'cover' }} />
                    ) : (
                      <div style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <UsersIcon size={24} color={colors.textSecondary} />
                      </div>
                    )}
                    <div style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#22c55e', border: `3px solid ${colors.card}`, animation: 'livePulse 1.5s infinite' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ fontSize: 17, fontWeight: 800, display: 'block' }}>{conf.groupName}</ThemedText>
                    <ThemedText style={{ fontSize: 13, color: colors.textSecondary, opacity: 0.8 }}>Conferencia de {conf.type === 'video' ? 'video' : 'voz'} activa</ThemedText>
                  </div>
                  <button 
                    onClick={() => navigate(`/chat/sg_${conf.groupId}`)}
                    style={{ 
                      padding: '10px 24px', borderRadius: 14, backgroundColor: '#22c55e', color: '#fff', 
                      border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14,
                      boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
                    }}
                  >
                    Unirse ahora
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 12, 
              backgroundColor: colors.primary + '15', 
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Hash size={20} color={colors.primary} />
            </div>
            <ThemedText style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>{t('home.channels_title')}</ThemedText>
          </div>
          
          {channels.length === 0 && !loading ? (
            <div style={{ 
              padding: '40px', textAlign: 'center', 
              backgroundColor: colors.backgroundSecondary, 
              borderRadius: 24, border: `2px dashed ${colors.border}`,
            }}>
              <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{t('home.no_channels')}</ThemedText>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {channels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={{ 
                    ...channel,
                    unreadCount: unreadCounts[channel.id] || 0 
                  }}
                  onPress={() => handleChannelPress(channel)}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ 
                width: 40, height: 40, borderRadius: 12, 
                backgroundColor: '#AF52DE15', 
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Users size={20} color="#AF52DE" />
              </div>
              <ThemedText style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>{t('home.groups_title')}</ThemedText>
            </div>
            {myGroups.length > 0 && (
              <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>{t('home.groups_count', { count: myGroups.length })}</span>
            )}
          </div>

          {myGroups.length === 0 ? (
            <div style={{ 
              padding: '60px', textAlign: 'center', 
              backgroundColor: colors.backgroundSecondary, 
              borderRadius: 24, border: `2px dashed ${colors.border}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16
            }}>
              <Sparkles size={32} color={colors.textSecondary} opacity={0.5} />
              <ThemedText style={{ color: colors.textSecondary, fontSize: 16, fontWeight: 600 }}>
                {t('home.no_groups')}
              </ThemedText>
              <button 
                onClick={() => navigate('/campus', { state: { tab: 'grupos' } })}
                style={{
                  padding: '10px 24px', borderRadius: 12,
                  backgroundColor: colors.primary, color: '#fff',
                  border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14
                }}
              >
                {t('home.explore_groups_btn')}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {myGroups.map((group) => (
                <div key={group.id} style={{ position: 'relative' }}>
                  <ChannelCard
                    channel={{
                      id: `sg_${group.id}`,
                      name: group.name,
                      description: group.subject,
                      icon: 'users',
                      photoURL: group.photoURL,
                      unreadCount: unreadCounts[`sg_${group.id}`] || 0,
                    } as any}
                    accentColor={group.color}
                    onPress={() => navigate(`/chat/sg_${group.id}`)}
                  />
                  {(userData?.role === 'teacher' || userData?.role === 'admin') && (
                    <div style={{ position: 'absolute', top: '50%', right: 48, transform: 'translateY(-50%)', display: 'flex', gap: 8, zIndex: 10 }}>
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleStartConference(group, 'video'); }}
                        title={t('conference.start_btn')}
                        style={{ 
                          height: 36, 
                          padding: '0 12px',
                          borderRadius: 10, 
                          backgroundColor: 'rgba(255,255,255,0.1)', 
                          border: `1px solid rgba(255,255,255,0.1)`, 
                          color: '#fff', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center', 
                          gap: 8,
                          backdropFilter: 'blur(10px)',
                          fontSize: 12,
                          fontWeight: 600,
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                        onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                      >
                        <Video size={16} />
                        <span>Conferencia</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <style>{`
        @keyframes livePulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }
      `}</style>
    </ThemedView>
  );
}
