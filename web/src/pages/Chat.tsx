import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { MOCK_CHANNELS } from '../constants/mockData';
import type { Message } from '../types';

const MESSAGES_PER_PAGE = 50;

function MessageBubble({ message, isOwnMessage }: { message: Message; isOwnMessage: boolean }) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`chat-message-wrapper ${isOwnMessage ? 'chat-message-own' : 'chat-message-other'}`}>
      {!isOwnMessage && (
        <div className="chat-sender-name">
          {message.senderName}
        </div>
      )}
      
      <div className={`chat-bubble ${isOwnMessage ? 'chat-bubble-own' : 'chat-bubble-other'}`}>
        <div className={`chat-bubble-text ${isOwnMessage ? 'chat-bubble-text-own' : 'chat-bubble-text-other'}`}>
          {message.text}
        </div>
        <div className={`chat-bubble-time ${isOwnMessage ? 'chat-bubble-time-own' : 'chat-bubble-time-other'}`}>
          {formatTime(message.createdAt)}
        </div>
      </div>
    </div>
  );
}

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

  if (loading) {
    return (
      <div className="chat-loading-container">
        <header className="chat-loading-header">
          <div className="header-content" style={{ maxWidth: '600px', margin: '0 auto' }}>
            <button 
              className="settings-button"
              onClick={() => navigate('/home')}
              style={{ marginRight: 'auto'}}
            >
              ←
            </button>
            <h1 className="text-title">{channelName}</h1>
          </div>
        </header>
        <div className="chat-loading-content">
          <div className="loading-spinner"></div>
          <p className="chat-loading-text">Cargando mensajes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <header className="header chat-header">
        <div className="chat-header-content">
          <button 
            className="settings-button chat-back-button"
            onClick={() => navigate('/home')}
          >
            ←
          </button>
          <h1 className="text-title chat-title">{channelName}</h1>
        </div>
      </header>

      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="chat-messages-container"
      >
        {loadingMore && (
          <div className="chat-loading-more">
            <div className="loading-spinner" style={{ width: '24px', height: '24px', margin: '0 auto' }} />
          </div>
        )}

        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <p className="chat-empty-text">
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