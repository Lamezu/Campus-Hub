import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, StatusBar,
  Alert, Image, ActivityIndicator, Animated, TextInput,
  Modal, Pressable, ScrollView, Platform, KeyboardAvoidingView, Clipboard,
} from 'react-native';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ChevronLeft, Users, Phone, Video, Settings, Search, X, ChevronDown, Star, Reply, Copy, Trash2, Forward, Bookmark, MessageCircle } from 'lucide-react-native';
import { KeyboardAwareView } from '@/components/KeyboardAwareView';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { ChatSettingsSheet } from '@/components/chat/ChatSettingsSheet';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { auth } from '@/config/firebase';
import { downloadAndOpenFile } from '@/utils/fileDownload';
import type { Message, GroupConversation, ReplyPreview } from '@/types';
import {
  subscribeToGroupMessages,
  sendGroupMessage,
  sendGroupImageMessage,
  sendGroupAudioMessage,
  sendGroupFileMessage,
  sendGroupPollMessage,
  markGroupAsRead,
  getGroupInfo,
  toggleGroupReaction,
  deleteGroupMessageForMe,
  deleteGroupMessageForAll,
  voteGroupPoll,
} from '@/services/groupDMService';
import { starMessage, unstarMessage, getStarredIdsForGroup } from '@/services/starredMessagesService';
import { saveMessage } from '@/services/savedItemsService';
import { notificationService } from '@/services/notificationService';
import { avatarColor } from '@/utils/avatarColor';
import { EmptyState } from '@/components/EmptyState';

