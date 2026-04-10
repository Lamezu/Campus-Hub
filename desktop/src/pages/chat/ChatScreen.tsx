import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { 
  Settings, ChevronLeft, Reply, Trash2, Copy, Forward, 
  Plus, ChevronDown, MoreVertical, Type, Bold, Italic, 
  Check, Search, Camera, Loader2, CheckCircle2, 
  Megaphone, Compass, CalendarRange, LifeBuoy 
} from 'lucide-react';
import { ChatBackgroundEditor } from '@/components/chat/ChatBackgroundEditor';
import { uploadChannelPhoto } from '@/config/cloudinary';
import { AlertModal } from '@/components/AlertModal';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { EventChannelView } from '@/components/chat/EventChannelView';
import { SoporteChannelView } from '@/components/chat/SoporteChannelView';
import { ChannelInfoModal } from '@/components/chat/ChannelInfoModal';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import { markChannelRead } from '@/services/channelReadService';
import { notificationService } from '@/services/notificationService';
import { useAlert } from '@/contexts/AlertContext';
import * as starredService from '@/services/starredMessagesService';
import type { Message, ReplyPreview } from '@/types';
import { useCurrentUser } from '@/contexts/UserContext';

const MESSAGES_PER_PAGE = 50;
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatScreen() {
  const { colors, chatSettings, setChatSettings } = useTheme();
  const { showAlert } = useAlert();
  const { id } = useParams<{ id: string }>();
  const cleanId = id?.replace(/^(sg_|group_|channel_|group_)/, '') || '';
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useCurrentUser();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [dynamicChannelName, setDynamicChannelName] = useState<string | null>(null);
  const [channelPhoto, setChannelPhoto] = useState<string | null>(null);
  const [showChannelInfo, setShowChannelInfo] = useState(false);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingBg, setUploadingBg] = useState(false);
  const [editingBgImage, setEditingBgImage] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastDocRef = useRef<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);

  const channelName = dynamicChannelName || `Canal ${id}`;
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) return;
    getDoc(doc(db, 'users', currentUser.uid)).then(snap => {
      if (snap.exists()) setUserProfile(snap.data());
    });
  }, [currentUser]);

  useEffect(() => {
    if (!cleanId) return;
    
    const mockChannel = MOCK_CHANNELS.find(ch => ch.id === cleanId);
    if (mockChannel) {
      setDynamicChannelName(mockChannel.name);
    }

    const tryFetchName = async () => {
      const sgSnap = await getDoc(doc(db, 'studyGroups', cleanId));
      if (sgSnap.exists()) {
        const data = sgSnap.data();
        setDynamicChannelName(data.name);
        setChannelPhoto(data.photoURL || null);
        setChannelMembers(data.memberIds || []);
        return;
      }
      
      const chSnap = await getDoc(doc(db, 'channels', cleanId));
      if (chSnap.exists()) {
        const data = chSnap.data();
        setDynamicChannelName(data.name || data.displayName || mockChannel?.name || null);
        setChannelPhoto(data.photoURL || null);
        setChannelMembers(data.memberIds || []);
      }
    };

    tryFetchName();
  }, [cleanId]);

  useEffect(() => {
    if (!cleanId) return;
    const messagesRef = collection(db, 'channels', cleanId, 'messages');
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
      if (currentUser && cleanId) {
        markChannelRead(cleanId, currentUser.uid);
      }
    }, (error) => {
      console.error(error);
      setLoading(false);
    });

    // Load starred messages IDs
    if (currentUser) {
      starredService.getStarredIdsForChannel(currentUser.uid, cleanId)
        .then(setStarredIds)
        .catch(console.error);
    }

    return () => unsubscribe();
  }, [cleanId, currentUser]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const highlightId = params.get('highlightId');
    if (highlightId && messages.length > 0) {
      const handleHighlight = (messageId: string) => {
        setHighlightedMessageId(messageId);
        const element = document.getElementById(`msg-${messageId}`);
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => setHighlightedMessageId(null), 2000);
      };
      handleHighlight(highlightId);
      const newParams = new URLSearchParams(location.search);
      newParams.delete('highlightId');
      navigate({ search: newParams.toString() }, { replace: true });
    }
  }, [location.search, messages.length]);

  // Mark as read and suppress current channel notifications
  useEffect(() => {
    if (!id || !currentUser) return;
    
    markChannelRead(id, currentUser.uid);
    notificationService.setCurrentView({ type: 'channel', id });
    
    return () => {
      notificationService.setCurrentView(null);
    };
  }, [id, currentUser]);

  const getChannelInfo = () => {
    const systemChannels: Record<string, { icon: any; verified: boolean; readOnly?: boolean; viewType?: 'events' | 'support' }> = {
      'general': { icon: Compass, verified: false },
      'anuncios oficiales': { icon: Megaphone, verified: true, readOnly: true },
      'eventos y actividad': { icon: CalendarRange, verified: true, readOnly: true, viewType: 'events' },
      'ayuda y soporte': { icon: LifeBuoy, verified: true, readOnly: false, viewType: 'support' }
    };

    const nameToTest = (dynamicChannelName || MOCK_CHANNELS.find(c => c.id === cleanId)?.name || '').toLowerCase();
    const idToTest = cleanId.toLowerCase();
    
    for (const key in systemChannels) {
      if (nameToTest.includes(key) || idToTest.includes(key)) {
        return { ...systemChannels[key], isSystem: true };
      }
    }
    return { icon: null, verified: false, isSystem: false, readOnly: false };
  };

  const channelInfo = getChannelInfo();
  const isSystemChannel = channelInfo.isSystem;
  const isReadOnlyChannel = channelInfo.readOnly && !isAdmin;

  const sendChannelNotifications = async (messageId: string, text: string) => {
    if (!currentUser || !cleanId) return;
    
    // Calculate unique targets
    let targets = [...channelMembers];
    if (isSystemChannel) {
      const usnap = await getDocs(query(collection(db, 'users'), limit(1000)));
      const allUserIds = usnap.docs.map(u => u.id);
      targets = [...targets, ...allUserIds];
    } else if (targets.length === 0) {
      const usnap = await getDocs(query(collection(db, 'users'), limit(100)));
      targets = usnap.docs.map(u => u.id);
    }

    const uniqueTargets = Array.from(new Set(targets.filter(t => t && t !== currentUser.uid)));
    const senderName = userProfile?.displayName || currentUser.displayName || 'Usuario';
    const channelNameDisplay = dynamicChannelName || MOCK_CHANNELS.find(c => c.id === cleanId)?.name || 'Canal';

    const notifyPromises = uniqueTargets.map(mId => 
      notificationService.addNotification(mId, {
        title: `${senderName} en ${channelNameDisplay}`,
        body: text,
        category: 'channel',
        meta: { channelId: cleanId },
      }, messageId)
    );
    
    await Promise.all(notifyPromises).catch(console.error);
  };

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
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
      
      await sendChannelNotifications(docRef.id, text);
    } catch (error) {
      console.error(error);
      showAlert({ title: 'Error', message: 'Error al enviar el mensaje.', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
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

      await sendChannelNotifications(docRef.id, '🎤 Mensaje de voz');
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleSendMedia = async (url: string, type: 'image' | 'video') => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const messagesRef = collection(db, 'channels', cleanId, 'messages');
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'Usuario',
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        attachments: [{ url, type, name: type === 'video' ? 'video.mp4' : 'image.jpg', size: 0 }],
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: null,
        deletedForUsers: [],
      });

      await sendChannelNotifications(docRef.id, type === 'video' ? '🎥 Vídeo' : '📷 Imagen');
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleSendPoll = async (poll: any) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    try {
      const messagesRef = collection(db, 'channels', cleanId, 'messages');
      const pollData = {
        question: poll.question,
        options: poll.options.map((opt: string, i: number) => ({ id: i.toString(), text: opt, votes: [] })),
        multipleAnswers: poll.multipleAnswers,
        closed: false,
        totalVotes: 0,
      };
      
      const docRef = await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderName: userProfile?.displayName || currentUser.displayName || 'Usuario',
        senderPhoto: userProfile?.photoURL || currentUser.photoURL || null,
        text: '',
        poll: pollData,
        createdAt: serverTimestamp(),
        edited: false,
        reactions: {},
        replyTo: null,
        deletedForUsers: [],
      });

      await sendChannelNotifications(docRef.id, `📊 Encuesta: ${poll.question}`);
    } catch (error) {
      console.error(error);
    } finally {
      setSending(false);
    }
  };

  const handleToggleStar = async (msg: Message) => {
    if (!currentUser || !cleanId) return;
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
        await starredService.starMessage(currentUser.uid, msg, 'channel', undefined, cleanId);
        setStarredIds(prev => new Set(prev).add(msg.id));
      }
    } catch (error) {
      console.error('Error toggling star:', error);
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

  const handleForward = (msg: Message) => {
    const audio = msg.attachments?.find(a => a.type === 'audio');
    const params = new URLSearchParams();
    if (msg.text) params.append('messageText', msg.text);
    if (audio) {
      params.append('audioUrl', audio.url);
      params.append('audioDuration', (audio.duration || 0).toString());
    }
    navigate(`/forward?${params.toString()}`);
  };

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
      console.error('Error uploading background:', error);
    } finally {
      setUploadingBg(false);
      if (bgInputRef.current) bgInputRef.current.value = '';
    }
  };

  const handleSaveEditedBg = (url: string, x: number, y: number, scale: number) => {
    const newBg = { url, x, y, scale };
    const saved = chatSettings.savedCustomBackgrounds || [];
    
    // Evitar duplicados (mismo URL)
    const filtered = saved.filter(b => b.url !== url);
    const updatedSaved = [newBg, ...filtered].slice(0, 10); // Límite de 10 fondos

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
      title: 'Eliminar fondo',
      message: '¿Estás seguro de que quieres eliminar este fondo de tu galería? No podrás recuperarlo.',
      type: 'confirm',
      showCancelButton: true,
      confirmText: 'Eliminar',
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

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <ThemedText style={{ marginTop: spacing.md, opacity: 0.6 }}>Cargando mensajes...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1, display: 'flex', flexDirection: 'row', height: '100%', backgroundColor: colors.background, overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: `${spacing.sm}px ${spacing.md}px`,
        backgroundColor: colors.card, 
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing.md,
        zIndex: 10,
        height: 64,
        boxSizing: 'border-box'
      }}>
        <button 
          onClick={() => navigate(-1)} 
          style={{ 
            background: 'none', 
            border: 'none', 
            cursor: 'pointer', 
            color: colors.text, 
            width: 40, 
            height: 40,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <ChevronLeft size={24} />
        </button>
        <div 
          onClick={() => setShowChannelInfo(true)}
          style={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center',
            gap: 12,
            cursor: 'pointer',
            overflow: 'hidden',
            paddingRight: 12
          }}
        >
          <div style={{ width: 40, height: 40, borderRadius: 12, overflow: 'hidden', backgroundColor: colors.backgroundSecondary, flexShrink: 0 }}>
            {channelPhoto ? (
              <img src={channelPhoto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            ) : (
              <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                {channelName?.[0]}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {channelInfo.icon && <channelInfo.icon size={18} color={colors.primary} />}
              <ThemedText style={{ fontSize: 16, fontWeight: 800, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{channelName}</ThemedText>
              {channelInfo.verified && <CheckCircle2 size={16} color="#007AFF" fill="#007AFF15" />}
            </div>
            <ThemedText style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{channelMembers.length} miembros</ThemedText>
          </div>
        </div>
        <button 
          onClick={() => setIsSearchOpen(!isSearchOpen)} 
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', color: colors.text, 
            width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Search size={22} color={isSearchOpen ? colors.primary : colors.text} />
        </button>
        <button 
          onClick={() => setShowSettings(!showSettings)} 
          style={{ 
            background: 'none', border: 'none', cursor: 'pointer', color: colors.text, 
            width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 0.2s'
          }}
          onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Settings size={22} />
        </button>
      </div>

      {/* Search Bar */}
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
            placeholder="Buscar en el chat..."
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
        {channelInfo.viewType === 'events' ? (
          <EventChannelView />
        ) : channelInfo.viewType === 'support' ? (
          <SoporteChannelView />
        ) : (
          <>
            {/* Background Layer */}
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
            
            <div
              ref={scrollRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column-reverse',
                padding: `${spacing.md}px 0`,
                position: 'relative',
                zIndex: 1
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {filteredMessages.length === 0 && !loading && (
                  <div style={{ padding: spacing.xl, textAlign: 'center', opacity: 0.6 }}>
                    <ThemedText style={{ color: backgroundActive ? '#FFFFFF' : colors.text }}>
                      {searchQuery ? 'No se encontraron mensajes' : 'No hay mensajes aún. ¡Sé el primero en escribir!'}
                    </ThemedText>
                  </div>
                )}
                {[...filteredMessages].reverse().map((msg) => (
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
                      onForward={handleForward}
                      channelId={id}
                      isSystem={isSystemChannel}
                      searchQuery={searchQuery}
                      onToggleStar={handleToggleStar}
                      isStarred={starredIds.has(msg.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
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

          {/* User Saved Backgrounds Gallery */}
          {chatSettings.savedCustomBackgrounds && chatSettings.savedCustomBackgrounds.length > 0 && (
            <div style={{ marginBottom: spacing.lg }}>
              <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>Tus Fondos</ThemedText>
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
            <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>Temas de Galería</ThemedText>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
              {Object.values(chatThemes).map(t => {
                const isPresetActive = !customBackground && chatSettings.themeId === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setChatSettings({ themeId: t.id, customBackground: null });
                    }}
                    title={t.name}
                    style={{
                      aspectRatio: '1', borderRadius: 8, backgroundColor: t.background,
                      backgroundImage: t.backgroundImage ? `url(${t.backgroundImage})` : 'none',
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
            <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, display: 'block', marginBottom: spacing.sm }}>Fondo Personalizado</ThemedText>
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
                {customBackground ? 'Cambiar imagen' : 'Subir imagen'}
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

      {/* Global Background Editor */}
      {editingBgImage && (
        <ChatBackgroundEditor 
          imageUri={editingBgImage}
          onClose={() => setEditingBgImage(null)}
          onSave={handleSaveEditedBg}
        />
      )}

      {/* Input */}
      {!channelInfo.viewType && (
        <div style={{ backgroundColor: colors.background, paddingBottom: 8 }}>
          <MessageInput
            ref={messageInputRef}
            onSend={handleSendMessage}
            onSendAudio={handleSendAudio}
            onSendMedia={handleSendMedia}
            onSendPoll={handleSendPoll}
            replyTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={sending || isReadOnlyChannel}
            isReadOnly={isReadOnlyChannel}
          />
        </div>
      )}
    </div>

    {id && (
      <ChannelInfoModal 
          isOpen={showChannelInfo}
          onClose={() => setShowChannelInfo(false)}
          channelId={id}
          channelName={channelName}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideDown { 
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </ThemedView>
  );
}
