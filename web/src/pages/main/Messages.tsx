import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import Layout from '../../components/Layout';
import { useTheme } from '../../contexts/ThemeContext';
import { subscribeToUserConversations, subscribeToContactSettings, setConversationArchived, muteConversation, deleteConversation, clearChatForMe, blockUser, reportUser, getOrCreateConversation, type Conversation, type ConversationUser } from '../../services/firebase/directMessageService';
import { subscribeToGroupConversations, muteGroupConversation, leaveGroup, type GroupConversation } from '../../services/firebase/groupDMService';
import { getFriends, searchUsers, sendFriendRequest, cancelFriendRequest, areFriends, removeFriend, toggleBestFriend, getBestFriendIds, type UserSearchResult } from '../../services/firebase/friendsService';
import { MessageCircle, Search, Plus, X, Clock, Archive, ChevronRight, Bell, BellOff, Star, UserMinus, UserPlus, Eraser, Ban, Trash2, Users, PenSquare, AlertTriangle, LogOut } from 'lucide-react';
import NotificationBell from '../../components/NotificationBell';
import CreateGroupModal from '../../components/messages/CreateGroupModal';
import { useTranslation } from '../../hooks/useTranslation';

interface ConversationWithUser extends Conversation {
  otherUserData?: ConversationUser;
}

