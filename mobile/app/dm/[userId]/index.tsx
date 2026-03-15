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
import { auth, db } from '@/config/firebase';
import type { DirectMessage, ReplyPreview, User } from '@/types';
import {
    Settings, ChevronLeft, Reply, Trash2, Copy, Forward, Plus,
    ChevronDown, Phone, Video
} from 'lucide-react-native';
import * as dmService from '@/services/dmService';
import { DMSettingsSheet } from '@/components/dm/DMSettingsSheet';

const MESSAGES_PER_PAGE = 50;
const PRESET_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function DMChatScreen() {
    const { colors, theme } = useTheme();
    const { userId } = useLocalSearchParams<{ userId: string }>();
    const [messages, setMessages] = useState<DirectMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [replyingTo, setReplyingTo] = useState<ReplyPreview | null>(null);
    const [menuMessage, setMenuMessage] = useState<DirectMessage | null>(null);
    const [isSwipingMessage, setIsSwipingMessage] = useState(false);
    const menuScaleAnim = useRef(new Animated.Value(0.88)).current;

    const [participant, setParticipant] = useState<User | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);

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
            () => setLoading(false)
        );

        dmService.markAsRead(conversationId, currentUser.uid);

        return () => unsubscribe();
    }, [conversationId, currentUser]);

    const handleSendMessage = async (text: string) => {
        if (!currentUser || !conversationId || sending) return;
        setSending(true);
        const replyData = replyingTo;
        setReplyingTo(null);

        try {
            await dmService.sendMessage(
                conversationId,
                currentUser.uid,
                currentUser.displayName || 'Usuario',
                currentUser.photoURL,
                text,
                replyData || undefined
            );
        } catch (error) {
            console.error('Error sending DM:', error);
            Alert.alert('Error', 'No se pudo enviar el mensaje.');
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
                currentUser.displayName || 'Usuario',
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
                currentUser.displayName || 'Usuario',
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
                currentUser.displayName || 'Usuario',
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
                currentUser.displayName || 'Usuario',
                currentUser.photoURL,
                url,
                duration
            );
        } catch (error) {
            console.error('Error sending audio DM:', error);
            Alert.alert('Error', 'No se pudo enviar el audio.');
        }
    };

    const handleDeleteForMe = async (messageId: string) => {
        if (!currentUser || !conversationId) return;
        try {
            await dmService.deleteMessageForMe(conversationId, messageId, currentUser.uid);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteForAll = async (messageId: string) => {
        if (!conversationId) return;
        try {
            await dmService.deleteMessageForAll(conversationId, messageId);
        } catch (error) {
            console.error(error);
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

    const handleReply = (message: DirectMessage) => {
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

    const handleReaction = async (emoji: string, target?: DirectMessage) => {
        const msg = target || menuMessage;
        if (!currentUser || !msg || !conversationId) return;
        setMenuMessage(null);
        await dmService.toggleReaction(conversationId, msg.id, emoji, currentUser.uid);
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

    const [deleteConfirmMsg, setDeleteConfirmMsg] = useState<DirectMessage | null>(null);

    const participantName = participant?.displayName || 'Usuario';
    const headerName = participantName.length > 13 ? participantName.slice(0, 13).trimEnd() + '...' : participantName;

    if (loading) {
        return (
            <ThemedView style={[styles.container, styles.centerContent]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <ThemedText style={styles.loadingText}>Cargando chat...</ThemedText>
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
                headerTitleContainerStyle: { right: 130 },
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
                            <ThemedText style={styles.headerStatus}>{participant?.role === 'teacher' ? 'Profesor' : 'Estudiante'}</ThemedText>
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
                    <Image source={{ uri: colors.chat.backgroundImage }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                )}
                <KeyboardAvoidingView
                    style={styles.container}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={headerHeight}
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
                                        Share.share({ url, message: `Archivo: ${name}` });
                                    }}
                                />
                            )}
                            contentContainerStyle={[styles.messageList, { paddingBottom: spacing.md }]}
                            onScroll={handleListScroll}
                            scrollEventThrottle={100}
                            inverted
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <ThemedText style={styles.emptyText}>No hay mensajes aún. Di hola!</ThemedText>
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
                    <View style={styles.menuCenter}>
                        <View style={[styles.reactionStripInner, { backgroundColor: colors.card }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reactionStripContent}>
                                {PRESET_REACTIONS.map(emoji => (
                                    <TouchableOpacity key={emoji} style={styles.emojiBtn} onPress={() => handleReaction(emoji)}>
                                        <ThemedText style={styles.emojiText}>{emoji}</ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <Animated.View style={[styles.menuContent, { backgroundColor: colors.card, transform: [{ scale: menuScaleAnim }] }]}>
                            <TouchableOpacity style={styles.menuItem} onPress={() => menuMessage && handleReply(menuMessage)}>
                                <Reply size={20} color={colors.text} strokeWidth={2} />
                                <ThemedText style={styles.menuItemText}>Responder</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => {
                                const msg = menuMessage;
                                setMenuMessage(null);
                                if (!msg) return;
                                const audio = msg.attachments?.find(a => a.type === 'audio');
                                if (audio) {
                                    router.push(`/forward?audioUrl=${encodeURIComponent(audio.url)}&audioDuration=${audio.duration ?? 0}` as never);
                                } else {
                                    router.push(`/forward?messageText=${encodeURIComponent(msg.text || '')}` as never);
                                }
                            }}>
                                <Forward size={20} color={colors.text} strokeWidth={2} />
                                <ThemedText style={styles.menuItemText}>Reenviar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuMessage(null); Clipboard.setString(menuMessage?.text || ''); }}>
                                <Copy size={20} color={colors.text} strokeWidth={2} />
                                <ThemedText style={styles.menuItemText}>Copiar</ThemedText>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.menuItem} onPress={() => { setDeleteConfirmMsg(menuMessage); setMenuMessage(null); }}>
                                <Trash2 size={20} color="#FF3B30" strokeWidth={2} />
                                <ThemedText style={[styles.menuItemText, { color: '#FF3B30' }]}>Eliminar</ThemedText>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Pressable>
            </Modal>

            <Modal visible={!!deleteConfirmMsg} transparent animationType="fade">
                <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setDeleteConfirmMsg(null)}>
                    <View style={[styles.deleteDialog, { backgroundColor: colors.card }]}>
                        <View style={styles.deleteDialogHeader}>
                            <ThemedText style={styles.deleteDialogTitle}>Eliminar mensaje</ThemedText>
                            <ThemedText style={{ opacity: 0.6 }}>¿Quieres eliminar este mensaje?</ThemedText>
                        </View>
                        <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => { handleDeleteForMe(deleteConfirmMsg!.id); setDeleteConfirmMsg(null); }}>
                            <ThemedText style={{ color: colors.text }}>Eliminar para mí</ThemedText>
                        </TouchableOpacity>
                        {deleteConfirmMsg?.senderId === currentUser?.uid && (
                            <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => { handleDeleteForAll(deleteConfirmMsg!.id); setDeleteConfirmMsg(null); }}>
                                <ThemedText style={{ color: '#FF3B30' }}>Eliminar para todos</ThemedText>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.deleteDialogBtn} onPress={() => setDeleteConfirmMsg(null)}>
                            <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>Cancelar</ThemedText>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            <DMSettingsSheet
                visible={showSettings}
                onClose={() => setShowSettings(false)}
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
    reactionStripInner: { borderRadius: 20, padding: 8, width: '100%' },
    reactionStripContent: { gap: 10, paddingHorizontal: 10 },
    emojiBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    emojiText: { fontSize: 24 },
    menuContent: { width: '100%', borderRadius: 16, overflow: 'hidden' },
    menuItem: { flexDirection: 'row', alignItems: 'center', gap: 15, padding: 15 },
    menuItemText: { fontSize: 16 },
    deleteDialog: { width: 280, borderRadius: 16, overflow: 'hidden' },
    deleteDialogHeader: { padding: 20, alignItems: 'center' },
    deleteDialogTitle: { fontSize: 18, fontWeight: '700', marginBottom: 5 },
    deleteDialogBtn: { padding: 15, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.1)' },
});