const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function GroupChatScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { groupId, highlightId } = useLocalSearchParams<{ groupId: string; highlightId?: string }>();
  const currentUser = auth.currentUser;

  const [groupInfo, setGroupInfo] = useState<GroupConversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
  const [menuMessage, setMenuMessage] = useState<Message | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [starredIds, setStarredIds] = useState<Set<string>>(new Set());

  const flatListRef = useRef<FlatList>(null);
  const messageInputRef = useRef<MessageInputHandle>(null);
  const scrollDownAnim = useRef(new Animated.Value(0)).current;
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const menuScaleAnim = useRef(new Animated.Value(0.88)).current;
  const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<Message | null>(null);
  const [showEmojiInput, setShowEmojiInput] = useState(false);
  const menuMessageRef = useRef<Message | null>(null);

  useEffect(() => {
    if (!groupId) return;
    getGroupInfo(groupId).then(info => setGroupInfo(info));
  }, [groupId]);

  useEffect(() => {
    if (!groupId || !currentUser) return;
    const unsub = subscribeToGroupMessages(groupId, currentUser.uid, msgs => {
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
            if (err?.code === 'permission-denied') {
        router.replace('/(tabs)/messages' as any);
      }
      setLoading(false);
    });
    return unsub;
  }, [groupId, currentUser?.uid]);

  useFocusEffect(useCallback(() => {
    if (groupId && currentUser?.uid) {
      markGroupAsRead(groupId, currentUser.uid).catch(() => {});
      notificationService.markChatRead('dm', groupId);
      notificationService.setCurrentView({ type: 'dm', id: groupId });
    }
    return () => { notificationService.setCurrentView(null); };
  }, [groupId, currentUser?.uid]));

  useEffect(() => {
    if (!groupId || !currentUser?.uid) return;
    getStarredIdsForGroup(currentUser.uid, groupId)
      .then(ids => setStarredIds(ids))
      .catch(() => {});
  }, [groupId, currentUser?.uid]);

  useEffect(() => {
    if (highlightId && messages.length > 0) {
      const timer = setTimeout(() => handleReplyPreviewPress(highlightId), 600);
      return () => clearTimeout(timer);
    }
  }, [highlightId, messages.length]);

  useEffect(() => {
    if (menuMessage) {
      menuScaleAnim.setValue(0.88);
      Animated.spring(menuScaleAnim, { toValue: 1, damping: 18, stiffness: 280, useNativeDriver: true }).start();
    }
  }, [menuMessage]);

  const searchMatches = React.useMemo(() => {
    if (!showSearch || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return messages.map((m, index) => ({ id: m.id, index })).filter(({ index }) => !!messages[index].text?.toLowerCase().includes(q));
  }, [messages, searchQuery, showSearch]);

  const currentSearchMatchId = searchMatches[currentMatchIndex]?.id ?? null;

  const goToSearchMatch = (newIndex: number) => {
    if (searchMatches.length === 0) return;
    const wrapped = ((newIndex % searchMatches.length) + searchMatches.length) % searchMatches.length;
    setCurrentMatchIndex(wrapped);
    try { flatListRef.current?.scrollToIndex({ index: searchMatches[wrapped].index, animated: true, viewPosition: 0.5 }); } catch {}
  };

  React.useEffect(() => {
    setCurrentMatchIndex(0);
    if (searchMatches.length > 0) {
      try { flatListRef.current?.scrollToIndex({ index: searchMatches[0].index, animated: true, viewPosition: 0.5 }); } catch {}
    }
  }, [searchMatches]);

  const senderName = currentUser?.displayName ?? 'Usuario';
  const senderPhoto = currentUser?.photoURL ?? null;

  const handleSend = async (text: string) => {
    if (!currentUser || !groupId || sending) return;
    setSending(true);
    const reply = replyingTo;
    setReplyingTo(null);
    try {
      await sendGroupMessage(groupId, currentUser.uid, senderName, senderPhoto, text, null, reply);
    } catch {
      Alert.alert(t('common.error') || 'Error', t('dm.send_error') || 'Send Error');
    } finally {
      setSending(false);
    }
  };

  const handleSendImage = async (url: string, width: number, height: number) => {
    if (!currentUser || !groupId) return;
    await sendGroupImageMessage(groupId, currentUser.uid, senderName, senderPhoto, url, width, height).catch(() => {});
  };

  const handleSendAudio = async (url: string, duration: number) => {
    if (!currentUser || !groupId) return;
    await sendGroupAudioMessage(groupId, currentUser.uid, senderName, senderPhoto, url, duration).catch(() => {});
  };

  const handleSendFile = async (name: string, url: string, size: number) => {
    if (!currentUser || !groupId) return;
    await sendGroupFileMessage(groupId, currentUser.uid, senderName, senderPhoto, name, url, size).catch(() => {});
  };

  const handleSendPoll = async (poll: { question: string; options: string[]; multipleAnswers: boolean }) => {
    if (!currentUser || !groupId) return;
    await sendGroupPollMessage(groupId, currentUser.uid, senderName, senderPhoto, poll).catch(() => {});
  };

  const handleVotePoll = async (messageId: string, optionId: string) => {
    if (!currentUser || !groupId) return;
    await voteGroupPoll(groupId, messageId, optionId, currentUser.uid).catch(() => {});
  };

  const handleLongPress = (message: Message) => setMenuMessage(message);

  const handleReaction = async (emoji: string, targetMsg?: Message) => {
    const msg = targetMsg ?? menuMessage;
    if (!msg || !groupId || !currentUser) return;
    setMenuMessage(null);
    await toggleGroupReaction(groupId, msg.id, emoji, currentUser.uid).catch(() => {});
  };

  const openEmojiPicker = () => {
    menuMessageRef.current = menuMessage;
    setMenuMessage(null);
    setShowEmojiInput(true);
  };

  const userCustomEmojis = menuMessage
    ? Object.entries(menuMessage.reactions ?? {})
        .filter(([emoji, users]) => currentUser != null && (users as string[]).includes(currentUser.uid) && !PRESET_REACTIONS.includes(emoji))
        .map(([emoji]) => emoji)
    : [];
  const pillEmojis = [...PRESET_REACTIONS, ...userCustomEmojis];

  const handleDeleteForMe = async () => {
    if (!menuMessage || !groupId || !currentUser) return;
    const msg = menuMessage;
    setMenuMessage(null);
    await deleteGroupMessageForMe(groupId, msg.id, currentUser.uid).catch(() => {});
  };

  const handleDeleteForAll = async () => {
    if (!menuMessage || !groupId) return;
    const msg = menuMessage;
    setMenuMessage(null);
    await deleteGroupMessageForAll(groupId, msg.id).catch(() => {});
  };

  const handleMenuDelete = (message: Message) => {
    setDeleteConfirmMsg(message);
    setMenuMessage(null);
  };

  const handleStarToggle = async (message: Message) => {
    setMenuMessage(null);
    if (!currentUser || !groupId) return;
    const isStarred = starredIds.has(message.id);
    if (isStarred) {
      setStarredIds(prev => { const s = new Set(prev); s.delete(message.id); return s; });
      await unstarMessage(currentUser.uid, message.id).catch(err => {
        console.error('Error unstarring:', err);
        Alert.alert('Error', 'No se pudo quitar el destacado.');
        setStarredIds(prev => new Set(prev).add(message.id)); // Revert
      });
    } else {
      setStarredIds(prev => new Set(prev).add(message.id));
      await starMessage(currentUser.uid, message, 'group', undefined, groupId).catch(err => {
        console.error('Error starring:', err);
        Alert.alert('Error', 'No se pudo destacar el mensaje.');
        setStarredIds(prev => { const s = new Set(prev); s.delete(message.id); return s; }); // Revert
      });
    }
  };

  const handleForward = (message: Message) => {
    setMenuMessage(null);
    const audio = message.attachments?.find(a => (a as any).type === 'audio');
    const image = message.attachments?.find(a => (a as any).type === 'image');
    const file = message.attachments?.find(a => (a as any).type === 'file');
    if (audio) {
      router.push(`/forward?audioUrl=${encodeURIComponent(audio.url)}&audioDuration=${audio.duration ?? 0}` as never);
    } else if (image) {
      router.push(`/forward?imageUrl=${encodeURIComponent(image.url)}&imageWidth=${image.imageWidth ?? 0}&imageHeight=${image.imageHeight ?? 0}&messageText=${encodeURIComponent(message.text || '')}` as never);
    } else if (file) {
      router.push(`/forward?fileUrl=${encodeURIComponent(file.url)}&fileName=${encodeURIComponent(file.name || 'archivo')}&fileSize=${file.size ?? 0}&messageText=${encodeURIComponent(message.text || '')}` as never);
    } else {
      router.push(`/forward?messageText=${encodeURIComponent(message.text || '')}` as never);
    }
  };

  const handleSaveMessage = async (message: Message) => {
    setMenuMessage(null);
    if (!currentUser || !groupId) return;
    await saveMessage(currentUser.uid, message as any, 'group', undefined, groupId).catch(() => {});
  };

  const handleReply = (message: Message) => {
    setMenuMessage(null);
    let type: ReplyPreview['type'] = 'text';
    let isAudio = false;
    let audioDuration: number | undefined;
    let attachmentName: string | undefined;
    let text = message.text || '';

    if (message.poll) {
      type = 'poll';
      text = message.poll.question;
    } else if (message.type === 'event') {
      type = 'text';
      text = message.metadata?.title || 'Evento';
    } else if (message.attachments && message.attachments.length > 0) {
      const audio = message.attachments.find(a => (a as any).type === 'audio');
      const image = message.attachments.find(a => (a as any).type === 'image');
      const file = message.attachments.find(a => (a as any).type === 'file');
      if (audio) {
        type = 'audio';
        isAudio = true;
        audioDuration = audio.duration;
      } else if (image) {
        type = 'image';
      } else if (file) {
        type = 'file';
        attachmentName = file.name;
      }
    }

    setReplyingTo({
      id: message.id,
      senderName: message.senderName,
      type,
      text,
      isAudio,
      audioDuration,
      attachmentName
    });
    messageInputRef.current?.focus();
  };

  const handleReplyPreviewPress = (messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;
    try { flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 }); } catch {}
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    setHighlightedMessageId(messageId);
    highlightTimeoutRef.current = setTimeout(() => setHighlightedMessageId(null), 2000);
  };

  const handleListScroll = (event: any) => {
    const y = event.nativeEvent.contentOffset.y;
    const shouldShow = y > 120;
    if (shouldShow !== showScrollDown) {
      setShowScrollDown(shouldShow);
      Animated.spring(scrollDownAnim, { toValue: shouldShow ? 1 : 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
    }
  };

  const groupTitle = groupInfo?.name
    || Object.values(groupInfo?.memberNames ?? {}).filter(n => n !== senderName).slice(0, 3).join(', ')
    || t('dm.group.new_group') || 'New Group';
  const memberCount = groupInfo?.members.length ?? 0;

  const renderGroupItem = useCallback(({ item }: { item: Message }) => (
    <MessageBubble
      message={item}
      isOwnMessage={item.senderId === currentUser?.uid}
      currentUserId={currentUser?.uid}
      onLongPress={handleLongPress}
      onReply={() => handleReply(item)}
      onDoubleTap={() => handleReaction('❤️', item)}
      onVotePoll={(optId) => handleVotePoll(item.id, optId)}
      onReplyPreviewPress={handleReplyPreviewPress}
      isStarred={starredIds.has(item.id)}
      highlighted={item.id === highlightedMessageId || item.id === currentSearchMatchId}
      searchHighlight={showSearch && !!searchQuery && item.id === currentSearchMatchId ? searchQuery : undefined}
      onFilePress={(url, name) => {
        downloadAndOpenFile(url, name).catch(() => {
          Alert.alert(t('common.error'), t('dm.file_open_error'));
        });
      }}
    />
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [currentUser?.uid, highlightedMessageId, currentSearchMatchId, starredIds, showSearch, searchQuery]);

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => (
            <TouchableOpacity
              style={styles.headerTitle}
              activeOpacity={0.7}
              onPress={() => router.push(`/dm/group/${groupId}/info` as any)}
            >
              {groupInfo?.photoURL
                ? <Image source={{ uri: groupInfo.photoURL }} style={styles.groupAvatar} />
                : (
                  <View style={[styles.groupAvatarPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                    <Users size={18} color={colors.primary} />
                  </View>
                )
              }
              <View>
                <ThemedText style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                  {groupTitle}
                </ThemedText>
                <ThemedText style={[styles.groupSubtitle, { color: colors.textSecondary }]}>
                  {t('dm.group.member_count', { count: memberCount }) || `${memberCount} miembros`}
                </ThemedText>
              </View>
            </TouchableOpacity>
          ),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: 4 }} hitSlop={8}>
              <ChevronLeft size={24} color={colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => router.push(`/dm/group/${groupId}/call?type=audio` as any)} style={styles.headerBtn}>
                <Phone size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => router.push(`/dm/group/${groupId}/call?type=video` as any)} style={styles.headerBtn}>
                <Video size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setShowSearch(s => !s); setSearchQuery(''); }} style={styles.headerBtn}>
                <Search size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
                <Settings size={20} color={colors.text} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          ),
          headerStyle: { backgroundColor: colors.card },
          headerShadowVisible: false,
        }}
      />

      <View style={[{ flex: 1 }, { backgroundColor: colors.chat.background === 'transparent' ? colors.background : colors.chat.background }]}>
        {colors.chat.backgroundImage && (
          <Image
            source={{ uri: colors.chat.backgroundImage }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
          />
        )}

        <KeyboardAwareView style={{ flex: 1 }}>
          {showSearch && (
            <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <Search size={16} color={colors.textSecondary} strokeWidth={2} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder={t('dm.search_in_chat_placeholder') || 'Search In Chat Placeholder'}
                placeholderTextColor={colors.textSecondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchMatches.length > 0 && (
                <>
                  <TouchableOpacity onPress={() => goToSearchMatch(currentMatchIndex + 1)} hitSlop={8}>
                    <ChevronDown size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <ThemedText style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {currentMatchIndex + 1}/{searchMatches.length}
                  </ThemedText>
                </>
              )}
              <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); }} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id}
            inverted
            contentContainerStyle={styles.messageList}
            onScroll={handleListScroll}
            scrollEventThrottle={16}
            renderItem={renderGroupItem}
            extraData={[currentUser?.uid, highlightedMessageId, currentSearchMatchId, starredIds, showSearch, searchQuery]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<View style={[{ flex: 1 }, Platform.OS === 'ios' && { transform: [{ scaleY: -1 }] }]}><EmptyState icon={MessageCircle} title={t('dm.no_messages_yet')} fill /></View>}
          />

          {showScrollDown && (
            <Animated.View style={[styles.scrollDownBtn, { opacity: scrollDownAnim, transform: [{ scale: scrollDownAnim }] }]}>
              <TouchableOpacity
                style={[styles.scrollDownCircle, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => flatListRef.current?.scrollToIndex({ index: 0, animated: true })}
              >
                <ChevronDown size={20} color={colors.text} />
              </TouchableOpacity>
            </Animated.View>
          )}


          <MessageInput
            ref={messageInputRef}
            onSend={handleSend}
            onSendImage={handleSendImage}
            onSendAudio={handleSendAudio}
            onSendFile={handleSendFile}
            onSendPoll={handleSendPoll}
            replyTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            disabled={sending}
          />
        </KeyboardAwareView>
      </View>

      <ChatSettingsSheet visible={showSettings} onClose={() => setShowSettings(false)} />

      {/* Hold-press menu modal — same pattern as DM chat */}
      <Modal visible={!!menuMessage} animationType="fade" transparent statusBarTranslucent onRequestClose={() => setMenuMessage(null)}>
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
                        onPress={() => handleReaction(emoji)}
                      >
                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  <TouchableOpacity style={[styles.emojiBtn, styles.emojiBtnPlus, { borderColor: colors.border }]} onPress={openEmojiPicker}>
                    <ThemedText style={{ fontSize: 18, color: colors.textSecondary }}>+</ThemedText>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>

            <Animated.View style={[styles.menuContent, { backgroundColor: colors.card, transform: [{ scale: menuScaleAnim }] }]}>
              <View style={[styles.menuPreview, { borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.menuPreviewName, { color: colors.primary }]} numberOfLines={1}>
                  {menuMessage?.senderId === currentUser?.uid ? (t('common.you') || 'You') : (menuMessage?.senderName || t('common.user') || 'User')}
                </ThemedText>
                <ThemedText style={[styles.menuPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                  {menuMessage?.attachments?.find(a => a.type === 'audio') ? (t('chat.voice_msg_preview') || 'Voice Msg Preview') : menuMessage?.text}
                </ThemedText>
              </View>

              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleReply(menuMessage)}>
                <Reply size={20} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.reply') || 'Reply'}</ThemedText>
              </TouchableOpacity>
              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleForward(menuMessage)}>
                <Forward size={20} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.forward') || 'Forward'}</ThemedText>
              </TouchableOpacity>

              {!!menuMessage?.text && (
                <>
                  <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                  <TouchableOpacity style={styles.menuItem} onPress={() => { if (menuMessage?.text) Clipboard.setString(menuMessage.text); setMenuMessage(null); }}>
                    <Copy size={20} color={colors.text} strokeWidth={2} />
                    <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.copy') || 'Copy'}</ThemedText>
                  </TouchableOpacity>
                </>
              )}

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleStarToggle(menuMessage)}>
                <Star size={20} color={menuMessage && starredIds.has(menuMessage.id) ? '#FFD60A' : colors.text} strokeWidth={2} fill={menuMessage && starredIds.has(menuMessage.id) ? '#FFD60A' : 'none'} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>
                  {menuMessage && starredIds.has(menuMessage.id) ? (t('chat.unstar') || 'Unstar') : (t('chat.star') || 'Star')}
                </ThemedText>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleSaveMessage(menuMessage)}>
                <Bookmark size={20} color={colors.text} strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.save') || 'Save'}</ThemedText>
              </TouchableOpacity>

              <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
              <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleMenuDelete(menuMessage)}>
                <Trash2 size={20} color="#FF3B30" strokeWidth={2} />
                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>{t('chat.delete') || 'Delete'}</ThemedText>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Pressable>
      </Modal>

      {/* Emoji picker modal */}
      <Modal visible={showEmojiInput} animationType="slide" transparent statusBarTranslucent onRequestClose={() => { setShowEmojiInput(false); menuMessageRef.current = null; }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity style={styles.emojiPickerOverlay} activeOpacity={1} onPress={() => { setShowEmojiInput(false); menuMessageRef.current = null; }}>
            <View style={[styles.emojiInputBox, { backgroundColor: colors.card }]} onStartShouldSetResponder={() => true}>
              <ThemedText style={[styles.emojiInputLabel, { color: colors.textSecondary }]}>
                {t('chat.emoji_picker_title') || 'Emoji Picker Title'}
              </ThemedText>
              <TextInput
                autoFocus
                style={[styles.emojiInputField, { color: colors.text }]}
                onChangeText={(text) => {
                  if (menuMessageRef.current && text.trim()) {
                    const target = menuMessageRef.current;
                    menuMessageRef.current = null;
                    setShowEmojiInput(false);
                    handleReaction(text.trim(), target);
                  }
                }}
                maxLength={8}
                placeholder=""
              />
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete confirm dialog */}
      <Modal visible={!!deleteConfirmMsg} animationType="fade" transparent onRequestClose={() => setDeleteConfirmMsg(null)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setDeleteConfirmMsg(null)}>
          <View style={[styles.deleteDialog, { backgroundColor: colors.card }]}>
            <View style={styles.deleteDialogHeader}>
              <ThemedText style={[styles.deleteDialogTitle, { color: colors.text }]}>
                {t('chat.delete_message') || 'Delete Message'}
              </ThemedText>
              <ThemedText style={[styles.deleteDialogSubtitle, { color: colors.textSecondary }]}>
                {deleteConfirmMsg?.senderId === currentUser?.uid
                  ? (t('chat.delete_confirm_msg') || 'Delete Confirm Msg')
                  : (t('chat.delete_for_me_only') || 'Delete For Me Only')}
              </ThemedText>
            </View>
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => { const m = deleteConfirmMsg!; setDeleteConfirmMsg(null); setMenuMessage(null); deleteGroupMessageForMe(groupId!, m.id, currentUser!.uid).catch(() => {}); }}>
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.text }]}>{t('chat.delete_for_me') || 'Delete For Me'}</ThemedText>
            </TouchableOpacity>
            {deleteConfirmMsg?.senderId === currentUser?.uid && (
              <>
                <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => { const m = deleteConfirmMsg!; setDeleteConfirmMsg(null); setMenuMessage(null); deleteGroupMessageForAll(groupId!, m.id).catch(() => {}); }}>
                  <ThemedText style={[styles.deleteDialogBtnText, { color: '#FF3B30' }]}>{t('chat.delete_for_all') || 'Delete For All'}</ThemedText>
                </TouchableOpacity>
              </>
            )}
            <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
            <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => setDeleteConfirmMsg(null)}>
              <ThemedText style={[styles.deleteDialogBtnText, { color: colors.primary, fontWeight: '600' }]}>{t('common.cancel') || 'Cancel'}</ThemedText>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  messageList: { padding: spacing.sm, gap: 4 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  groupAvatar: { width: 36, height: 36, borderRadius: 18 },
  groupAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  groupName: { fontSize: typography.sizes.sm, fontWeight: '700' },
  groupSubtitle: { fontSize: 11 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 4 },
  headerBtn: { padding: 6 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    paddingHorizontal: spacing.sm, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm },
  scrollDownBtn: { position: 'absolute', bottom: 80, right: 16 },
  scrollDownCircle: {
    width: 36, height: 36, borderRadius: 18,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 4,
  },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  menuCenter: { width: 280, alignItems: 'center', gap: 10 },
  reactionStripOuter: { width: '100%', alignItems: 'center' },
  reactionStripInner: { borderRadius: 24, padding: 4, width: '100%' },
  reactionStripContent: { paddingHorizontal: 8, alignItems: 'center', gap: 4 },
  emojiBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 22 },
  emojiBtnPlus: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, marginLeft: 8 },
  emojiText: { fontSize: 24 },
  menuContent: { width: '100%', borderRadius: 18, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  menuPreview: { padding: 15, borderBottomWidth: StyleSheet.hairlineWidth },
  menuPreviewName: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  menuPreviewText: { fontSize: 14, lineHeight: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  menuItemText: { fontSize: 15, fontWeight: '500' },
  menuDivider: { height: StyleSheet.hairlineWidth },
  emojiPickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  emojiInputBox: { padding: 20, borderTopLeftRadius: 20, borderTopRightRadius: 20, alignItems: 'center' },
  emojiInputLabel: { fontSize: 13, marginBottom: 15, fontWeight: '600' },
  emojiInputField: { fontSize: 40, width: '100%', textAlign: 'center', paddingVertical: 20 },
  deleteDialog: { width: 280, borderRadius: 20, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6 },
  deleteDialogHeader: { padding: 24, alignItems: 'center' },
  deleteDialogTitle: { fontSize: 18, fontWeight: '800', marginBottom: 8 },
  deleteDialogSubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  deleteDialogDivider: { height: StyleSheet.hairlineWidth },
  deleteDialogBtn: { padding: 16, alignItems: 'center' },
  deleteDialogBtnText: { fontSize: 16, fontWeight: '500' },
});
