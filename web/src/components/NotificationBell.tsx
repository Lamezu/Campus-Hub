import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Bell, MessageSquare, Heart, Users, Megaphone } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationsContext';
import { useTheme } from '../contexts/ThemeContext';
import type { NotificationItem, NotificationCategory } from '../types';

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function CategoryIcon({ category, color }: { category: NotificationCategory; color: string }) {
  const props = { size: 18, color, strokeWidth: 1.8 };
  if (category === 'dm') return <MessageSquare {...props} />;
  if (category === 'social') return <Heart {...props} />;
  if (category === 'friend') return <Users {...props} />;
  if (category === 'campus') return <Megaphone {...props} />;
  return <Bell {...props} />;
}

interface NotificationBellProps {
  categories?: NotificationCategory[];
}

export default function NotificationBell({ categories }: NotificationBellProps = {}) {
  const { notifications, pendingRequests, acceptRequest, rejectRequest, markRead, markAllRead } = useNotifications();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const bellRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [panelRect, setPanelRect] = useState<{ top: number; right: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [friendRequestItem, setFriendRequestItem] = useState<NotificationItem | null>(null);

  const filtered = categories
    ? notifications.filter(n => categories.includes(n.category))
    : notifications;
  const unreadCount = filtered.filter(n => !n.read).length;

  const handleBellClick = () => {
    if (!open && bellRef.current) {
      const r = bellRef.current.getBoundingClientRect();
      setPanelRect({ top: r.bottom + 8, right: window.innerWidth - r.right });
    }
    setOpen(o => !o);
  };

  const grouped = useMemo(() => {
    const groups: Record<string, NotificationItem[]> = {};
    filtered.forEach(n => {
      let key = n.id;
      if (n.category === 'dm' && n.meta?.conversationId) key = `dm_${n.meta.conversationId}`;
      else if (n.category === 'social' && n.meta?.postId) key = `social_${n.meta.postId}`;
      else if (n.category === 'channel' && n.meta?.channelId) key = `channel_${n.meta.channelId}`;
      else if (n.category === 'campus') key = 'campus_all';
      else if (n.category === 'friend' && n.meta?.fromUserId) key = `friend_${n.meta.fromUserId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(n);
    });

    return Object.values(groups)
      .map(items => {
        const latest = items[0];
        const unreadItems = items.filter(i => !i.read);
        const unread = unreadItems.length;
        let body = latest.body;
        if (items.length > 1) {
          if (latest.category === 'channel') body = `${unread > 0 ? unread : items.length} mensaje${items.length !== 1 ? 's' : ''} nuevo${items.length !== 1 ? 's' : ''}`;
          else if (latest.category === 'social') body = `${items.length} interacciones nuevas`;
          else if (latest.category === 'campus') body = `${items.length} anuncios`;
          else body = `${items.length} notificaciones nuevas`;
        }
        return {
          ...latest,
          allIds: items.map(i => i.id),
          read: unread === 0,
          count: items.length,
          body,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [filtered]);

  const handlePress = async (item: NotificationItem & { allIds: string[] }) => {
    await Promise.all(item.allIds.map(id => markRead(id)));

    if (item.category === 'friend') {
      if (item.meta?.isRequest === 'true' && item.meta?.fromUserId) {
        setFriendRequestItem(item);
      } else {
        setOpen(false);
        navigate('/friends');
      }
      return;
    }

    if (item.category === 'social' && item.meta?.postId) {
      setOpen(false);
      navigate(`/post/${item.meta.postId}`);
      return;
    }

    if (item.category === 'dm') {
      const dest = item.meta?.conversationId
        ? `/messages/${item.meta.conversationId}`
        : item.meta?.participantId
          ? `/messages/${item.meta.participantId}`
          : null;
      if (dest) { setOpen(false); navigate(dest); }
      return;
    }

    if (item.category === 'channel' && item.meta?.channelId) {
      setOpen(false);
      navigate(`/chat/${item.meta.channelId}`);
      return;
    }

    if (item.category === 'campus') {
      setOpen(false);
      navigate('/campus');
      return;
    }
  };

  const handleAccept = async () => {
    if (!friendRequestItem?.meta?.fromUserId) return;
    const req = pendingRequests.find(r => r.fromUserId === friendRequestItem.meta!.fromUserId);
    if (req) {
      setActionLoading(req.id);
      try { await acceptRequest(req); } catch {}
      setActionLoading(null);
    }
    setFriendRequestItem(null);
  };

  const panel = open && panelRect ? createPortal(
    <>
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1050 }}
        onClick={() => setOpen(false)}
      />
      <div style={{
        position: 'fixed',
        top: panelRect.top,
        right: panelRect.right,
        width: '340px',
        backgroundColor: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: '18px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        zIndex: 1051,
        overflow: 'hidden',
        maxHeight: 'calc(100vh - 80px)',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '13px 16px 12px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <span style={{ fontWeight: '700', fontSize: '15px', color: 'var(--text)' }}>
            Notificaciones
          </span>
          {unreadCount > 0 && (
            <button
              onClick={() => categories
                ? Promise.all(categories.map(c => markAllRead(c)))
                : markAllRead()
              }
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: colors.primary,
                padding: '2px 0',
              }}
            >
              Leer todo
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {grouped.length === 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '44px 16px',
              gap: '8px',
            }}>
              <Bell size={36} color="var(--text-secondary)" strokeWidth={1.4} />
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                No hay notificaciones
              </span>
            </div>
          ) : (
            grouped.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handlePress(item)}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '11px 16px',
                  borderBottom: idx < grouped.length - 1 ? '1px solid var(--border)' : 'none',
                  width: '100%',
                  backgroundColor: item.read ? 'transparent' : `${colors.primary}0D`,
                  border: 'none',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = `${colors.primary}14`; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = item.read ? 'transparent' : `${colors.primary}0D`; }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '18px',
                  backgroundColor: 'var(--background-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: '1px',
                }}>
                  <CategoryIcon category={item.category} color={colors.primary} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: item.read ? '500' : '700',
                    color: 'var(--text)',
                    lineHeight: '18px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginBottom: '2px',
                  }}>
                    {item.title}
                  </span>
                  <span style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontSize: '12px',
                    color: 'var(--text-secondary)',
                    lineHeight: '17px',
                  }}>
                    {item.body}
                  </span>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                  gap: '6px',
                  flexShrink: 0,
                  paddingTop: '1px',
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '16px', whiteSpace: 'nowrap' }}>
                    {timeAgo(item.createdAt)}
                  </span>
                  {!item.read && (
                    <div style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: colors.primary,
                    }} />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <button
        ref={bellRef}
        onClick={handleBellClick}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '6px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          color: 'var(--text)',
          borderRadius: '8px',
        }}
        aria-label="Notificaciones"
      >
        <Bell size={22} strokeWidth={1.8} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute',
            top: '0px',
            right: '0px',
            backgroundColor: '#FF3B30',
            color: '#fff',
            borderRadius: '10px',
            minWidth: '16px',
            height: '16px',
            fontSize: '9px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
            lineHeight: 1,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panel}

      {friendRequestItem && createPortal(
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1200,
            padding: '24px',
          }}
          onClick={() => setFriendRequestItem(null)}
        >
          <div
            style={{
              backgroundColor: 'var(--background)',
              borderRadius: '16px',
              padding: '24px',
              width: '100%',
              maxWidth: '360px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
            onClick={e => e.stopPropagation()}
          >
            <span style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text)' }}>
              Solicitud de amistad
            </span>
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '22px' }}>
              <strong>{friendRequestItem.meta?.fromUserName ?? 'Alguien'}</strong> quiere ser tu amigo/a.
            </span>
            <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
              <button
                onClick={() => setFriendRequestItem(null)}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid var(--border)',
                  backgroundColor: 'var(--background-secondary)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Rechazar
              </button>
              <button
                onClick={handleAccept}
                disabled={actionLoading !== null}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: colors.primary,
                  color: '#fff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  opacity: actionLoading !== null ? 0.6 : 1,
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
