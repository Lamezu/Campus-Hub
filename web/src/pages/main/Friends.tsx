import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import {
  getFriends,
  removeFriend,
  getBestFriendIds,
  toggleBestFriend,
  type FriendUser
} from '../../services/firebase/friendsService';
import { getOrCreateConversation } from '../../services/firebase/directMessageService';
import { Star, UserX, MessageCircle, Users } from 'lucide-react';


const UserStarIcon = ({ size = 24, color = 'currentColor' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="7" r="4" />
    <path d="M10.3 15H6a4 4 0 0 0-4 4v1" />
    <path d="m17.5 11.4-.9 2.7-2.9.1 2.3 1.7-.8 2.8 2.3-1.6 2.3 1.6-.8-2.8 2.3-1.7-2.9-.1z" fill={color} stroke="none" />
  </svg>
);

type Tab = 'friends' | 'best';

export default function Friends() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('friends');

  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [bestFriendIds, setBestFriendIds] = useState<string[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { colors } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      if (!user) { navigate('/login'); return; }
      setCurrentUserId(user.uid);
      setLoading(false);
    });
    return unsub;
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) return;
    setLoadingFriends(true);
    Promise.all([
      getFriends(currentUserId),
      getBestFriendIds(currentUserId)
    ])
      .then(([f, bids]) => {
        setFriends(f);
        setBestFriendIds(bids);
      })
      .catch(() => {})
      .finally(() => setLoadingFriends(false));
  }, [currentUserId]);

  const handleRemoveFriend = async (friendId: string) => {
    if (!currentUserId || !window.confirm('¿Eliminar a este amigo?')) return;
    setActionLoading(friendId);
    try {
      await removeFriend(currentUserId, friendId);
      setFriends(prev => prev.filter(f => f.id !== friendId));
      setBestFriendIds(prev => prev.filter(id => id !== friendId));
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const handleToggleBest = async (friendId: string) => {
    if (!currentUserId) return;
    setActionLoading('star_' + friendId);
    const isBest = bestFriendIds.includes(friendId);
    try {
      await toggleBestFriend(currentUserId, friendId, !isBest);
      setBestFriendIds(prev =>
        isBest ? prev.filter(id => id !== friendId) : [...prev, friendId]
      );
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const handleMessage = async (friendId: string) => {
    if (!currentUserId) return;
    setActionLoading('msg_' + friendId);
    try {
      const convId = await getOrCreateConversation(currentUserId, friendId);
      navigate(`/messages/${convId}`);
    } catch {
    } finally {
      setActionLoading(null);
    }
  };

  const Avatar = ({ photoURL, name, size = 44 }: { photoURL: string | null; name: string; size?: number }) => (
    <div style={{
      width: size, height: size, borderRadius: '50%', backgroundColor: colors.primary,
      flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontSize: size * 0.4, fontWeight: '700', color: '#fff'
    }}>
      {photoURL
        ? <img src={photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : name[0]?.toUpperCase() || '?'}
    </div>
  );

  const tabBtn = (t: Tab, label: string) => (
    <button
      onClick={() => setTab(t)}
      style={{
        flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer', fontSize: '14px',
        fontWeight: tab === t ? '700' : '500',
        color: tab === t ? colors.primary : 'var(--text-secondary)',
        backgroundColor: 'transparent',
        borderBottom: `2px solid ${tab === t ? colors.primary : 'transparent'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        transition: 'all 0.15s'
      }}
    >
      {t === 'best' && (
        <UserStarIcon
          size={16}
          color={tab === 'best' ? colors.primary : 'var(--text-secondary)'}
        />
      )}
      {label}
    </button>
  );

  const displayList = tab === 'best'
    ? friends.filter(f => bestFriendIds.includes(f.id))
    : friends;

  const renderEmpty = () => (
    <div style={{ textAlign: 'center', padding: '60px 24px' }}>
      {tab === 'best'
        ? <UserStarIcon size={48} color={colors.primary} />
        : <Users size={48} color={colors.primary} strokeWidth={1.5} style={{ margin: '0 auto 16px', display: 'block' }} />
      }
      <p style={{ color: 'var(--text)', fontWeight: '600', fontSize: '17px', margin: '0 0 8px' }}>
        {tab === 'best' ? 'Sin mejores amigos' : 'Sin amigos aún'}
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
        {tab === 'best'
          ? 'Marca amigos con ★ para añadirlos aquí'
          : 'Acepta solicitudes de amistad desde la campanita'}
      </p>
    </div>
  );

  if (loading) return <div className="loading-container"><div className="loading-spinner" /></div>;

  return (
    <Layout title="Amigos" showBackButton onBack={() => navigate('/profile')}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)', position: 'sticky', top: '56px', zIndex: 5 }}>
          {tabBtn('friends', 'Amigos')}
          {tabBtn('best', 'Mejores Amigos')}
        </div>

        {loadingFriends ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <div className="loading-spinner" />
          </div>
        ) : displayList.length === 0 ? renderEmpty() : (
          displayList.map(friend => (
            <div key={friend.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <Avatar photoURL={friend.photoURL} name={friend.displayName} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: '600', color: 'var(--text)', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {friend.displayName}
                </p>
                {friend.role && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>{friend.role}</p>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                <button
                  onClick={() => handleToggleBest(friend.id)}
                  disabled={actionLoading === 'star_' + friend.id}
                  style={{
                    padding: '8px', borderRadius: '10px',
                    backgroundColor: bestFriendIds.includes(friend.id) ? colors.primary + '20' : 'var(--background-secondary)',
                    border: 'none', cursor: 'pointer',
                    color: bestFriendIds.includes(friend.id) ? colors.primary : 'var(--text-secondary)',
                    display: 'flex'
                  }}
                  title={bestFriendIds.includes(friend.id) ? 'Quitar de mejores amigos' : 'Añadir a mejores amigos'}
                >
                  <Star size={18} fill={bestFriendIds.includes(friend.id) ? 'currentColor' : 'none'} />
                </button>
                <button
                  onClick={() => handleMessage(friend.id)}
                  disabled={actionLoading === 'msg_' + friend.id}
                  style={{ padding: '8px', borderRadius: '10px', backgroundColor: colors.primary + '20', border: 'none', cursor: 'pointer', color: colors.primary, display: 'flex' }}
                  title="Enviar mensaje"
                >
                  <MessageCircle size={18} />
                </button>
                <button
                  onClick={() => handleRemoveFriend(friend.id)}
                  disabled={actionLoading === friend.id}
                  style={{ padding: '8px', borderRadius: '10px', backgroundColor: 'var(--background-secondary)', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
                  title="Eliminar amigo"
                >
                  <UserX size={18} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}
