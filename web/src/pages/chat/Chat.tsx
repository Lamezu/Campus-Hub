import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { MOCK_CHANNELS } from '../../constants/mockData';
import type { Message } from '../../types';
import MessageBubble from '../../components/chat/MessageBubble';
import { useTheme } from '../../contexts/ThemeContext';
import { useWindowSize } from '../../hooks/useWindowSize';

const MESSAGES_PER_PAGE = 50;

function MessageInput({ onSend, disabled = false }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-input-container">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyPress}
        placeholder="Escribe un mensaje..."
        className="chat-textarea"
        disabled={disabled}
        rows={1}
      />
      <button
        onClick={handleSend}
        disabled={!text.trim() || disabled}
        className="chat-send-button"
      >
        <div className="chat-send-icon" />
      </button>
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
        console.error('Error loading user data:', error);
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
            reactions: data.reactions || {}
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
      (error) => {
        console.error('Error loading messages:', error);
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
          reactions: data.reactions || {}
        };
      }).reverse();

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error('Error loading more messages:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;

    setSending(true);

    try {
      const messagesRef = collection(db, 'channels', id, 'messages');

      await addDoc(messagesRef, {
        text,
        senderId: currentUser.uid,
        senderName: userData?.displayName || currentUser.displayName || 'User',
        senderPhoto: userData?.photoURL || currentUser.photoURL || null,
        createdAt: serverTimestamp(),
        edited: false,
        editedAt: null,
        attachments: null,
        reactions: {}
      });

      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && hasMore && !loadingMore) {
      loadMoreMessages();
    }
  };

  // Determinar estilos de fondo según el dispositivo
  const backgroundStyles = isDesktop
    ? {
        backgroundColor: chatTheme.background, // Color sólido en escritorio
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
          minHeight: '100vh',
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
            🎨
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
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column' as const,
      }}
    >
      <div className="chat-header" style={{ 
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
          🎨
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

        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text" style={{ backgroundColor: 'rgba(255,255,255,0.8)', padding: '12px', borderRadius: '8px' }}>
              No hay mensajes aún. ¡Comienza la conversación! 💬
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwnMessage={message.senderId === currentUser?.uid}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <MessageInput onSend={handleSendMessage} disabled={sending} />
    </div>
  );
}