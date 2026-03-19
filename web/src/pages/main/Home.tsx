import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import Layout from '../../components/Layout';
import { ChannelCard } from '../../components/ChannelCard';
import type { Channel, StudyGroup } from '../../types';
import { Settings } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';
import { useTheme } from '../../contexts/ThemeContext';

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
  };
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { colors } = useTheme();

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
        if (userDoc.exists()) setUserData(userDoc.data());
      } catch {}
      finally { setLoading(false); }
    });
    return unsubscribe;
  }, [navigate]);

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
        } as StudyGroup;
      }));
    }, (error) => {
    });
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

  return (
    <Layout
      title={`Bienvenido, ${displayName}!`}
      rightAction={
        <>
          <NotificationBell />
          <button
            className="settings-button"
            onClick={() => navigate('/settings')}
            style={{ fontSize: '24px' }}
          >
            <Settings />
          </button>
        </>
      }
    >
      <div style={{ padding: '0 16px' }}>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, padding: '12px 0 4px' }}>
            Canales
          </div>
          {MOCK_CHANNELS.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onPress={() => navigate(`/chat/${channel.id}`)}
            />
          ))}
        </div>

        {myGroups.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: colors.textSecondary, padding: '12px 0 4px' }}>
              Mis grupos
            </div>
            {myGroups.map((group) => (
              <div key={group.id} style={{ position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: 4, height: 36, borderRadius: '0 4px 4px 0', backgroundColor: group.color, zIndex: 1 }} />
                <ChannelCard
                  channel={studyGroupToChannel(group)}
                  onPress={() => navigate(`/chat/sg_${group.id}`)}
                />
              </div>
            ))}
          </div>
        )}

      </div>
    </Layout>
  );
}
