import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Search, MoreHorizontal, CheckCheck, BellOff, Info, UserPlus, Eraser, Ban, Trash2, Users as UsersIcon, Plus } from 'lucide-react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { NewDMModal } from '@/components/NewDMModal';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';
import { auth } from '@/config/firebase';
import { subscribeToConversations, deleteConversation, markConversationAsRead } from '@/services/dmService';
import { subscribeToFriends } from '@/services/friendsService';
import { subscribeToGroupConversations, markGroupAsRead } from '@/services/groupDMService';
import { DMConversation, GroupConversation, User } from '@/types';
import { NotificationBell } from '@/components/NotificationBell';
import { NewGroupModal } from '@/components/dm/NewGroupModal';
import { useTranslation } from '@/contexts/LanguageContext';

function timeLabel(iso: string, t: any): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return t('messages.time.now');
  if (diff < 3600) return t('messages.time.m', { n: Math.floor(diff / 60) });
  if (diff < 86400) return t('messages.time.h', { n: Math.floor(diff / 3600) });
  if (diff < 604800) return t('messages.time.d', { n: Math.floor(diff / 86400) });
  const d = new Date(iso);
  const now = new Date();
  if (now.getTime() - d.getTime() < 86400000 * 7) {
    return d.toLocaleDateString([], { weekday: 'short' }).toLowerCase().replace('.', '');
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#825225',
  teacher: '#1b4b2c',
  student: '#1b3b5c'
};

