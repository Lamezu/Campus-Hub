import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeToUserConversations, getOrCreateConversation, type Conversation, type ConversationUser } from '../../services/firebase/directMessageService';
import { getFriends } from '../../services/firebase/friendsService';
import { MessageCircle, Search, Plus, X, Clock } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';

interface ConversationWithUser extends Conversation {
  otherUserData?: ConversationUser;
}

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [starting, setStarting] = useState(false);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const userCacheRef = useRef<Record<string, ConversationUser>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUserId(user.uid);
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) return;

    const unsubscribe = subscribeToUserConversations(currentUserId, async (convs) => {
      const enriched: ConversationWithUser[] = await Promise.all(
        convs.map(async (conv) => {
          const otherId = conv.participants.find(id => id !== currentUserId);
          if (!otherId) return conv;

          if (userCacheRef.current[otherId]) {
            return { ...conv, otherUserData: userCacheRef.current[otherId] };
          }

          try {
            const snap = await getDoc(doc(db, 'users', otherId));
            if (snap.exists()) {
              const data = snap.data();
              const user: ConversationUser = {
                uid: otherId,
                displayName: data.displayName || 'Usuario',
                photoURL: data.photoURL || null,
                role: data.role
              };
              userCacheRef.current[otherId] = user;
              return { ...conv, otherUserData: user };
            }
          } catch {}

          return conv;
        })
      );
      setConversations(enriched);
    });

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !showNewChat) return;
    getFriends(currentUserId).then(setFriends).catch(() => {});
  }, [currentUserId, showNewChat]);

  const handleOpenConversation = async (friendId: string) => {
    if (!currentUserId || starting) return;
    setStarting(true);
    try {
      const convId = await getOrCreateConversation(currentUserId, friendId);
      navigate(`/messages/${convId}`);
    } catch {
    } finally {
      setStarting(false);
    }
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Ayer';
    } else if (days < 7) {
      return date.toLocaleDateString('es-ES', { weekday: 'short' });
    }
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  const filteredFriends = friends.filter(f =>
    f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Layout title="Mensajes" rightAction={<NotificationBell />}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 80px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 16px 12px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--background)',
          zIndex: 10,
          borderBottom: '1px solid var(--border)'
        }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
            Mensajes
          </h1>
          <button
            onClick={() => setShowNewChat(true)}
            style={{
              background: colors.primary,
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff'
            }}
          >
            <Plus size={20} />
          </button>
        </div>

        {conversations.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            gap: '16px'
          }}>
            <MessageCircle size={56} color={colors.primary} strokeWidth={1.5} />
            <p style={{ color: 'var(--text)', fontWeight: '600', fontSize: '18px', margin: 0 }}>
              Sin conversaciones
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, textAlign: 'center' }}>
              Inicia una conversación con un amigo
            </p>
            <button
              onClick={() => setShowNewChat(true)}
              style={{
                background: colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px 24px',
                fontSize: '15px',
                fontWeight: '600',
                cursor: 'pointer',
                marginTop: '8px'
              }}
            >
              Nueva conversación
            </button>
          </div>
        ) : (
          <div>
            {conversations.map((conv) => {
              const unread = conv.unreadCount?.[currentUserId!] || 0;
              const other = conv.otherUserData;
              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '50%',
                    backgroundColor: colors.primary,
                    flexShrink: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: '700',
                    color: '#fff'
                  }}>
                    {other?.photoURL ? (
                      <img src={other.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      other?.displayName?.[0]?.toUpperCase() || '?'
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{
                        fontWeight: unread > 0 ? '700' : '600',
                        color: 'var(--text)',
                        fontSize: '15px'
                      }}>
                        {other?.displayName || 'Usuario'}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: unread > 0 ? colors.primary : 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Clock size={11} />
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: '13px',
                      color: unread > 0 ? 'var(--text)' : 'var(--text-secondary)',
                      fontWeight: unread > 0 ? '500' : '400',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || 'Sin mensajes aún'}
                    </p>
                  </div>

                  {unread > 0 && (
                    <div style={{
                      backgroundColor: colors.primary,
                      color: '#fff',
                      borderRadius: '12px',
                      minWidth: '20px',
                      height: '20px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '0 6px',
                      flexShrink: 0
                    }}>
                      {unread > 99 ? '99+' : unread}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showNewChat && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
          onClick={() => setShowNewChat(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--background)',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '70vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)'
            }}>
              <span style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text)' }}>
                Nueva conversación
              </span>
              <button
                onClick={() => setShowNewChat(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'var(--background-secondary)',
                borderRadius: '10px',
                padding: '8px 14px'
              }}>
                <Search size={16} color="var(--text-secondary)" />
                <input
                  type="text"
                  placeholder="Buscar amigo..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    border: 'none',
                    background: 'none',
                    outline: 'none',
                    color: 'var(--text)',
                    fontSize: '15px',
                    flex: 1
                  }}
                  autoFocus
                />
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {filteredFriends.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 16px', fontSize: '14px' }}>
                  {friends.length === 0 ? 'Aún no tienes amigos' : 'Sin resultados'}
                </p>
              ) : (
                filteredFriends.map(friend => (
                  <div
                    key={friend.id}
                    onClick={() => handleOpenConversation(friend.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border)',
                      transition: 'background 0.15s'
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: colors.primary,
                      flexShrink: 0,
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: '700',
                      color: '#fff'
                    }}>
                      {friend.photoURL ? (
                        <img src={friend.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        friend.displayName?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div>
                      <p style={{ margin: 0, fontWeight: '600', color: 'var(--text)', fontSize: '15px' }}>
                        {friend.displayName}
                      </p>
                      {friend.role && (
                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {friend.role}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