export default function Messages() {
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserData, setCurrentUserData] = useState<{ displayName: string; photoURL: string | null } | null>(null);
  const [conversations, setConversations] = useState<ConversationWithUser[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [modalTab, setModalTab] = useState<'friends' | 'search'>('friends');
  const [friends, setFriends] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [requestStates, setRequestStates] = useState<Record<string, 'sending' | 'sent' | 'cancelling'>>({});
  const [starting, setStarting] = useState(false);
  const [groups, setGroups] = useState<GroupConversation[]>([]);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [contactSettings, setContactSettings] = useState<Record<string, { archived?: boolean; muted?: boolean; deleted?: boolean; isBestFriend?: boolean }>>({});
  const [groupMutedMap, setGroupMutedMap] = useState<Record<string, boolean>>({});
  const [ctxMenu, setCtxMenu] = useState<{ conv: ConversationWithUser; x: number; y: number } | null>(null);
  const [moreMenu, setMoreMenu] = useState<{ conv: ConversationWithUser; x: number; y: number } | null>(null);
  const [groupCtxMenu, setGroupCtxMenu] = useState<{ group: GroupConversation; x: number; y: number } | null>(null);
  const [touchTimer, setTouchTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [isFriendMap, setIsFriendMap] = useState<Record<string, boolean>>({});
  const [isBestFriendMap, setIsBestFriendMap] = useState<Record<string, boolean>>({});
  const navigate = useNavigate();
  const { colors } = useTheme();
  const { t, language } = useTranslation();
  const userCacheRef = useRef<Record<string, ConversationUser>>({});
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate('/login');
        return;
      }
      setCurrentUserId(user.uid);
      setLoading(false);
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          setCurrentUserData({ displayName: snap.data().displayName || '', photoURL: snap.data().photoURL || null });
        }
      } catch { }
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
    const unsubscribe = subscribeToGroupConversations(currentUserId, (groupList) => {
      setGroups(groupList);
      const mutedGroups = JSON.parse(localStorage.getItem(`mutedGroups_${currentUserId}`) || '{}');
      const mutedMap: Record<string, boolean> = {};
      groupList.forEach(group => {
        mutedMap[group.id] = mutedGroups[group.id] || false;
      });
      setGroupMutedMap(mutedMap);
    });
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
          } catch { }

          return conv;
        })
      );
      setConversations(enriched);
    });

    return unsubscribe;
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !showNewChat) return;
    getFriends(currentUserId).then(setFriends).catch(() => { });
  }, [currentUserId, showNewChat]);

  useEffect(() => {
    if (modalTab !== 'search' || !currentUserId) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!search.trim() && !roleFilter) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const results = await searchUsers(search.trim(), currentUserId, roleFilter);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search, modalTab, currentUserId, roleFilter]);

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

  const handleSendRequest = async (result: UserSearchResult) => {
    if (!currentUserId || !currentUserData) return;
    setRequestStates(prev => ({ ...prev, [result.user.id]: 'sending' }));
    try {
      await sendFriendRequest(currentUserId, result.user.id, currentUserData.displayName, currentUserData.photoURL);
      setSearchResults(prev =>
        prev.map(r => r.user.id === result.user.id ? { ...r, status: 'sent' } : r)
      );
    } catch { }
    setRequestStates(prev => { const s = { ...prev }; delete s[result.user.id]; return s; });
  };

  const handleCancelRequest = async (result: UserSearchResult) => {
    if (!result.requestId) return;
    setRequestStates(prev => ({ ...prev, [result.user.id]: 'cancelling' }));
    try {
      await cancelFriendRequest(result.requestId);
      setSearchResults(prev =>
        prev.map(r => r.user.id === result.user.id ? { ...r, status: 'none', requestId: undefined } : r)
      );
    } catch { }
    setRequestStates(prev => { const s = { ...prev }; delete s[result.user.id]; return s; });
  };

  const formatTime = (timestamp: any): string => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const locale = language || 'es';

    if (days === 0) {
      return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return t('time_ago.yesterday');
    } else if (days < 7) {
      return date.toLocaleDateString(locale, { weekday: 'short' });
    }
    return date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' });
  };

  const filteredFriends = friends.filter(f =>
    f.displayName?.toLowerCase().includes(search.toLowerCase())
  );

  const getOtherId = (conv: ConversationWithUser) =>
    conv.participants.find(id => id !== currentUserId) || '';

  const activeConversations = conversations.filter(c => !contactSettings[getOtherId(c)]?.archived);
  const archivedCount = conversations.filter(c => contactSettings[getOtherId(c)]?.archived).length;

  const loadFriendInfo = async (otherId: string) => {
    if (!currentUserId || isFriendMap[otherId] !== undefined) return;
    const [friend, bestIds] = await Promise.all([
      areFriends(currentUserId, otherId).catch(() => false),
      getBestFriendIds(currentUserId).catch(() => [] as string[]),
    ]);
    setIsFriendMap(prev => ({ ...prev, [otherId]: friend }));
    setIsBestFriendMap(prev => ({ ...prev, [otherId]: bestIds.includes(otherId) }));
  };

  const openCtxMenu = (e: React.MouseEvent, conv: ConversationWithUser) => {
    e.preventDefault();
    loadFriendInfo(getOtherId(conv));
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 120);
    setCtxMenu({ conv, x, y });
    setMoreMenu(null);
  };

  const closeAllMenus = () => {
    setCtxMenu(null);
    setMoreMenu(null);
    setGroupCtxMenu(null);
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }
    setTouchPosition(null);
  };

  const openMoreMenu = (e: React.MouseEvent, conv: ConversationWithUser) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = Math.min(rect.right, window.innerWidth - 220);
    const y = Math.min(rect.bottom + 4, window.innerHeight - 300);
    setMoreMenu({ conv, x, y });
    setCtxMenu(null);
  };

  const handleArchive = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    closeAllMenus();
    const otherId = getOtherId(conv);
    const isArchived = !!contactSettings[otherId]?.archived;
    setConversationArchived(currentUserId, otherId, !isArchived);
  };

  const handleMuteToggle = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const otherId = getOtherId(conv);
    const isMuted = !!contactSettings[otherId]?.muted;
    setContactSettings(prev => ({ ...prev, [otherId]: { ...prev[otherId], muted: !isMuted } }));
    closeAllMenus();
    muteConversation(currentUserId, otherId, !isMuted);
  };

  const handleBestFriendToggle = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const otherId = getOtherId(conv);
    const next = !isBestFriendMap[otherId];
    setIsBestFriendMap(prev => ({ ...prev, [otherId]: next }));
    closeAllMenus();
    toggleBestFriend(currentUserId, otherId, next);
  };

  const handleRemoveFriend = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const name = conv.otherUserData?.displayName || t('common.user');
    if (!window.confirm(t('messages.remove_friend_confirm', { name }))) return;
    const otherId = getOtherId(conv);
    closeAllMenus();
    removeFriend(currentUserId, otherId).then(() => {
      setIsFriendMap(prev => ({ ...prev, [otherId]: false }));
    });
  };

  const handleAddFriend = (conv: ConversationWithUser) => {
    if (!currentUserId || !currentUserData) return;
    closeAllMenus();
    sendFriendRequest(currentUserId, getOtherId(conv), currentUserData.displayName, currentUserData.photoURL).catch(() => { });
  };

  const handleClearChat = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const name = conv.otherUserData?.displayName || t('common.user');
    if (!window.confirm(t('messages.clear_chat_confirm', { name }))) return;
    closeAllMenus();
    clearChatForMe(conv.id, currentUserId);
  };

  const handleBlock = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const name = conv.otherUserData?.displayName || t('common.user');
    if (!window.confirm(t('messages.block_confirm', { name }))) return;
    closeAllMenus();
    blockUser(currentUserId, getOtherId(conv));
  };

  const handleDeleteChat = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const name = conv.otherUserData?.displayName || t('common.user');
    if (!window.confirm(t('messages.delete_chat_confirm', { name }))) return;
    const otherId = getOtherId(conv);
    setContactSettings(prev => ({ ...prev, [otherId]: { ...prev[otherId], deleted: true } }));
    closeAllMenus();
    deleteConversation(currentUserId, otherId);
  };

  const handleReport = (conv: ConversationWithUser) => {
    if (!currentUserId) return;
    const name = conv.otherUserData?.displayName || t('common.user');
    if (!window.confirm(t('messages.report_confirm', { name }))) return;
    closeAllMenus();
    reportUser(currentUserId, getOtherId(conv))
      .then(() => window.alert(t('messages.report_success')))
      .catch(() => { });
  };

  const openGroupCtxMenu = (e: React.MouseEvent | React.TouchEvent, group: GroupConversation) => {
    e.preventDefault();
    e.stopPropagation();
    
    let clientX, clientY;
    if ('touches' in e) {
      const touch = e.touches[0];
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const x = Math.min(clientX, window.innerWidth - 220);
    const y = Math.min(clientY, window.innerHeight - 120);
    setGroupCtxMenu({ group, x, y });
    setCtxMenu(null);
    setMoreMenu(null);
  };

  const handleGroupMuteToggle = async (group: GroupConversation) => {
    if (!currentUserId) return;
    closeAllMenus();
    const currentMuted = groupMutedMap[group.id] || false;
    const newMuted = !currentMuted;
    
    const mutedGroups = JSON.parse(localStorage.getItem(`mutedGroups_${currentUserId}`) || '{}');
    mutedGroups[group.id] = newMuted;
    localStorage.setItem(`mutedGroups_${currentUserId}`, JSON.stringify(mutedGroups));
    
    setGroupMutedMap(prev => ({ ...prev, [group.id]: newMuted }));
    
    try {
      await muteGroupConversation(currentUserId, group.id, newMuted);
    } catch (err) {
      console.log('Mute guardado localmente, fallo en Firestore');
    }
  };

  const handleGroupInfo = (group: GroupConversation) => {
  closeAllMenus();
  navigate(`/messages/group/${group.id}`, { state: { openInfoPanel: true } });
};

  const handleLeaveGroup = async (group: GroupConversation) => {
    if (!currentUserId) return;
    const groupName = group.name || t('common.group');
    if (!window.confirm(t('messages.leave_group_confirm', { name: groupName }))) return;
    closeAllMenus();
    try {
      await leaveGroup(group.id, currentUserId);
    } catch (err) {
      console.error('Failed to leave group:', err);
    }
  };

  const handleTouchStart = (e: React.TouchEvent, group: GroupConversation) => {
    e.stopPropagation();
    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });
    
    if (touchTimer) {
      clearTimeout(touchTimer);
    }
    
    const timer = setTimeout(() => {
      openGroupCtxMenu(e, group);
    }, 500);
    
    setTouchTimer(timer);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchTimer) {
      clearTimeout(touchTimer);
      setTouchTimer(null);
    }
    setTouchPosition(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (touchPosition && touchTimer) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchPosition.x);
      const dy = Math.abs(touch.clientY - touchPosition.y);
      
      if (dx > 10 || dy > 10) {
        clearTimeout(touchTimer);
        setTouchTimer(null);
        setTouchPosition(null);
      }
    }
  };

  const DropdownBtn = ({ icon, label, onClick, danger = false }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) => (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 16px', width: '100%', background: 'none',
        border: 'none', cursor: 'pointer',
        color: danger ? '#FF3B30' : 'var(--text)',
        fontSize: '14px', fontWeight: '500', textAlign: 'left',
        transition: 'background 0.12s', whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      <span style={{ color: danger ? '#FF3B30' : 'var(--text-secondary)', display: 'flex', flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <Layout title={t('messages.title')} rightAction={<NotificationBell categories={['dm']} />}>
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
            {t('messages.title')}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setShowCreateGroup(true)}
              title="Nuevo grupo"
              style={{ background: 'var(--background-secondary)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <Users size={18} />
            </button>
            <button
              onClick={() => setShowNewChat(true)}
              title="Nuevo mensaje"
              style={{ background: colors.primary, border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff' }}
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        {ctxMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={closeAllMenus} />
            <div
              className="animate-scale-in"
              style={{
                position: 'fixed', top: ctxMenu.y, left: ctxMenu.x, zIndex: 999,
                backgroundColor: 'var(--background)', borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
                overflow: 'hidden', minWidth: '200px',
              }}
            >
              <DropdownBtn
                icon={<Archive size={16} />}
                label={contactSettings[getOtherId(ctxMenu.conv)]?.archived ? t('messages.unarchive_label') : t('messages.archive_label')}
                onClick={() => handleArchive(ctxMenu.conv)}
              />
              <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
              <button
                onClick={e => openMoreMenu(e, ctxMenu.conv)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: '10px', padding: '10px 16px', width: '100%', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text)',
                  fontSize: '14px', fontWeight: '500', transition: 'background 0.12s',
                }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'flex' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
                  </span>
                  {t('messages.more_options')}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
              </button>
            </div>
          </>
        )}

        {moreMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={closeAllMenus} />
            <div
              className="animate-scale-in"
              style={{
                position: 'fixed', top: moreMenu.y, left: moreMenu.x, zIndex: 999,
                backgroundColor: 'var(--background)', borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
                overflow: 'hidden', minWidth: '220px',
              }}
            >
              {(() => {
                const conv = moreMenu.conv;
                const otherId = getOtherId(conv);
                const isMuted = !!contactSettings[otherId]?.muted;
                const isFriend = !!isFriendMap[otherId];
                const isBestFriend = !!isBestFriendMap[otherId];
                const firstName = conv.otherUserData?.displayName?.split(' ')[0] || 'Usuario';
                return (
                  <>
                    <DropdownBtn
                      icon={isMuted ? <Bell size={16} /> : <BellOff size={16} />}
                      label={isMuted ? t('messages.unmute_label') : t('messages.mute_label')}
                      onClick={() => handleMuteToggle(conv)}
                    />
                    <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
                    {isFriend ? (
                      <>
                        <DropdownBtn
                          icon={<Star size={16} color={isBestFriend ? '#FFD60A' : undefined} fill={isBestFriend ? '#FFD60A' : 'none'} />}
                          label={isBestFriend ? t('messages.best_friend_remove') : t('messages.best_friend_add')}
                          onClick={() => handleBestFriendToggle(conv)}
                        />
                        <DropdownBtn
                          icon={<UserMinus size={16} />}
                          label={t('messages.remove_friend_label')}
                          onClick={() => handleRemoveFriend(conv)}
                          danger
                        />
                      </>
                    ) : (
                      <DropdownBtn
                        icon={<UserPlus size={16} />}
                        label={t('messages.add_friend_label')}
                        onClick={() => handleAddFriend(conv)}
                      />
                    )}
                    <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
                    <DropdownBtn
                      icon={<Eraser size={16} />}
                      label={t('messages.clear_chat_label')}
                      onClick={() => handleClearChat(conv)}
                    />
                    <DropdownBtn
                      icon={<Ban size={16} />}
                      label={t('messages.block_label', { name: firstName })}
                      onClick={() => handleBlock(conv)}
                      danger
                    />
                    <DropdownBtn
                      icon={<Trash2 size={16} />}
                      label={t('messages.delete_chat_label')}
                      onClick={() => handleDeleteChat(conv)}
                      danger
                    />
                    <DropdownBtn
                      icon={<AlertTriangle size={16} />}
                      label={t('messages.report_label', { name: firstName })}
                      onClick={() => handleReport(conv)}
                      danger
                    />
                  </>
                );
              })()}
            </div>
          </>
        )}

        {groupCtxMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 998 }} onClick={closeAllMenus} />
            <div
              className="animate-scale-in"
              style={{
                position: 'fixed', top: groupCtxMenu.y, left: groupCtxMenu.x, zIndex: 999,
                backgroundColor: 'var(--background)', borderRadius: '12px',
                boxShadow: '0 4px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
                overflow: 'hidden', minWidth: '200px',
              }}
            >
              <DropdownBtn
                icon={groupMutedMap[groupCtxMenu.group.id] ? <Bell size={16} /> : <BellOff size={16} />}
                label={groupMutedMap[groupCtxMenu.group.id] ? t('messages.unmute_label') : t('messages.mute_label')}
                onClick={() => handleGroupMuteToggle(groupCtxMenu.group)}
              />
              <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
              <DropdownBtn
                icon={<Users size={16} />}
                label={t('chat.group_info_title')}
                onClick={() => handleGroupInfo(groupCtxMenu.group)}
              />
              <div style={{ height: '1px', backgroundColor: 'var(--border)', margin: '0 12px' }} />
              <DropdownBtn
                icon={<LogOut size={16} />}
                label={t('dm.group.leave_group')}
                onClick={() => handleLeaveGroup(groupCtxMenu.group)}
                danger
              />
            </div>
          </>
        )}

        {activeConversations.length === 0 && archivedCount === 0 && groups.length === 0 ? (
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
              {t('messages.no_conversations_title')}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, textAlign: 'center' }}>
              {t('messages.no_conversations_desc')}
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
              {t('messages.new_conversation_btn')}
            </button>
          </div>
        ) : (
          <div>
            {archivedCount > 0 && (
              <div
                onClick={() => navigate('/messages/archived')}
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
                  backgroundColor: 'var(--background-secondary)',
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <Archive size={22} color="var(--text-secondary)" />
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontWeight: '600', color: 'var(--text)', fontSize: '15px' }}>
                    {t('messages.archived_label')}
                  </span>
                  <p style={{ margin: '2px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    {archivedCount} {archivedCount === 1 ? t('messages.archived_count_one') : t('messages.archived_count_other')}
                  </p>
                </div>
                <ChevronRight size={18} color="var(--text-secondary)" />
              </div>
            )}

            {groups.map(group => {
              const totalUnread = group.unreadCount || 0;
              const isGroupMuted = groupMutedMap[group.id] || false;
              return (
                <div
                  key={group.id}
                  onClick={() => navigate(`/messages/group/${group.id}`)}
                  onContextMenu={(e) => openGroupCtxMenu(e, group)}
                  onTouchStart={(e) => handleTouchStart(e, group)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', cursor: 'pointer', borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: colors.primary, flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {group.photoURL
                      ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <Users size={22} color="#fff" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontWeight: totalUnread > 0 ? '700' : '600', color: 'var(--text)', fontSize: '15px' }}>
                          {group.name || t('common.group')}
                        </span>
                        {isGroupMuted && <BellOff size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
                      </span>
                      <span style={{ fontSize: '12px', color: totalUnread > 0 ? colors.primary : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={11} />
                        {formatTime(group.lastMessageAt ? { toDate: () => new Date(group.lastMessageAt!) } : null)}
                      </span>
                    </div>
                    <p style={{ margin: '2px 0 0', fontSize: '13px', color: totalUnread > 0 ? 'var(--text)' : 'var(--text-secondary)', fontWeight: totalUnread > 0 ? '500' : '400', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {group.lastMessageSenderName && group.lastMessage
                        ? `${group.lastMessageSenderName.split(' ')[0]}: ${group.lastMessage}`
                        : group.lastMessage || t('dm.group.member_count', { count: String(group.members.length) })}
                    </p>
                  </div>
                  {totalUnread > 0 && (
                    <div style={{ backgroundColor: colors.primary, color: '#fff', borderRadius: '12px', minWidth: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', padding: '0 6px', flexShrink: 0 }}>
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </div>
                  )}
                </div>
              );
            })}

            {activeConversations.map((conv) => {
              const unread = conv.unreadCount?.[currentUserId!] || 0;
              const other = conv.otherUserData;
              const otherId = getOtherId(conv);
              const isMuted = !!contactSettings[otherId]?.muted;
              return (
                <div
                  key={conv.id}
                  onClick={() => navigate(`/messages/${conv.id}`)}
                  onContextMenu={e => openCtxMenu(e, conv)}
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
                        <span style={{
                          fontWeight: unread > 0 ? '700' : '600',
                          color: 'var(--text)',
                          fontSize: '15px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          {other?.displayName || t('common.user')}
                        </span>
                        {isMuted && <BellOff size={13} color="var(--text-secondary)" style={{ flexShrink: 0 }} />}
                      </span>
                      <span style={{
                        fontSize: '12px',
                        color: unread > 0 ? colors.primary : 'var(--text-secondary)',
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
                      color: unread > 0 ? 'var(--text)' : 'var(--text-secondary)',
                      fontWeight: unread > 0 ? '500' : '400',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {conv.lastMessage || t('messages.no_messages_yet')}
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

      {showCreateGroup && (
        <CreateGroupModal
          onClose={() => setShowCreateGroup(false)}
          onCreated={groupId => { setShowCreateGroup(false); navigate(`/messages/group/${groupId}`); }}
        />
      )}

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
          onClick={() => { setShowNewChat(false); setSearch(''); setSearchResults([]); setModalTab('friends'); setRoleFilter('all'); }}
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
                {modalTab === 'friends' ? t('messages.new_chat_friends_title') : t('messages.new_chat_search_title')}
              </span>
              <button
                onClick={() => { setShowNewChat(false); setSearch(''); setSearchResults([]); setModalTab('friends'); setRoleFilter('all'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}
              >
                <X size={22} />
              </button>
            </div>

            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {(['friends', 'search'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => { setModalTab(tab); setSearch(''); setSearchResults([]); setRoleFilter('all'); }}
                  style={{
                    flex: 1,
                    background: 'none',
                    border: 'none',
                    padding: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    color: modalTab === tab ? colors.primary : 'var(--text-secondary)',
                    borderBottom: `2px solid ${modalTab === tab ? colors.primary : 'transparent'}`,
                    transition: 'all 0.15s'
                  }}
                >
                  {tab === 'friends' ? t('messages.tab_friends') : t('messages.tab_search')}
                </button>
              ))}
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
                  placeholder={modalTab === 'friends' ? t('messages.search_friend_placeholder') : t('messages.search_people_placeholder')}
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
              {modalTab === 'search' && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {([
                    { label: t('messages.role_all'), value: 'all' },
                    { label: t('messages.role_students'), value: 'student' },
                    { label: t('messages.role_teachers'), value: 'teacher' },
                    { label: t('messages.role_admins'), value: 'admin' },
                  ] as const).map(opt => (
                    <button
                      key={opt.label}
                      onClick={() => setRoleFilter(opt.value)}
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        border: `1.5px solid ${roleFilter === opt.value ? colors.primary : 'var(--border)'}`,
                        background: roleFilter === opt.value ? colors.primary : 'transparent',
                        color: roleFilter === opt.value ? '#fff' : 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              {modalTab === 'friends' ? (
                filteredFriends.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 16px', fontSize: '14px' }}>
                    {friends.length === 0 ? t('messages.no_friends_yet') : t('dm.no_results')}
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
                        width: '44px', height: '44px', borderRadius: '50%',
                        backgroundColor: colors.primary, flexShrink: 0, overflow: 'hidden',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '18px', fontWeight: '700', color: '#fff'
                      }}>
                        {friend.photoURL
                          ? <img src={friend.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : friend.displayName?.[0]?.toUpperCase() || '?'}
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
                )
              ) : (
                (!search.trim() && !roleFilter) ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 16px', fontSize: '14px' }}>
                    {t('messages.search_prompt')}
                  </p>
                ) : searchLoading ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 16px', fontSize: '14px' }}>
                    {t('messages.searching')}
                  </p>
                ) : searchResults.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '32px 16px', fontSize: '14px' }}>
                    {t('dm.no_results')}
                  </p>
                ) : (
                  searchResults.map(result => {
                    const busy = !!requestStates[result.user.id];
                    return (
                      <div
                        key={result.user.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '14px',
                          padding: '12px 16px',
                          borderBottom: '1px solid var(--border)'
                        }}
                      >
                        <div style={{
                          width: '44px', height: '44px', borderRadius: '50%',
                          backgroundColor: colors.primary, flexShrink: 0, overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '18px', fontWeight: '700', color: '#fff'
                        }}>
                          {result.user.photoURL
                            ? <img src={result.user.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : result.user.displayName?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontWeight: '600', color: 'var(--text)', fontSize: '15px' }}>
                            {result.user.displayName}
                          </p>
                          {result.user.role && (
                            <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                              {result.user.role}
                            </p>
                          )}
                        </div>
                        {result.status === 'friend' ? (
                          <button
                            onClick={() => handleOpenConversation(result.user.id)}
                            style={{
                              background: colors.primary, color: '#fff', border: 'none',
                              borderRadius: '20px', padding: '6px 14px', fontSize: '13px',
                              fontWeight: '600', cursor: 'pointer', flexShrink: 0
                            }}
                          >
                            {t('messages.send_message_btn')}
                          </button>
                        ) : result.status === 'sent' ? (
                          <button
                            onClick={() => !busy && handleCancelRequest(result)}
                            disabled={busy}
                            style={{
                              background: 'var(--background-secondary)', color: 'var(--text-secondary)',
                              border: '1px solid var(--border)', borderRadius: '20px',
                              padding: '6px 14px', fontSize: '13px', fontWeight: '600',
                              cursor: busy ? 'default' : 'pointer', flexShrink: 0
                            }}
                          >
                            {busy ? '...' : t('messages.cancel_request_btn')}
                          </button>
                        ) : result.status === 'received' ? (
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                            {t('messages.request_received')}
                          </span>
                        ) : (
                          <button
                            onClick={() => !busy && handleSendRequest(result)}
                            disabled={busy}
                            style={{
                              background: colors.primary, color: '#fff', border: 'none',
                              borderRadius: '20px', padding: '6px 14px', fontSize: '13px',
                              fontWeight: '600', cursor: busy ? 'default' : 'pointer', flexShrink: 0,
                              opacity: busy ? 0.7 : 1
                            }}
                          >
                            {busy ? '...' : t('messages.add_btn')}
                          </button>
                        )}
                      </div>
                    );
                  })
                )
              )}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}