export default function MessagesScreen() {
  const { colors } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [groupConversations, setGroupConversations] = useState<GroupConversation[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showNewDMModal, setShowNewDMModal] = useState(false);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const currentUser = auth.currentUser;

  const ROLE_LABELS: Record<string, string> = {
    admin: t('messages.roles.admin'),
    teacher: t('messages.roles.teacher'),
    student: t('messages.roles.student')
  };

  useEffect(() => {
    if (!currentUser) return;
    const unsubConvs = subscribeToConversations(currentUser.uid, (convs) => {
      setConversations(convs);
      setLoading(false);
    });
    const unsubGroups = subscribeToGroupConversations(currentUser.uid, (groups) => {
      setGroupConversations(groups);
      setLoading(false);
    });
    const unsubFriends = subscribeToFriends(currentUser.uid, (f) => {
      setFriends(f);
    });
    return () => { 
      unsubConvs(); 
      unsubGroups(); 
      unsubFriends(); 
    };
  }, [currentUser]);

  const allChats = useMemo(() => {
    const combined = [
      ...conversations.map(c => ({ ...c, type: 'dm', sortDate: c.lastMessageAt })),
      ...groupConversations.map(g => ({ 
        id: g.id,
        participantId: g.id,
        participantName: g.name || 'Grupo sin nombre',
        participantPhoto: g.photoURL,
        participantRole: 'student' as const,
        lastMessage: g.lastMessageSenderName ? `${g.lastMessageSenderName}: ${g.lastMessage}` : g.lastMessage,
        lastMessageAt: g.lastMessageAt || g.createdAt,
        lastMessageSenderId: g.lastMessageSenderId || '',
        unreadCount: g.unreadCount,
        isOnline: false,
        isFriend: false,
        isBestFriend: false,
        isGroup: true,
        type: 'group',
        sortDate: g.lastMessageAt || g.createdAt
      }))
    ];
    return combined.sort((a, b) => new Date(b.sortDate!).getTime() - new Date(a.sortDate!).getTime());
  }, [conversations, groupConversations]);

  const filtered = allChats.filter(c =>
    c.participantName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredFriends = friends.filter(f => 
    !conversations.some(c => c.participantId === f.uid) &&
    f.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ThemedView style={{ flex: 1 }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `12px 20px`, borderBottom: `1px solid ${colors.border}`, flexShrink: 0 }}>
          <ThemedText style={{ fontSize: 22, fontWeight: '800' }}>{t('messages.title')}</ThemedText>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationBell category="dm" />
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={() => setShowNewGroupModal(true)} 
                title={t('messages.new_group_tooltip')}
                style={{ 
                  background: `${colors.primary}15`, border: 'none', cursor: 'pointer', 
                  width: 38, height: 38, borderRadius: 10, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: colors.primary 
                }}
              >
                <Plus size={20} />
              </button>
              <button 
                onClick={() => setShowNewDMModal(true)} 
                title={t('messages.new_dm_tooltip')}
                style={{ 
                  background: colors.primary, border: 'none', cursor: 'pointer', 
                  width: 38, height: 38, borderRadius: 10, display: 'flex', 
                  alignItems: 'center', justifyContent: 'center', color: '#fff' 
                }}
              >
                <MessageSquare size={20} />
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', flexShrink: 0 }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            padding: '12px 18px', 
            backgroundColor: colors.card, 
            borderRadius: 18,
            border: `1.5px solid ${colors.border}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
            transition: 'all 0.2s'
          }}
          onFocusCapture={e => e.currentTarget.style.borderColor = colors.primary}
          onBlurCapture={e => e.currentTarget.style.borderColor = colors.border}
          >
            <Search size={18} color={colors.primary} strokeWidth={2.5} />
            <input 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
              placeholder={t('messages.search_placeholder')}
              style={{ 
                flex: 1, 
                background: 'none', 
                border: 'none', 
                outline: 'none', 
                color: colors.text, 
                fontSize: 15,
                fontWeight: 600
              }} 
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 60 }}><div style={{ width: 32, height: 32, border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
          ) : filtered.length === 0 && filteredFriends.length === 0 ? (
            <div style={{ padding: spacing.lg, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, opacity: 0.5, marginTop: 40 }}>
              <MessageSquare size={48} strokeWidth={1.5} /><ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{t('messages.no_chats')}</ThemedText>
            </div>
          ) : (
            <>
              {filtered.map(conv => {
                const isGroup = (conv as any).isGroup;
                const initials = conv.participantName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
                const hasUnread = conv.unreadCount > 0;
                const role = conv.participantRole || 'student';
                
                return (
                  <div 
                    key={conv.id} 
                    onClick={() => navigate(isGroup ? `/dm/group/${conv.id}` : `/dm/${conv.participantId}`)} 
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', transition: 'background-color 0.1s' }} 
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} 
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {conv.participantPhoto ? (
                        <img src={conv.participantPhoto} alt="" style={{ width: 52, height: 52, borderRadius: isGroup ? 16 : 26, objectFit: 'cover' }} />
                      ) : (
                        <div style={{ 
                          width: 52, height: 52, borderRadius: isGroup ? 16 : 26, 
                          backgroundColor: isGroup ? `${colors.primary}12` : `${colors.primary}22`, 
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: isGroup ? `1px dashed ${colors.primary}40` : 'none'
                        }}>
                          {isGroup ? <UsersIcon size={24} color={colors.primary} opacity={0.6} /> : <span style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>{initials}</span>}
                        </div>
                      )}
                      {conv.isBestFriend && <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#FF2D55', border: `2px solid ${colors.background}`, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⭐</div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                          <ThemedText style={{ fontWeight: hasUnread ? '800' : '700', fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.participantName}</ThemedText>
                          {!isGroup && <div style={{ backgroundColor: ROLE_COLORS[role] || colors.primary, padding: '2px 8px', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.8 }}><span style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{ROLE_LABELS[role]}</span></div>}
                          {isGroup && <div style={{ backgroundColor: colors.backgroundSecondary, padding: '2px 8px', borderRadius: 6, border: `1px solid ${colors.border}` }}><span style={{ color: colors.textSecondary, fontSize: 10, fontWeight: '700' }}>{t('messages.group_badge')}</span></div>}
                        </div>
                        <span style={{ fontSize: 11, color: colors.textSecondary }}>{timeLabel(conv.lastMessageAt, t)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                        <ThemedText style={{ fontSize: 13, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{conv.lastMessage || t('messages.new_conv')}</ThemedText>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {hasUnread && <div style={{ minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingInline: 5 }}><span style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{conv.unreadCount > 99 ? '99+' : conv.unreadCount}</span></div>}
                          <button 
                            onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conv.id ? null : conv.id); }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: colors.textSecondary }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <MoreHorizontal size={18} />
                          </button>
                        </div>

                        {menuOpenId === conv.id && (
                          <div style={{ position: 'absolute', top: 30, right: 0, width: 220, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, boxShadow: '0 8px 16px rgba(0,0,0,0.2)', zIndex: 100, padding: 6 }}>
                            {hasUnread && (
                              <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={async (e) => { 
                                e.stopPropagation(); 
                                if (currentUser) {
                                  if (isGroup) {
                                    await markGroupAsRead(conv.id, currentUser.uid);
                                  } else {
                                    await markConversationAsRead(conv.id, currentUser.uid);
                                  }
                                }
                                setMenuOpenId(null); 
                              }}>
                                <CheckCheck size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600 }}>{t('messages.menu.mark_read')}</ThemedText>
                              </button>
                            )}
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}>
                              <BellOff size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600 }}>{t('messages.menu.mute')}</ThemedText>
                            </button>
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}>
                              <Info size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600 }}>{t('messages.menu.contact_info')}</ThemedText>
                            </button>
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}>
                              <UserPlus size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600 }}>{t('messages.menu.add_friend')}</ThemedText>
                            </button>
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.text }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}>
                              <Eraser size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600 }}>{t('messages.menu.clear_chat')}</ThemedText>
                            </button>
                            <div style={{ height: 1, backgroundColor: colors.border, margin: '4px 8px' }} />
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.danger }} onMouseEnter={e => e.currentTarget.style.backgroundColor = `${colors.danger}15`} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={(e) => { e.stopPropagation(); setMenuOpenId(null); }}>
                              <Ban size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600, color: colors.danger }}>{t('messages.menu.block_user', { name: conv.participantName.split(' ')[0] })}</ThemedText>
                            </button>
                            <button style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: 'none', background: 'none', cursor: 'pointer', color: colors.danger }} onMouseEnter={e => e.currentTarget.style.backgroundColor = `${colors.danger}15`} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'} onClick={async (e) => { 
                              e.stopPropagation(); 
                              if (currentUser) await deleteConversation(conv.id, currentUser.uid);
                              setMenuOpenId(null); 
                            }}>
                              <Trash2 size={16} /><ThemedText style={{ fontSize: 13, fontWeight: 600, color: colors.danger }}>{t('messages.menu.delete_chat')}</ThemedText>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {search && filteredFriends.map(f => (
                <div key={f.uid} onClick={() => navigate(`/dm/${f.uid}`)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', opacity: 0.8 }} onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <div style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ color: colors.primary, fontWeight: 'bold', fontSize: 18 }}>{f.displayName[0]}</span></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ThemedText style={{ fontWeight: '700', fontSize: 15 }}>{f.displayName}</ThemedText>
                      <div style={{ backgroundColor: ROLE_COLORS[f.role] || colors.primary, padding: '2px 8px', borderRadius: 6, opacity: 0.8 }}><span style={{ color: '#fff', fontSize: 10, fontWeight: '600' }}>{ROLE_LABELS[f.role]}</span></div>
                    </div>
                    <ThemedText style={{ fontSize: 12, opacity: 0.6 }}>{t('messages.friends.start_chat')}</ThemedText>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        <NewDMModal isOpen={showNewDMModal} onClose={() => setShowNewDMModal(false)} onSelectUser={(uid) => { setShowNewDMModal(false); navigate(`/dm/${uid}`); }} />
        <NewGroupModal isOpen={showNewGroupModal} onClose={() => setShowNewGroupModal(false)} onGroupCreated={(id) => navigate(`/dm/group/${id}`)} />
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </ThemedView>
  );
}
