import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import MessageBubble from '../../components/chat/MessageBubble';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { uploadAudio } from '../../config/cloudinary';
import { CornerDownRight, X, Mic, ChevronsDown, ArrowLeft, Phone, Video } from 'lucide-react';
import { useCall } from '../../contexts/CallContext';
import {
  createCall,
  type CallType
} from '../../services/firebase/callService';
import {
  subscribeToMessages,
  loadMoreMessages as loadMoreDMs,
  sendMessage,
  markAsRead,
  deleteMessage,
  deleteMessageForMe,
  addReaction,
  removeReaction,
  type DMMessage,
  type DMReplyTo
} from '../../services/firebase/directMessageService';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

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

function MessageInput({
  onSend,
  onSendAudio,
  disabled,
  replyingTo,
  onCancelReply,
  themeStyle,
  showRecorder,
  setShowRecorder
}: {
  onSend: (text: string) => void;
  onSendAudio: (blob: Blob, duration: number) => void;
  disabled?: boolean;
  replyingTo?: any;
  onCancelReply?: () => void;
  themeStyle?: ThemeStyle;
  showRecorder: boolean;
  setShowRecorder: (v: boolean) => void;
}) {
  const [text, setText] = useState('');
  const { colors } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      textareaRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {replyingTo && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          backgroundColor: themeStyle ? themeStyle.border : colors.backgroundSecondary,
          borderTop: `1px solid ${themeStyle ? themeStyle.border : colors.border}`,
          fontSize: '13px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>
                {replyingTo.senderName}
              </span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>
                {replyingTo.text?.substring(0, 30) || '🎵 Audio'}
              </span>
            </span>
          </div>
          <button
            onClick={onCancelReply}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: themeStyle ? themeStyle.text : colors.textSecondary, display: 'flex', padding: '4px' }}
          >
            <X size={18} />
          </button>
        </div>
      )}
      <div
        className="chat-input-container"
        style={themeStyle ? { backgroundColor: themeStyle.bg, borderTop: `1px solid ${themeStyle.border}` } : {}}
      >
        {showRecorder ? (
          <AudioRecorder
            onSend={(blob, duration) => {
              onSendAudio(blob, duration);
              setShowRecorder(false);
            }}
            onCancel={() => setShowRecorder(false)}
          />
        ) : (
          <>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={replyingTo ? `Responder a ${replyingTo.senderName}...` : 'Escribe un mensaje...'}
              className="chat-textarea"
              style={themeStyle ? { color: themeStyle.text, backgroundColor: 'transparent' } : {}}
              disabled={disabled}
              rows={1}
            />
            <button
              onClick={() => setShowRecorder(true)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, padding: '8px', display: 'flex', alignItems: 'center' }}
              title="Grabar audio"
            >
              <Mic size={20} />
            </button>
            <button
              onClick={handleSend}
              disabled={!text.trim() || disabled}
              className="chat-send-button"
            >
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
  const { setActiveCall, setActiveCallId } = useCall();

  const handleStartCall = async (type: CallType) => {
    if (!currentUser || !otherUser) return;
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
      alert('No se pudo iniciar la llamada.');
    }
  };
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<QueryDocumentSnapshot | null>(null);
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

    const unsubscribe = subscribeToMessages(conversationId, (msgs, lastDoc) => {
      setMessages(msgs);
      setLoading(false);
      setHasMore(msgs.length === MESSAGES_PER_PAGE);
      lastDocRef.current = lastDoc;
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'auto' }), 100);
    });

    markAsRead(conversationId, currentUser.uid).catch(() => {});

    return () => unsubscribe();
  }, [conversationId, currentUser]);

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
      const replyTo: DMReplyTo | null = replyingTo
        ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text || '', isAudio: replyingTo.attachments?.[0]?.type === 'audio' }
        : null;
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
    } catch {
      alert('Error al enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (audioBlob: Blob, duration: number) => {
    if (!currentUser || !conversationId || sending) return;
    setSending(true);
    try {
      const audioUrl = await uploadAudio(audioBlob, `temp_${Date.now()}`);
      const replyTo: DMReplyTo | null = replyingTo
        ? { id: replyingTo.id, senderName: replyingTo.senderName, text: replyingTo.text || '', isAudio: replyingTo.attachments?.[0]?.type === 'audio' }
        : null;
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
      alert(`Error al enviar el audio: ${err instanceof Error ? err.message : 'Error'}`);
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
    const ok = window.confirm(forEveryone ? '¿Eliminar para todos?' : '¿Eliminar para ti?');
    if (!ok) return;
    try {
      if (forEveryone) {
        await deleteMessage(conversationId, message.id);
      } else {
        await deleteMessageForMe(conversationId, message.id, currentUser!.uid);
      }
    } catch {
      alert('Error al eliminar el mensaje');
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

  const filteredMessages = messages.filter(
    msg => !msg.deletedForUsers?.includes(currentUser?.uid || '')
  );

  const isNonDefaultTheme = colors.chatSettings.themeId !== 'default';
  const useThemeStyling = isDesktop && isNonDefaultTheme;
  const themeIsLight = getLuminance(chatTheme.background) > 0.55;
  const themeTextColor = themeIsLight ? '#1C1C1E' : '#FFFFFF';
  const themeBorderColor = themeIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const desktopThemeStyle: ThemeStyle | undefined = useThemeStyling
    ? { bg: chatTheme.background, border: themeBorderColor, text: themeTextColor }
    : undefined;

  const backgroundStyles = isDesktop
    ? { backgroundColor: chatTheme.background, backgroundImage: 'none' }
    : {
        backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
        backgroundColor: chatTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed'
      };

  const headerContent = (
    <div className="chat-header" style={{
      backgroundColor: desktopThemeStyle ? desktopThemeStyle.bg : 'var(--background)',
      borderBottom: `1px solid ${desktopThemeStyle ? desktopThemeStyle.border : 'var(--border)'}`
    }}>
      <button
        className="chat-back-button"
        style={desktopThemeStyle ? { color: desktopThemeStyle.text } : {}}
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
        {otherUser?.displayName || 'Conversación'}
      </h1>
      <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto' }}>
        <button
          onClick={() => handleStartCall('audio')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle?.text ?? 'var(--text)' }}
          title="Llamada de voz"
        >
          <Phone size={20} />
        </button>
        <button
          onClick={() => handleStartCall('video')}
          className="chat-back-button"
          style={{ color: desktopThemeStyle?.text ?? 'var(--text)' }}
          title="Videollamada"
        >
          <Video size={20} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="chat-loading-container" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {headerContent}
        <div className="chat-loading-content">
          <div className="loading-spinner" />
          <p className="chat-loading-text">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-loading-container" style={{ ...backgroundStyles, height: '100vh', display: 'flex', flexDirection: 'column' }}>
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
              No hay mensajes aún. ¡Inicia la conversación! 💬
            </p>
          </div>
        ) : (
          filteredMessages.map(message => (
            <MessageBubble
              key={message.id}
              message={message as any}
              isOwnMessage={message.senderId === currentUser?.uid}
              onReply={(msg: any) => setReplyingTo(msg)}
              onDelete={handleDelete}
              onReact={handleReact}
              onCopy={handleCopy}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={(msg: any) => { setReplyingTo(msg); setShowRecorder(true); }}
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
          transition: 'opacity 0.2s ease, transform 0.2s ease'
        }}
      >
        <ChevronsDown size={22} strokeWidth={2.5} />
      </button>

      <MessageInput
        onSend={handleSendMessage}
        onSendAudio={handleSendAudio}
        disabled={sending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        themeStyle={desktopThemeStyle}
        showRecorder={showRecorder}
        setShowRecorder={setShowRecorder}
      />

    </div>
  );
}
