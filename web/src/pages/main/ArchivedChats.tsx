import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeToUserConversations, subscribeToContactSettings, setConversationArchived, type Conversation, type ConversationUser } from '../../services/firebase/directMessageService';
import { Archive, Clock, ArchiveX, ArrowLeft, BellOff } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

interface ConversationWithUser extends Conversation {
  otherUserData?: ConversationUser;
}

export default function ArchivedChats() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [contactSettings, setContactSettings] = useState<Record<string, { archived?: boolean; muted?: boolean; mute?: string }>>({});
  const [contextMenu, setContextMenu] = useState<{ convId: string; otherId: string; x: number; y: number } | null>(null);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const userCacheRef = useRef<Record<string, ConversationUser>>({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { navigate('/login'); return; }
      setCurrentUserId(user.uid);
      setLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!currentUserId) return;
    const unsubscribe = subscribeToContactSettings(currentUserId, setContactSettings);
    return unsubscribe;
  }, [currentUserId]);

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

  const getOtherId = (conv: ConversationWithUser) =>
    conv.participants.find(id => id !== currentUserId) || '';

  const archivedConversations = conversations.filter(c => contactSettings[getOtherId(c)]?.archived);

  const handleUnarchive = async (otherId: string) => {
    if (!currentUserId) return;
    setContextMenu(null);
    await setConversationArchived(currentUserId, otherId, false);
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Ayer';
    if (days < 7) return date.toLocaleDateString('es-ES', { weekday: 'short' });
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Layout title={t('dm.archived_title')}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '0 0 80px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '20px 16px 12px',
          position: 'sticky',
          top: 0,
          backgroundColor: 'var(--background)',
          zIndex: 10,
          borderBottom: '1px solid var(--border)'
        }}>
          <button
            onClick={() => navigate('/messages')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: 'var(--text)', borderRadius: '8px', flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: 'var(--text)', margin: 0 }}>
            {t('dm.archived_title')}
          </h1>
        </div>

        {contextMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 998 }}
              onClick={() => setContextMenu(null)}
            />
            <div
              className="animate-scale-in"
              style={{
                position: 'fixed',
                top: contextMenu.y,
                left: contextMenu.x,
                zIndex: 999,
                backgroundColor: 'var(--background)',
                borderRadius: '12px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                border: '1px solid var(--border)',
                overflow: 'hidden',
                minWidth: '180px'
              }}
            >
              <button
                onClick={() => handleUnarchive(contextMenu.otherId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 16px',
                  width: '100%',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: '500',
                  textAlign: 'left'
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ArchiveX size={16} color="var(--text-secondary)" />
                Desarchivar
              </button>
            </div>
          </>
        )}

        {archivedConversations.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '80px 24px',
            gap: '16px'
          }}>
            <Archive size={56} color="var(--text-secondary)" strokeWidth={1.5} />
            <p style={{ color: 'var(--text)', fontWeight: '600', fontSize: '18px', margin: 0 }}>
              {t('dm.no_archived')}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, textAlign: 'center' }}>
              {t('dm.no_archived_desc')}
            </p>
          </div>
        ) : (
          <div>
            {archivedConversations.map((conv) => {
              const unread = conv.unreadCount?.[currentUserId!] || 0;
              const other = conv.otherUserData;
              const otherId = getOtherId(conv);
              const isMuted = !!(contactSettings[otherId]?.muted || (contactSettings[otherId]?.mute && contactSettings[otherId].mute !== 'off'));
              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  onContextMenu={e => {
                    e.preventDefault();
                    const x = Math.min(e.clientX, window.innerWidth - 200);
                    const y = Math.min(e.clientY, window.innerHeight - 80);
                    setContextMenu({ convId: conv.id, otherId, x, y });
                  }}
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
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                        <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {other?.displayName || 'Usuario'}
                        </span>
                        {isMuted && <BellOff size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                        marginLeft: '6px'
                      }}>
                        <Clock size={11} />
                        {formatTime(conv.lastMessageAt)}
                      </span>
                    </div>
                    <p style={{
                      margin: '2px 0 0',
                      fontSize: '13px',
                      color: 'var(--text-secondary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || t('dm.no_messages')}
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
    </Layout>
  );
}
