import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { Settings, ChevronLeft, Reply, Trash2, Copy, Forward, Plus, ChevronDown, MoreVertical, Type, Bold, Italic, Check } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import type { Message, ReplyPreview } from '@/types';

const MESSAGES_PER_PAGE = 50;
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatScreen() {
  const { colors, chatSettings, setChatSettings } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type });
  };

  const scrollRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);

  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const channelName = channel?.name || `Canal ${id}`;
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
    });
  }, [currentUser]);

  useEffect(() => {
    if (!id) return;
    const messagesRef = collection(db, 'channels', id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'), limit(MESSAGES_PER_PAGE));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messagesData: Message[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            text: data.text || '',
            senderId: data.senderId || '',
            senderName: data.senderName || 'Desconocido',
            senderPhoto: data.senderPhoto || null,
            createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
            edited: data.edited || false,
            editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
            attachments: data.attachments || null,
            reactions: data.reactions || {},
            replyTo: data.replyTo || null,
            deletedForUsers: data.deletedForUsers || [],
          };
        })
        .filter(msg => !currentUser || !msg.deletedForUsers?.includes(currentUser.uid));
      
      setMessages(messagesData);
      setLoading(false);
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
      if (snapshot.docs.length > 0) {
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, currentUser]);

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'Usuario',
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text,
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: replyData ?? null,
        deletedForUsers: [],
      });
    } catch (error) {
      console.error(error);
      showAlert('Error', 'Error al enviar el mensaje.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !id) return;
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', id, 'messages');
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'Usuario',
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        attachments: [{ url, type: 'audio', duration }],
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: replyData ?? null,
        deletedForUsers: [],
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleReply = (message: Message) => {
    setReplyingTo({
      id: message.id,
      text: message.text,
      senderName: message.senderName,
      isAudio: !!message.attachments?.find(a => a.type === 'audio'),
    });
  };

  const handleReaction = async (emoji: string, msg: Message) => {
    if (!currentUser || !id) return;
    const existing = msg.reactions?.[emoji] ?? [];
    const hasReacted = existing.includes(currentUser.uid);
    await updateDoc(doc(db, 'channels', id, 'messages', msg.id), {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    });
  };

  const deleteMessage = async (messageId: string, forAll = false) => {
    if (!id || !currentUser) return;
    try {
      if (forAll) {
        await deleteDoc(doc(db, 'channels', id, 'messages', messageId));
      } else {
        await updateDoc(doc(db, 'channels', id, 'messages', messageId), {
          deletedForUsers: arrayUnion(currentUser.uid),
        });
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleReplyPreviewPress = (messageId: string) => {
    setHighlightedMessageId(messageId);
    const element = document.getElementById(`msg-${messageId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <ThemedText style={{ marginTop: spacing.md, opacity: 0.6 }}>Cargando mensajes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: colors.chat.background }}>
      {/* Header */}
      <div style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        backgroundColor: colors.chat.isDark ? '#1C1C1E' : '#FFFFFF', 
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
      }}>
        <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.chat.isDark ? '#FFFFFF' : '#1C1C1E' }}>
          <ChevronLeft size={24} />
        </button>
        <div style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: typography.sizes.md, fontWeight: 'bold', color: colors.chat.isDark ? '#FFFFFF' : '#1C1C1E' }}>{channelName}</ThemedText>
        </div>
        <button onClick={() => setShowSettings(!showSettings)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.chat.isDark ? '#FFFFFF' : '#1C1C1E' }}>
          <MoreVertical size={22} />
        </button>
      </div>

      {/* Messages List Area */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column-reverse',
            padding: `${spacing.md}px 0`,
            backgroundImage: colors.chat.backgroundImage ? `url(${colors.chat.backgroundImage})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {messages.length === 0 && !loading && (
              <div style={{ padding: spacing.xl, textAlign: 'center', opacity: 0.6 }}>
                <ThemedText style={{ color: colors.chat.isDark ? '#FFFFFF' : '#1C1C1E' }}>No hay mensajes aún. ¡Sé el primero en escribir!</ThemedText>
              </div>
            )}
            {[...messages].reverse().map((msg) => (
              <div key={msg.id} id={`msg-${msg.id}`}>
                <MessageBubble
                  message={msg}
                  isOwnMessage={msg.senderId === currentUser?.uid}
                  currentUserId={currentUser?.uid}
                  onReply={handleReply}
                  onLongPress={setMenuMessage}
                  onDoubleTap={() => handleReaction('❤️', msg)}
                  onReplyPreviewPress={handleReplyPreviewPress}
                  highlighted={highlightedMessageId === msg.id}
                  onDelete={deleteMessage}
                  onReact={(id, emoji) => handleReaction(emoji, messages.find(m => m.id === id)!)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div style={{
          position: 'absolute', top: 60, right: 20, width: 280,
          backgroundColor: colors.card, border: `1px solid ${colors.border}`,
          borderRadius: 16, boxShadow: '0 8px 24px rgba(0,0,0,0.2)', zIndex: 1000,
          padding: spacing.md,
          maxHeight: '80vh', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md }}>
            <ThemedText style={{ fontWeight: 'bold' }}>Personalizar Chat</ThemedText>
            <button onClick={() => setShowSettings(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}>
              <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
            </button>
          </div>

          <div style={{ marginBottom: spacing.lg }}>
            <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>Fondo del Chat</ThemedText>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {Object.values(chatThemes).map(t => (
                <button
                  key={t.id}
                  onClick={() => setChatSettings({ themeId: t.id })}
                  title={t.name}
                  style={{
                    aspectRatio: '1', borderRadius: 8, backgroundColor: t.background,
                    backgroundImage: t.backgroundImage ? `url(${t.backgroundImage})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    border: chatSettings.themeId === t.id ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                    cursor: 'pointer', position: 'relative'
                  }}
                >
                  {chatSettings.themeId === t.id && (
                    <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Check size={14} color="#FFF" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ padding: spacing.sm, borderRadius: 12, border: `1px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: spacing.md }}>
              <Type size={18} color={colors.primary} />
              <ThemedText style={{ fontSize: 14, fontWeight: 'bold' }}>Ajustes de texto</ThemedText>
            </div>

            <div style={{ marginBottom: spacing.md }}>
              <ThemedText style={{ fontSize: 12, opacity: 0.6, display: 'block', marginBottom: 4 }}>Tamaño</ThemedText>
              <div style={{ display: 'flex', gap: 4 }}>
                {[12, 14, 16, 18, 20].map(size => (
                  <button
                    key={size}
                    onClick={() => setChatSettings({ fontSize: size })}
                    style={{
                      flex: 1, padding: '4px', borderRadius: 6, border: 'none',
                      backgroundColor: chatSettings.fontSize === size ? colors.primary : 'transparent',
                      color: chatSettings.fontSize === size ? '#FFF' : colors.text, 
                      cursor: 'pointer', fontSize: 11, fontWeight: 'bold',
                      transition: 'all 0.15s'
                    }}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px', borderRadius: 8, border: 'none',
                  backgroundColor: chatSettings.fontWeight === 'bold' ? `${colors.primary}20` : 'transparent',
                  color: chatSettings.fontWeight === 'bold' ? colors.primary : colors.text,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <Bold size={16} />
                <span style={{ fontSize: 12, fontWeight: 'bold' }}>N</span>
              </button>
              <button
                onClick={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '8px', borderRadius: 8, border: 'none',
                  backgroundColor: chatSettings.fontStyle === 'italic' ? `${colors.primary}20` : 'transparent',
                  color: chatSettings.fontStyle === 'italic' ? colors.primary : colors.text,
                  cursor: 'pointer', transition: 'all 0.15s'
                }}
              >
                <Italic size={16} />
                <span style={{ fontSize: 12, fontStyle: 'italic' }}>K</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <MessageInput
        ref={messageInputRef}
        onSend={handleSendMessage}
        onSendAudio={handleSendAudio}
        replyTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
        disabled={sending}
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
      />

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </ThemedView>
  );
}
