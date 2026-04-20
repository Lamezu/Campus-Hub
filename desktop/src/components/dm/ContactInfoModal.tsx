import React, { useState, useEffect, useMemo } from 'react';
import {
  X, ChevronLeft, MessageSquare, Phone, Video,
  Image as ImageIcon, Star, Bell, ImagePlus,
  Plus, ChevronRight, Share2, UserPlus,
  UserCheck, Heart, Trash2, Shield, AlertTriangle,
  Loader2, Search, Send, Hash, FileText, Globe, Play, Check, Music, Download
} from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { useTranslation } from '@/contexts/LanguageContext';
import { spacing } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { collection, serverTimestamp, writeBatch, doc } from 'firebase/firestore';
import type { User, MutualGroup, MuteDuration, SaveToPhotosPreference, SharedMedia, DMConversation } from '@/types';
import { Avatar } from '@/components/common/Avatar';
import * as contactService from '@/services/contactSettingsService';
import { subscribeToConversations, getOrCreateConversation } from '@/services/dmService';
import { MOCK_CHANNELS as CHANNELS } from '@/constants/mockData';
import { useNavigate, useLocation } from 'react-router-dom';
import { AlertModal } from '@/components/AlertModal';
import { subscribeToFriendshipStatus } from '@/services/friendsService';
import { useCall } from '@/contexts/CallContext';
import { createCall } from '@/services/callService';
interface ContactInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  viewType?: string;
}
type SubView = 'media' | 'notifications' | 'photos' | 'share' | 'starred' | null;
const roleBadgeColor = (role: string) => {
  if (role === 'teacher') return '#007AFF';
  if (role === 'admin') return '#AF52DE';
  return '#34C759';
};
const roleLabel = (role: string, t: any) => {
  if (role === 'teacher') return t('common.roles.teacher');
  if (role === 'admin') return t('common.roles.admin');
  return t('common.roles.student');
};
export function ContactInfoModal({ isOpen, onClose, user, viewType }: ContactInfoModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const { setActiveCall, setActiveCallId } = useCall();
  const meId = auth.currentUser?.uid;
  const [loading, setLoading] = useState(true);
  const [activeSubView, setActiveSubView] = useState<SubView>(null);
  const [mute, setMute] = useState<MuteDuration>('off');
  const [saveToPhotos, setSaveToPhotos] = useState<SaveToPhotosPreference>('default');
  const [alertTone, setAlertTone] = useState('default');
  const [isBestFriend, setIsBestFriend] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [friendRequestStatus, setFriendRequestStatus] = useState<'none' | 'sent' | 'received'>('none');
  const [sharedMedia, setSharedMedia] = useState<SharedMedia[]>([]);
  const [mutualGroups, setMutualGroups] = useState<MutualGroup[]>([]);
  const [showClearAlert, setShowClearAlert] = useState(false);
  const [showBlockAlert, setShowBlockAlert] = useState(false);
  const [showReportAlert, setShowReportAlert] = useState(false);
  useEffect(() => {
    if (!isOpen || !meId || !user.uid) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const conversationId = [meId, user.uid].sort().join('_');
        const [settings, media, groups] = await Promise.all([
          contactService.getContactSettings(meId, user.uid),
          contactService.getSharedMedia(conversationId, 200),
          contactService.getMutualGroups(meId, user.uid)
        ]);
        setMute(settings.mute);
        setSaveToPhotos(settings.saveToPhotos);
        setAlertTone(settings.alertTone || 'default');
        setIsBestFriend(settings.isBestFriend);
        setSharedMedia(media);
        setMutualGroups(groups);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [isOpen, meId, user.uid]);
  useEffect(() => {
    if (!isOpen || !meId || !user.uid) return;
    const unsub = subscribeToFriendshipStatus(meId, user.uid, (status) => {
      if (status === 'friends') {
        setIsFriend(true);
        setFriendRequestStatus('none');
      } else {
        setIsFriend(false);
        setFriendRequestStatus(status);
      }
    });
    return () => unsub();
  }, [isOpen, meId, user.uid]);
  const handleFriendAction = async () => {
    if (!meId || !user.uid) return;
    try {
      if (friendRequestStatus === 'received') {
        await contactService.acceptFriendRequest(meId, user.uid);
        setIsFriend(true);
        setFriendRequestStatus('none');
      } else if (friendRequestStatus === 'none' && !isFriend) {
        await contactService.sendFriendRequest(meId, user.uid, auth.currentUser?.displayName || 'Usuario', auth.currentUser?.photoURL || null);
        setFriendRequestStatus('sent');
      } else if (isFriend) {
        const next = await contactService.toggleBestFriend(meId, user.uid);
        setIsBestFriend(next);
      }
    } catch (error) {
      console.error(error);
    }
  };
  const handleBlock = async () => {
    if (!meId || !user.uid) return;
    try {
      await contactService.blockUser(meId, user.uid);
      setShowBlockAlert(false);
      onClose();
    } catch (error) {
      console.error(error);
    }
  };
  const handleReport = async () => {
    if (!meId || !user.uid) return;
    try {
      await contactService.reportUser(meId, user.uid);
      setShowReportAlert(false);
      onClose();
    } catch (error) {
      console.error(error);
    }
  };
  const handleAudioCall = async () => {
    if (!meId || !user.uid) return;
    const callId = await createCall(
      meId, user.uid,
      auth.currentUser?.displayName || 'Usuario', auth.currentUser?.photoURL || null,
      user.displayName || 'Usuario', user.photoURL || null,
      'audio'
    );
    setActiveCallId(callId);
    setActiveCall({
      callId,
      isCaller: true,
      type: 'audio',
      otherUserName: user.displayName || 'Usuario',
      otherUserPhoto: user.photoURL || null,
    });
    onClose();
  };
  const handleVideoCall = async () => {
    if (!meId || !user.uid) return;
    const callId = await createCall(
      meId, user.uid,
      auth.currentUser?.displayName || 'Usuario', auth.currentUser?.photoURL || null,
      user.displayName || 'Usuario', user.photoURL || null,
      'video'
    );
    setActiveCallId(callId);
    setActiveCall({
      callId,
      isCaller: true,
      type: 'video',
      otherUserName: user.displayName || 'Usuario',
      otherUserPhoto: user.photoURL || null,
    });
    onClose();
  };
  const menuContainerStyle: React.CSSProperties = {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    border: `1px solid ${colors.border}`
  };
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: '14px 16px',
    gap: 12,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  };
  const dividerStyle: React.CSSProperties = {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 48
  };
  return (
    <>
      <div style={{
        width: isOpen ? 475 : 0,
        opacity: isOpen ? 1 : 0,
        height: '100%',
        backgroundColor: colors.background,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderLeft: isOpen ? `1px solid ${colors.border}` : 'none',
        position: 'relative',
        zIndex: 100,
        boxShadow: isOpen ? '-4px 0 16px rgba(0,0,0,0.1)' : 'none',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
      }}>
        {activeSubView === null ? (
          <>
            <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${colors.border}`, backgroundColor: colors.background, zIndex: 10 }}>
              <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
              <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('contact_info.title')}</ThemedText>
              <div style={{ width: 32 }} />
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 20px' }} className="custom-scrollbar">
              {viewType === 'support' || user.displayName?.toLowerCase().includes('ayuda') ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 16 }}>
                  <div style={{ width: 110, height: 110, borderRadius: '50%', marginBottom: 20 }}>
                    <Avatar 
                      src={user.photoURL} 
                      name={user.displayName} 
                      size={110} 
                      style={{ border: `4px solid ${colors.border}` }} 
                    />
                  </div>
                  <ThemedText style={{ fontSize: 24, fontWeight: 800, marginBottom: 12, textAlign: 'center' }}>{user.displayName}</ThemedText>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 15, textAlign: 'center', lineHeight: '1.5', padding: '0 8px' }}>{user.bio || t('contact_info.bio_default')}</ThemedText>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
                    <div style={{ width: 110, height: 110, borderRadius: '50%', marginBottom: 16 }}>
                      <Avatar 
                        src={user.photoURL} 
                        name={user.displayName} 
                        size={110} 
                        style={{ border: `4px solid ${colors.border}` }} 
                      />
                    </div>
                    <ThemedText style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>{user.displayName}</ThemedText>
                    <div style={{ padding: '4px 12px', borderRadius: 20, backgroundColor: `${roleBadgeColor(user.role)}22`, color: roleBadgeColor(user.role), fontSize: 12, fontWeight: 700, marginBottom: 12 }}>{roleLabel(user.role, t)}</div>
                    <ThemedText style={{ color: colors.textSecondary, fontSize: 14, textAlign: 'center' }}>{user.bio || t('chat_ui.channel_info.no_bio')}</ThemedText>
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                    {[
                      { icon: MessageSquare, label: t('chat_ui.menu.reply'), onClick: () => { onClose(); navigate(`/dm/${user.uid}`); } },
                      ...(user.displayName !== 'Usuario eliminado' ? [
                        { icon: Phone, label: t('dm_chat.menu.audio_call').replace('📞 ', ''), onClick: handleAudioCall },
                        { icon: Video, label: t('dm_chat.menu.video_call').replace('📹 ', ''), onClick: handleVideoCall }
                      ] : [])
                    ].map((action, i) => (
                      <button key={i} onClick={action.onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '16px 0', borderRadius: 16, backgroundColor: colors.backgroundSecondary, border: 'none', cursor: 'pointer', transition: 'transform 0.1s' }}><action.icon size={22} color={colors.primary} /><ThemedText style={{ fontSize: 12, fontWeight: 600 }}>{action.label}</ThemedText></button>
                    ))}
                  </div>
                  <div style={menuContainerStyle}>
                    <div style={rowStyle} onClick={() => setActiveSubView('media')}>
                      <ImageIcon size={20} color={colors.textSecondary} />
                      <ThemedText style={{ flex: 1, fontWeight: 600 }}>{t('chat_ui.channel_info.starred_view.image')}, {t('common.more').toLowerCase()}...</ThemedText>
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{sharedMedia.length}</ThemedText>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </div>
                    <div style={dividerStyle} />
                    <div style={rowStyle} onClick={() => setActiveSubView('starred')}>
                      <Star size={20} color={colors.textSecondary} />
                      <ThemedText style={{ flex: 1, fontWeight: 600 }}>{t('chat_ui.channel_info.starred_messages')}</ThemedText>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </div>
                    <div style={dividerStyle} />
                    <div style={rowStyle} onClick={() => setActiveSubView('notifications')}>
                      <Bell size={20} color={colors.textSecondary} />
                      <ThemedText style={{ flex: 1, fontWeight: 600 }}>{t('settings.notifications')}</ThemedText>
                      <ThemedText style={{ color: colors.textSecondary, fontSize: 14 }}>{mute === 'off' ? t('settings.mute_options.none') : (mute === '8h' ? t('settings.mute_options.8h') : (mute === '1w' ? t('settings.mute_options.1w') : t('settings.mute_options.always')))}</ThemedText>
                      <ChevronRight size={18} color={colors.textSecondary} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 24 }}>
                    <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 8 }}>{t('contact_info.mutual_groups')}</ThemedText>
                    <div style={menuContainerStyle}>
                      <div style={{ ...rowStyle, color: colors.primary }}>
                        <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={18} /></div>
                        <ThemedText style={{ fontWeight: 700, color: colors.primary }}>{t('contact_info.create_group_with', { name: user.displayName.split(' ')[0] })}</ThemedText>
                      </div>
                      {mutualGroups.map((group, i) => (
                        <React.Fragment key={group.id}>
                          <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 64 }} />
                          <div style={rowStyle} onClick={() => {
                            const prefix = group.type === 'studyGroup' ? 'sg_' : '';
                            navigate(`/chat/${prefix}${group.id}`);
                          }}>
                            <Avatar 
                              src={null} 
                              name={group.name} 
                              size={36} 
                              style={{ borderRadius: '50%' }} 
                            />
                            <div style={{ flex: 1 }}>
                              <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{group.name}</ThemedText>
                              <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block' }}>{t('chat_ui.members_count', { count: group.memberCount })} • {group.memberPreview}</ThemedText>
                            </div>
                            <ChevronRight size={18} color={colors.textSecondary} />
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                  <div style={menuContainerStyle}>
                    <div style={{ ...rowStyle, color: '#34C759' }} onClick={() => setActiveSubView('share')}>
                      <Share2 size={20} />
                      <ThemedText style={{ fontWeight: 600, color: '#34C759' }}>{t('contact_info.share')}</ThemedText>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ ...rowStyle, cursor: friendRequestStatus === 'sent' ? 'default' : 'pointer' }} onClick={handleFriendAction}>
                      {isFriend ? (isBestFriend ? <Heart size={20} color={colors.primary} fill={colors.primary} /> : <UserCheck size={20} color={colors.primary} />) : friendRequestStatus === 'received' ? (<UserCheck size={20} color="#34C759" />) : (<UserPlus size={20} color={friendRequestStatus === 'sent' ? colors.textSecondary : colors.primary} />)}
                      <ThemedText style={{ flex: 1, fontWeight: 600, color: isFriend ? colors.primary : (friendRequestStatus === 'received' ? '#34C759' : (friendRequestStatus === 'sent' ? colors.textSecondary : colors.primary)) }}>
                        {isFriend ? (isBestFriend ? t('contact_info.best_friend_remove') : t('contact_info.best_friend_add')) : (friendRequestStatus === 'received' ? t('contact_info.friend_request_accept') : (friendRequestStatus === 'sent' ? t('contact_info.friend_request_sent') : t('contact_info.friend_request_send')))}
                      </ThemedText>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ ...rowStyle, color: '#FF9500' }} onClick={() => setShowClearAlert(true)}>
                      <Trash2 size={20} />
                      <ThemedText style={{ fontWeight: 600, color: '#FF9500' }}>{t('contact_info.clear_chat')}</ThemedText>
                    </div>
                  </div>
                  <div style={menuContainerStyle}>
                    <div style={{ ...rowStyle, color: colors.danger }} onClick={() => setShowBlockAlert(true)}>
                      <Shield size={20} />
                      <ThemedText style={{ fontWeight: 600, color: colors.danger }}>{t('contact_info.block', { name: user.displayName.split(' ')[0] })}</ThemedText>
                    </div>
                    <div style={dividerStyle} />
                    <div style={{ ...rowStyle, color: colors.danger }} onClick={() => setShowReportAlert(true)}>
                      <AlertTriangle size={20} />
                      <ThemedText style={{ fontWeight: 600, color: colors.danger }}>{t('contact_info.report', { name: user.displayName.split(' ')[0] })}</ThemedText>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : activeSubView === 'starred' ? (
          <StarredMessagesView user={user} onBack={() => setActiveSubView(null)} />
        ) : activeSubView === 'media' ? (
          <SharedMediaView user={user} media={sharedMedia} onBack={() => setActiveSubView(null)} />
        ) : activeSubView === 'notifications' ? (
          <NotificationsView
            mute={mute}
            currentTone={alertTone}
            onMuteChange={async (m) => {
              setMute(m);
              await contactService.updateContactSettings(meId!, user.uid, { mute: m });
            }}
            onToneChange={async (tName) => {
              setAlertTone(tName);
              const { playTone } = await import('@/utils/toneGenerator');
              playTone(tName === 'none' ? 'silent' : tName);
              await contactService.updateContactSettings(meId!, user.uid, { alertTone: tName });
            }}
            onBack={() => setActiveSubView(null)}
          />
        ) : activeSubView === 'share' ? (
          <ShareContactModal user={user} onBack={() => setActiveSubView(null)} />
        ) : null}
      </div>
      <AlertModal
        isOpen={showClearAlert}
        type="confirm"
        title={t('contact_info.clear_chat')}
        message={t('chat_ui.channel_info.alerts.clear_msg', { name: user.displayName })}
        confirmText={t('chat_ui.delete_btn')}
        showCancelButton
        onClose={() => setShowClearAlert(false)}
        onConfirm={async () => {
          const conversationId = [meId, user.uid].sort().join('_');
          await contactService.clearChat(conversationId, meId!);
          setShowClearAlert(false);
          onClose();
        }}
      />
      <AlertModal
        isOpen={showBlockAlert}
        type="confirm"
        title={t('contact_info.block', { name: user.displayName.split(' ')[0] })}
        message={t('friends_screen.alerts.remove_friend_msg', { name: user.displayName })}
        confirmText={t('common.confirm')}
        showCancelButton
        onClose={() => setShowBlockAlert(false)}
        onConfirm={handleBlock}
      />
      <AlertModal
        isOpen={showReportAlert}
        type="confirm"
        title={t('contact_info.report', { name: user.displayName.split(' ')[0] })}
        message={t('chat_ui.delete_bg_msg')}
        confirmText={t('common.confirm')}
        showCancelButton
        onClose={() => setShowReportAlert(false)}
        onConfirm={handleReport}
      />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: ${colors.border}; border-radius: 10px; }
      `}</style>
    </>
  );
}
const handleDownload = async (url: string, filename: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  } catch (error) {
    console.error('Download error:', error);
    window.open(url, '_blank');
  }
};
const handleViewMedia = (url: string) => {
  window.open(url, '_blank');
};
function StarredMessagesView({ user, onBack }: { user: User, onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const meId = auth.currentUser?.uid;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!meId || !user.uid) return;
    const conversationId = [meId, user.uid].sort().join('_');
    import('@/services/starredMessagesService').then(service => {
      service.getStarredMessagesForDM(meId, conversationId).then(msgs => {
        setItems(msgs);
        setLoading(false);
      }).catch(() => setLoading(false));
    });
  }, [meId, user.uid]);
  const handleUnstar = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const service = await import('@/services/starredMessagesService');
    await service.unstarMessage(meId!, id);
    setItems(prev => prev.filter(m => m.id !== id));
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('chat_ui.channel_info.starred_messages')}</ThemedText>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}><Loader2 size={32} className="animate-spin" color={colors.primary} /></div>
        ) : items.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 12, padding: 40, textAlign: 'center' }}>
            <Star size={48} />
            <ThemedText style={{ fontWeight: 700 }}>{t('chat_ui.channel_info.starred_view.no_starred')}</ThemedText>
            <ThemedText style={{ fontSize: 13 }}>{t('chat_ui.channel_info.starred_view.no_starred_desc')}</ThemedText>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map((item) => (
              <div
                key={item.id}
                style={{ padding: '16px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer', transition: 'background-color 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                onClick={() => {
                  const params = new URLSearchParams(location.search);
                  params.set('highlightId', item.id);
                  navigate({ search: params.toString() }, { replace: true });
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ fontWeight: 700, color: colors.primary, fontSize: 14 }}>{item.senderName || user.displayName}</ThemedText>
                    <ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleString()}</ThemedText>
                  </div>
                  <button
                    onClick={(e) => handleUnstar(item.id, e)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#FFD60A' }}
                  >
                    <Star size={18} fill="#FFD60A" />
                  </button>
                </div>
                <ThemedText style={{ fontSize: 14, lineHeight: '1.4' }} numberOfLines={3}>{item.text || (item.type === 'image' ? t('chat_ui.channel_info.starred_view.image') : item.type === 'file' ? t('chat_ui.channel_info.starred_view.file') : t('chat_ui.channel_info.starred_view.message'))}</ThemedText>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
function SharedMediaView({ user, media, onBack }: { user: User, media: SharedMedia[], onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState<'images' | 'videos' | 'files' | 'audio' | 'links'>('images');
  const [fullScreenMedia, setFullScreenMedia] = useState<SharedMedia | null>(null);
  const filteredMedia = useMemo(() => {
    return media.filter(m => {
      if (activeTab === 'images') return m.type === 'image';
      if (activeTab === 'videos') return m.type === 'video';
      if (activeTab === 'files') return m.type === 'file';
      if (activeTab === 'audio') return m.type === 'audio';
      if (activeTab === 'links') return m.type === 'link';
      return false;
    });
  }, [media, activeTab]);
  const tabs = [
    { id: 'images', key: 'images', icon: ImageIcon, label: t('chat_ui.image') },
    { id: 'videos', key: 'videos', icon: ImageIcon, label: t('chat_ui.video') },
    { id: 'files', key: 'documents', icon: FileText, label: t('saved_items.tabs.documents') },
    { id: 'audio', key: 'audio', icon: Music, label: 'Audio' },
    { id: 'links', key: 'links', icon: Globe, label: 'Links' },
  ];
  const currentTabLabel = tabs.find(t => t.id === activeTab)?.label || t('saved_items.tabs.documents');
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
          <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
          <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{currentTabLabel}</ThemedText>
        </div>
        <div style={{ display: 'flex', overflowX: 'auto', padding: '0 10px', borderBottom: `1px solid ${colors.border}` }} className="no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '16px 12px',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `3px solid ${colors.primary}` : '3px solid transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <ThemedText style={{
                fontSize: 13,
                fontWeight: activeTab === tab.id ? 800 : 600,
                color: activeTab === tab.id ? colors.primary : colors.textSecondary
              }}>
                {tab.label} ({media.filter(m => m.type === (tab.id === 'files' ? 'file' : tab.id === 'images' ? 'image' : tab.id === 'videos' ? 'video' : tab.id)).length})
              </ThemedText>
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }} className="custom-scrollbar">
          {filteredMedia.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', opacity: 0.5, gap: 12 }}>
              <ImageIcon size={48} />
              <ThemedText>{t('saved_items.empty.none')}</ThemedText>
            </div>
          ) : (
            <div style={{
              display: activeTab === 'images' || activeTab === 'videos' ? 'grid' : 'flex',
              flexDirection: 'column',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 8
            }}>
              {filteredMedia.map((item, i) => (
                <div key={i} onClick={() => (item.type === 'image' || item.type === 'video') ? setFullScreenMedia(item) : handleViewMedia(item.url)} style={{ cursor: 'pointer' }}>
                  {item.type === 'image' || item.type === 'video' ? (
                    <div style={{ aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundSecondary, position: 'relative' }}>
                      <img src={item.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {item.type === 'video' && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' }}><Play size={20} color="#fff" fill="#fff" /></div>}
                      <ThemedText style={{ position: 'absolute', bottom: 4, left: 4, fontSize: 10, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>{item.name}</ThemedText>
                    </div>
                  ) : item.type === 'audio' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Music size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{new Date(item.createdAt).toLocaleDateString()}</ThemedText></div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.url, item.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                      >
                        <Download size={18} color={colors.textSecondary} />
                      </button>
                    </div>
                  ) : item.type === 'link' ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }} onClick={() => window.open(item.url, '_blank')}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Globe size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }} numberOfLines={1}>{item.name || item.url}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.primary }} numberOfLines={1}>{item.url}</ThemedText></div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: colors.card, borderRadius: 12, border: `1px solid ${colors.border}`, marginBottom: 8 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><FileText size={18} color={colors.primary} /></div>
                      <div style={{ flex: 1 }}><ThemedText style={{ fontSize: 14, fontWeight: 600 }}>{item.name}</ThemedText><ThemedText style={{ fontSize: 11, color: colors.textSecondary }}>{(item.size / 1024 / 1024).toFixed(1)} MB</ThemedText></div>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(item.url, item.name); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                      >
                        <Download size={18} color={colors.textSecondary} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {fullScreenMedia && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={() => setFullScreenMedia(null)} style={{ position: 'absolute', top: 40, left: 20, background: 'rgba(0,0,0,0.5)', border: 'none', cursor: 'pointer', color: '#fff', padding: 8, borderRadius: '50%' }}><ChevronLeft size={24} /></button>
          {fullScreenMedia.type === 'video' ? (
            <video src={fullScreenMedia.url} autoPlay controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
          ) : (
            <img src={fullScreenMedia.url} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="" />
          )}
          <div style={{ position: 'absolute', bottom: 40, left: 20, right: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <ThemedText style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{fullScreenMedia.name}</ThemedText>
            <button
              onClick={() => handleDownload(fullScreenMedia.url, fullScreenMedia.name)}
              style={{ background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: '#fff', padding: '8px 16px', borderRadius: 20, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Download size={18} /> {t('post_screen.save')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function NotificationsView({ mute, currentTone, onMuteChange, onToneChange, onBack }: { mute: MuteDuration, currentTone: string, onMuteChange: (m: MuteDuration) => void, onToneChange: (t: string) => void, onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const muteOptions: { id: MuteDuration, label: string }[] = [
    { id: '8h', label: t('settings.mute_options.8h') },
    { id: '1w', label: t('settings.mute_options.1w') },
    { id: 'always', label: t('settings.mute_options.always') },
    { id: 'off', label: t('settings.mute_options.none') }
  ];
  const tones = ['default', 'classic', 'soft', 'melody', 'bell', 'pulse', 'none'];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('settings.notifications')}</ThemedText>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: 20 }} className="custom-scrollbar">
        <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>{t('chat_ui.channel_info.mute_notifs')}</ThemedText>
        <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
          {muteOptions.map((opt, i) => (
            <React.Fragment key={opt.id}>
              <div onClick={() => onMuteChange(opt.id)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <div style={{ flex: 1 }}>
                  <ThemedText style={{ fontWeight: 700, fontSize: 15 }}>{opt.label}</ThemedText>
                </div>
                {mute === opt.id && <Check size={20} color={colors.primary} />}
              </div>
              {i < muteOptions.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 16 }} />}
            </React.Fragment>
          ))}
        </div>
        <ThemedText style={{ fontSize: 12, fontWeight: 800, color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, marginLeft: 8 }}>{t('settings.notifications_desc')}</ThemedText>
        <div style={{ backgroundColor: colors.card, borderRadius: 16, border: `1px solid ${colors.border}`, overflow: 'hidden', marginBottom: 24 }}>
          {tones.map((tone, i) => (
            <React.Fragment key={tone}>
              <div onClick={() => onToneChange(tone)} style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                <Music size={18} color={colors.textSecondary} />
                <ThemedText style={{ flex: 1, fontWeight: 600, fontSize: 15 }}>{t(`settings.tones.${tone}`)}</ThemedText>
                {currentTone === tone && <Check size={20} color={colors.primary} />}
              </div>
              {i < tones.length - 1 && <div style={{ height: 1, backgroundColor: colors.border, marginLeft: 48 }} />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
function ShareContactModal({ user, onBack }: { user: User, onBack: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userData } = useCurrentUser();
  const [activeTab, setActiveTab] = useState<'channels' | 'dms'>('channels');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [sending, setSending] = useState(false);
  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    return subscribeToConversations(meId, setConversations);
  }, []);
  const filteredItems = useMemo(() => {
    const q = query.toLowerCase();
    const isAdmin = userData?.role === 'admin' || userData?.role === 'teacher';
    if (activeTab === 'channels') {
      return CHANNELS.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(q);
        if (!matchesSearch) return false;
        if (isAdmin) return true;
        const nameLower = c.name.toLowerCase();
        const isRestricted = nameLower.includes('anuncios') || nameLower.includes('actividades') || nameLower.includes('ayuda') || nameLower.includes('soporte');
        return !isRestricted;
      });
    } else {
      return conversations.filter(c => c.participantName.toLowerCase().includes(q));
    }
  }, [activeTab, query, conversations, userData]);
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const handleSend = async () => {
    if (selectedIds.size === 0) return;
    setSending(true);
    try {
      const me = auth.currentUser;
      if (!me) return;
      const contactCard = {
        userId: user.uid,
        name: user.displayName || 'Usuario',
        photo: user.photoURL || null,
        role: user.role || 'student',
        bio: user.bio || null
      };
      const batch = writeBatch(db);
      for (const id of Array.from(selectedIds)) {
        if (activeTab === 'channels') {
          const chMsgRef = doc(collection(db, 'channels', id, 'messages'));
          batch.set(chMsgRef, {
            text: '',
            senderId: me.uid,
            senderName: me.displayName || 'Tú',
            senderPhoto: me.photoURL,
            createdAt: serverTimestamp(),
            edited: false,
            reactions: {},
            replyTo: null,
            forwarded: true,
            contactCard
          });
        } else {
          const conv = conversations.find(c => c.id === id);
          if (conv) {
            const convId = await getOrCreateConversation(me.uid, conv.participantId);
            const dmMsgRef = doc(collection(db, 'conversations', convId, 'messages'));
            batch.set(dmMsgRef, {
              text: '',
              senderId: me.uid,
              senderName: me.displayName || 'Tú',
              senderPhoto: me.photoURL,
              createdAt: serverTimestamp(),
              edited: false,
              reactions: {},
              replyTo: null,
              forwarded: true,
              contactCard
            });
          }
        }
      }
      await batch.commit();
      onBack();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.background }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${colors.border}` }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}><ChevronLeft size={24} /></button>
        <ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('contact_info.share')}</ThemedText>
      </div>
      <div style={{ padding: '12px 20px', borderBottom: `1px solid ${colors.border}` }}>
        <ThemedText style={{ fontSize: 12, color: colors.textSecondary, display: 'block', marginBottom: 4 }}>{t('forward.preview_label')}</ThemedText>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Avatar 
            src={user.photoURL} 
            name={user.displayName} 
            size={32} 
          />
          <ThemedText style={{ fontSize: 16, fontWeight: 800 }}>{user.displayName}</ThemedText>
        </div>
      </div>
      <div style={{ display: 'flex', borderBottom: `1px solid ${colors.border}` }}>
        {(['channels', 'dms'] as const).map(tabId => (
          <button key={tabId} onClick={() => { setActiveTab(tabId); setQuery(''); }} style={{ flex: 1, padding: 16, background: 'none', border: 'none', borderBottom: activeTab === tabId ? `2px solid ${colors.primary}` : 'none', cursor: 'pointer' }}>
            <ThemedText style={{ fontWeight: 700, color: activeTab === tabId ? colors.primary : colors.textSecondary }}>{tabId === 'channels' ? t('forward.tabs.channels') : t('forward.tabs.dms')}</ThemedText>
          </button>
        ))}
      </div>
      <div style={{ padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: colors.backgroundSecondary, borderRadius: 10 }}>
          <Search size={16} color={colors.textSecondary} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={activeTab === 'channels' ? t('forward.search.channels') : t('forward.search.dms')}
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14 }}
          />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
        {filteredItems.map((item: any) => {
          const id = item.id;
          const isSelected = selectedIds.has(id);
          const name = activeTab === 'channels' ? item.name : item.participantName;
          const photo = activeTab === 'channels' ? null : item.participantPhoto;
          const desc = activeTab === 'channels' ? item.description : (item.participantRole === 'teacher' ? t('forward.roles.teacher') : t('forward.roles.student'));
          return (
            <div key={id} onClick={() => toggleSelect(id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${colors.border}`, cursor: 'pointer' }}>
              <div style={{ width: 44, height: 44, borderRadius: activeTab === 'channels' ? 12 : 22, overflow: 'hidden' }}>
                {activeTab === 'channels' ? (
                  <div style={{ width: '100%', height: '100%', backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Hash size={20} color={colors.primary} />
                  </div>
                ) : (
                  <Avatar 
                    src={photo} 
                    name={name} 
                    size={44} 
                  />
                )}
              </div>
              <div style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: 700 }}>{name}</ThemedText>
                <ThemedText style={{ fontSize: 12, color: colors.textSecondary }}>{desc}</ThemedText>
              </div>
              <div style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${isSelected ? colors.primary : colors.border}`, backgroundColor: isSelected ? colors.primary : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: 20, borderTop: `1px solid ${colors.border}` }}>
        <button
          onClick={handleSend}
          disabled={selectedIds.size === 0 || sending}
          style={{ width: '100%', padding: '16px', borderRadius: 16, backgroundColor: selectedIds.size > 0 ? colors.primary : colors.border, border: 'none', cursor: selectedIds.size > 0 ? 'pointer' : 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {sending ? <Loader2 size={24} className="animate-spin" color="#fff" /> : <><Send size={20} color="#fff" /><ThemedText style={{ fontWeight: 700, color: '#fff' }}>{t('forward.button.send')} {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}</ThemedText></>}
        </button>
      </div>
    </div>
  );
}