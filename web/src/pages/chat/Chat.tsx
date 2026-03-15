import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import type { Message } from '../../types';
import MessageBubble from '../../components/chat/MessageBubble';
import ForwardModal from '../../components/chat/FowardModal';
import AudioRecorder from '../../components/chat/AudioRecorder';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';
import { Settings, CornerDownRight, X, Mic, ChevronsDown } from 'lucide-react';
import { uploadAudio } from '../../config/cloudinary';

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

function MessageInput({ onSend, onSendAudio, disabled = false, replyingTo, onCancelReply, themeStyle, showRecorder, setShowRecorder }: {
  onSend: (text: string) => void;
  onSendAudio: (audioBlob: Blob, duration: number) => void;
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
          fontSize: '13px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CornerDownRight size={16} color={themeStyle ? themeStyle.text : colors.primary} />
            <span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.primary, fontWeight: '600' }}>{replyingTo.senderName}</span>
              <span style={{ color: themeStyle ? themeStyle.text : colors.textSecondary, opacity: 0.7, marginLeft: '8px' }}>{replyingTo.text.substring(0, 30)}...</span>
            </span>
          </div>
          <button
            onClick={onCancelReply}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: themeStyle ? themeStyle.text : colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              padding: '4px'
            }}
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
            onSend={(audioBlob, duration) => {
              onSendAudio(audioBlob, duration);
              setShowRecorder(false);
            }}
            onCancel={() => setShowRecorder(false)}
          />
        ) : (
          <>
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
            <button
              onClick={() => setShowRecorder(true)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.primary,
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<any>(null);
  const navigate = useNavigate();

  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const isDesktop = useWindowSize();

  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const channelName = channel?.name || `Channel ${id}`;
  const currentUser = auth.currentUser;

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

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
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
            replyTo: data.replyTo || null
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
          replyTo: data.replyTo || null
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

  const handleForwardToChannels = async (channelIds: string[]) => {
    if (!currentUser || !messageToForward) return;
    
    try {
      for (const channelId of channelIds) {
        const messagesRef = collection(db, 'channels', channelId, 'messages');
        
        await addDoc(messagesRef, {
          text: messageToForward.text,
          senderId: currentUser.uid,
          senderName: userData?.displayName || currentUser.displayName || 'User',
          senderPhoto: userData?.photoURL || currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          edited: false,
          editedAt: null,
          attachments: messageToForward.attachments,
          reactions: {},
          deletedForUsers: [],
          isForwarded: true,
          originalSender: messageToForward.senderName,
          forwardedFrom: {
            channelId: id,
            messageId: messageToForward.id,
            senderName: messageToForward.senderName
          }
        });
      }
      
      alert(`Mensaje reenviado a ${channelIds.length} chat(s)`);
      setShowForwardModal(false);
      setMessageToForward(null);
    } catch {
      alert('Error al reenviar el mensaje');
    }
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

  const isNonDefaultTheme = colors.chatSettings.themeId !== 'default';
  const useThemeStyling = isDesktop && isNonDefaultTheme;
  const themeIsLight = getLuminance(chatTheme.background) > 0.55;
  const themeTextColor = themeIsLight ? '#1C1C1E' : '#FFFFFF';
  const themeBorderColor = themeIsLight ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
  const desktopThemeStyle: ThemeStyle | undefined = useThemeStyling
    ? { bg: chatTheme.background, border: themeBorderColor, text: themeTextColor }
    : undefined;

  const backgroundStyles = isDesktop
    ? {
        backgroundColor: chatTheme.background,
        backgroundImage: 'none',
      }
    : {
        backgroundImage: chatTheme.backgroundImage ? `url(${chatTheme.backgroundImage})` : 'none',
        backgroundColor: chatTheme.background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
      };

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
        <button
          className="chat-back-button"
          onClick={() => navigate('/settings/theme')}
          style={{ fontSize: '20px', ...(desktopThemeStyle ? { color: desktopThemeStyle.text } : {}) }}
          title="Personalizar tema"
        >
          <Settings size={20} color={desktopThemeStyle ? desktopThemeStyle.text : undefined} />
        </button>
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
              onReply={handleReply}
              onDelete={handleDelete}
              onForward={handleForward}
              onReact={handleReact}
              onCopy={handleCopy}
              onScrollToMessage={handleScrollToMessage}
              onAudioReply={handleAudioReply}
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
        disabled={sending}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        themeStyle={desktopThemeStyle}
        showRecorder={showRecorder}
        setShowRecorder={setShowRecorder}
      />

      <ForwardModal
        isOpen={showForwardModal}
        onClose={() => {
          setShowForwardModal(false);
          setMessageToForward(null);
        }}
        onForward={handleForwardToChannels}
        message={messageToForward}
      />
    </div>
  );
}