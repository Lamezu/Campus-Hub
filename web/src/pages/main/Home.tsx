import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import Layout from '../../components/Layout';
import { ChannelCard } from '../../components/ChannelCard';
import type { Channel } from '../../types';
import { Settings } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

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
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [navigate]);

  const handleChannelPress = (channel: Channel) => {
    navigate(`/chat/${channel.id}`);
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

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
            onClick={handleSettingsClick}
            style={{ fontSize: '24px' }}
          >
            <Settings />
          </button>
        </>
      }
    >
      <div style={{ padding: '0 16px' }}>
        <p className="text-subtitle" style={{ marginBottom: '16px' }}>
          Selecciona un canal para comenzar a chatear.
        </p>

        <div>
          {MOCK_CHANNELS.map((channel) => (
            <ChannelCard
              key={channel.id}
              channel={channel}
              onPress={() => handleChannelPress(channel)}
            />
          ))}
        </div>
      </div>
    </Layout>
  );
}