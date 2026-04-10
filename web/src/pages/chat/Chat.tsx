import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import type { Message } from '../../types';
import MessageBubble from '../../components/chat/MessageBubble';
import SharePostModal from '../../components/SharePostModal';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { Settings, CornerDownRight, X, Mic, ChevronsDown, Info, Plus, Image, FileText, BarChart3, UserRound, Presentation } from 'lucide-react';
import ChannelInfoPanel from '../../components/chat/ChannelInfoPanel';
import DMInfoPanel from '../../components/chat/DMInfoPanel';
import { useCall } from '../../contexts/CallContext';
import { createConference, subscribeToActiveConferenceForGroup } from '../../services/firebase/studyGroupConferenceService';
import type { GroupCall } from '../../services/firebase/groupCallService';
import { PollModal } from '../../components/chat/PollModal';
import { uploadAudio, uploadChatImage, uploadChatFile } from '../../config/cloudinary';
import type { PollData } from '../../types';
import { updateLastRead } from '../../services/firebase/messageService';
import { saveMessage, unsaveMessage, subscribeToSavedMessages } from '../../services/firebase/savedItemsService';
import ContactPickerModal, { type ContactData } from '../../components/ContactPickerModal';

const MESSAGES_PER_PAGE = 50;

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

function MessageInput({ onSend, onSendAudio, onSendAttachment, onSendPoll, onSendContact, disabled = false, replyingTo, onCancelReply, themeStyle, showRecorder, setShowRecorder }: {
  onSend: (text: string) => void;
  onSendAudio: (audioBlob: Blob, duration: number) => void;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const attachItems = [
    { label: 'Fotos', icon: <Image size={22} color="#5856D6" />, bg: '#5856D622', action: () => { setShowAttachMenu(false); imageInputRef.current?.click(); } },
    { label: 'Documento', icon: <FileText size={22} color="#007AFF" />, bg: '#007AFF22', action: () => { setShowAttachMenu(false); fileInputRef.current?.click(); } },
    { label: 'Encuesta', icon: <BarChart3 size={22} color="#FF2D55" />, bg: '#FF2D5522', action: () => { setShowAttachMenu(false); setShowPoll(true); } },
    { label: 'Contacto', icon: <UserRound size={22} color="#34C759" />, bg: '#34C75922', action: () => { setShowAttachMenu(false); setShowContactPicker(true); } },
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
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: themeStyle ? themeStyle.border : colors.backgroundSecondary,
          borderTop: `1px solid ${themeStyle ? themeStyle.border : colors.border}`,
          fontSize: '13px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>{replyingTo.senderName}</span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>{replyingTo.text.substring(0, 30)}...</span>
            </span>
          </div>
          <button onClick={onCancelReply} style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyle ? themeStyle.text : colors.textSecondary, display: 'flex', alignItems: 'center', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
      )}
      <div className="chat-input-container" style={themeStyle ? { backgroundColor: themeStyle.bg, borderTop: `1px solid ${themeStyle.border}` } : {}}>
        {showRecorder ? (
          <AudioRecorder onSend={(audioBlob, duration) => { onSendAudio(audioBlob, duration); setShowRecorder(false); }} onCancel={() => setShowRecorder(false)} />
        ) : (
          <>
            <button
              onClick={() => setShowAttachMenu(v => !v)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAttachMenu ? colors.primary : colors.textSecondary, flexShrink: 0, transition: 'color 0.2s ease' }}
              title="Adjuntar"
            >
              <Plus size={22} strokeWidth={2} style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)', transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)' }} />
            </button>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder={replyingTo ? `Responder a ${replyingTo.senderName}...` : "Escribe un mensaje..."}
              className="chat-textarea"
              style={themeStyle ? { color: themeStyle.text, backgroundColor: 'transparent' } : {}}
              disabled={disabled}
              rows={1}
            />
            <button onClick={() => setShowRecorder(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Grabar audio">
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

const SUPPORT_CHANNEL_ID = '5';

export default function Chat() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [messageToForward, setMessageToForward] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [studyGroupData, setStudyGroupData] = useState<{ name: string; photo: string | null; memberIds: string[] } | null>(null);
  const [activeGroupConference, setActiveGroupConference] = useState<GroupCall | null>(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<any>(null);
  const navigate = useNavigate();

  const { setActiveConference, setActiveConferenceId, activeConferenceId, requestConferenceJoin } = useCall();
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const isDesktop = useWindowSize();

  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const channelName = groupName ?? channel?.name ?? id ?? '';
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!id?.startsWith('sg_')) return;
    const groupId = id.slice(3);
    getDoc(doc(db, 'studyGroups', groupId)).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setGroupName(data.name ?? null);
        setStudyGroupData({ name: data.name ?? '', photo: data.photoURL ?? null, memberIds: data.memberIds ?? [] });
      }
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!id?.startsWith('sg_')) return;
    const groupId = id.slice(3);
    const unsub = subscribeToActiveConferenceForGroup(groupId, (call) => {
      setActiveGroupConference(call);
    });
    return unsub;
  }, [id]);

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
      }
    };
    loadUserData();
  }, [currentUser]);

  useEffect(() => {
    if (!id) return;

    const messagesRef = collection(db, 'channels', id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));

    const uid = currentUser?.uid;
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (uid) updateLastRead(id, uid).catch(() => {});
        const messagesData: Message[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Unknown',
            senderPhoto: data.senderPhoto || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            edited: data.edited || false,
            editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
            attachments: data.attachments || null,
            reactions: data.reactions || {},
            deletedForUsers: data.deletedForUsers || [],
            isForwarded: data.isForwarded || false,
            originalSender: data.originalSender || null,
            forwardedFrom: data.forwardedFrom || null,
            replyTo: data.replyTo || null,
            poll: (data.poll && typeof data.poll === 'object' && !Array.isArray(data.poll) && typeof data.poll.question === 'string' && Array.isArray(data.poll.options))
              ? { ...data.poll, options: (data.poll.options as any[]).map((o: any) => typeof o === 'string' ? o : (o?.text ?? o?.label ?? o?.value ?? String(o))), votes: data.poll.votes || {} }
              : null,
          };
        }).reverse();

        setMessages(messagesData);
        setLoading(false);
        setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);

        if (snapshot.docs.length > 0) {
          lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        }

        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        }, 100);
      },
      () => {
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  const loadMoreMessages = async () => {
    if (!id || !hasMore || loadingMore || !lastDocRef.current) return;

    setLoadingMore(true);

    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      const q = query(
        messagesRef,
        orderBy('createdAt', 'desc'),
        startAfter(lastDocRef.current),
        limit(MESSAGES_PER_PAGE)
      );

      const snapshot = await getDocs(q);

      const olderMessages: Message[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          text: data.text || '',
          senderId: data.senderId || '',
          senderName: data.senderName || 'Unknown',
          senderPhoto: data.senderPhoto || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          edited: data.edited || false,
          editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
          attachments: data.attachments || null,
          reactions: data.reactions || {},
          deletedForUsers: data.deletedForUsers || [],
          isForwarded: data.isForwarded || false,
          originalSender: data.originalSender || null,
          forwardedFrom: data.forwardedFrom || null,
          replyTo: data.replyTo || null,
          poll: data.poll || null,
        };
      }).reverse();

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch {
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!currentUser || !id) return;
    const unsub = subscribeToSavedMessages(currentUser.uid, msgs => {
      setSavedIds(new Set(msgs.filter(m => m.originalChannelId === id).map(m => m.id)));
    });
    return () => unsub();
  }, [currentUser, id]);

  const handleSave = async (message: Message) => {
    if (!currentUser || !id) return;
    try {
      if (savedIds.has(message.id)) {
        await unsaveMessage(currentUser.uid, message.id);
      } else {
        await saveMessage(currentUser.uid, {
          id: message.id,
          text: message.text,
          senderName: message.senderName,
          senderId: message.senderId,
          originalChannelId: id,
          chatType: 'channel',
          attachments: message.attachments?.map(a => ({ type: a.type, url: a.url })),
        }, id);
      }
    } catch (err) {
      console.error('Error al guardar mensaje:', err);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;

    setSending(true);

    try {
      const messagesRef = collection(db, 'channels', id, 'messages');

      const messageData: any = {
        text,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || 'User',
        senderPhoto: userData?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null,
        attachments: null,
        reactions: {},
        deletedForUsers: [],
      };

      if (replyingTo) {
        messageData.replyTo = {
          id: replyingTo.id,
          senderName: replyingTo.senderName,
          text: replyingTo.text
        };
      }

      await addDoc(messagesRef, messageData);

      setReplyingTo(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch {
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

const handleSendAudio = async (audioBlob: Blob, duration: number) => {
  if (!currentUser || !id || sending) return;

  setSending(true);

  try {
    if (!audioBlob || audioBlob.size === 0) {
      throw new Error('El audio está vacío');
    }

    const tempId = `temp_${Date.now()}`;
    const audioUrl = await uploadAudio(audioBlob, tempId);
    
    const messagesRef = collection(db, 'channels', id, 'messages');

    const messageData: any = {
      text: '',
      senderId: currentUser.uid,
      senderName: userData?.displayName || currentUser.displayName || 'User',
      senderPhoto: userData?.photoURL || currentUser.photoURL || null,
      createdAt: serverTimestamp(),
      edited: false,
      editedAt: null,
      attachments: [{
        url: audioUrl,
        type: 'audio',
        name: `audio_${Date.now()}.webm`,
        size: audioBlob.size,
        duration: duration
      }],
      reactions: {},
      deletedForUsers: [],
    };

    if (replyingTo) {
      messageData.replyTo = {
        id: replyingTo.id,
        senderName: replyingTo.senderName,
        text: replyingTo.text
      };
    }

    await addDoc(messagesRef, messageData);

    setReplyingTo(null);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  } catch (error) {
    alert(`Error al enviar el audio: ${error instanceof Error ? error.message : 'Error desconocido'}`);
  } finally {
    setSending(false);
  }
};

  const handleSendAttachment = async (file: File, type: 'image' | 'file') => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const url = type === 'image' ? await uploadChatImage(file, `${id}_${Date.now()}`) : await uploadChatFile(file, `${id}_${Date.now()}`);
      await addDoc(collection(db, 'channels', id, 'messages'), {
        text: '',
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || 'User',
        senderPhoto: userData?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false, editedAt: null,
        attachments: [{ url, type, name: file.name, size: file.size }],
        reactions: {}, deletedForUsers: [],
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { alert('Error al enviar el archivo'); } finally { setSending(false); }
  };

  const handleSendPoll = async (poll: Omit<PollData, 'votes'>) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'channels', id, 'messages'), {
        text: poll.question,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || 'User',
        senderPhoto: userData?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false, editedAt: null,
        attachments: null, reactions: {}, deletedForUsers: [],
        poll: { ...poll, votes: {} },
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { } finally { setSending(false); }
  };

  const handleSendContact = async (contact: ContactData) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'channels', id, 'messages'), {
        text: `👤 ${contact.name}`,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || 'User',
        senderPhoto: userData?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false, editedAt: null,
        attachments: [{ type: 'contact', url: contact.photo ?? '', name: contact.name, size: 0, bio: contact.bio, userId: contact.userId }],
        reactions: {}, deletedForUsers: [],
      });
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch { } finally { setSending(false); }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 120);
  };

  const handleReply = (message: any) => {
    setReplyingTo(message);
  };

  const handleAudioReply = (message: any) => {
    setReplyingTo(message);
    setShowRecorder(true);
  };

  const handleDelete = async (message: any, forEveryone: boolean) => {
    if (!id || !message) return;
    
    const confirmMessage = forEveryone 
      ? '¿Eliminar este mensaje para todos?' 
      : '¿Eliminar este mensaje para ti?';
      
    if (!window.confirm(confirmMessage)) return;

    try {
      if (forEveryone) {
        await deleteDoc(doc(db, 'channels', id, 'messages', message.id));
      } else {
        await updateDoc(doc(db, 'channels', id, 'messages', message.id), {
          deletedForUsers: arrayUnion(currentUser?.uid)
        });
      }
    } catch {
      alert('Error al eliminar el mensaje');
    }
  };

  const handleForward = (message: any) => {
    setMessageToForward(message);
    setShowForwardModal(true);
  };

  const handleReact = async (message: any, emoji: string) => {
    if (!id || !currentUser) return;
    
    try {
      const messageRef = doc(db, 'channels', id, 'messages', message.id);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const currentReactions = messageDoc.data().reactions || {};
        const userReactions = currentReactions[emoji] || [];
        
        if (userReactions.includes(currentUser.uid)) {
          if (userReactions.length === 1) {
            const { [emoji]: _, ...rest } = currentReactions;
            await updateDoc(messageRef, { reactions: rest });
          } else {
            await updateDoc(messageRef, {
              [`reactions.${emoji}`]: arrayRemove(currentUser.uid)
            });
          }
        } else {
          await updateDoc(messageRef, {
            [`reactions.${emoji}`]: arrayUnion(currentUser.uid)
          });
        }
      }
    } catch {
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Mensaje copiado al portapapeles');
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const filteredMessages = messages.filter(msg => 
    !msg.deletedForUsers?.includes(currentUser?.uid || '')
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
      <div
        className="chat-loading-container"
        style={{
          ...backgroundStyles,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column' as const,
        }}
      >
        {customBgOverlay}
        <div className="chat-loading-header" style={{ 
          backgroundColor: 'var(--background)',
          borderBottom: '1px solid var(--border)',
        }}>
          <button
            className="chat-back-button"
            onClick={() => navigate('/home')}
          >
            ←
          </button>
          <h1 className="chat-header-title">{channelName}</h1>
          <button
            className="chat-back-button"
            onClick={() => navigate('/settings/theme')}
            style={{ fontSize: '20px' }}
            title="Personalizar tema"
          >
            <Settings size={20} />
          </button>
        </div>
        <div className="chat-loading-content">
          <div className="loading-spinner"></div>
          <p className="chat-loading-text">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="chat-loading-container"
      style={{
        ...backgroundStyles,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      {customBgOverlay}
      <div className="chat-header" style={{
        backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)',
        borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}`,
      }}>
        <button
          className="chat-back-button"
          style={desktopThemeStyle ? { color: desktopThemeStyle.text } : {}}
          onClick={() => navigate('/home')}
        >
          ←
        </button>
        <h1 className="chat-header-title" style={desktopThemeStyle ? { color: desktopThemeStyle.text } : {}}>{channelName}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {activeGroupConference && (
            <button
              className="chat-back-button"
              onClick={() => requestConferenceJoin(activeGroupConference)}
              style={{ fontSize: '20px', ...(desktopThemeStyle ? { color: desktopThemeStyle.text } : {}) }}
              title="Unirse a la conferencia"
            >
              <Presentation size={20} color="#34C759" />
            </button>
          )}
          <button
            className="chat-back-button"
            onClick={() => setShowInfoPanel(v => !v)}
            style={{ fontSize: '20px', ...(desktopThemeStyle ? { color: desktopThemeStyle.text } : {}) }}
            title="Información"
          >
            <Info size={20} color={showInfoPanel ? colors.primary : (desktopThemeStyle ? desktopThemeStyle.text : undefined)} />
          </button>
          <button
            className="chat-back-button"
            onClick={() => navigate('/settings/theme')}
            style={{ fontSize: '20px', ...(desktopThemeStyle ? { color: desktopThemeStyle.text } : {}) }}
            title="Personalizar tema"
          >
            <Settings size={20} color={desktopThemeStyle ? desktopThemeStyle.text : undefined} />
          </button>
        </div>
      </div>
      
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container"
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          backgroundColor: 'transparent',
        }}
      >
        {loadingMore && (
          <div className="chat-loading-more">
            <div className="loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
          </div>
        )}

        {filteredMessages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text" style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '12px', borderRadius: '8px' }}>
              No hay mensajes aún. ¡Comienza la conversación! 💬
            </p>
          </div>
        ) : (
          filteredMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.senderId === currentUser?.uid}
              isAdmin={userData?.role === 'admin'}
              chatId={id}
              isConversation={false}
              isSaved={savedIds.has(message.id)}
              onReply={handleReply}
              onDelete={handleDelete}
              onForward={handleForward}
              onReact={handleReact}
              onCopy={handleCopy}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={handleAudioReply}
              onSave={handleSave}
              onAvatarClick={(senderId) => { if (senderId !== currentUser?.uid) setProfileUserId(senderId); }}
            />
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
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <ChevronsDown size={22} color={colors.text} strokeWidth={2.5} />
      </button>

      <MessageInput
        onSend={handleSendMessage}
        onSendAudio={handleSendAudio}
        onSendAttachment={handleSendAttachment}
        onSendPoll={handleSendPoll}
        onSendContact={handleSendContact}
        disabled={sending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        themeStyle={desktopThemeStyle}
        showRecorder={showRecorder}
        setShowRecorder={setShowRecorder}
      />

      {showInfoPanel && id && (
        <ChannelInfoPanel
          chatId={id}
          isGroup={!!id?.startsWith('sg_')}
          currentUserId={currentUser?.uid ?? ''}
          userRole={userData?.role ?? 'student'}
          colors={colors}
          onClose={() => setShowInfoPanel(false)}
          onClearChat={() => setMessages([])}
          onLeave={() => { setShowInfoPanel(false); navigate('/home'); }}
        />
      )}

      {profileUserId && (
        <DMInfoPanel
          otherUserId={profileUserId}
          currentUserId={currentUser?.uid ?? ''}
          colors={colors}
          onClose={() => setProfileUserId(null)}
        />
      )}

      <SharePostModal
        isOpen={showForwardModal}
        onClose={() => { setShowForwardModal(false); setMessageToForward(null); }}
        message={messageToForward}
      />
    </div>
  );
}