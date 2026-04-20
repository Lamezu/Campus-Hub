import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, Bell, MessageSquare, Hash,
  Users, Megaphone, Calendar
} from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationService } from '@/services/notificationService';
import { acceptFriendRequest } from '@/services/friendsService';
import { auth } from '@/config/firebase';
import { useTranslation } from '@/contexts/LanguageContext';
import type { NotificationItem, NotificationCategory } from '@/types';

function timeAgo(date: any, t: any): string {
  if (!date) return '';
  const ts =
    typeof date === 'string' ? new Date(date).getTime()
    : date?.toDate ? date.toDate().getTime()
    : date?.seconds ? date.seconds * 1000
    : new Date(date).getTime();
  if (isNaN(ts)) return '';
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return t('notifications_screen.time.now');
  if (diff < 3600) return t('notifications_screen.time.m', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('notifications_screen.time.h', { n: Math.floor(diff / 3600) });
  return t('notifications_screen.time.d', { n: Math.floor(diff / 86400) });
}

function getGroupKey(n: NotificationItem): string {
  if (n.meta?.channelId) return n.meta.channelId;
  if (n.meta?.participantId) return n.meta.participantId;
  if (n.meta?.groupId) return n.meta.groupId;
  if (n.meta?.postId) return n.meta.postId;
  return n.category;
}

function getGroupLabel(n: NotificationItem): string {
  if (n.meta?.channelName) return n.meta.channelName;
  if (n.meta?.participantName) return n.meta.participantName;
  if (n.meta?.groupName) return n.meta.groupName;
  return n.title;
}

type Section = {
  id: string;
  title: string;
  icon: React.ReactNode;
  iconBg: string;
  categories: NotificationCategory[];
  subGroups?: boolean;
};

function GroupRow({
  label,
  preview,
  timeStr,
  icon,
  iconBg,
  unread,
  onClick,
  colors,
}: {
  label: string;
  preview: string;
  timeStr: string;
  icon: React.ReactNode;
  iconBg: string;
  unread: number;
  onClick: () => void;
  colors: any;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 20px',
        backgroundColor: hovered ? colors.backgroundSecondary : colors.card,
        borderRadius: 14,
        cursor: 'pointer',
        marginBottom: 10,
        transition: 'background-color 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: iconBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontSize: 15,
            fontWeight: unread > 0 ? '700' : '600',
            color: colors.text,
            fontFamily: 'Inter, sans-serif',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>{label}</span>
          <span style={{ fontSize: 12, color: colors.textSecondary, flexShrink: 0 }}>{timeStr}</span>
        </div>
        <span style={{
          fontSize: 13,
          color: colors.textSecondary,
          display: 'block',
          marginTop: 2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>{preview}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {unread > 0 && (
          <div style={{
            minWidth: 18, height: 18, borderRadius: 9,
            backgroundColor: colors.primary,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px',
          }}>
            <span style={{ fontSize: 10, color: '#fff', fontWeight: '700' }}>{unread}</span>
          </div>
        )}
        <ChevronRight size={16} color={colors.textSecondary} />
      </div>
    </div>
  );
}

function NotificationRow({
  item,
  icon,
  iconBg,
  onClick,
  colors,
  t,
}: {
  item: NotificationItem;
  icon: React.ReactNode;
  iconBg: string;
  onClick: () => void;
  colors: any;
  t: any;
}) {
  const [hovered, setHovered] = useState(false);
  const displayTitle = item.titleKey ? t(item.titleKey, item.meta) : item.title;
  const displayBody = item.bodyKey ? t(item.bodyKey, item.meta) : item.body;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '13px 20px',
        backgroundColor: !item.read
          ? `${colors.primary}0F`
          : hovered ? colors.backgroundSecondary : 'transparent',
        borderRadius: 12,
        cursor: 'pointer',
        marginBottom: 4,
        transition: 'background-color 0.15s',
        userSelect: 'none',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: iconBg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 14, fontWeight: !item.read ? '700' : '500',
          color: colors.text, fontFamily: 'Inter, sans-serif',
          display: 'block',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{displayTitle}</span>
        <span style={{
          fontSize: 13, color: colors.textSecondary,
          display: 'block', marginTop: 2,
        }}>{displayBody}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: colors.textSecondary }}>{timeAgo(item.createdAt, t)}</span>
        {!item.read && (
          <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
        )}
      </div>
    </div>
  );
}

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const searchParams = new URLSearchParams(location.search);
  const sectionParam = searchParams.get('section') as string | null;
  const categoryFilter = searchParams.get('category') as NotificationCategory | null;

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [friendRequestItem, setFriendRequestItem] = useState<NotificationItem | null>(null);

  useEffect(() => {
    const update = () => {
      const all = [...notificationService.getAll()].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setNotifications(all);
    };
    update();
    return notificationService.subscribe(update);
  }, []);

  const SECTIONS: Section[] = useMemo(() => [
    {
      id: 'canales',
      title: t('notifications_screen.sections.canales'),
      icon: <Hash size={22} color="#fff" />,
      iconBg: colors.primary,
      categories: ['channel', 'general'],
      subGroups: true,
    },
    {
      id: 'campus',
      title: t('notifications_screen.sections.campus'),
      icon: <Megaphone size={22} color="#fff" />,
      iconBg: '#8B5CF6',
      categories: ['campus'],
      subGroups: true,
    },
    {
      id: 'mensajes',
      title: t('notifications_screen.sections.mensajes'),
      icon: <MessageSquare size={22} color="#fff" />,
      iconBg: '#10B981',
      categories: ['dm'],
      subGroups: true,
    },
    {
      id: 'amigos',
      title: t('notifications_screen.sections.amigos'),
      icon: <Users size={22} color="#fff" />,
      iconBg: '#F59E0B',
      categories: ['friend'],
      subGroups: false,
    },
    {
      id: 'social',
      title: t('notifications_screen.sections.social'),
      icon: <Bell size={22} color="#fff" />,
      iconBg: '#EC4899',
      categories: ['social'],
      subGroups: true,
    },
  ], [colors, t]);

  const currentSection = sectionParam ? SECTIONS.find(s => s.id === sectionParam) : null;

  const sectionNotifs = useMemo(() => {
    if (!currentSection) return notifications;
    return notifications.filter(n => currentSection.categories.includes(n.category as any));
  }, [currentSection, notifications]);

  const subGroupsData = useMemo(() => {
    if (!currentSection?.subGroups) return [];
    const map = new Map<string, NotificationItem[]>();
    for (const n of sectionNotifs) {
      const key = getGroupKey(n);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries())
      .map(([key, items]) => ({
        key,
        label: getGroupLabel(items[0]),
        items: items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
        latestItem: items[0],
        unread: items.filter(i => !i.read).length,
      }))
      .sort((a, b) => new Date(b.latestItem.createdAt).getTime() - new Date(a.latestItem.createdAt).getTime());
  }, [currentSection, sectionNotifs]);

  const friendSubSections = useMemo(() => {
    const requests = sectionNotifs.filter(n => n.meta?.isRequest === 'true');
    const accepted = sectionNotifs.filter(n => n.meta?.isRequest !== 'true');
    return { requests, accepted };
  }, [sectionNotifs]);

  useEffect(() => {
    if (currentSection) {
      currentSection.categories.forEach(cat => notificationService.markAllRead(cat));
    }
    if (categoryFilter) {
      notificationService.markAllRead(categoryFilter);
    }
  }, [sectionParam, categoryFilter, currentSection]);

  const goToSection = (sectionId: string) => {
    navigate(`/notifications?section=${sectionId}`);
  };

  const handlePress = useCallback((item: NotificationItem) => {
    notificationService.markRead(item.id);
    if (item.category === 'friend' && item.meta?.isRequest === 'true') {
      setFriendRequestItem(item);
      return;
    }
    if (item.category === 'dm' && item.meta?.participantId) {
      navigate(`/dm/${item.meta.participantId}`);
    } else if ((item.category === 'channel' || item.category === 'general') && item.meta?.channelId) {
      navigate(`/chat/${item.meta.channelId}`);
    } else if (item.category === 'campus') {
      const type = item.meta?.type;
      const hasEventId = !!(item.meta?.eventId || item.meta?.linkedEventId);
      const tab = (type === 'event' || hasEventId) ? 'calendario' : 'tablon';
      const parsedId = item.meta?.eventId || item.meta?.announcementId || item.meta?.id || item.meta?.linkedEventId;
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
    } catch (e) {
      console.error('Error accepting friend request:', e);
    }
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
    } catch (e) { }
  }, [friendRequestItem]);

  const handleMarkAllRead = useCallback(() => {
    if (currentSection) {
      currentSection.categories.forEach(cat => notificationService.markAllRead(cat));
    } else {
      notificationService.markAllRead();
    }
  }, [currentSection]);

  const totalUnread = notifications.filter(n => !n.read).length;
  const sectionUnread = sectionNotifs.filter(n => !n.read).length;
  const unreadForHeader = currentSection ? sectionUnread : totalUnread;

  const getNotifIcon = (n: NotificationItem, size = 20) => {
    if (n.category === 'dm') return <MessageSquare size={size} color="#fff" />;
    if (n.category === 'friend') return <Users size={size} color="#fff" />;
    if (n.category === 'campus') return n.meta?.type === 'event' ? <Calendar size={size} color="#fff" /> : <Megaphone size={size} color="#fff" />;
    if (n.category === 'social') return <Bell size={size} color="#fff" />;
    return <Hash size={size} color="#fff" />;
  };

  const getNotifIconBg = (n: NotificationItem) => {
    if (n.category === 'dm') return '#10B981';
    if (n.category === 'friend') return '#F59E0B';
    if (n.category === 'campus') return '#8B5CF6';
    if (n.category === 'social') return '#EC4899';
    return colors.primary;
  };

  const renderEmpty = () => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: 80, gap: 16, opacity: 0.5 }}>
      <Bell size={48} color={colors.textSecondary} strokeWidth={1.4} />
      <ThemedText style={{ fontSize: 15 }}>{t('notifications_screen.empty')}</ThemedText>
    </div>
  );

  const renderDashboard = () => (
    <div style={{ padding: '12px 16px' }}>
      {SECTIONS.map(section => {
        const sNotifs = notifications.filter(n => section.categories.includes(n.category as any));
        if (sNotifs.length === 0) return null;
        const latest = sNotifs[0];
        const unread = sNotifs.filter(n => !n.read).length;
        const preview = latest.bodyKey ? t(latest.bodyKey, latest.meta) : latest.body;
        return (
          <GroupRow
            key={section.id}
            label={section.title}
            preview={preview}
            timeStr={timeAgo(latest.createdAt, t)}
            icon={section.icon}
            iconBg={section.iconBg}
            unread={unread}
            onClick={() => goToSection(section.id)}
            colors={colors}
          />
        );
      })}
      {notifications.length === 0 && renderEmpty()}
    </div>
  );

  const renderSection = () => {
    if (!currentSection) return null;

    if (currentSection.id === 'amigos') {
      const { requests, accepted } = friendSubSections;
      return (
        <div style={{ padding: '12px 16px' }}>
          {requests.length > 0 && (
            <>
              <span style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 8, paddingLeft: 4 }}>
                {t('notifications_screen.friends.new_requests')}
              </span>
              {requests.map(n => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  icon={<Users size={20} color="#fff" />}
                  iconBg="#F59E0B"
                  onClick={() => handlePress(n)}
                  colors={colors}
                  t={t}
                />
              ))}
            </>
          )}
          {accepted.length > 0 && (
            <>
              <span style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 8, paddingLeft: 4, marginTop: requests.length > 0 ? 16 : 0 }}>
                {t('notifications_screen.friends.accepted')}
              </span>
              {accepted.map(n => (
                <NotificationRow
                  key={n.id}
                  item={n}
                  icon={<Users size={20} color="#fff" />}
                  iconBg="#F59E0B"
                  onClick={() => handlePress(n)}
                  colors={colors}
                  t={t}
                />
              ))}
            </>
          )}
          {requests.length === 0 && accepted.length === 0 && renderEmpty()}
        </div>
      );
    }

    if (currentSection.id === 'campus') {
      const eventos = sectionNotifs.filter(n =>
        n.meta?.type === 'event' ||
        n.title?.toLowerCase().includes('evento') ||
        (n.category === 'campus' && n.meta?.eventId)
      );

      const eventosIds = new Set(eventos.map(n => n.id));
      const anunciosFinal = sectionNotifs.filter(n => !eventosIds.has(n.id));

      if (anunciosFinal.length === 0 && eventos.length === 0) return <div style={{ padding: '12px 16px' }}>{renderEmpty()}</div>;

      return (
        <div style={{ padding: '12px 16px' }}>
          {anunciosFinal.length > 0 && (
            <GroupRow
              label={t('notifications_screen.campus.announcements')}
              preview={anunciosFinal[0].bodyKey ? t(anunciosFinal[0].bodyKey, anunciosFinal[0].meta) : anunciosFinal[0].body}
              timeStr={timeAgo(anunciosFinal[0].createdAt, t)}
              icon={<Megaphone size={22} color="#fff" />}
              iconBg="#8B5CF6"
              unread={anunciosFinal.filter(n => !n.read).length}
              onClick={() => navigate(`/notifications?section=campus&group=anuncios`)}
              colors={colors}
            />
          )}
          {eventos.length > 0 && (
            <GroupRow
              label={t('notifications_screen.campus.events')}
              preview={eventos[0].bodyKey ? t(eventos[0].bodyKey, eventos[0].meta) : eventos[0].body}
              timeStr={timeAgo(eventos[0].createdAt, t)}
              icon={<Calendar size={22} color="#fff" />}
              iconBg="#0EA5E9"
              unread={eventos.filter(n => !n.read).length}
              onClick={() => navigate(`/notifications?section=campus&group=eventos`)}
              colors={colors}
            />
          )}
        </div>
      );
    }

    if (currentSection.subGroups && subGroupsData.length > 0) {
      return (
        <div style={{ padding: '12px 16px' }}>
          {subGroupsData.map(group => (
            <GroupRow
              key={group.key}
              label={group.label}
              preview={group.latestItem.bodyKey ? t(group.latestItem.bodyKey, group.latestItem.meta) : group.latestItem.body}
              timeStr={timeAgo(group.latestItem.createdAt, t)}
              icon={getNotifIcon(group.latestItem, 22)}
              iconBg={getNotifIconBg(group.latestItem)}
              unread={group.unread}
              onClick={() => {
                if (group.items.length === 1) {
                  handlePress(group.items[0]);
                } else {
                  navigate(`/notifications?section=${currentSection.id}&group=${encodeURIComponent(group.key)}`);
                }
              }}
              colors={colors}
            />
          ))}
        </div>
      );
    }

    return (
      <div style={{ padding: '12px 16px' }}>
        {sectionNotifs.length === 0 ? renderEmpty() : sectionNotifs.map(n => (
          <NotificationRow
            key={n.id}
            item={n}
            icon={getNotifIcon(n)}
            iconBg={getNotifIconBg(n)}
            onClick={() => handlePress(n)}
            colors={colors}
            t={t}
          />
        ))}
      </div>
    );
  };

  const groupParam = searchParams.get('group');
  const groupDetail = useMemo(() => {
    if (!groupParam || !currentSection) return null;
    const decoded = decodeURIComponent(groupParam);

    if (currentSection.id === 'campus') {
      const getEventos = () => sectionNotifs.filter(n =>
        n.meta?.type === 'event' ||
        n.title?.toLowerCase().includes('evento') ||
        (n.category === 'campus' && n.meta?.eventId)
      );
      
      if (decoded === 'eventos') return getEventos();
      if (decoded === 'anuncios') {
        const evts = getEventos();
        const evtIds = new Set(evts.map(n => n.id));
        return sectionNotifs.filter(n => !evtIds.has(n.id));
      }
    }

    return sectionNotifs.filter(n => getGroupKey(n) === decoded);
  }, [groupParam, sectionNotifs, currentSection]);

  const renderGroupDetail = () => {
    if (!groupDetail) return null;
    return (
      <div style={{ padding: '12px 16px' }}>
        {groupDetail.length === 0 ? renderEmpty() : groupDetail.map(n => (
          <NotificationRow
            key={n.id}
            item={n}
            icon={getNotifIcon(n)}
            iconBg={getNotifIconBg(n)}
            onClick={() => handlePress(n)}
            colors={colors}
            t={t}
          />
        ))}
      </div>
    );
  };

  const CAMPUS_GROUP_TITLES: Record<string, string> = { 
    anuncios: t('notifications_screen.campus.announcements'), 
    eventos: t('notifications_screen.campus.events') 
  };
  const pageTitle = groupDetail
    ? (groupParam && CAMPUS_GROUP_TITLES[groupParam]
        ? CAMPUS_GROUP_TITLES[groupParam]
        : groupDetail[0] ? getGroupLabel(groupDetail[0]) : t('notifications_screen.title'))
    : currentSection
      ? currentSection.title
      : t('notifications_screen.title');

  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: colors.background }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: `1px solid ${colors.border}`,
          backgroundColor: colors.background,
          flexShrink: 0,
        }}>
          <button
            onClick={() => navigate(-1)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: colors.text, display: 'flex', borderRadius: 8 }}
          >
            <ChevronLeft size={24} />
          </button>

          <ThemedText style={{ fontWeight: '700', fontSize: 17, fontFamily: 'Inter, sans-serif' }}>
            {pageTitle}
          </ThemedText>

          {unreadForHeader > 0 ? (
            <button
              onClick={handleMarkAllRead}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '4px 8px' }}
            >
              <ThemedText style={{ color: colors.primary, fontSize: 13, fontWeight: '600' }}>{t('notifications_screen.mark_all_read')}</ThemedText>
            </button>
          ) : (
            <div style={{ width: 72 }} />
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {groupDetail
            ? renderGroupDetail()
            : currentSection
              ? renderSection()
              : renderDashboard()}
        </div>

      </div>

      {friendRequestItem && (
        <div style={{
          position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: 24,
        }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: colors.card, borderRadius: 18, padding: 28,
              width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 24, backgroundColor: '#F59E0B20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Users size={24} color="#F59E0B" />
              </div>
              <ThemedText style={{ fontSize: 18, fontWeight: '700' }}>{t('notifications_screen.modal.title')}</ThemedText>
            </div>
            <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>
              {t('notifications_screen.modal.body', { name: friendRequestItem?.meta?.fromUserName ?? 'Alguien' })}
            </ThemedText>
            <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
              <button
                onClick={handleRejectRequest}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.backgroundSecondary,
                  cursor: 'pointer', color: colors.text,
                  fontWeight: '600', fontSize: 14, fontFamily: 'Inter, sans-serif',
                }}
              >
                {t('notifications_screen.modal.reject')}
              </button>
              <button
                onClick={handleAcceptRequest}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12, border: 'none',
                  backgroundColor: colors.primary,
                  cursor: 'pointer', color: '#fff',
                  fontWeight: '600', fontSize: 14, fontFamily: 'Inter, sans-serif',
                }}
              >
                {t('notifications_screen.modal.accept')}
              </button>
            </div>
          </div>
        </div>
      )}
    </ThemedView>
  );
}
