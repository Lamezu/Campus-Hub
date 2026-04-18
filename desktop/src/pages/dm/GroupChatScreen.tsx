import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, Settings, Users, Search, Plus, Info, LogOut, Phone, Video, Camera, Loader2, Bold, Italic, Trash2, Type, Check } from 'lucide-react';
import { ChatBackgroundEditor } from '@/components/chat/ChatBackgroundEditor';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { chatThemes, spacing } from '@/constants/styles';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/config/firebase';
import { useAlert } from '@/contexts/AlertContext';
import { notificationService } from '@/services/notificationService';
import type { Message, GroupConversation, ReplyPreview } from '@/types';
import * as groupService from '@/services/groupDMService';
import { GroupInfoSidebar } from '../../components/dm/GroupInfoSidebar';
import { ForwardModal } from '@/components/ForwardModal';
import { ContactInfoModal } from '@/components/dm/ContactInfoModal';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { User } from '@/types';
import { useCall } from '@/contexts/CallContext';
import { createGroupCall } from '@/services/groupCallService';
import { useTranslation } from '@/contexts/LanguageContext';
import { ChatLoadingOverlay } from '@/components/chat/ChatLoadingOverlay';

export default function GroupChatScreen() {
  const { t } = useTranslation();
  const { colors, chatSettings, setChatSettings } = useTheme();
  const { showAlert } = useAlert();
  const { groupId } = useParams<{ groupId: string }>();
  const { setActiveGroupCall, setActiveGroupCallId } = useCall();
  const navigate = useNavigate();

  const location = useLocation();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<User | null>(null);
  const [uploadingBg, setUploadingBg] = useState(false);
  const [editingBgImage, setEditingBgImage] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const handleAudioCall = async () => {
    if (!currentUser || !group || !groupId) return;
    const participantData: Record<string, { name: string; photo: string | null }> = {};
    group.members.forEach(uid => {
      participantData[uid] = {
        name: group.memberNames[uid] || t('profile.username_placeholder'),
        photo: group.memberPhotos[uid] || null
      };
    });
    const callId = await createGroupCall(
      groupId,
      group.name || t('group_chat.group_placeholder'),
      group.photoURL,
      currentUser.uid,
      currentUser.displayName || t('profile.username_placeholder'),
      currentUser.photoURL,
      'audio',
      group.members,
      participantData
    );
    setActiveGroupCallId(callId);
    setActiveGroupCall({
      callId,
      isInitiator: true,
      type: 'audio',
      groupName: group.name || t('group_chat.group_placeholder'),
      groupPhoto: group.photoURL || null,
      myUid: currentUser.uid,
      myName: currentUser.displayName || t('profile.username_placeholder'),
      myPhoto: currentUser.photoURL || null,
    });
  };

  const handleVideoCall = async () => {
    if (!currentUser || !group || !groupId) return;
    const participantData: Record<string, { name: string; photo: string | null }> = {};
    group.members.forEach(uid => {
      participantData[uid] = {
        name: group.memberNames[uid] || t('profile.username_placeholder'),
        photo: group.memberPhotos[uid] || null
      };
    });
    const callId = await createGroupCall(
      groupId,
      group.name || t('group_chat.group_placeholder'),
      group.photoURL,
      currentUser.uid,
      currentUser.displayName || t('profile.username_placeholder'),
      currentUser.photoURL,
      'video',
      group.members,
      participantData
    );
    setActiveGroupCallId(callId);
    setActiveGroupCall({
      callId,
      isInitiator: true,
      type: 'video',
      groupName: group.name || t('group_chat.group_placeholder'),
      groupPhoto: group.photoURL || null,
      myUid: currentUser.uid,
      myName: currentUser.displayName || t('profile.username_placeholder'),
      myPhoto: currentUser.photoURL || null,
    });
  };

  
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!groupId || !currentUser) return;

    const unsubInfo = groupService.subscribeToGroupInfo(groupId, (data) => {
      setGroup(data);
    });

    const unsubMsgs = groupService.subscribeToGroupMessages(groupId, currentUser.uid, (newMsgs) => {
      setMessages(newMsgs);
      setLoading(false);
      groupService.markGroupAsRead(groupId, currentUser.uid);
    }, () => setLoading(false));

    return () => {
      unsubInfo();
      unsubMsgs();
    };
  }, [groupId, currentUser]);

  useEffect(() => {
    if (!groupId) return;
    notificationService.setCurrentView({ type: 'group', id: groupId });
    return () => {
      notificationService.setCurrentView(null);
    };
  }, [groupId]);

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      await groupService.sendGroupMessage(
        groupId, 
        currentUser.uid, 
        currentUser.displayName || t('profile.username_placeholder'), 
        currentUser.photoURL, 
        text, 
        null, 
        replyData
      );

        if (group) {
          const targets = group.members.filter(uid => uid !== currentUser.uid);
          if (targets.length > 0) {
            notificationService.addNotificationsBatch(targets, {
              title: group.name || t('group_chat.notification_title'),
              body: text,
              category: 'group',
              meta: { groupId, groupName: group.name || t('group_chat.group_placeholder') },
            });
          }
        }
    } catch {
      showAlert({ title: t('common.error'), message: t('group_chat.error.send_msg'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await groupService.sendGroupAudio(
        groupId, 
        currentUser.uid, 
        currentUser.displayName || t('profile.username_placeholder'), 
        currentUser.photoURL, 
        url, 
        duration
      );
        if (group) {
          const targets = group.members.filter(uid => uid !== currentUser.uid);
          if (targets.length > 0) {
            notificationService.addNotificationsBatch(targets, {
              title: group.name || t('group_chat.notification_title'),
              body: t('group_chat.voice_message_from', { name: currentUser.displayName || t('profile.username_placeholder') }),
              category: 'group',
              meta: { groupId, groupName: group.name || t('group_chat.group_placeholder') },
            });
          }
        }
    } catch {
      showAlert({ title: t('common.error'), message: t('group_chat.error.send_audio'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video') => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await groupService.sendGroupMedia(
        groupId, 
        currentUser.uid, 
        currentUser.displayName || t('profile.username_placeholder'), 
        currentUser.photoURL, 
        url, 
        type
      );
        if (group) {
          const targets = group.members.filter(uid => uid !== currentUser.uid);
          if (targets.length > 0) {
            notificationService.addNotificationsBatch(targets, {
              title: group.name || t('group_chat.notification_title'),
              body: t('group_chat.file_from', { type: type === 'image' ? t('chat_ui.image') : t('chat_ui.video'), name: currentUser.displayName || t('profile.username_placeholder') }),
              category: 'group',
              meta: { groupId, groupName: group.name || t('group_chat.group_placeholder') },
            });
          }
        }
    } catch {
      showAlert({ title: t('common.error'), message: t('group_chat.error.send_file'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendPoll = async (pollData: { question: string; options: string[]; multipleAnswers: boolean }) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await groupService.sendGroupPoll(
        groupId, 
        currentUser.uid, 
        currentUser.displayName || t('profile.username_placeholder'), 
        currentUser.photoURL, 
        pollData
      );
        if (group) {
          const targets = group.members.filter(uid => uid !== currentUser.uid);
          if (targets.length > 0) {
            notificationService.addNotificationsBatch(targets, {
              title: group.name || t('group_chat.notification_title'),
              body: t('group_chat.poll_from', { name: currentUser.displayName || t('profile.username_placeholder'), question: pollData.question }),
              category: 'group',
              meta: { groupId, groupName: group.name || t('group_chat.group_placeholder') },
            });
          }
        }
    } catch {
      showAlert({ title: t('common.error'), message: t('group_chat.error.create_poll'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleReact = async (id: string, emoji: string) => {
    if (!currentUser || !groupId) return;
    await groupService.toggleGroupReaction(groupId, id, emoji, currentUser.uid);
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !groupId) return;
    await groupService.voteGroupPoll(groupId, messageId, optionId, currentUser.uid);
  };

  const handleDelete = async (msgId: string, forAll = false) => {
    if (!currentUser || !groupId) return;
    if (forAll) await groupService.deleteGroupMessageForAll(groupId, msgId);
    else await groupService.deleteGroupMessageForMe(groupId, msgId, currentUser.uid);
  };

  const handleUserClick = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setSelectedContact({ uid, ...snap.data() } as User);
      }
    } catch (error) {
      console.error('Error fetching user for contact card:', error);
    }
  };

  const handleLeaveGroup = () => {
    if (!currentUser || !groupId) return;
    showAlert({
      title: t('group_chat.leave.title'),
      message: t('group_chat.leave.confirm_msg'),
      type: 'confirm',
      showCancelButton: true,
      onConfirm: async () => {
        await groupService.leaveGroup(groupId, currentUser.uid);
        navigate('/tabs/messages');
      }
    });
  };


  const groupName = group?.name || t('group_chat.group_placeholder');
  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.text?.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const customBackground = chatSettings.customBackground;
  const backgroundActive = !!(customBackground || chatThemes[chatSettings.themeId]?.backgroundImage);
  const backgroundUrl = customBackground?.url || chatThemes[chatSettings.themeId]?.backgroundImage;

  const handleBgChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingBg(true);
    try {
      const url = await uploadChannelPhoto(file, `group_bg_${Date.now()}`);
      setEditingBgImage(url);
    } catch (error) {
      console.error(error);
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const handleSaveEditedBg = (url: string, x: number, y: number, scale: number) => {
    const newBg = { url, x, y, scale };
    const saved = chatSettings.savedCustomBackgrounds || [];
    const filtered = saved.filter(b => b.url !== url);
    const updatedSaved = [newBg, ...filtered].slice(0, 10);

    setChatSettings({
      customBackground: newBg,
      savedCustomBackgrounds: updatedSaved
    });
    setEditingBgImage(null);
    setShowSettings(false);
  };

  const removeBackground = () => {
    if (!customBackground) return;
    showAlert({
      title: t('chat_ui.delete_bg_title'),
      message: t('chat_ui.delete_bg_msg'),
      type: 'confirm',
      showCancelButton: true,
      onConfirm: () => {
        const saved = chatSettings.savedCustomBackgrounds || [];
        const updatedSaved = saved.filter(b => b.url !== customBackground.url);
        setChatSettings({ 
          customBackground: null,
          themeId: 'default',
          savedCustomBackgrounds: updatedSaved
        });
      }
    });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `0 ${spacing.md}px`, backgroundColor: colors.card, borderBottom: `1px solid ${colors.border}`, height: 64, flexShrink: 0, zIndex: 10 }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex' }}><ChevronLeft size={24} /></button>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => setShowGroupInfo(true)}>
            <div style={{ position: 'relative' }}>
              {group?.photoURL ? (
                <img src={group.photoURL} alt="" style={{ width: 40, height: 40, borderRadius: 12, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: `${colors.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={20} color={colors.primary} />
                </div>
              )}
            </div>
            <div style={{ minWidth: 0 }}>
              <ThemedText style={{ fontWeight: '700', fontSize: 16, display: 'block', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</ThemedText>
              <ThemedText style={{ fontSize: 11, opacity: 0.7, display: 'block', color: colors.textSecondary }}>
                {t('group_chat.member_count', { count: group?.members?.length || 0 })} • {(group?.members?.length || 0) > 1 ? t('group_chat.active_group') : t('group_chat.only_you')}
              </ThemedText>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <button 
              onClick={handleAudioCall} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, padding: 8, borderRadius: 8, display: 'flex' }}
            >
              <Phone size={20} />
            </button>
            <button 
              onClick={handleVideoCall} 
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, padding: 8, borderRadius: 8, display: 'flex' }}
            >
              <Video size={20} />
            </button>

            <button onClick={() => setIsSearchOpen(!isSearchOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSearchOpen ? colors.primary : colors.text, padding: 8, borderRadius: 8, display: 'flex' }}><Search size={20} /></button>
            <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, padding: 8, borderRadius: 8, display: 'flex' }}><Settings size={22} /></button>
          </div>


        </div>

        {isSearchOpen && (
          <div style={{ padding: `8px ${spacing.md}px`, backgroundColor: colors.backgroundSecondary, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', gap: spacing.sm, animation: 'slideDown 0.2s ease-out' }}>
            <Search size={16} color={colors.textSecondary} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('group_chat.search_placeholder')}
              style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: colors.text, fontSize: 14, padding: '4px 0' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><Plus size={16} style={{ transform: 'rotate(45deg)' }} /></button>
            )}
          </div>
        )}

        <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          {backgroundUrl && (
            <div style={{
              position: 'absolute', inset: 0,
              zIndex: 0,
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              transform: customBackground ? `translate(${customBackground.x * 100}%, ${customBackground.y * 100}%) scale(${customBackground.scale})` : 'none',
              pointerEvents: 'none'
            }} />
          )}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column-reverse', padding: `${spacing.md}px 0`, position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredMessages.length === 0 ? (
                <div style={{ padding: spacing.xl, textAlign: 'center', opacity: 0.6 }}>
                  <ThemedText style={{ color: backgroundActive ? '#FFFFFF' : colors.text }}>
                    {searchQuery ? t('chat_ui.no_messages_found') : t('group_chat.empty_greet')}
                  </ThemedText>
                </div>
              ) : [...filteredMessages].reverse().map((msg) => (
                <MessageBubble 
                  key={msg.id}
                  message={msg} 
                  isOwnMessage={msg.senderId === currentUser?.uid} 
                  currentUserId={currentUser?.uid} 
                  onReply={(m) => {
                    const firstAttachment = m.attachments?.[0];
                    setReplyingTo({ 
                      id: m.id, 
                      text: m.text || '', 
                      senderName: m.senderName,
                      isAudio: firstAttachment?.type === 'audio',
                      type: (firstAttachment?.type as any) || (m.poll ? 'poll' : 'text'),
                      attachmentName: firstAttachment?.name || undefined
                    });
                  }} 
                  onLongPress={() => {}}
                  onDelete={handleDelete} 
                  onReact={handleReact} 
                  onVotePoll={(optId: string) => handleVotePoll(msg.id, optId)} 
                  onForward={(m) => setForwardingMessage(m)}
                  isGroup={true}
                  searchQuery={searchQuery} 
                  backgroundActive={backgroundActive}
                  onUserClick={handleUserClick}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ backgroundColor: colors.background, paddingBottom: 8 }}>
          <MessageInput 
            ref={messageInputRef} 
            onSend={handleSendMessage} 
            onSendAudio={handleSendAudio}
            onSendMedia={handleSendMedia}
            onSendPoll={handleSendPoll}
            replyTo={replyingTo} 
            onCancelReply={() => setReplyingTo(null)} 
            disabled={sending} 
          />
        </div>
        {loading && <ChatLoadingOverlay />}
      </div>

      {showSettings && (
        <div style={{ position: 'absolute', top: 64, right: 28, width: 350, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000, padding: spacing.md, maxHeight: '80vh', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}><ThemedText style={{ fontWeight: 800, fontSize: 16 }}>{t('chat_ui.customize_title')}</ThemedText><button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}><Plus size={20} style={{ transform: 'rotate(45deg)' }} /></button></div>
          {chatSettings.savedCustomBackgrounds && chatSettings.savedCustomBackgrounds.length > 0 && (
            <div style={{ marginBottom: spacing.lg }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.your_backgrounds')}</ThemedText>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {chatSettings.savedCustomBackgrounds.map((bg, idx) => {
                  const isActive = customBackground?.url === bg.url;
                  return (
                    <button
                      key={idx}
                      onClick={() => setChatSettings({ customBackground: bg })}
                      style={{
                        aspectRatio: '1', borderRadius: 8,
                        backgroundColor: '#000',
                        backgroundImage: `url(${bg.url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: isActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                        cursor: 'pointer', position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      {isActive && (
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={14} color="#FFF" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: spacing.lg }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.gallery_themes')}</ThemedText>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {Object.values(chatThemes).map(theme => {
                const isPresetActive = !customBackground && chatSettings.themeId === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setChatSettings({ themeId: theme.id, customBackground: null });
                    }}
                    style={{
                      aspectRatio: '1', borderRadius: 8, backgroundColor: (theme as any).background,
                      backgroundImage: theme.backgroundImage ? `url(${theme.backgroundImage})` : 'none',
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      border: isPresetActive ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                      cursor: 'pointer', position: 'relative'
                    }}
                  >
                    {isPresetActive && (
                      <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Check size={14} color="#FFF" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>{t('chat_ui.custom_background')}</ThemedText>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => bgInputRef.current?.click()}
                disabled={uploadingBg}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, backgroundColor: colors.backgroundSecondary,
                  border: customBackground ? `2px solid ${colors.primary}` : 'none',
                  color: colors.text, fontSize: 13, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
              >
                {uploadingBg ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
                {customBackground ? t('chat_ui.change_image') : t('chat_ui.upload_image')}
              </button>
              {customBackground && (
                <button
                  onClick={removeBackground}
                  style={{
                    padding: '10px', borderRadius: 10, backgroundColor: colors.danger + '15',
                    border: 'none', color: colors.danger, cursor: 'pointer'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            <input type="file" ref={bgInputRef} onChange={handleBgChange} accept="image/*" style={{ display: 'none' }} />
          </div>
          <div style={{ padding: spacing.sm, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.md }}><Type size={18} color={colors.primary} /><ThemedText style={{ fontSize: 14, fontWeight: 'bold' }}>{t('chat_ui.text_settings')}</ThemedText></div>
            <div style={{ marginBottom: spacing.md }}><ThemedText style={{ fontSize: 12, opacity: 0.6, display: 'block', marginBottom: 4 }}>{t('chat_ui.font_size')}</ThemedText><div style={{ display: 'flex', gap: 4 }}>{[12, 14, 16, 18, 20].map(size => <button key={size} onClick={() => setChatSettings({ fontSize: size })} style={{ flex: 1, padding: '4px', borderRadius: 6, border: 'none', backgroundColor: chatSettings.fontSize === size ? colors.primary : 'transparent', color: chatSettings.fontSize === size ? '#FFF' : colors.text, cursor: 'pointer', fontSize: 11, fontWeight: 'bold' }}>{size}</button>)}</div></div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: 'none', backgroundColor: chatSettings.fontWeight === 'bold' ? `${colors.primary}20` : 'transparent', color: chatSettings.fontWeight === 'bold' ? colors.primary : colors.text, cursor: 'pointer' }}>
                <Bold size={16} /><span style={{ fontSize: 12, fontWeight: 'bold' }}>{t('chat_ui.bold_symbol')}</span>
              </button>
              <button onClick={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', borderRadius: 8, border: 'none', backgroundColor: chatSettings.fontStyle === 'italic' ? `${colors.primary}20` : 'transparent', color: chatSettings.fontStyle === 'italic' ? colors.primary : colors.text, cursor: 'pointer' }}>
                <Italic size={16} /><span style={{ fontSize: 12, fontStyle: 'italic' }}>{t('chat_ui.italic_symbol')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {editingBgImage && (
        <ChatBackgroundEditor
          imageUri={editingBgImage}
          onClose={() => setEditingBgImage(null)}
          onSave={handleSaveEditedBg}
        />
      )}

      {forwardingMessage && (
        <ForwardModal 
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
        />
      )}

      {group && (
        <GroupInfoSidebar 
          isOpen={showGroupInfo}
          onClose={() => setShowGroupInfo(false)}
          group={group}
        />
      )}

      {selectedContact && (
        <ContactInfoModal 
          isOpen={!!selectedContact} 
          onClose={() => setSelectedContact(null)} 
          user={selectedContact} 
        />
      )}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { 
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const menuItemStyle = (colors: any): React.CSSProperties => ({
  width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: colors.text, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8
});
