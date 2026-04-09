import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import MessageBubble from '../../components/chat/MessageBubble';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { PollModal } from '../../components/chat/PollModal';
import { uploadAudio, uploadChatImage, uploadChatFile } from '../../config/cloudinary';
import { CornerDownRight, X, Mic, ChevronsDown, ArrowLeft, Plus, Image, FileText, BarChart3, Users, LogOut, UserPlus, UserRound } from 'lucide-react';
import type { PollData } from '../../types';
import {
  subscribeToGroupMessages,
  subscribeToGroupInfo,
  sendGroupMessage,
  markGroupAsRead,
  toggleGroupReaction,
  deleteGroupMessageForMe,
  deleteGroupMessageForAll,
  leaveGroup,
  type GroupConversation,
  type GroupMessage,
} from '../../services/firebase/groupDMService';
import { getFriends } from '../../services/firebase/friendsService';
import { saveMessage, unsaveMessage, subscribeToSavedMessages } from '../../services/firebase/savedItemsService';
import SharePostModal from '../../components/SharePostModal';
import ContactPickerModal, { type ContactData } from '../../components/ContactPickerModal';

function getLuminance(hex: string): number {
  if (!hex || !hex.startsWith('#')) return 1;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

interface ThemeStyle { bg: string; border: string; text: string; }

function MessageInput({
  onSend, onSendAudio, onSendAttachment, onSendPoll, onSendContact,
  disabled, replyingTo, onCancelReply, themeStyle, showRecorder, setShowRecorder,
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled) { onSend(text.trim()); setText(''); textareaRef.current?.focus(); }
  };
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
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
        <div className="animate-slide-up" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', backgroundColor: themeStyle ? themeStyle.border : colors.backgroundSecondary, borderTop: `1px solid ${themeStyle ? themeStyle.border : colors.border}`, fontSize: '13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>{replyingTo.senderName}</span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>{replyingTo.text?.substring(0, 30) || '🎵 Audio'}</span>
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
            <button onClick={() => setShowAttachMenu(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: showAttachMenu ? colors.primary : colors.textSecondary, flexShrink: 0, transition: 'color 0.2s ease' }} title="Adjuntar">
              <Plus size={22} strokeWidth={2} style={{ transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)', transform: showAttachMenu ? 'rotate(45deg)' : 'rotate(0deg)' }} />
            </button>
            <textarea ref={textareaRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown} placeholder="Escribe un mensaje..." className="chat-textarea" style={themeStyle ? { color: themeStyle.text, backgroundColor: 'transparent' } : {}} disabled={disabled} rows={1} />
            <button onClick={() => setShowRecorder(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '8px', display: 'flex', alignItems: 'center' }} title="Grabar audio">
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

function GroupInfoPanel({
  group, currentUserId, colors, onClose, onLeave,
}: {
  group: GroupConversation;
  currentUserId: string;
  colors: any;
  onClose: () => void;
  onLeave: () => void;
}) {
  const [closing, setClosing] = useState(false);
  const close = () => { setClosing(true); setTimeout(onClose, 240); };

  const memberList = group.members.map(id => ({
    id,
    name: group.memberNames[id] || 'Usuario',
    photo: group.memberPhotos[id] || null,
    isCreator: id === group.createdBy,
  }));

  return (
    <div
      className={closing ? '' : 'animate-slide-right'}
      style={{ position: 'absolute', inset: 0, zIndex: 300, backgroundColor: 'var(--background)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, backgroundColor: 'var(--background)', zIndex: 1 }}>
        <button onClick={close} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', display: 'flex', padding: 4 }}>
          <ArrowLeft size={22} />
        </button>
        <span style={{ fontWeight: '700', fontSize: '17px', color: 'var(--text)' }}>Info del grupo</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px 20px', gap: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ width: 80, height: 80, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
          {group.photoURL
            ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Users size={36} color="#fff" />}
        </div>
        <p style={{ margin: 0, fontWeight: '700', fontSize: '20px', color: 'var(--text)' }}>{group.name || 'Grupo sin nombre'}</p>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{group.members.length} miembros</p>
      </div>

      <div style={{ padding: '16px 20px 8px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Miembros
        </p>
        {memberList.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: '700', color: '#fff', flexShrink: 0 }}>
              {m.photo ? <img src={m.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: '600', fontSize: '14px', color: 'var(--text)' }}>{m.name}{m.id === currentUserId ? ' (tú)' : ''}</p>
            </div>
            {m.isCreator && (
              <span style={{ fontSize: '11px', fontWeight: '600', color: colors.primary, backgroundColor: `${colors.primary}22`, padding: '2px 8px', borderRadius: 20 }}>
                Admin
              </span>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: '16px 0 32px' }}>
        <button
          onClick={onLeave}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', width: '100%', background: 'none', border: 'none', cursor: 'pointer', color: '#FF3B30', fontSize: '15px', fontWeight: '500' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--background-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          <LogOut size={20} />
          Salir del grupo
        </button>
      </div>
    </div>
  );
}

export default function GroupChat() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { colors } = useTheme();
  const isDesktop = useWindowSize();
  const chatTheme = colors.chat;

  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [forwardMessage, setForwardMessage] = useState<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    import('firebase/firestore').then(({ doc, getDoc }) => {
      import('../../config/firebase').then(({ db }) => {
        getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
          if (snap.exists()) setUserData(snap.data());
        }).catch(() => {});
      });
    });
  }, [currentUser]);

  useEffect(() => {
    if (!groupId) return;
    return subscribeToGroupInfo(groupId, g => {
      setGroup(g);
      if (!g) navigate('/messages');
    });
  }, [groupId, navigate]);

  useEffect(() => {
    if (!groupId || !currentUser) return;
    const unsub = subscribeToGroupMessages(groupId, currentUser.uid, msgs => {
      setMessages(msgs);
      setLoading(false);
      markGroupAsRead(groupId, currentUser.uid).catch(() => {});
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 60);
    });
    return unsub;
  }, [groupId, currentUser]);

  useEffect(() => {
    if (!currentUser || !groupId) return;
    const channelId = `group/${groupId}`;
    const unsub = subscribeToSavedMessages(currentUser.uid, msgs => {
      setSavedIds(new Set(msgs.filter(m => m.originalChannelId === channelId).map(m => m.id)));
    });
    return () => unsub();
  }, [currentUser, groupId]);

  const handleSave = async (message: any) => {
    if (!currentUser || !groupId) return;
    const channelId = `group/${groupId}`;
    if (savedIds.has(message.id)) {
      await unsaveMessage(currentUser.uid, message.id).catch(() => {});
    } else {
      await saveMessage(currentUser.uid, {
        id: message.id,
        text: message.text,
        senderName: message.senderName,
        senderId: message.senderId,
        originalChannelId: channelId,
        chatType: 'group',
        attachments: message.attachments,
      }, channelId).catch(() => {});
    }
  };

  const handleSend = async (text: string) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const replyData = replyingTo ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text || '' } : null;
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || 'Usuario', userData?.photoURL || currentUser.photoURL || null, text, null, replyData);
      setReplyingTo(null);
    } catch {} finally { setSending(false); }
  };

  const handleSendAudio = async (blob: Blob, duration: number) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const url = await uploadAudio(blob, `group_${groupId}_${Date.now()}`);
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || 'Usuario', userData?.photoURL || currentUser.photoURL || null, '', [{ url, type: 'audio', name: 'audio.webm', size: blob.size, duration }]);
      setShowRecorder(false);
    } catch {} finally { setSending(false); }
  };

  const handleSendAttachment = async (file: File, type: 'image' | 'file') => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      const url = type === 'image' ? await uploadChatImage(file, `group_${groupId}_${Date.now()}`) : await uploadChatFile(file, `group_${groupId}_${Date.now()}`);
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || 'Usuario', userData?.photoURL || currentUser.photoURL || null, '', [{ url, type, name: file.name, size: file.size }]);
    } catch {} finally { setSending(false); }
  };

  const handleSendPoll = async (poll: Omit<PollData, 'votes'>) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || 'Usuario', userData?.photoURL || currentUser.photoURL || null, poll.question, null);
    } catch {} finally { setSending(false); }
  };

  const handleSendContact = async (contact: ContactData) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    try {
      await sendGroupMessage(groupId, currentUser.uid, userData?.displayName || currentUser.displayName || 'Usuario', userData?.photoURL || currentUser.photoURL || null, `👤 ${contact.name}`, [{ type: 'contact', url: contact.photo ?? '', name: contact.name, size: 0, bio: contact.bio, userId: contact.userId }]);
    } catch {} finally { setSending(false); }
  };

  const handleReact = async (message: any, emoji: string) => {
    if (!groupId || !currentUser) return;
    await toggleGroupReaction(groupId, message.id, emoji, currentUser.uid).catch(() => {});
  };

  const handleDelete = async (message: any, forEveryone: boolean) => {
    if (!groupId || !currentUser) return;
    if (!window.confirm(forEveryone ? '¿Eliminar para todos?' : '¿Eliminar para ti?')) return;
    if (forEveryone) {
      await deleteGroupMessageForAll(groupId, message.id).catch(() => {});
    } else {
      await deleteGroupMessageForMe(groupId, message.id, currentUser.uid).catch(() => {});
    }
  };

  const handleLeave = async () => {
    if (!groupId || !currentUser) return;
    if (!window.confirm('¿Salir del grupo?')) return;
    await leaveGroup(groupId, currentUser.uid).catch(() => {});
    navigate('/messages');
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    setShowScrollButton(scrollHeight - scrollTop - clientHeight > 120);
  };

  const handleScrollToMessage = (messageId: string) => {
    const el = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

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
      ? { backgroundColor: chatTheme.background }
      : {
          backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
          backgroundColor: chatTheme.background,
          backgroundSize: 'cover', backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
        };

  const customBgOverlay = isCustomTheme && chatTheme.backgroundImage ? (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', zIndex: 0 }}>
      <img src={chatTheme.backgroundImage} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `translate(${chatTheme.offsetX || 0}px, ${chatTheme.offsetY || 0}px) scale(${chatTheme.scale || 1})`, transformOrigin: 'center', pointerEvents: 'none' }} />
    </div>
  ) : null;

  const groupName = group?.name || 'Grupo';
  const memberCount = group?.members.length ?? 0;

  if (loading) {
    return (
      <div className="chat-loading-container animate-fade-in" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {customBgOverlay}
        <div className="chat-header" style={{ backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)', borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}` }}>
          <button className="chat-back-button" onClick={() => navigate('/messages')}>←</button>
          <h1 className="chat-header-title">{groupName}</h1>
        </div>
        <div className="chat-loading-content"><div className="loading-spinner" /></div>
      </div>
    );
  }

  return (
    <div className="chat-loading-container animate-fade-in" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {customBgOverlay}

      <div className="chat-header" style={{ backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)', borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}`, zIndex: 10, position: 'relative' }}>
        <button className="chat-back-button" style={desktopThemeStyle ? { color: desktopThemeStyle.text } : {}} onClick={() => navigate('/messages')}>
          <ArrowLeft size={22} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setShowInfoPanel(v => !v)}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: colors.primary, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {group?.photoURL
              ? <img src={group.photoURL} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Users size={18} color="#fff" />}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: '700', fontSize: '15px', color: desktopThemeStyle ? desktopThemeStyle.text : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {groupName}
            </p>
            <p style={{ margin: 0, fontSize: '12px', color: desktopThemeStyle ? desktopThemeStyle.text : 'var(--text-secondary)', opacity: 0.7 }}>
              {memberCount} miembros
            </p>
          </div>
        </div>

        <button className="chat-back-button" onClick={() => setShowInfoPanel(v => !v)} style={desktopThemeStyle ? { color: desktopThemeStyle.text } : {}}>
          <Users size={20} color={showInfoPanel ? colors.primary : undefined} />
        </button>
      </div>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container"
        style={{ flex: 1, overflowY: 'auto', backgroundColor: 'transparent', position: 'relative', zIndex: 1 }}
      >
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text" style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '12px', borderRadius: '8px' }}>
              No hay mensajes aún. ¡Empieza la conversación! 💬
            </p>
          </div>
        ) : (
          messages.map(msg => (
            <MessageBubble
              key={msg.id}
              message={msg as any}
              isOwnMessage={msg.senderId === currentUser?.uid}
              isAdmin={userData?.role === 'admin'}
              chatId={groupId}
              isConversation={false}
              chatCollection="groupConversations"
              isSaved={savedIds.has(msg.id)}
              onReply={m => setReplyingTo(m)}
              onDelete={handleDelete}
              onForward={(msg: any) => setForwardMessage(msg)}
              onReact={handleReact}
              onCopy={text => navigator.clipboard.writeText(text)}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={m => { setReplyingTo(m); setShowRecorder(true); }}
              onSave={handleSave}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <button
        onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })}
        className="btn-press"
        style={{
          position: 'absolute', bottom: '80px', right: '16px', width: '44px', height: '44px',
          borderRadius: '50%', backgroundColor: colors.backgroundSecondary, color: colors.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.35)', border: `1px solid ${colors.border}`,
          zIndex: 5, opacity: showScrollButton ? 1 : 0,
          transform: showScrollButton ? 'scale(1)' : 'scale(0.7)',
          pointerEvents: showScrollButton ? 'auto' : 'none',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
      >
        <ChevronsDown size={22} strokeWidth={2.5} />
      </button>

      <div style={{ position: 'relative', zIndex: 2 }}>
        <MessageInput
          onSend={handleSend}
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
      </div>

      {showInfoPanel && group && (
        <GroupInfoPanel
          group={group}
          currentUserId={currentUser?.uid ?? ''}
          colors={colors}
          onClose={() => setShowInfoPanel(false)}
          onLeave={handleLeave}
        />
      )}
      <SharePostModal
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        message={forwardMessage}
      />
    </div>
  );
}
