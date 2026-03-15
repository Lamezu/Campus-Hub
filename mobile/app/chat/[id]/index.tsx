import React, { useState, useEffect, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, TouchableOpacity, Pressable, Modal, ScrollView, StatusBar, Image, Animated, TextInput, Share, Clipboard, Alert } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, limit, startAfter, getDocs, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { auth, db } from '@/config/firebase';
import type { Message, ReplyPreview } from '@/types';
import { Settings, ChevronLeft, Reply, Trash2, Copy, Forward, Plus, ChevronDown } from 'lucide-react-native';
import { notificationService } from '@/services/notificationService';
import { markChannelRead } from '@/services/channelReadService';
import { useCurrentUser } from '@/contexts/UserContext';

const MESSAGES_PER_PAGE = 50;
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function ChatScreen() {
  const { colors, theme, chatSettings, setChatSettings } = useTheme();
  const { isAdmin } = useCurrentUser();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [isSwipingMessage, setIsSwipingMessage] = useState(false);
  const menuScaleAnim = useRef(new Animated.Value(0.88)).current;
  const [userProfile, setUserProfile] = useState<any>(null);

  const flatListRef = useRef<FlatList>(null);
  const lastDocRef = useRef<any>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const channel = MOCK_CHANNELS.find(ch => ch.id === id);
  const [channelDetails, setChannelDetails] = useState<any>(channel || null);
  const channelName = channelDetails?.name || channel?.name || (id?.startsWith('sg_') ? 'Grupo' : 'Canal');
  const currentUser = auth.currentUser;
  const isSG = id?.startsWith('sg_') ?? false;
  const realId = isSG ? (id?.replace('sg_', '') ?? '') : (id ?? '');

  useEffect(() => {
    if (!id) return;
    const colName = isSG ? 'studyGroups' : 'channels';

    const unsub = onSnapshot(doc(db, colName, realId), snap => {
      if (snap.exists()) {
        setChannelDetails({ id: snap.id, ...snap.data() });
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('ChatDetails Snapshot error:', error);
      }
    });
    return () => unsub();
  }, [id]);

  useEffect(() => {
    if (!id || !currentUser) return;
    notificationService.markChatRead('channel', id);
    notificationService.setCurrentView({ type: 'channel', id });
    return () => { notificationService.setCurrentView(null); };
  }, [id, currentUser]);

  useEffect(() => {
    if (!realId || !currentUser?.uid) return;
    markChannelRead(realId, currentUser.uid).catch(console.error);
  }, [realId, currentUser?.uid, messages.length]);

  useEffect(() => {
    if (!currentUser) {
      setUserProfile(null);
      return;
    }
    const loadProfile = async () => {
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          setUserProfile(userDoc.data());
        }
      } catch (error) {
        console.error(error);
      }
    };
    loadProfile();
  }, [currentUser]);

  useEffect(() => {
    if (!id) return;
    const messagesRef = collection(db, 'channels', realId, 'messages');
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
            poll: data.poll || null,
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
      if (error.code !== 'permission-denied') {
        console.error('ChatMessages Snapshot error:', error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [id]);

  const loadMoreMessages = async () => {
    if (!id || !hasMore || loadingMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      const q = query(messagesRef, orderBy('createdAt', 'desc'), startAfter(lastDocRef.current), limit(MESSAGES_PER_PAGE));
      const snapshot = await getDocs(q);
      const olderMessages: Message[] = snapshot.docs
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
            poll: data.poll || null,
            deletedForUsers: data.deletedForUsers || [],
          };
        })
        .filter(msg => !currentUser || !msg.deletedForUsers?.includes(currentUser.uid));
      if (olderMessages.length > 0) {
        setMessages(prev => [...prev, ...olderMessages]);
        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
      }
      setHasMore(snapshot.docs.length === MESSAGES_PER_PAGE);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingMore(false);
    }
  };

  const buildMessageBase = () => ({
    senderId: currentUser!.uid,
    senderName: userProfile?.displayName || currentUser!.displayName || 'Usuario',
    senderPhoto: userProfile?.photoURL || currentUser!.photoURL || null,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    reactions: {},
    replyTo: null as null,
  });

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !id || sending) return;
    setSending(true);
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      await addDoc(messagesRef, {
        ...buildMessageBase(),
        text,
        attachments: null,
        replyTo: replyData ?? null,
      });
    } catch (error) {
      console.error(error);
      alert('Error al enviar el mensaje.');
    } finally {
      setSending(false);
    }
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !id) return;
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      await addDoc(messagesRef, {
        ...buildMessageBase(),
        text: '',
        attachments: [{ url, type: 'audio', name: 'audio.m4a', size: 0, duration }],
        replyTo: replyData ?? null,
      });
    } catch (error) {
      console.error(error);
      alert('Error al guardar el audio.');
    }
  };

  const handleSendImage = async (url: string, width: number, height: number) => {
    if (!currentUser || !id) return;
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      await addDoc(messagesRef, {
        ...buildMessageBase(),
        text: '',
        attachments: [{ url, type: 'image', name: 'imagen.jpg', size: 0, imageWidth: width, imageHeight: height }],
        replyTo: replyData ?? null,
      });
    } catch (error) {
      console.error(error);
      alert('Error al guardar la imagen.');
    }
  };

  const handleSendFile = async (name: string, url: string, size: number) => {
    if (!currentUser || !id) return;
    const replyData = replyingTo;
    setReplyingTo(null);
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      await addDoc(messagesRef, {
        ...buildMessageBase(),
        text: '',
        attachments: [{ url, type: 'file', name, size }],
        replyTo: replyData ?? null,
      });
    } catch (error) {
      console.error(error);
      alert('Error al guardar el archivo.');
    }
  };

  const handleSendPoll = async (poll: { question: string; options: string[]; multipleAnswers: boolean }) => {
    if (!currentUser || !id) return;
    try {
      const messagesRef = collection(db, 'channels', realId, 'messages');
      const pollData = {
        question: poll.question,
        options: poll.options.map((opt, i) => ({ id: i.toString(), text: opt, votes: [] })),
        multipleAnswers: poll.multipleAnswers,
        closed: false,
        totalVotes: 0,
      };
      await addDoc(messagesRef, {
        ...buildMessageBase(),
        text: '',
        poll: pollData,
        attachments: null,
      });
    } catch (error) {
      console.error('Error sending group poll:', error);
    }
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !id) return;
    try {
      const messageRef = doc(db, 'channels', realId, 'messages', messageId);
      const snap = await getDoc(messageRef);
      if (!snap.exists()) return;

      const data = snap.data();
      if (!data.poll) return;

      const poll = data.poll;
      const newOptions = poll.options.map((opt: any, idx: number) => {
        const isThisOption = opt.id === optionId || idx.toString() === optionId;
        let votes = opt.votes || [];

        if (poll.multipleAnswers) {
          if (isThisOption) {
            if (votes.includes(currentUser.uid)) {
              votes = votes.filter((v: string) => v !== currentUser.uid);
            } else {
              votes = [...votes, currentUser.uid];
            }
          }
        } else {
          if (isThisOption) {
            if (votes.includes(currentUser.uid)) {
              votes = votes.filter((v: string) => v !== currentUser.uid);
            } else {
              votes = [...votes, currentUser.uid];
            }
          } else {
            votes = votes.filter((v: string) => v !== currentUser.uid);
          }
        }
        return { ...opt, votes };
      });

      const totalVotes = newOptions.reduce((sum: number, o: any) => sum + (o.votes?.length ?? 0), 0);

      await updateDoc(messageRef, {
        'poll.options': newOptions,
        'poll.totalVotes': totalVotes,
      });
    } catch (error) {
      console.error('Error voting in group poll:', error);
    }
  };

  const deleteForMe = async (messageId: string) => {
    if (!currentUser || !id) return;
    try {
      await updateDoc(doc(db, 'channels', realId, 'messages', messageId), {
        deletedForUsers: arrayUnion(currentUser.uid),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteForAll = async (messageId: string) => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'channels', realId, 'messages', messageId));
    } catch (error) {
      console.error(error);
    }
  };

  const handleClearChannel = () => {
    const buttons: any[] = [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar para mí',
        onPress: async () => {
          if (!currentUser) return;
          try {
            const snap = await getDocs(collection(db, 'channels', realId, 'messages'));
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.update(d.ref, { deletedForUsers: arrayUnion(currentUser.uid) }));
              await batch.commit();
            }
            Alert.alert('Chat vaciado', 'Los mensajes ya no son visibles para ti');
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo vaciar el chat');
          }
        },
      },
    ];
    if (isAdmin || userProfile?.role === 'admin') {
      buttons.push({
        text: 'Eliminar para todos',
        style: 'destructive',
        onPress: async () => {
          try {
            const snap = await getDocs(collection(db, 'channels', realId, 'messages'));
            if (!snap.empty) {
              const batch = writeBatch(db);
              snap.docs.forEach(d => batch.delete(d.ref));
              await batch.commit();
            }
            Alert.alert('Chat eliminado', 'Se eliminaron todos los mensajes');
          } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo eliminar el chat');
          }
        },
      });
    }
    Alert.alert('Vaciar chat', '¿Cómo quieres vaciar el chat?', buttons);
  };

  const handleReply = (message: Message) => {
    const audio = message.attachments?.find(a => a.type === 'audio');
    const image = message.attachments?.find(a => a.type === 'image');
    const file = message.attachments?.find(a => a.type === 'file');

    setReplyingTo({
      id: message.id,
      text: message.text,
      senderName: message.senderName,
      ...(audio ? { isAudio: true, audioDuration: audio.duration, type: 'audio' } : {}),
      ...(image ? { type: 'image' } : {}),
      ...(file ? { type: 'file', attachmentName: file.name } : {}),
      ...(message.poll ? { type: 'poll', text: message.poll.question } : {}),
    });
    setMenuMessage(null);
  };

  const handleReplyPreviewPress = (messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    try {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    } catch { }
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedMessageId(messageId);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  const onMessageSwipeStart = () => setIsSwipingMessage(true);
  const onMessageSwipeEnd = () => setIsSwipingMessage(false);

  useEffect(() => {
    if (menuMessage) {
      menuScaleAnim.setValue(0.88);
      Animated.spring(menuScaleAnim, {
        toValue: 1,
        damping: 18,
        stiffness: 280,
        useNativeDriver: true,
      }).start();
    }
  }, [menuMessage]);

  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const [customEmoji, setCustomEmoji] = useState('');
  const menuMessageRef = useRef<Message | null>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const showScrollDownRef = useRef(false);
  const scrollDownAnim = useRef(new Animated.Value(0)).current;
  const [showScrollDown, setShowScrollDown] = useState(false);

  const handleListScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 120;
    if (shouldShow !== showScrollDownRef.current) {
      showScrollDownRef.current = shouldShow;
      setShowScrollDown(shouldShow);
      Animated.spring(scrollDownAnim, {
        toValue: shouldShow ? 1 : 0,
        useNativeDriver: true,
        tension: 80,
        friction: 10,
      }).start();
    }
  };

  const scrollToBottom = () => {
    flatListRef.current?.scrollToIndex({ index: 0, animated: true });
  };

  const handleMessageDoubleTap = async (messageId: string, reactions: Record<string, string[]>) => {
    if (!currentUser || !id) return;
    const heartLikes = reactions['❤️'] ?? [];
    if (!heartLikes.includes(currentUser.uid)) {
      await updateDoc(doc(db, 'channels', realId, 'messages', messageId), {
        'reactions.❤️': arrayUnion(currentUser.uid),
      });
    }
  };

  const handleMenuDelete = (message: Message) => {
    setMenuMessage(null);
    setDeleteConfirmMsg(message);
  };

  const handleReaction = async (emoji: string, target?: Message) => {
    const msg = target ?? menuMessage;
    if (!currentUser || !msg || !id) return;
    setMenuMessage(null);
    const existing = msg.reactions?.[emoji] ?? [];
    const hasReacted = existing.includes(currentUser.uid);
    await updateDoc(doc(db, 'channels', realId, 'messages', msg.id), {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
    });
  };

  const handleCopy = (message: Message) => {
    setMenuMessage(null);
    if (message.text) Clipboard.setString(message.text);
  };

  const handleForward = async (message: Message) => {
    setMenuMessage(null);
    if (message.text) await Share.share({ message: message.text });
  };

  const handleQuickAudioReply = (message: Message) => {
    setMenuMessage(null);
    handleReply(message);
    setTimeout(() => messageInputRef.current?.startRecordingLocked(), 150);
  };

  const openEmojiPicker = () => {
    menuMessageRef.current = menuMessage;
    setMenuMessage(null);
    setCustomEmoji('');
    setShowEmojiInput(true);
  };

  const userCustomEmojis = menuMessage
    ? Object.entries(menuMessage.reactions ?? {})
      .filter(([emoji, users]) => currentUser != null && users.includes(currentUser.uid) && !PRESET_REACTIONS.includes(emoji))
      .map(([emoji]) => emoji)
    : [];
  const pillEmojis = [...PRESET_REACTIONS, ...userCustomEmojis];

  const headerHeight = useHeaderHeight();

  if (loading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: channelName, headerShown: true }} />
        <ThemedView style={[styles.container, styles.centerContent]}>
          <ActivityIndicator size="large" color={colors.primary} />
          <ThemedText style={styles.loadingText}>Cargando mensajes...</ThemedText>
        </ThemedView>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent={true}
      />
      <Stack.Screen options={{
        headerShown: true,
        headerStyle: {
          backgroundColor: colors.card,
        },
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerTitleAlign: 'center',
        headerBackVisible: false,
        headerTitle: () => (
          <TouchableOpacity onPress={() => router.push(`/chat/${id}/info` as any)}>
            <ThemedText style={{ fontSize: typography.sizes.md, fontWeight: 'bold' }}>{channelName}</ThemedText>
          </TouchableOpacity>
        ),
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 4, marginLeft: spacing.xs }}
          >
            <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
          </TouchableOpacity>
        ),
        headerRight: () => (
          <TouchableOpacity
            onPress={() => setShowSettings(true)}
            style={{ padding: 4, marginRight: spacing.xs }}
          >
            <Settings size={22} color={colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        )
      }} />

      <View style={[styles.container, { backgroundColor: colors.chat.background }]}>
        {colors.chat.backgroundImage && (
          <Image
            source={{ uri: colors.chat.backgroundImage }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}
        {Platform.OS === 'ios' ? (
          <KeyboardAvoidingView
            style={styles.container}
            behavior="padding"
            keyboardVerticalOffset={headerHeight}
          >
            <View style={[styles.container, colors.chat.backgroundImage && { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
              <FlatList
                ref={flatListRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <MessageBubble
                    message={item}
                    isOwnMessage={item.senderId === currentUser?.uid}
                    currentUserId={currentUser?.uid}
                    onReply={handleReply}
                    onLongPress={setMenuMessage}
                    onDoubleTap={() => handleMessageDoubleTap(item.id, item.reactions ?? {})}
                    onSwipeStart={onMessageSwipeStart}
                    onSwipeEnd={onMessageSwipeEnd}
                    onQuickAudioReply={handleQuickAudioReply}
                    onReplyPreviewPress={handleReplyPreviewPress}
                    highlighted={highlightedMessageId === item.id}
                    onVotePoll={(optionId) => handleVotePoll(item.id, optionId)}
                    onFilePress={(url, name) => {
                      Share.share({ url, message: `Archivo de ${channelName}: ${name}` });
                    }}
                  />
                )}
                contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
                onEndReached={loadMoreMessages}
                onEndReachedThreshold={0.5}
                scrollEnabled={!isSwipingMessage}
                onScrollToIndexFailed={() => { }}
                ListHeaderComponent={loadingMore ? <View style={styles.loadingMoreContainer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
                ListEmptyComponent={<View style={styles.emptyContainer}><ThemedText style={styles.emptyText}>No hay mensajes aún.</ThemedText></View>}
                inverted
                onScroll={handleListScroll}
                scrollEventThrottle={100}
              />
              <Animated.View
                pointerEvents={showScrollDown ? 'auto' : 'none'}
                style={[styles.scrollDownBtn, { opacity: scrollDownAnim, transform: [{ scale: scrollDownAnim }] }]}
              >
                <Pressable onPress={scrollToBottom} style={[styles.scrollDownBtnInner, { backgroundColor: colors.card }]}>
                  <ChevronDown size={26} color={colors.text} strokeWidth={2.5} />
                </Pressable>
              </Animated.View>
              <MessageInput
                ref={messageInputRef}
                onSend={handleSendMessage}
                onSendAudio={handleSendAudio}
                onSendImage={handleSendImage}
                onSendFile={handleSendFile}
                onSendPoll={handleSendPoll}
                replyTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
                disabled={sending}
              />
            </View>
          </KeyboardAvoidingView>
        ) : (
          <View style={[styles.container, colors.chat.backgroundImage && { backgroundColor: 'rgba(0,0,0,0.1)' }]}>
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <MessageBubble
                  message={item}
                  isOwnMessage={item.senderId === currentUser?.uid}
                  currentUserId={currentUser?.uid}
                  onReply={handleReply}
                  onLongPress={setMenuMessage}
                  onDoubleTap={() => handleMessageDoubleTap(item.id, item.reactions ?? {})}
                  onSwipeStart={onMessageSwipeStart}
                  onSwipeEnd={onMessageSwipeEnd}
                  onQuickAudioReply={handleQuickAudioReply}
                  onReplyPreviewPress={handleReplyPreviewPress}
                  highlighted={highlightedMessageId === item.id}
                  onVotePoll={(optionId) => handleVotePoll(item.id, optionId)}
                  onFilePress={(url, name) => {
                    Share.share({ url, message: `Archivo de ${channelName}: ${name}` });
                  }}
                />
              )}
              contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
              onEndReached={loadMoreMessages}
              onEndReachedThreshold={0.5}
              scrollEnabled={!isSwipingMessage}
              onScrollToIndexFailed={() => { }}
              ListHeaderComponent={loadingMore ? <View style={styles.loadingMoreContainer}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
              ListEmptyComponent={<View style={styles.emptyContainer}><ThemedText style={styles.emptyText}>No hay mensajes aún.</ThemedText></View>}
              inverted
              onScroll={handleListScroll}
              scrollEventThrottle={100}
            />
            <Animated.View
              pointerEvents={showScrollDown ? 'auto' : 'none'}
              style={[styles.scrollDownBtn, { opacity: scrollDownAnim, transform: [{ scale: scrollDownAnim }] }]}
            >
              <Pressable onPress={scrollToBottom} style={[styles.scrollDownBtnInner, { backgroundColor: colors.card }]}>
                <ChevronDown size={26} color={colors.text} strokeWidth={2.5} />
              </Pressable>
            </Animated.View>
            <MessageInput
              ref={messageInputRef}
              onSend={handleSendMessage}
              onSendAudio={handleSendAudio}
              onSendImage={handleSendImage}
              onSendFile={handleSendFile}
              onSendPoll={handleSendPoll}
              replyTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
              disabled={sending}
            />
          </View>
        )}
      </View>

      <Modal visible={!!menuMessage} animationType="fade" transparent={true} statusBarTranslucent onRequestClose={() => setMenuMessage(null)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuMessage(null)}>
          <View style={styles.menuCenter} onStartShouldSetResponder={() => true}>
            <View style={styles.reactionStripOuter}>
              <View style={[styles.reactionStripInner, { backgroundColor: colors.card }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionStripContent}>
                  {pillEmojis.map(emoji => {
                    const reacted = !!(currentUser && (menuMessage?.reactions?.[emoji] ?? []).includes(currentUser.uid));
                    return (
                      <TouchableOpacity
                        key={emoji}
                        style={[styles.emojiBtn, reacted && { backgroundColor: colors.primary + '33' }]}
                        onPress={() => menuMessage && handleReaction(emoji)}
                      >
                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={[styles.emojiBtn, styles.emojiBtnPlus, { borderColor: colors.border }]} onPress={openEmojiPicker}>
                    <Plus size={18} color={colors.textSecondary} strokeWidth={2.5} />
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>

            <Animated.View
              style={[styles.menuContent, { backgroundColor: colors.card, transform: [{ scale: menuScaleAnim }] }]}
            >
              <View style={[styles.menuPreview, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.menuPreviewName, { color: colors.primary }]} numberOfLines={1}>
                  {menuMessage?.senderName}
                </ThemedText>
                <ThemedText style={[styles.menuPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {menuMessage?.attachments?.find(a => a.type === 'audio') ? '­ƒÄñ Mensaje de voz' : menuMessage?.text}
                </ThemedText>
              </View>
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleReply(menuMessage)}>
                <Reply size={20} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>Responder</ThemedText>
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleForward(menuMessage)}>
                <Forward size={20} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>Reenviar</ThemedText>
              </TouchableOpacity>
              {!!menuMessage?.text && (
                <>
                  <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleCopy(menuMessage)}>
                    <Copy size={20} color={colors.text} strokeWidth={2} />
                    <ThemedText style={[styles.menuItemText, { color: colors.text }]}>Copiar</ThemedText>
                  </TouchableOpacity>
                </>
              )}
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleMenuDelete(menuMessage)}>
                <Trash2 size={20} color="#FF3B30" strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>Eliminar</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showEmojiInput}
        animationType="slide"
        transparent
        statusBarTranslucent
        onRequestClose={() => {
          setShowEmojiInput(false);
          setCustomEmoji('');
          menuMessageRef.current = null;
        }}
      >
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.emojiPickerOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowEmojiInput(false);
              setCustomEmoji('');
              menuMessageRef.current = null;
            }}
          >
            <View style={[styles.emojiInputBox, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
              <ThemedText style={[styles.emojiInputLabel, { color: colors.textSecondary }]}>
                Selecciona un emoji del teclado
              </ThemedText>
              <TextInput
                autoFocus
                style={[styles.emojiInputField, { color: colors.text }]}
                value={customEmoji}
                onChangeText={(text) => {
                  if (menuMessageRef.current && text.trim()) {
                    const target = menuMessageRef.current;
                    menuMessageRef.current = null;
                    setShowEmojiInput(false);
                    setCustomEmoji('');
                    handleReaction(text.trim(), target);
                  }
                }}
                maxLength={8}
                placeholder=""
                caretHidden={false}
              />
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSettings} animationType="slide" transparent={true} onRequestClose={() => setShowSettings(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <ThemedText style={styles.modalTitle}>Personalizar Chat</ThemedText>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>Hecho</ThemedText>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Temas del Chat</ThemedText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>
                  {Object.values(chatThemes).map((t) => (
                    <TouchableOpacity key={t.id} style={[styles.themeItem, { borderColor: chatSettings.themeId === t.id ? colors.primary : colors.border }]} onPress={() => setChatSettings({ themeId: t.id })}>
                      <View style={[styles.themePreview, { backgroundColor: t.background === 'transparent' ? colors.background : t.background, overflow: 'hidden' }]}>
                        {t.backgroundImage && <Image source={{ uri: t.backgroundImage }} style={StyleSheet.absoluteFill} />}
                        <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOwn, alignSelf: 'flex-end', opacity: 0.9 }]} />
                        <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOther, alignSelf: 'flex-start', opacity: 0.9 }]} />
                      </View>
                      <ThemedText style={[styles.themeName, chatSettings.themeId === t.id && { color: colors.primary }]}>{t.name}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Tamaño de Letra ({chatSettings.fontSize}px)</ThemedText>
                <View style={styles.row}>
                  {[12, 14, 16, 18, 20].map(size => (
                    <TouchableOpacity key={size} style={[styles.sizeButton, { borderColor: colors.border }, chatSettings.fontSize === size && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontSize: size })}>
                      <ThemedText style={{ color: chatSettings.fontSize === size ? '#FFF' : colors.text }}>{size}</ThemedText>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.settingsSection}>
                <ThemedText style={styles.settingsLabel}>Estilo de Letra</ThemedText>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.styleButton, { borderColor: colors.border }, chatSettings.fontWeight === 'bold' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}>
                    <ThemedText style={[chatSettings.fontWeight === 'bold' && { color: '#FFF' }]}>Negrita</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.styleButton, { borderColor: colors.border, marginLeft: spacing.sm }, chatSettings.fontStyle === 'italic' && { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}>
                    <ThemedText style={[chatSettings.fontStyle === 'italic' && { color: '#FFF' }]}>Cursiva</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={[styles.settingsSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.lg }]}>
                <ThemedText style={styles.settingsLabel}>Chat</ThemedText>
                <TouchableOpacity
                  style={[styles.clearChatBtn, { borderColor: '#FF3B30' }]}
                  onPress={() => { setShowSettings(false); setTimeout(handleClearChannel, 300); }}
                >
                  <ThemedText style={styles.clearChatBtnText}>Vaciar chat</ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!deleteConfirmMsg}
        animationType="fade"
        transparent
        onRequestClose={() => setDeleteConfirmMsg(null)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setDeleteConfirmMsg(null)}
        >
          <View style={[styles.deleteDialog, { backgroundColor: colors.card }]}>
            <View style={styles.deleteDialogHeader}>
              <ThemedText style={[styles.deleteDialogTitle, { color: colors.text }]}>
                Eliminar mensaje
              </ThemedText>
              <ThemedText style={[styles.deleteDialogSubtitle, { color: colors.textSecondary }]}>
                {deleteConfirmMsg?.senderId === currentUser?.uid
                  ? '¿Cómo quieres eliminarlo?'
                  : 'Solo se eliminará para ti.'}
              </ThemedText>
            </View>
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.deleteDialogBtn}
              onPress={() => {
                const msg = deleteConfirmMsg!;
                setDeleteConfirmMsg(null);
                deleteForMe(msg.id);
              }}
            >
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.text }]}>
                Eliminar para mí
              </ThemedText>
            </TouchableOpacity>
            {deleteConfirmMsg?.senderId === currentUser?.uid && (
              <>
                <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.deleteDialogBtn}
                  onPress={() => {
                    const msg = deleteConfirmMsg!;
                    setDeleteConfirmMsg(null);
                    deleteForAll(msg.id);
                  }}
                >
                  <ThemedText style={[styles.deleteDialogBtnText, { color: '#FF3B30' }]}>
                    Eliminar para todos
                  </ThemedText>
                </TouchableOpacity>
              </>
            )}
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity
              style={styles.deleteDialogBtn}
              onPress={() => setDeleteConfirmMsg(null)}
            >
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.primary, fontWeight: '600' }]}>
                Cancelar
              </ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },
  messageList: { padding: spacing.md, flexGrow: 1 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: spacing.xl * 2 },
  emptyText: { opacity: 0.5, textAlign: 'center' },
  loadingText: { marginTop: spacing.md, opacity: 0.6 },
  loadingMoreContainer: { paddingVertical: spacing.md, alignItems: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1 },
  modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  modalBody: { marginTop: spacing.lg },
  settingsSection: { marginBottom: spacing.xl },
  settingsLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, marginBottom: spacing.md },
  themeScrollContent: { paddingRight: spacing.xl, gap: spacing.md },
  themeItem: { width: 100, padding: spacing.sm, borderRadius: 16, borderWidth: 2, alignItems: 'center' },
  themePreview: { width: '100%', height: 80, borderRadius: 12, padding: 8, justifyContent: 'center', gap: 6, marginBottom: 8 },
  bubblePreview: { width: '80%', height: 14, borderRadius: 7 },
  themeName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  sizeButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
  styleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18, borderWidth: 1 },
  clearChatBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: spacing.md, alignItems: 'center' },
  clearChatBtnText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  emojiPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', alignItems: 'center', paddingBottom: spacing.xl },
  menuCenter: { alignItems: 'center', gap: 10 },
  menuContent: {
    width: 272,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  menuPreview: { paddingHorizontal: spacing.md, paddingVertical: 14, gap: 3, borderBottomWidth: StyleSheet.hairlineWidth },
  menuPreviewName: { fontSize: typography.sizes.sm, fontWeight: '700' },
  menuPreviewText: { fontSize: typography.sizes.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14, paddingHorizontal: 20 },
  menuItemText: { fontSize: typography.sizes.md, flex: 1 },
  menuDivider: { height: StyleSheet.hairlineWidth },
  deleteDialog: {
    width: 280,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  deleteDialogHeader: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  deleteDialogTitle: { fontSize: typography.sizes.md, fontWeight: '700', marginBottom: 4 },
  deleteDialogSubtitle: { fontSize: typography.sizes.sm },
  deleteDialogDivider: { height: StyleSheet.hairlineWidth },
  deleteDialogBtn: { paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  deleteDialogBtnText: { fontSize: typography.sizes.md },
  reactionStripOuter: {
    width: 272,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  reactionStripInner: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  reactionStripContent: { paddingHorizontal: 10, gap: 2 },
  emojiBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiBtnPlus: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  emojiText: { fontSize: 26, lineHeight: 36, includeFontPadding: false },
  emojiInputBox: {
    width: 272,
    borderRadius: 18,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  emojiInputLabel: { fontSize: typography.sizes.sm, fontWeight: '500' },
  emojiInputField: {
    fontSize: 44,
    textAlign: 'center',
    width: '100%',
    height: 64,
    includeFontPadding: false,
  },
  scrollDownBtn: {
    position: 'absolute',
    bottom: Platform.OS === 'android' ? 140 : 90,
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  scrollDownBtnInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 6,
  },
});
