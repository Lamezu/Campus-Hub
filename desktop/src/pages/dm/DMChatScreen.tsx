import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { ChevronLeft, Phone, Video, Settings, UserPlus, UserCheck, Type, Bold, Italic, Check, Plus, Search, Camera, Loader2, Trash2 } from 'lucide-react';
import { ChatBackgroundEditor } from '@/components/chat/ChatBackgroundEditor';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { ForwardModal } from '@/components/ForwardModal';
import { ContactInfoModal } from '@/components/dm/ContactInfoModal';
import { chatThemes, spacing } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { useAlert } from '@/contexts/AlertContext';
import { notificationService } from '@/services/notificationService';
import * as dmService from '@/services/dmService';
import { subscribeToFriendshipStatus, sendFriendRequest } from '@/services/friendsService';
import * as starredService from '@/services/starredMessagesService';
import { useCall } from '@/contexts/CallContext';
import { createCall } from '@/services/callService';
import type { DirectMessage, ReplyPreview, User, Message } from '@/types';
import { useTranslation } from '@/contexts/LanguageContext';
import { ChatLoadingOverlay } from '@/components/chat/ChatLoadingOverlay';

export default function DMChatScreen() {
  const { t } = useTranslation();
  const { colors, chatSettings, setChatSettings } = useTheme();
  const { showAlert } = useAlert();
  const { userId } = useParams<{ userId: string }>();
  const { setActiveCall, setActiveCallId } = useCall();
  const navigate = useNavigate();

  const location = useLocation();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [participant, setParticipant] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [friendStatus, setFriendStatus] = useState<'none' | 'sent' | 'received' | 'friends'>('none');
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedContact, setSelectedContact] = useState<User | null>(null);

  const [uploadingBg, setUploadingBg] = useState(false);
  const [editingBgImage, setEditingBgImage] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!userId || !currentUser) return;
    const init = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setParticipant({ uid: userDoc.id, ...userDoc.data() } as User);
        } else {
          setParticipant({ uid: userId, displayName: 'Usuario eliminado' } as any);
        }
        const convId = await dmService.getOrCreateConversation(currentUser.uid, userId);
        setConversationId(convId);
      } catch (error) {
        console.error(error);
      }
    };
    init();

    const unsubStatus = subscribeToFriendshipStatus(currentUser.uid, userId, (status) => {
      setFriendStatus(status);
    });

    return () => unsubStatus();
  }, [userId, currentUser]);

  useEffect(() => {
    if (!conversationId || !currentUser) return;
    const unsubscribe = dmService.subscribeToMessages(conversationId, currentUser.uid, (newMessages) => {
      setMessages(newMessages);
      setLoading(false);
      dmService.markAsRead(conversationId, currentUser.uid);
    }, () => setLoading(false));

    starredService.getStarredIdsForConversation(currentUser.uid, conversationId)
      .then(setStarredIds)
      .catch(console.error);

    return () => unsubscribe();
  }, [conversationId, currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlightId');
    if (highlightId && messages.length > 0) {
      handleReplyPreviewPress(highlightId);
      const newParams = new URLSearchParams(location.search);
      newParams.delete('highlightId');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [location.search, messages.length]);

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const msgId = await dmService.sendMessage(conversationId, currentUser.uid, currentUser.displayName || t('profile.username_placeholder'), currentUser.photoURL, text, replyData);

      if (userId) {
        notificationService.addNotification(userId, {
          title: t('notifications.dm_message_title'),
          titleKey: 'notifications.dm_message_title',
          body: text,
          category: 'dm',
          meta: { 
            name: currentUser.displayName || t('profile.username_placeholder'),
            conversationId 
          },
        }, msgId);
      }
    } catch {
      showAlert({ title: t('common.error'), message: t('dm_chat.error.send_msg'), type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !conversationId) return;
    setReplyingTo(null);
    try {
      const msgId = await dmService.sendAudioMessage(conversationId, currentUser.uid, currentUser.displayName || t('profile.username_placeholder'), currentUser.photoURL, url, duration);

      if (userId) {
        notificationService.addNotification(userId, {
          title: t('notifications.dm_message_title'),
          titleKey: 'notifications.dm_message_title',
          body: t('chat_ui.voice_message'),
          category: 'dm',
          meta: { 
            name: currentUser.displayName || t('profile.username_placeholder'),
            conversationId 
          },
        }, msgId);
      }
    } catch {
      showAlert({ title: t('common.error'), message: t('dm_chat.error.send_audio'), type: 'error' });
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video') => {
    if (!currentUser || !conversationId) return;
    setReplyingTo(null);
    try {
      const msgId = await dmService.sendMessage(conversationId, currentUser.uid, currentUser.displayName || t('profile.username_placeholder'), currentUser.photoURL, '', null, false, [{ url, type, name: type === 'video' ? 'video.mp4' : 'image.jpg', size: 0 }]);

      if (userId) {
        notificationService.addNotification(userId, {
          title: t('notifications.dm_message_title'),
          titleKey: 'notifications.dm_message_title',
          body: type === 'video' ? t('chat_ui.video') : t('chat_ui.image'),
          category: 'dm',
          meta: { 
            name: currentUser.displayName || t('profile.username_placeholder'),
            conversationId 
          },
        }, msgId);
      }
    } catch {
      showAlert({ title: t('common.error'), message: t('dm_chat.error.send_file'), type: 'error' });
    }
  };

  const handleSendPoll = async (poll: any) => {
    if (!currentUser || !conversationId) return;
    try {
      const msgId = await dmService.sendPoll(conversationId, currentUser.uid, currentUser.displayName || t('profile.username_placeholder'), currentUser.photoURL, poll);

      if (userId) {
        notificationService.addNotification(userId, {
          title: t('notifications.dm_message_title'),
          titleKey: 'notifications.dm_message_title',
          body: t('chat_ui.poll_notification', { question: poll.question }),
          category: 'dm',
          meta: { 
            name: currentUser.displayName || t('profile.username_placeholder'),
            conversationId 
          },
        }, msgId);
      }
    } catch {
      showAlert({ title: t('common.error'), message: t('dm_chat.error.create_poll'), type: 'error' });
    }
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !conversationId) return;
    try { await dmService.votePoll(conversationId, messageId, optionId, currentUser.uid); } catch (error) { console.error(error); }
  };

  const handleDelete = async (msgId: string, forAll = false) => {
    if (!currentUser || !conversationId) return;
    if (forAll) await dmService.deleteMessageForAll(conversationId, msgId);
    else await dmService.deleteMessageForMe(conversationId, msgId, currentUser.uid);
  };

  const handleReact = async (id: string, emoji: string) => {
    if (!currentUser || !conversationId) return;
    await dmService.toggleReaction(conversationId, id, emoji, currentUser.uid);
  };

  const handleReply = (msg: Message) => {
    const firstAttachment = msg.attachments?.[0];
    setReplyingTo({ 
      id: msg.id, 
      text: msg.text || '', 
      senderName: msg.senderName, 
      isAudio: firstAttachment?.type === 'audio',
      type: (firstAttachment?.type as any) || (msg.poll ? 'poll' : 'text'),
      attachmentName: firstAttachment?.name || undefined
    });
  };

  const handleForward = (msg: Message) => {
    setForwardingMessage(msg);
  };

  const handleUserClick = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        setSelectedContact({ uid, ...snap.data() } as User);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleToggleStar = async (msg: Message) => {
    if (!currentUser || !conversationId) return;
    const isStarred = starredIds.has(msg.id);
    try {
      if (isStarred) {
        await starredService.unstarMessage(currentUser.uid, msg.id);
        setStarredIds(prev => {
          const next = new Set(prev);
          next.delete(msg.id);
          return next;
        });
      } else {
        await starredService.starMessage(currentUser.uid, msg, 'dm', conversationId);
        setStarredIds(prev => new Set(prev).add(msg.id));
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReplyPreviewPress = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`msg-${messageId}`);
    if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  const handleAudioCall = async () => {
    if (!currentUser || !participant || !conversationId) return;
    const callId = await createCall(
      currentUser.uid, 
      participant.uid, 
      currentUser.displayName || t('profile.username_placeholder'), 
      currentUser.photoURL,
      participant.displayName || t('profile.username_placeholder'),
      participant.photoURL,
      'audio'
    );
    setActiveCallId(callId);
    setActiveCall({
      callId,
      isCaller: true,
      type: 'audio',
      otherUserName: participant.displayName || t('profile.username_placeholder'),
      otherUserPhoto: participant.photoURL || null,
    });
  };

  const handleVideoCall = async () => {
    if (!currentUser || !participant || !conversationId) return;
    const callId = await createCall(
      currentUser.uid, 
      participant.uid, 
      currentUser.displayName || t('profile.username_placeholder'), 
      currentUser.photoURL,
      participant.displayName || t('profile.username_placeholder'),
      participant.photoURL,
      'video'
    );
    setActiveCallId(callId);
    setActiveCall({
      callId,
      isCaller: true,
      type: 'video',
      otherUserName: participant.displayName || t('profile.username_placeholder'),
      otherUserPhoto: participant.photoURL || null,
    });
  };


  const participantName = participant?.displayName || t('profile.username_placeholder');
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
      const url = await uploadChannelPhoto(file, `global_bg_${Date.now()}`);
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
      confirmText: t('chat_ui.delete_btn'),
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

  const formatLastActive = () => {
    const raw = (participant as any)?.lastActive;
    if (!raw) return t('dm_chat.last_seen.offline');
    let ms: number;
    if (typeof raw.toDate === 'function') {
      ms = raw.toDate().getTime();
    } else if (typeof raw === 'number') {
      ms = raw;
    } else if (typeof raw === 'string') {
      ms = new Date(raw).getTime();
    } else if (raw instanceof Date) {
      ms = raw.getTime();
    } else {
      return t('dm_chat.last_seen.offline');
    }
    
    if (isNaN(ms)) return t('dm_chat.last_seen.offline');
    if (Date.now() - ms < 300000) return t('dm_chat.last_seen.online');
    const lastSeenTime = new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return t('dm_chat.last_seen.at', { time: lastSeenTime });
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: `${spacing.sm}px ${spacing.md}px`, backgroundColor: colors.card, borderBottom: `1px solid ${colors.border}`, flexShrink: 0, zIndex: 10, height: 64, boxSizing: 'border-box' }}>
          <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, display: 'flex' }}><ChevronLeft size={24} /></button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, cursor: 'pointer' }} onClick={() => setShowContactInfo(true)}>
            {participant?.photoURL ? <img src={participant.photoURL} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} /> : <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: `${colors.primary}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>{participantName[0]}</ThemedText></div>}
            <div>
              <ThemedText style={{ fontWeight: '700', fontSize: 16, display: 'block', color: colors.text }}>{participantName}</ThemedText>
              <ThemedText style={{ fontSize: 11, opacity: 0.7, display: 'block', color: colors.textSecondary }}>
                <span style={{ color: colors.primary, fontWeight: 'bold' }}>{participant?.role ? t(`common.roles.${participant.role}`) : ''}</span> • {formatLastActive()}
              </ThemedText>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {friendStatus !== 'friends' && <button onClick={async () => { if (friendStatus === 'sent' || !currentUser) return; try { await sendFriendRequest(currentUser.uid, userId!, currentUser.displayName || t('profile.username_placeholder'), currentUser.photoURL); setFriendStatus('sent'); showAlert({ title: t('dm_chat.friend_request.sent_title'), message: t('dm_chat.friend_request.sent_msg', { name: participantName }), type: 'success' }); } catch { showAlert({ title: t('common.error'), message: t('dm_chat.friend_request.error_msg'), type: 'error' }); } }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: friendStatus === 'sent' ? colors.primary : colors.textSecondary, padding: 8, borderRadius: 8, display: 'flex', opacity: friendStatus === 'sent' ? 0.5 : 1 }}>{friendStatus === 'sent' ? <UserCheck size={20} /> : <UserPlus size={20} />}</button>}
            {participantName !== 'Usuario eliminado' && (
              <>
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
              </>
            )}

            <button onClick={() => setIsSearchOpen(!isSearchOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isSearchOpen ? colors.primary : colors.text, padding: 8, borderRadius: 8, display: 'flex' }}><Search size={20} /></button>
            <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text, padding: 8, borderRadius: 8, display: 'flex' }}><Settings size={22} /></button>
          </div>

        </div>

        {isSearchOpen && (
          <div style={{
            padding: `8px ${spacing.md}px`,
            backgroundColor: colors.backgroundSecondary,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            animation: 'slideDown 0.2s ease-out'
          }}>
            <Search size={16} color={colors.textSecondary} />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('chat_ui.search_placeholder')}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: colors.text, fontSize: 14, padding: '4px 0'
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
                <Plus size={16} style={{ transform: 'rotate(45deg)' }} />
              </button>
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
                    {searchQuery ? t('chat_ui.no_messages_found') : t('dm_chat.empty_greet', { name: participantName })}
                  </ThemedText>
                </div>
              ) : [...filteredMessages].reverse().map((msg) => (
                <div key={msg.id} id={`msg-${msg.id}`}>
                  <MessageBubble
                    message={msg as any}
                    isOwnMessage={msg.senderId === currentUser?.uid}
                    currentUserId={currentUser?.uid}
                    onReply={handleReply}
                    onLongPress={setMenuMessage as any}
                    onDoubleTap={() => handleReact(msg.id, '❤️')}
                    onReplyPreviewPress={handleReplyPreviewPress}
                    highlighted={highlightedMessageId === msg.id}
                    onDelete={handleDelete}
                    onReact={handleReact}
                    onForward={handleForward as any}
                    onVotePoll={(optId: string) => handleVotePoll(msg.id, optId)}
                    channelId={conversationId ?? undefined}
                    isDM={true}
                    participantId={userId}
                    searchQuery={searchQuery}
                    backgroundActive={backgroundActive}
                    isStarred={starredIds.has(msg.id)}
                    onToggleStar={handleToggleStar}
                    onUserClick={handleUserClick}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {showSettings && (
          <div style={{ position: 'absolute', top: 60, right: 20, width: 350, backgroundColor: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000, padding: spacing.md, maxHeight: '80vh', overflowY: 'auto' }}>
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
                        aspectRatio: '1', borderRadius: 8, backgroundColor: theme.background,
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

        <div style={{ backgroundColor: colors.background, paddingBottom: 8 }}>
          <MessageInput ref={messageInputRef} onSend={handleSendMessage} onSendAudio={handleSendAudio} onSendMedia={handleSendMedia} onSendPoll={handleSendPoll} replyTo={replyingTo} onCancelReply={() => setReplyingTo(null)} disabled={sending} />
        </div>
        {loading && <ChatLoadingOverlay />}
      </div>
      {participant && (
        <ContactInfoModal 
          isOpen={showContactInfo} 
          onClose={() => setShowContactInfo(false)} 
          user={participant} 
        />
      )}
      {selectedContact && (
        <ContactInfoModal 
          isOpen={!!selectedContact} 
          onClose={() => setSelectedContact(null)} 
          user={selectedContact} 
        />
      )}
      
      {forwardingMessage && (
        <ForwardModal 
          message={forwardingMessage}
          onClose={() => setForwardingMessage(null)}
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

const headerMenuItemStyle = (colors: any): React.CSSProperties => ({
  width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', color: colors.text, fontSize: 14, display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8
});
