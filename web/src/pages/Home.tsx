import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { MOCK_CHANNELS } from '../constants/mockData';
import type { Channel } from '../types';

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

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
    <div>
      <header className="header">
        <div className="header-content">
          <div>
            <h1 className="text-title">Bienvenido, {displayName}!</h1>
            <p className="text-subtitle">
              Selecciona un canal para comenzar a chatear.
            </p>
          </div>
          <button 
            className="settings-button"
            onClick={() => navigate('/settings')}
          >
            ⚙️
          </button>
        </div>
      </header>

      <main className="container">
        <ul className="channels-list">
          {MOCK_CHANNELS.map((channel) => (
            <li
              key={channel.id}
              className="channel-item"
              onClick={() => handleChannelPress(channel)}
            >
              <div className="channel-icon">
                {channel.icon}
              </div>
              
              <div className="channel-info">
                <h3 className="channel-name">{channel.name}</h3>
                <p className="channel-description">{channel.description}</p>
              </div>
              
              <span className="channel-chevron">›</span>
            </li>
          ))}
        </ul>
      </main>

      
      <footer className="nav-footer">
        <ul className="nav-items">
          <li 
            className={`nav-item ${location.pathname === '/home' ? 'active' : ''}`}
            onClick={() => navigate('/home')}
          >
            <span className="nav-icon">🏠</span>
            <span>Home</span>
          </li>
          <li 
            className={`nav-item ${location.pathname === '/explore' ? 'active' : ''}`}
            onClick={() => navigate('/explore')}
          >
            <span className="nav-icon">🔍</span>
            <span>Explore</span>
          </li>
          <li 
            className={`nav-item ${location.pathname === '/create' ? 'active' : ''}`}
            onClick={() => navigate('/create')}
          >
            <span className="nav-icon">➕</span>
            <span>Create</span>
          </li>
          <li 
            className={`nav-item ${location.pathname === '/messages' ? 'active' : ''}`}
            onClick={() => navigate('/messages')}
          >
            <span className="nav-icon">💬</span>
            <span>Messages</span>
          </li>
          <li 
            className={`nav-item ${location.pathname === '/profile' ? 'active' : ''}`}
            onClick={() => navigate('/profile')}
          >
            <span className="nav-icon">👤</span>
            <span>Profile</span>
          </li>
        </ul>
      </footer>
    </div>
  );
}