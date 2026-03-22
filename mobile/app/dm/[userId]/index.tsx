import React, { useState, useEffect, useRef } from 'react';
import {
    View, FlatList, StyleSheet, KeyboardAvoidingView, Platform, Image,
    ActivityIndicator, TouchableOpacity, Pressable, Modal, ScrollView,
    StatusBar, Animated, TextInput, Share, Clipboard, Alert
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageBubble } from '@/components/MessageBubble';
import { MessageInput, type MessageInputHandle } from '@/components/MessageInput';
import { spacing, chatThemes, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { auth, db } from '@/config/firebase';
import type { DirectMessage, ReplyPreview, User } from '@/types';
import {
    Settings, ChevronLeft, Reply, Trash2, Copy, Forward, Plus,
    ChevronDown, Phone, Video
} from 'lucide-react-native';
import * as dmService from '@/services/dmService';
import { ChatSettingsSheet } from '@/components/chat/ChatSettingsSheet';

const MESSAGES_PER_PAGE = 50;
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function DMChatScreen() {
    const { colors, theme } = useTheme();
    const { t } = useTranslation();
    const { userId, highlightId } = useLocalSearchParams<{ userId: string; highlightId?: string }>();
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
    const [menuMessage, setMenuMessage] = useState<DirectMessage | null>(null);
    const [isSwipingMessage, setIsSwipingMessage] = useState(false);
    const menuScaleAnim = useRef(new Animated.Value(0.88)).current;

    const [participant, setParticipant] = useState<User | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<DirectMessage | null>(null);

    const [showEmojiInput, setShowEmojiInput] = useState(false);
    const [customEmoji, setCustomEmoji] = useState('');
    const menuMessageRef = useRef<DirectMessage | null>(null);

    const flatListRef = useRef<FlatList>(null);
    const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
    const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const currentUser = auth.currentUser;
    const messageInputRef = useRef<MessageInputHandle>(null);
    const [showScrollDown, setShowScrollDown] = useState(false);
    const scrollDownAnim = useRef(new Animated.Value(0)).current;

    const headerHeight = useHeaderHeight();

    useEffect(() => {
        if (!userId || !currentUser) return;

        const init = async () => {
            try {
                const userRef = doc(db, 'users', userId);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    setParticipant({ uid: userDoc.id, ...userDoc.data() } as User);
                }

                const convId = await dmService.getOrCreateConversation(currentUser.uid, userId);
                setConversationId(convId);
            } catch (error) {
                console.error('Error initializing DM chat:', error);
            }
        };

        init();
    }, [userId, currentUser]);

    useEffect(() => {
        if (!conversationId || !currentUser) return;

        const unsubscribe = dmService.subscribeToMessages(
            conversationId,
            currentUser.uid,
            (newMessages) => {
                setMessages(newMessages as DirectMessage[]);
                setLoading(false);
            },
            (err) => {
                console.error('DM subscription error:', err);
                if (err.code === 'failed-precondition') {
                    setError(t('dm.db_index_error') || 'Falta un índice en la base de datos para este chat.');
                }
                setLoading(false);
            }
        );

        dmService.markAsRead(conversationId, currentUser.uid).catch(err => {
            console.error('Mark as read error:', err);
            if (err.code === 'failed-precondition') {
                setError(t('dm.db_index_error') || 'Falta un índice en la base de datos para marcar como leído.');
            }
        });

        return () => unsubscribe();
    }, [conversationId, currentUser]);

    const handleReaction = async (emoji: string, targetMsg?: DirectMessage) => {
        const msg = targetMsg || menuMessage;
        if (!msg || !conversationId || !currentUser) return;

        setMenuMessage(null);
        const reactions = msg.reactions || {};
        const userReactions = reactions[emoji] || [];
        const hasReacted = userReactions.includes(currentUser.uid);

        await updateDoc(doc(db, 'conversations', conversationId, 'messages', msg.id), {
            [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid),
        });
    };

    const handleReply = (message: DirectMessage) => {
        setReplyingTo({
            id: message.id,
            text: message.text || (message.attachments?.find(a => a.type === 'audio') ? t('chat.voice_msg_preview') : t('common.file')),
            senderName: message.senderId === currentUser?.uid ? t('common.you') : (participant?.displayName || t('common.user')),
        });
        messageInputRef.current?.focus();
    };

    const handleCopy = (message: DirectMessage) => {
        setMenuMessage(null);
        if (message.text) Clipboard.setString(message.text);
    };

    const handleForward = async (message: DirectMessage) => {
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

    useEffect(() => {
        if (highlightId && messages.length > 0) {
            const timer = setTimeout(() => handleReplyPreviewPress(highlightId), 600);
            return () => clearTimeout(timer);
        }
    }, [highlightId, messages.length]);

    const handleSendMessage = async (text: string) => {
        if (!currentUser || !conversationId || sending) return;
        setSending(true);
        const replyData = replyingTo;
        setReplyingTo(null);

        try {
            await dmService.sendMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || t('chat.info.you') || 'Usuario',
                currentUser.photoURL,
                text,
                replyData || undefined
            );
        } catch (error) {
            console.error('Error sending DM:', error);
            Alert.alert(t('common.error') || 'Error', t('dm.send_error') || 'No se pudo enviar el mensaje.');
        } finally {
            setSending(false);
        }
    };

    const handleSendImage = async (url: string, width: number, height: number) => {
        if (!currentUser || !conversationId) return;
        try {
            await dmService.sendImageMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || t('chat.info.you') || 'Usuario',
                currentUser.photoURL,
                url,
                width,
                height
            );
        } catch (error) {
            console.error('Error sending image DM:', error);
        }
    };

    const handleSendPoll = async (poll: { question: string; options: string[]; multipleAnswers: boolean }) => {
        if (!currentUser || !conversationId) return;
        try {
            await dmService.sendPollMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || t('chat.info.you') || 'Usuario',
                currentUser.photoURL,
                poll
            );
        } catch (error) {
            console.error('Error sending poll DM:', error);
        }
    };

    const handleSendFile = async (name: string, url: string, size: number) => {
        if (!currentUser || !conversationId) return;
        try {
            await dmService.sendFileMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || t('chat.info.you') || 'Usuario',
                currentUser.photoURL,
                url,
                name,
                size
            );
        } catch (error) {
            console.error('Error sending file DM:', error);
        }
    };

    const handleSendAudio = async (url: string, duration: number) => {
        if (!currentUser || !conversationId) return;
        setReplyingTo(null);
        try {
            await dmService.sendAudioMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || t('chat.info.you') || 'Usuario',
                currentUser.photoURL,
                url,
                duration
            );
        } catch (error) {
            console.error('Error sending audio DM:', error);
            Alert.alert(t('common.error') || 'Error', t('dm.audio_error') || 'No se pudo enviar el audio.');
        }
    };

    const handleVotePoll = async (messageId: string, optionId: string) => {
        if (!currentUser || !conversationId) return;
        try {
            await dmService.votePoll(conversationId, messageId, optionId, currentUser.uid);
        } catch (error) {
            console.error('Error voting in poll:', error);
        }
    };

    const handleMessageDoubleTap = (messageId: string, reactions: Record<string, string[]>) => {
        if (!currentUser) return;
        const msg = messages.find(m => m.id === messageId);
        if (msg) handleReaction('❤️', msg);
    };

    const handleClearChat = async () => {
        if (!conversationId) return;
        Alert.alert(t('chat.settings.clear_chat') || 'Vaciar chat', t('chat.settings.clear_chat_msg') || '¿Seguro que quieres borrar todos tus mensajes de este chat?', [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: () => { /* No expuesto en dmService wrapper */ } }
        ]);
    };

    const handleDeleteForMe = async (messageId: string) => {
        if (!conversationId || !currentUser) return;
        try {
            await dmService.deleteMessageForMe(conversationId, messageId, currentUser.uid);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (error) {
            console.error('Delete for me error:', error);
        }
    };

    const handleDeleteForAll = async (messageId: string) => {
        if (!conversationId || !currentUser) return;
        try {
            await dmService.deleteMessageForAll(conversationId, messageId);
            setMessages(prev => prev.filter(m => m.id !== messageId));
        } catch (error) {
            console.error('Delete for all error:', error);
        }
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


    const scrollToBottom = () => {
        flatListRef.current?.scrollToIndex({ index: 0, animated: true });
    };

    const handleListScroll = (event: any) => {
        const y = event.nativeEvent.contentOffset.y;
        const shouldShow = y > 120;
        if (shouldShow !== showScrollDown) {
            setShowScrollDown(shouldShow);
            Animated.spring(scrollDownAnim, {
                toValue: shouldShow ? 1 : 0,
                useNativeDriver: true,
                tension: 80,
                friction: 10,
            }).start();
        }
    };

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

    const handleMenuDelete = (message: DirectMessage) => {
        setDeleteConfirmMsg(message);
        setMenuMessage(null);
    };


    const participantName = participant?.displayName || 'Usuario';
    const headerName = participantName.length > 13 ? participantName.slice(0, 13).trimEnd() + '...' : participantName;

    if (error) {
        return (
            <ThemedView style={[styles.container, styles.centerContent]}>
                <ThemedText style={[styles.errorText, { color: colors.danger ?? '#FF3B30' }]}>
                    ⚠️ {error}
                </ThemedText>
                <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
                    <ThemedText style={{ color: colors.primary }}>{t('common.back') || 'Volver atrás'}</ThemedText>
                </TouchableOpacity>
            </ThemedView>
        );
    }

    if (loading) {
        return (
            <ThemedView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={styles.loadingText}>{t('dm.loading_chat') || 'Cargando chat...'}</ThemedText>
            </ThemedView>
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
                headerStyle: { backgroundColor: colors.card },
                headerShadowVisible: false,
                headerTintColor: colors.text,
                headerTitleAlign: 'left',
                headerBackVisible: false,
                headerTitle: () => (
                    <TouchableOpacity
                        onPress={() => router.push(`/dm/${userId}/profile` as any)}
                        style={styles.headerInfo}
                    >
                        {participant?.photoURL ? (
                            <Image source={{ uri: participant.photoURL }} style={styles.headerAvatar} />
                        ) : (
                            <View style={[styles.headerAvatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                                <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>
                                    {participantName[0]}
                                </ThemedText>
                            </View>
                        )}
                        <View style={styles.headerNameWrapper}>
                            <ThemedText style={styles.headerName}>{headerName}</ThemedText>
                            <ThemedText style={styles.headerStatus}>{participant?.role === 'teacher' ? t('roles.teacher') : t('roles.student')}</ThemedText>
                        </View>
                    </TouchableOpacity>
                ),
                headerLeft: () => (
                    <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: spacing.xs }}>
                        <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
                    </TouchableOpacity>
                ),
                headerRight: () => (
                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={() => router.push(`/dm/${userId}/call?type=audio` as any)} style={styles.headerBtn}>
                            <Phone size={20} color={colors.text} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push(`/dm/${userId}/call?type=video` as any)} style={styles.headerBtn}>
                            <Video size={20} color={colors.text} strokeWidth={2} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.headerBtn}>
                            <Settings size={20} color={colors.text} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                )
            }} />

            <View style={[styles.container, { backgroundColor: colors.chat.background === 'transparent' ? colors.background : colors.chat.background }]}>
                {colors.chat.backgroundImage && (
                    <Image
                        source={{ uri: colors.chat.backgroundImage }}
                        style={[
                            StyleSheet.absoluteFillObject,
                            (colors.chat.offsetX !== undefined || colors.chat.offsetY !== undefined || colors.chat.scale !== undefined) ? {
                                transform: [
                                    { translateX: colors.chat.offsetX || 0 },
                                    { translateY: colors.chat.offsetY || 0 },
                                    { scale: colors.chat.scale || 1 }
                                ]
                            } : {}
                        ]}
                        resizeMode="cover"
                    />
                )}
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
                >
                    <View style={[styles.container, colors.chat.backgroundImage ? { backgroundColor: 'rgba(0,0,0,0.08)' } : undefined]}>
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
                                    onDoubleTap={() => handleReaction('❤️', item)}
                                    onSwipeStart={() => setIsSwipingMessage(true)}
                                    onSwipeEnd={() => setIsSwipingMessage(false)}
                                    onQuickAudioReply={(msg) => {
                                        handleReply(msg);
                                        setTimeout(() => messageInputRef.current?.startRecordingLocked(), 150);
                                    }}
                                    onReplyPreviewPress={handleReplyPreviewPress}
                                    highlighted={highlightedMessageId === item.id}
                                    onVotePoll={(optionId) => handleVotePoll(item.id, optionId)}
                                    onFilePress={(url, name) => {
                                        Share.share({ url, message: `${t('common.image_file') || 'Archivo'}: ${name}` });
                                    }}
                                />
                            )}
                            contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
                            onScroll={handleListScroll}
                            scrollEventThrottle={100}
                            inverted
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <ThemedText style={styles.emptyText}>{t('dm.no_messages_yet') || 'No hay mensajes aún. Di hola!'}</ThemedText>
                                </View>
                            }
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
                            onSendPoll={handleSendPoll}
                            onSendFile={handleSendFile}
                            replyTo={replyingTo}
                            onCancelReply={() => setReplyingTo(null)}
                            disabled={sending}
                        />
                    </View>
                </KeyboardAvoidingView>
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
                                    {menuMessage?.senderId === currentUser?.uid ? t('common.you') : (participant?.displayName || t('common.user'))}
                                </ThemedText>
                                <ThemedText style={[styles.menuPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                                    {menuMessage?.attachments?.find(a => a.type === 'audio') ? t('chat.voice_msg_preview') : menuMessage?.text}
                                </ThemedText>
                            </View>
                            <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleReply(menuMessage)}>
                                <Reply size={20} color={colors.text} strokeWidth={2} />
                                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.reply')}</ThemedText>
                            </TouchableOpacity>
                            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleForward(menuMessage)}>
                                <Forward size={20} color={colors.text} strokeWidth={2} />
                                <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.forward')}</ThemedText>
                            </TouchableOpacity>
                            {!!menuMessage?.text && (
                                <>
                                    <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                                    <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleCopy(menuMessage)}>
                                        <Copy size={20} color={colors.text} strokeWidth={2} />
                                        <ThemedText style={[styles.menuItemText, { color: colors.text }]}>{t('chat.copy')}</ThemedText>
                                    </TouchableOpacity>
                                </>
                            )}
                            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
                            <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleMenuDelete(menuMessage)}>
                                <Trash2 size={20} color="#FF3B30" strokeWidth={2} />
                                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>{t('chat.delete')}</ThemedText>
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
                                {t('chat.emoji_picker_title') || 'Selecciona un emoji del teclado'}
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
                                {t('chat.delete_message') || 'Eliminar mensaje'}
                            </ThemedText>
                            <ThemedText style={[styles.deleteDialogSubtitle, { color: colors.textSecondary }]}>
                                {deleteConfirmMsg?.senderId === currentUser?.uid
                                    ? (t('chat.delete_confirm_msg') || '¿Cómo quieres eliminarlo?')
                                    : (t('chat.delete_for_me_only') || 'Solo se eliminará para ti.')}
                            </ThemedText>
                        </View>
                        <View style={[styles.deleteDialogDivider, { backgroundColor: colors.border }]} />
                        <TouchableOpacity
                            style={styles.deleteDialogBtn}
                            onPress={() => {
                                const msg = deleteConfirmMsg!;
                                setDeleteConfirmMsg(null);
                                handleDeleteForMe(msg.id);
                            }}
                        >
                            <ThemedText style={[styles.deleteDialogBtnText, { color: colors.text }]}>
                                {t('chat.delete_for_me') || 'Eliminar para mí'}
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
                                        handleDeleteForAll(msg.id);
                                    }}
                                >
                                    <ThemedText style={[styles.deleteDialogBtnText, { color: '#FF3B30' }]}>
                                        {t('chat.delete_for_all') || 'Eliminar para todos'}
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
                                {t('common.cancel') || 'Cancelar'}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <ChatSettingsSheet
                visible={showSettings}
                onClose={() => setShowSettings(false)}
                onClearChat={handleClearChat}
                showClearChat={true}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    centerContent: { justifyContent: 'center', alignItems: 'center' },
    loadingText: { marginTop: spacing.md, opacity: 0.6 },
    headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerNameWrapper: { flexShrink: 1 },
    headerAvatar: { width: 36, height: 36, borderRadius: 18 },
    headerAvatarPlaceholder: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    headerName: { fontSize: 16, fontWeight: '700' },
    headerStatus: { fontSize: 12, opacity: 0.6 },
    headerActions: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    headerBtn: { padding: 8 },
    messageList: { padding: spacing.md, flexGrow: 1 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
    emptyText: { opacity: 0.5, textAlign: 'center' },
    scrollDownBtn: { position: 'absolute', bottom: 100, alignSelf: 'center', zIndex: 10 },
    scrollDownBtnInner: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
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
    errorText: { fontSize: 14, fontWeight: '700', textAlign: 'center', paddingHorizontal: 40 },
});
