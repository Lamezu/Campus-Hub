import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import MessageBubble from '../../components/chat/MessageBubble';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { uploadAudio } from '../../config/cloudinary';
import { CornerDownRight, X, Mic, ChevronsDown, ArrowLeft, Phone, Video, Info, Plus, Image, FileText, BarChart3, UserRound } from 'lucide-react';
import DMInfoPanel from '../../components/chat/DMInfoPanel';
import { PollModal } from '../../components/chat/PollModal';
import { uploadChatImage, uploadChatFile } from '../../config/cloudinary';
import type { PollData } from '../../types';
import { useCall } from '../../contexts/CallContext';
import {
  createCall,
  type CallType
} from '../../services/firebase/callService';
import {
  subscribeToMessages,
  loadMoreMessages as loadMoreDMs,
  sendMessage,
  markDMAsRead,
  deleteMessage,
  deleteMessageForMe,
  addReaction,
  removeReaction,
  deleteConversation,
  type DMMessage,
  type DMReplyTo
} from '../../services/firebase/directMessageService';
import { saveMessage, unsaveMessage, subscribeToSavedMessages } from '../../services/firebase/savedItemsService';
import SharePostModal from '../../components/SharePostModal';
import ContactPickerModal, { type ContactData } from '../../components/ContactPickerModal';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useTranslation } from '../../hooks/useTranslation';

const MESSAGES_PER_PAGE = 50;

function replyAttachmentType(msg: DMMessage): DMReplyTo['attachmentType'] | undefined {
  const type = msg.attachments?.[0]?.type as string | undefined;
  if (type === 'image' || type === 'audio' || type === 'file' || type === 'contact') return type;
  return undefined;
}

function replyPreviewText(msg: DMMessage): string {
  if (msg.text?.trim()) return msg.text.trim().substring(0, 40);
  const type = msg.attachments?.[0]?.type;
  if (type === 'image') return '📷 Imagen';
  if (type === 'audio') return '🎵 Audio';
  if (type === 'file') return `📎 ${msg.attachments![0].name || 'Archivo'}`;
  if (type === 'contact') return `👤 ${msg.attachments![0].name || 'Contacto'}`;
  return '';
}

