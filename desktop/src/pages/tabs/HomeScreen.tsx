import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Hash, Users, Sparkles, Plus } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChannelCard } from '@/components/ChannelCard';
import { NotificationBell } from '@/components/NotificationBell';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, collection, query } from 'firebase/firestore';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useStudyGroups } from '@/hooks/useStudyGroups';
import { subscribeToChannelUnread } from '@/services/channelReadService';
import type { Channel, StudyGroup } from '@/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [dbChannels, setDbChannels] = useState<Record<string, any>>({});
  const { groups } = useStudyGroups();

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
    const q = query(collection(db, 'channels'));
    const unsub = onSnapshot(q, snap => {
      const map: Record<string, any> = {};
      snap.docs.forEach(d => map[d.id] = d.data());
      setDbChannels(map);
    });
    return unsub;
  }, []);

  // Handle unread counts
  useEffect(() => {
    if (!user?.uid) return;

    const channelsToTrack = [...MOCK_CHANNELS.map(c => c.id), ...groups.map(g => g.id)];
    const unsubs: Array<() => void> = [];

    channelsToTrack.forEach(id => {
      const unsub = subscribeToChannelUnread(id, user.uid, (count) => {
        setUnreadCounts(prev => ({ ...prev, [id]: count }));
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [user?.uid, groups.length]);

  const handleChannelPress = (channel: any) => {
    navigate(`/chat/${channel.id}`);
  };

  // Filter groups the user is a member of
  const myGroups = groups.filter(g => g.memberIds.includes(user?.uid || ''));

  if (!user && !loading) return null;

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column', backgroundColor: colors.background }}>
      {/* Header */}
      <div style={{
        padding: '32px 40px',
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
        background: `linear-gradient(135deg, ${colors.card} 0%, ${colors.backgroundSecondary} 100%)`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <ThemedText style={{ fontSize: 32, fontWeight: 800, color: colors.text, letterSpacing: '-0.5px', display: 'block' }}>
              ¡Hola, {userData?.displayName || user?.displayName || 'Usuario'}!
            </ThemedText>
            <ThemedText style={{ marginTop: 4, fontSize: 16, color: colors.textSecondary, fontWeight: 500, display: 'block' }}>
              ¿Qué tal va el día de hoy?
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
        {/* Canales Section */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 12, 
              backgroundColor: colors.primary + '15', 
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Hash size={20} color={colors.primary} />
            </div>
            <ThemedText style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>Canales</ThemedText>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
            {MOCK_CHANNELS.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={{ 
                  ...channel, 
                  name: dbChannels[channel.id]?.name || dbChannels[channel.id]?.displayName || channel.name,
                  photoURL: dbChannels[channel.id]?.photoURL || channel.photoURL,
                  description: dbChannels[channel.id]?.description || channel.description,
                  unreadCount: unreadCounts[channel.id] || 0 
                }}
                onPress={() => handleChannelPress(channel)}
              />
            ))}
          </div>
        </section>

        {/* Mis Canales (Study Groups) Section */}
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
              <ThemedText style={{ fontSize: 20, fontWeight: 800, color: colors.text }}>Grupos</ThemedText>
            </div>
            {myGroups.length > 0 && (
              <span style={{ fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>{myGroups.length} grupos</span>
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
                Aún no te has unido a ningún grupo de estudio
              </ThemedText>
              <button 
                onClick={() => navigate('/campus', { state: { tab: 'Grupos' } })}
                style={{
                  padding: '10px 24px', borderRadius: 12,
                  backgroundColor: colors.primary, color: '#fff',
                  border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: 14
                }}
              >
                Explorar Grupos
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
              {myGroups.map((group) => (
                <ChannelCard
                  key={group.id}
                  channel={{
                    id: group.id,
                    name: group.name,
                    description: group.subject,
                    icon: 'users',
                    photoURL: group.photoURL,
                    unreadCount: unreadCounts[group.id] || 0,
                  } as any}
                  accentColor={group.color}
                  onPress={() => handleChannelPress(group)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </ThemedView>
  );
}
