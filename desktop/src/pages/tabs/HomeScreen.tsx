import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChannelCard } from '@/components/ChannelCard';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Channel } from '@/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  const handleChannelPress = (channel: Channel) => {
    navigate(`/chat/${channel.id}`);
  };

  if (!user && !loading) return null;

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: spacing.lg,
        borderBottom: `1px solid ${colors.border}`,
        backgroundColor: colors.card,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <ThemedText type="title">
            Bienvenido, {userData?.displayName || user?.displayName || 'Usuario'}!
          </ThemedText>
          <button
            onClick={() => navigate('/settings')}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: spacing.sm,
              color: colors.text,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = colors.backgroundSecondary)}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Settings size={24} strokeWidth={1.8} />
          </button>
        </div>
        <ThemedText style={{ marginTop: spacing.xs, fontSize: typography.sizes.sm, opacity: 0.6, display: 'block' }}>
          Selecciona un canal para comenzar a chatear.
        </ThemedText>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: spacing.md,
      }}>
        {MOCK_CHANNELS.map((channel) => (
          <ChannelCard
            key={channel.id}
            channel={channel}
            onPress={() => handleChannelPress(channel)}
          />
        ))}
      </div>
    </ThemedView>
  );
}