function getLuminance(hex: string): number {
  if (!hex || !hex.startsWith('#')) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

interface ThemeStyle {
  bg: string;
  border: string;
  text: string;
}

function MessageInput({
  onSend, onSendAudio, onSendAttachment, onSendPoll, onSendContact,
  disabled, replyingTo, onCancelReply, themeStyle, showRecorder, setShowRecorder
}: {
  onSend: (text: string) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  onSendAttachment: (file: File, type: 'image' | 'file') => void;
  onSendPoll: (poll: Omit<PollData, 'votes'>) => void;
  onSendContact: (contact: ContactData) => void;
  disabled?: boolean;
  replyingTo?: any;
  onCancelReply?: () => void;
  themeStyle?: ThemeStyle;
  showRecorder: boolean;
  setShowRecorder: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showContactPicker, setShowContactPicker] = useState(false);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const attachItems = [
    { label: t('chat.photos'), icon: <Image size={22} color="#5856D6" />, bg: '#5856D622', action: () => { setShowAttachMenu(false); imageInputRef.current?.click(); } },
    { label: t('chat.document'), icon: <FileText size={22} color="#007AFF" />, bg: '#007AFF22', action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
    { label: t('chat.poll_label'), icon: <BarChart3 size={22} color="#FF2D55" />, bg: '#FF2D5522', action: () => { setShowAttachMenu(false); setShowPoll(true); } },
    { label: t('chat.contact_label'), icon: <UserRound size={22} color="#34C759" />, bg: '#34C75922', action: () => { setShowAttachMenu(false); setShowContactPicker(true); } },
  ];

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      {showAttachMenu && (
        <>
          <div onClick={() => setShowAttachMenu(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="animate-slide-up" style={{ position: 'absolute', bottom: '100%', left: 8, zIndex: 50, backgroundColor: colors.background, border: `1px solid ${colors.border}`, borderRadius: 16, padding: '12px 16px', display: 'flex', gap: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.18)', marginBottom: 6 }}>
            {attachItems.map(item => (
              <button key={item.label} onClick={item.action} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.icon}</div>
                <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSendAttachment(f, 'image'); e.target.value = ''; }} />
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onSendAttachment(f, 'file'); e.target.value = ''; }} />
      <PollModal visible={showPoll} onClose={() => setShowPoll(false)} onSend={onSendPoll} />
      <ContactPickerModal visible={showContactPicker} onClose={() => setShowContactPicker(false)} onSelect={contact => { onSendContact(contact); setShowContactPicker(false); }} />
      {replyingTo && (
        <div className="animate-slide-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: themeStyle ? themeStyle.border : colors.backgroundSecondary, borderTop: `1px solid ${themeStyle ? themeStyle.border : colors.border}`, fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>{replyingTo.senderName}</span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>{replyPreviewText(replyingTo)}</span>
            </span>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyle ? themeStyle.text : colors.textSecondary, display: 'flex', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className="chat-input-container" style={themeStyle ? { backgroundColor: themeStyle.bg, borderTop: `1px solid ${themeStyle.border}` } : {}}>
        {showRecorder ? (
          <AudioRecorder onSend={(blob, duration) => { onSendAudio(blob, duration); setShowRecorder(false); }} onCancel={() => setShowRecorder(false)} />
        ) : (
          <>
            <button onClick={() => setShowAttachMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAttachMenu ? colors.primary : colors.textSecondary, flexShrink: 0, transition: 'color 0.2s ease' }} title={t('chat.attach')}>
              <Plus size={22} strokeWidth={2} style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)', transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)' }} />
            </button>
            <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder={replyingTo ? t('chat.reply_to', { name: replyingTo.senderName }) : t('chat.type_message')} className="chat-textarea" style={themeStyle ? { color: themeStyle.text, backgroundColor: 'transparent' } : {}} disabled={disabled} rows={1} />
            <button onClick={() => setShowRecorder(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '8px', display: 'flex', alignItems: 'center' }} title={t('chat.record_audio')}>
              <Mic size={20} />
            </button>
            <button onClick={handleSend} disabled={!text.trim() || disabled} className="chat-send-button btn-press">
              <div className="chat-send-icon" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function DirectChat() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const [searchParams] = useSearchParams();
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [forwardMessage, setForwardMessage] = useState<any>(null);
  const [amIBlocked, setAmIBlocked] = useState(false);
  const [haveIBlocked, setHaveIBlocked] = useState(false);
  const { setActiveCall, setActiveCallId } = useCall();
  const { t } = useTranslation();

  const handleStartCall = async (type: CallType) => {
    if (!currentUser || !otherUser) return;
    if (amIBlocked || haveIBlocked) return;
    try {
      const callId = await createCall(
        currentUser.uid,
        otherUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        otherUser.displayName || 'Usuario',
        otherUser.photoURL || null,
        type
      );
      setActiveCall({
        callId,
        isCaller: true,
        type,
        otherUserName: otherUser.displayName || 'Usuario',
        otherUserPhoto: otherUser.photoURL || null
      });
      setActiveCallId(callId);
    } catch {
      alert(t('call.start_failed'));
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
  const isFirstMsgLoad = useRef(true);
  const navigate = useNavigate();
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const isDesktop = useWindowSize();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setUserData(snap.data());
    });
  }, [currentUser]);

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    getDoc(doc(db, 'conversations', conversationId)).then(async snap => {
      if (!snap.exists()) return;
      const data = snap.data();
      const otherId = data.participants?.find((id: string) => id !== currentUser.uid);
      if (otherId) {
        const userSnap = await getDoc(doc(db, 'users', otherId));
        if (userSnap.exists()) setOtherUser({ uid: otherId, ...userSnap.data() });
      }
    });
  }, [conversationId, currentUser]);

  useEffect(() => {
    if (!conversationId || !currentUser) return;

    const uid = currentUser.uid;
    isFirstMsgLoad.current = true;
    const unsubscribe = subscribeToMessages(conversationId, (msgs, lastDoc) => {
      const wasFirst = isFirstMsgLoad.current;
      isFirstMsgLoad.current = false;
      setMessages(msgs);
      setLoading(false);
      setHasMore(msgs.length === MESSAGES_PER_PAGE);
      lastDocRef.current = lastDoc;
      const targetId = searchParams.get('messageId');
      if (wasFirst && targetId) {
        setTimeout(() => {
          const el = messagesContainerRef.current?.querySelector(`[data-message-id="${targetId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHighlightedMessageId(targetId);
            setTimeout(() => setHighlightedMessageId(null), 2500);
          } else {
            messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
          }
        }, 150);
      } else if (wasFirst) {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
      }
      markDMAsRead(conversationId, uid).catch(() => {});
    });

    return () => unsubscribe();
  }, [conversationId, currentUser, userData]);

  useEffect(() => {
    if (!currentUser || !conversationId) return;
    const unsub = subscribeToSavedMessages(currentUser.uid, msgs => {
      setSavedIds(new Set(msgs.filter(m => m.originalChannelId === conversationId).map(m => m.id)));
    });
    return () => unsub();
  }, [currentUser, conversationId]);

  useEffect(() => {
    if (!currentUser || !otherUser) return;
    
    const checkBlockStatus = async () => {
      try {
        const myDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const myBlockedUsers = myDoc.data()?.blockedUsers || [];
        setHaveIBlocked(myBlockedUsers.includes(otherUser.uid));
        
        const otherDoc = await getDoc(doc(db, 'users', otherUser.uid));
        const otherBlockedUsers = otherDoc.data()?.blockedUsers || [];
        setAmIBlocked(otherBlockedUsers.includes(currentUser.uid));
      } catch (error) {
        console.error('Error checking block status:', error);
      }
    };
    
    checkBlockStatus();
  }, [currentUser, otherUser]);

  const handleLoadMore = async () => {
    if (!conversationId || !hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const { messages: older, lastDoc } = await loadMoreDMs(conversationId, lastDocRef.current);
      if (older.length > 0) {
        setMessages(prev => [...older, ...prev]);
        lastDocRef.current = lastDoc;
      }
      setHasMore(older.length === MESSAGES_PER_PAGE);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      let replyTo: DMReplyTo | null = null;
      
      if (replyingTo) {
        const attachmentType = replyAttachmentType(replyingTo);
        replyTo = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyPreviewText(replyingTo),
        };
        if (attachmentType !== undefined) {
          replyTo.attachmentType = attachmentType;
        }
      }
      
      await sendMessage(
        conversationId,
        text,
        currentUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        null,
        replyTo
      );
      
      setReplyingTo(null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (error) {
      alert(t('chat.send_failed'));
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      const audioUrl = await uploadAudio(audioBlob, `temp_${Date.now()}`);
      let replyTo: DMReplyTo | null = null;
      
      if (replyingTo) {
        const attachmentType = replyAttachmentType(replyingTo);
        replyTo = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyPreviewText(replyingTo),
        };
        if (attachmentType !== undefined) {
          replyTo.attachmentType = attachmentType;
        }
      }
      
      await sendMessage(
        conversationId,
        '',
        currentUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        [{ url: audioUrl, type: 'audio', name: `audio_${Date.now()}.webm`, size: audioBlob.size, duration }],
        replyTo
      );
      setReplyingTo(null);
      setShowRecorder(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      alert(t('chat.send_audio_error', { error: err instanceof Error ? err.message : 'Error' }));
    } finally {
      setSending(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !loadingMore) handleLoadMore();
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 120);
  };

  const handleDelete = async (message: any, forEveryone: boolean) => {
    if (!conversationId) return;
    const ok = window.confirm(forEveryone ? t('chat.delete_confirm_for_all') : t('chat.delete_confirm_for_me'));
    if (!ok) return;
    try {
      if (forEveryone) {
        await deleteMessage(conversationId, message.id);
      } else {
        await deleteMessageForMe(conversationId, message.id, currentUser!.uid);
      }
    } catch {
      alert(t('chat.delete_error'));
    }
  };

  const handleReact = async (message: any, emoji: string) => {
    if (!conversationId || !currentUser) return;
    const existing = message.reactions?.[emoji] || [];
    try {
      if (existing.includes(currentUser.uid)) {
        await removeReaction(conversationId, message.id, emoji, currentUser.uid);
      } else {
        await addReaction(conversationId, message.id, emoji, currentUser.uid);
      }
    } catch {}
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleSave = async (message: any) => {
    if (!currentUser || !conversationId) return;
    try {
      if (savedIds.has(message.id)) {
        await unsaveMessage(currentUser.uid, message.id);
      } else {
        await saveMessage(
          currentUser.uid,
          {
            id: message.id,
            text: message.text,
            senderName: message.senderName,
            senderId: message.senderId,
            originalChannelId: conversationId,
            chatType: 'dm',
            attachments: message.attachments,
          },
          conversationId
        );
      }
    } catch (err) {
      console.error('Error al guardar mensaje:', err);
    }
  };

  const handleSendAttachment = async (file: File, type: 'image' | 'file') => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      const url = type === 'image'
        ? await uploadChatImage(file, `${conversationId}_${Date.now()}`)
        : await uploadChatFile(file, `${conversationId}_${Date.now()}`);
      await sendMessage(conversationId, '', currentUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        [{ url, type, name: file.name, size: file.size }], null);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { alert(t('chat.send_file_error')); } finally { setSending(false); }
  };

  const handleSendPoll = async (poll: Omit<PollData, 'totalVotes'>) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      await sendMessage(conversationId, poll.question, currentUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        null, null, {
          question: poll.question,
          options: (poll.options as any[]).map((opt: any, i: number) => ({
            id: String(i),
            text: typeof opt === 'string' ? opt : opt.text,
            votes: [],
          })),
          multipleAnswers: poll.multipleAnswers,
          totalVotes: 0,
          closed: false,
        });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { } finally { setSending(false); }
  };

  const handleSendContact = async (contact: ContactData) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      await sendMessage(conversationId, `👤 ${contact.name}`, currentUser.uid,
        userData?.displayName || currentUser.displayName || 'Usuario',
        userData?.photoURL || currentUser.photoURL || null,
        [{ type: 'contact', url: contact.photo ?? '', name: contact.name, size: 0, bio: contact.bio, userId: contact.userId }]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { } finally { setSending(false); }
  };

  const filteredMessages = messages.filter(
    msg => !msg.deletedForUsers?.includes(currentUser?.uid || '')
  );

  const isCustomTheme = chatTheme.id?.startsWith('custom_');
  const isNonDefaultTheme = colors.chatSettings.themeId !== 'default';
  const useThemeStyling = isDesktop && isNonDefaultTheme;
  const themeIsLight = getLuminance(chatTheme.background) > 0.55;
  const themeTextColor = themeIsLight ? '#1C1C1E' : '#FFFFFF';
  const themeBorderColor = themeIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const desktopThemeStyle: ThemeStyle | undefined = (useThemeStyling && !isCustomTheme)
    ? { bg: chatTheme.background, border: themeBorderColor, text: themeTextColor }
    : undefined;

  const backgroundStyles: React.CSSProperties = isCustomTheme
    ? { position: 'relative' }
    : isDesktop
      ? { backgroundColor: chatTheme.background, backgroundImage: 'none' }
      : {
          backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
          backgroundColor: chatTheme.background,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
        };

  const headerContent = (
    <div className="chat-header" style={{
      backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)',
      borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}`
    }}>
      <button
        className="chat-back-button"
        style={{ color: desktopThemeStyle?.text ?? colors.text }}
        onClick={() => navigate('/messages')}
      >
        <ArrowLeft size={22} />
      </button>
      {otherUser?.photoURL ? (
        <img
          src={otherUser.photoURL}
          alt=""
          style={{ width: '34px', height: '34px', borderRadius: '50%', objectFit: 'cover', marginRight: '10px' }}
        />
      ) : (
        <div style={{
          width: '34px',
          height: '34px',
          borderRadius: '50%',
          backgroundColor: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: '700',
          fontSize: '15px',
          marginRight: '10px',
          flexShrink: 0
        }}>
          {otherUser?.displayName?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      <h1
        className="chat-header-title"
        style={{ ...(desktopThemeStyle ? { color: desktopThemeStyle.text } : {}), flex: 1 }}
      >
        {otherUser?.displayName || t('dm.title')}
      </h1>
      <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
        <button
          onClick={() => handleStartCall('audio')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle?.text ?? 'var(--text)' }}
          title={t('call.audio_call')}
        >
          <Phone size={20} />
        </button>
        <button
          onClick={() => handleStartCall('video')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle?.text ?? 'var(--text)' }}
          title={t('call.video_call')}
        >
          <Video size={20} />
        </button>
        <button
          onClick={() => setShowInfoPanel(v => !v)}
          className="chat-back-button"
          style={{ color: desktopThemeStyle?.text ?? 'var(--text)' }}
          title={t('common.info')}
        >
          <Info size={20} color={showInfoPanel ? colors.primary : (desktopThemeStyle ? desktopThemeStyle.text : undefined)} />
        </button>
      </div>
    </div>
  );

  const customBgOverlay = isCustomTheme && chatTheme.backgroundImage ? (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      <img
        src={chatTheme.backgroundImage}
        alt=""
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `translate(${chatTheme.offsetX || 0}px, ${chatTheme.offsetY || 0}px) scale(${chatTheme.scale || 1})`,
          transformOrigin: 'center',
          pointerEvents: 'none',
        }}
      />
    </div>
  ) : null;

  if (loading) {
    return (
      <div className="chat-loading-container" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {customBgOverlay}
        {headerContent}
        <div className="chat-loading-content">
          <div className="loading-spinner" />
          <p className="chat-loading-text">{t('chat.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-loading-container animate-fade-in" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {customBgOverlay}
      {headerContent}

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container"
        style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent' }}
      >
        {loadingMore && (
          <div className="chat-loading-more">
            <div className="loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text" style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '12px', borderRadius: '8px' }}>
              {t('chat.no_messages_start')}
            </p>
          </div>
        ) : (
          filteredMessages.map(message => (
            <div
              key={message.id}
              style={{
                borderRadius: 12,
                transition: 'background-color 0.4s ease',
                backgroundColor: highlightedMessageId === message.id ? `${colors.primary}22` : 'transparent',
              }}
            >
            <MessageBubble
              message={message as any}
              isOwnMessage={message.senderId === currentUser?.uid}
              isAdmin={userData?.role === 'admin'}
              chatId={conversationId}
              isConversation={true}
              chatCollection="conversations"
              isSaved={savedIds.has(message.id)}
              onReply={(msg: any) => setReplyingTo(msg)}
              onDelete={handleDelete}
              onForward={(msg: any) => setForwardMessage(msg)}
              onReact={handleReact}
              onCopy={handleCopy}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={(msg: any) => { setReplyingTo(msg); setShowRecorder(true); }}
              onSave={handleSave}
              onAvatarClick={(senderId) => { if (senderId !== currentUser?.uid) setShowInfoPanel(true); }}
            />
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <button
        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '16px',
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          backgroundColor: colors.backgroundSecondary,
          color: colors.text,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)',
          border: `1px solid ${colors.border}`,
          zIndex: 500,
          opacity: showScrollButton ? 1 : 0,
          transform: showScrollButton ? 'scale(1)' : 'scale(0.7)',
          pointerEvents: showScrollButton ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease'
        }}
      >
        <ChevronsDown size={22} strokeWidth={2.5} />
      </button>

      {(amIBlocked || haveIBlocked) && (
        <div style={{
          padding: '8px 16px',
          backgroundColor: '#FF3B3015',
          borderTop: '1px solid #FF3B3030',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          fontSize: '13px',
          color: '#FF3B30'
        }}>
          <Info size={16} />
          <span>{t('chat.blocked_warning')}</span>
        </div>
      )}

      <MessageInput
        onSend={handleSendMessage}
        onSendAudio={handleSendAudio}
        onSendAttachment={handleSendAttachment}
        onSendPoll={handleSendPoll}
        onSendContact={handleSendContact}
        disabled={sending || amIBlocked || haveIBlocked}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        themeStyle={desktopThemeStyle}
        showRecorder={showRecorder}
        setShowRecorder={setShowRecorder}
      />

      {showInfoPanel && otherUser && conversationId && (
        <div className="animate-slide-right" style={{ position: 'absolute', inset: 0, zIndex: 300 }}>
          <DMInfoPanel
            otherUserId={otherUser.uid}
            conversationId={conversationId}
            currentUserId={currentUser?.uid ?? ''}
            userRole={userData?.role ?? 'student'}
            colors={colors}
            onClose={() => setShowInfoPanel(false)}
            onClearChat={() => setMessages([])}
            onDeleteChat={() => {
              const uid = auth.currentUser?.uid;
              if (uid) deleteConversation(uid, otherUser.uid).catch(() => {});
              navigate('/messages');
            }}
            onCall={handleStartCall}
          />
        </div>
      )}

      <SharePostModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />
    </div>
  );
}