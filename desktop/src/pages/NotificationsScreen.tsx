import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Bell, MessageSquare, Heart, Users, Megaphone, Check } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';
import { notificationService } from '@/services/notificationService';
import { acceptFriendRequest } from '@/services/friendsService';
import { auth } from '@/config/firebase';
import type { NotificationItem, NotificationCategory } from '@/types';

function timeAgo(date: any): string {
  if (!date) return '';
  const timestamp = typeof date === 'string' ? new Date(date).getTime() : 
                    date.toDate ? date.toDate().getTime() : 
                    date.seconds ? date.seconds * 1000 : new Date(date).getTime();
  
  if (isNaN(timestamp)) return '';
  
  const diff = (Date.now() - timestamp) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function CategoryIcon({ category, color }: { category: NotificationCategory; color: string }) {
  const size = 20;
  if (category === 'dm') return <MessageSquare size={size} color={color} />;
  if (category === 'social') return <Heart size={size} color={color} />;
  if (category === 'friend') return <Users size={size} color={color} />;
  if (category === 'campus') return <Megaphone size={size} color={color} />;
  return <Bell size={size} color={color} />;
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const categoryFilter = searchParams.get('category') as NotificationCategory | null;
  const categoriesFilter = searchParams.get('categories')?.split(',') as NotificationCategory[] | null;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [friendRequestItem, setFriendRequestItem] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const update = () => {
      let all = [...notificationService.getAll()];
      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      if (categoriesFilter) {
        setNotifications(all.filter(n => categoriesFilter.includes(n.category)));
      } else if (categoryFilter) {
        setNotifications(all.filter(n => n.category === categoryFilter));
      } else {
        setNotifications(all);
      }
    };
    update();
    const unsub = notificationService.subscribe(update);
    
    if (categoriesFilter) {
      categoriesFilter.forEach(cat => notificationService.markAllRead(cat));
    } else {
      notificationService.markAllRead(categoryFilter || undefined);
    }
    
    return unsub;
  }, [categoryFilter, categoriesFilter]);

  const handleMarkAllRead = useCallback(async () => {
    if (categoriesFilter) {
      await Promise.all(categoriesFilter.map(cat => notificationService.markAllRead(cat)));
    } else {
      await notificationService.markAllRead(categoryFilter || undefined);
    }
  }, [categoryFilter, categoriesFilter]);

  const handlePress = useCallback((item: NotificationItem) => {
    notificationService.markRead(item.id);
    if (item.category === 'friend' && item.meta?.isRequest === 'true') {
      setFriendRequestItem(item);
      return;
    }
    if (item.category === 'dm' && item.meta?.participantId) {
      navigate(`/dm/${item.meta.participantId}`);
    } else if (item.category === 'channel' && item.meta?.channelId) {
      navigate(`/chat/${item.meta.channelId}`);
    } else if (item.category === 'campus') {
      const type = item.meta?.type;
      const hasEventId = !!(item.meta?.eventId || item.meta?.linkedEventId);
      const tab = (type === 'event' || hasEventId) ? 'calendario' : 'tablon';
      
      const parsedId = item.meta?.eventId || item.meta?.announcementId || item.meta?.id || item.meta?.linkedEventId || item.meta?.linkedAnnouncementId || item.meta?.postId;
      navigate('/tabs/campus', { state: { tab, selectedId: parsedId } });
    } else if (item.category === 'social' && item.meta?.postId) {
      navigate(`/post/${item.meta.postId}`);
    }
  }, [navigate]);

  const handleAcceptRequest = useCallback(async () => {
    const fromUserId = friendRequestItem?.meta?.fromUserId;
    const meId = auth.currentUser?.uid;
    if (!fromUserId || !meId) return;
    
    setFriendRequestItem(null);
    try {
      const { getFriendRequest } = await import('@/services/friendsService');
      const req = await getFriendRequest(fromUserId, meId);
      if (req) await acceptFriendRequest(req.id);
    } catch(e) {}
  }, [friendRequestItem]);

  const handleRejectRequest = useCallback(async () => {
    const fromUserId = friendRequestItem?.meta?.fromUserId;
    const meId = auth.currentUser?.uid;
    if (!fromUserId || !meId) return;
    
    setFriendRequestItem(null);
    try {
      const { getFriendRequest, rejectFriendRequest } = await import('@/services/friendsService');
      const req = await getFriendRequest(fromUserId, meId);
      if (req) await rejectFriendRequest(req.id);
    } catch(e) {}
  }, [friendRequestItem]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: `${spacing.sm}px ${spacing.md}px`, borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.background, flexShrink: 0,
        }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: colors.text, display: 'flex' }}>
            <ChevronLeft size={24} />
          </button>
          <ThemedText style={{ fontWeight: '700', fontSize: 16 }}>
            {categoriesFilter ? 'Notificaciones' : categoryFilter ? `Notificaciones: ${categoryFilter.toUpperCase()}` : 'Notificaciones'}
          </ThemedText>
          {unreadCount > 0 ? (
            <button onClick={handleMarkAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}>
              <ThemedText style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>Leer todo</ThemedText>
            </button>
          ) : (
            <div style={{ width: 64 }} />
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {notifications.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 16, opacity: 0.5 }}>
              <Bell size={48} color={colors.textSecondary} strokeWidth={1.5} />
              <ThemedText style={{ fontSize: 15 }}>No hay notificaciones</ThemedText>
            </div>
          ) : notifications.map(item => (
            <div
              key={item.id}
              onClick={() => handlePress(item)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: `${spacing.sm + 4}px ${spacing.md}px`,
                borderBottom: `1px solid ${colors.border}`,
                backgroundColor: !item.read ? `${colors.primary}0A` : 'transparent',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 20, backgroundColor: colors.backgroundSecondary,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <CategoryIcon category={item.category} color={colors.primary} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <ThemedText style={{ fontSize: 14, fontWeight: !item.read ? '700' : '500', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.title}
                </ThemedText>
                <ThemedText style={{ fontSize: 13, color: colors.textSecondary, display: 'block', marginTop: 2 }}>
                  {item.body}
                </ThemedText>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{timeAgo(item.createdAt)}</ThemedText>
                {!item.read && (
                  <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Friend request modal */}
      {friendRequestItem && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: spacing.lg }}>
          <div onClick={e => e.stopPropagation()} style={{ backgroundColor: colors.card, borderRadius: 16, padding: spacing.xl, width: '100%', maxWidth: 340, gap: spacing.sm, display: 'flex', flexDirection: 'column' }}>
            <ThemedText style={{ fontSize: 18, fontWeight: '700', display: 'block' }}>Solicitud de amistad</ThemedText>
            <ThemedText style={{ color: colors.textSecondary, display: 'block' }}>
              {friendRequestItem?.meta?.fromUserName ?? 'Alguien'} quiere ser tu amigo/a.
            </ThemedText>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button onClick={handleRejectRequest} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: `1px solid ${colors.border}`,
                backgroundColor: colors.backgroundSecondary, cursor: 'pointer', color: colors.text, fontWeight: '600',
              }}>Rechazar</button>
              <button onClick={handleAcceptRequest} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none',
                backgroundColor: colors.primary, cursor: 'pointer', color: '#fff', fontWeight: '600',
              }}>Aceptar</button>
            </div>
          </div>
        </div>
      )}
    </ThemedView>
  );
}
