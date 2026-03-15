import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Image } from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft, MessageSquare, Image as ImageIcon, FileText, Trash2, Bookmark, PlayCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { subscribeToSavedMessages, subscribeToSavedPosts, unsaveMessage, type SavedMessage } from '@/services/savedItemsService';
import { spacing, typography } from '@/constants/styles';
import { toggleSavePost } from '@/services/savedItemsService';
import type { Post } from '@/types';

type TabType = 'messages' | 'posts';

export default function SavedItemsScreen() {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
    const [savedPosts, setSavedPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;

        const unsubMessages = subscribeToSavedMessages(currentUser.uid, (msgs) => {
            setSavedMessages(msgs);
            if (activeTab === 'messages') setLoading(false);
        });

        const unsubPosts = subscribeToSavedPosts(currentUser.uid, (posts) => {
            setSavedPosts(posts);
            if (activeTab === 'posts') setLoading(false);
        });

        setTimeout(() => setLoading(false), 1500);

        return () => {
            unsubMessages();
            unsubPosts();
        };
    }, [currentUser]);

    const handleUnsaveMessage = async (id: string) => {
        if (!currentUser) return;
        try {
            await unsaveMessage(currentUser.uid, id);
        } catch (error) {
            console.error(error);
        }
    };

    const handleUnsavePost = async (id: string) => {
        if (!currentUser) return;
        try {
            await toggleSavePost(currentUser.uid, id);
        } catch (error) {
            console.error(error);
        }
    };

    const renderMessageItem = ({ item }: { item: SavedMessage }) => {
        const hasMedia = item.attachments && item.attachments.length > 0;
        const isAudio = item.attachments?.some(a => a.type === 'audio');

        return (
            <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push({ pathname: `/chat/${item.originalChannelId}`, params: { highlight: item.id } } as any)}
            >
                <View style={styles.itemHeader}>
                    <View style={styles.senderInfo}>
                        <View style={[styles.avatarSmall, { backgroundColor: colors.primary }]}>
                            <ThemedText style={styles.avatarTextSmall}>
                                {item.senderName.charAt(0).toUpperCase()}
                            </ThemedText>
                        </View>
                        <ThemedText style={styles.senderName}>{item.senderName}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => handleUnsaveMessage(item.id)}>
                        <Trash2 size={18} color={colors.danger} />
                    </TouchableOpacity>
                </View>

                <View style={styles.itemContent}>
                    {isAudio ? (
                        <View style={styles.mediaPreview}>
                            <PlayCircle size={20} color={colors.primary} />
                            <ThemedText style={styles.mediaLabel}>Mensaje de voz</ThemedText>
                        </View>
                    ) : hasMedia ? (
                        <View style={styles.mediaPreview}>
                            <ImageIcon size={20} color={colors.primary} />
                            <ThemedText style={styles.mediaLabel}>Imagen / Archivo</ThemedText>
                        </View>
                    ) : null}

                    {!!item.text && (
                        <ThemedText style={styles.itemText} numberOfLines={3}>
                            {item.text}
                        </ThemedText>
                    )}
                </View>

                <ThemedText style={styles.itemDate}>
                    Guardado el {new Date(item.savedAt).toLocaleDateString()}
                </ThemedText>
            </TouchableOpacity>
        );
    };

    const renderPostItem = ({ item }: { item: Post }) => {
        return (
            <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/post/${item.id}` as any)}
            >
                <View style={styles.itemHeader}>
                    <ThemedText style={styles.postTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <TouchableOpacity onPress={() => handleUnsavePost(item.id)}>
                        <Trash2 size={18} color={colors.danger} />
                    </TouchableOpacity>
                </View>

                <View style={styles.itemContent}>
                    {item.mediaUrl && (
                        <Image source={{ uri: item.mediaUrl }} style={styles.postMediaPreview} />
                    )}
                    <ThemedText style={styles.itemText} numberOfLines={3}>
                        {item.content}
                    </ThemedText>
                </View>

                <View style={styles.itemFooter}>
                    <ThemedText style={styles.senderName}>De {item.authorName}</ThemedText>
                    <ThemedText style={styles.itemDate}>
                        {new Date(item.createdAt).toLocaleDateString()}
                    </ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Guardados</ThemedText>
                <View style={{ width: 32 }} />
            </View>

            <View style={[styles.headerOffset, { paddingTop: spacing.md }]}>
                <View style={[styles.tabBar, { backgroundColor: colors.backgroundSecondary }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'messages' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                        onPress={() => setActiveTab('messages')}
                    >
                        <MessageSquare size={18} color={activeTab === 'messages' ? colors.primary : colors.textSecondary} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'messages' ? colors.text : colors.textSecondary }]}>
                            Mensajes
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                        onPress={() => setActiveTab('posts')}
                    >
                        <Bookmark size={18} color={activeTab === 'posts' ? colors.primary : colors.textSecondary} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? colors.text : colors.textSecondary }]}>
                            Posts
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={activeTab === 'messages' ? (savedMessages as any) : (savedPosts as any)}
                    renderItem={activeTab === 'messages' ? (renderMessageItem as any) : (renderPostItem as any)}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Bookmark size={64} color={colors.border} strokeWidth={1} />
                            <ThemedText style={styles.emptyTitle}>No hay nada guardado</ThemedText>
                            <ThemedText style={styles.emptySubtitle}>
                                Los elementos que guardes aparecerán aquí
                            </ThemedText>
                        </View>
                    }
                />
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    customHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingBottom: spacing.sm + 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4, width: 32 },
    headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', flex: 1, textAlign: 'center' },
    headerOffset: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
    tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
    tabText: { fontSize: typography.sizes.sm, fontWeight: '600' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: spacing.lg, paddingTop: spacing.xs },
    itemCard: { borderWidth: 1, padding: spacing.md, borderRadius: 16, marginBottom: spacing.md },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    senderInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    avatarSmall: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    avatarTextSmall: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    senderName: { fontSize: typography.sizes.sm, fontWeight: '600' },
    itemContent: { marginBottom: spacing.sm },
    itemText: { fontSize: typography.sizes.md, lineHeight: 22 },
    itemDate: { fontSize: typography.sizes.xs, opacity: 0.5 },
    mediaPreview: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.xs, opacity: 0.7 },
    mediaLabel: { fontSize: typography.sizes.sm, fontStyle: 'italic' },
    postTitle: { fontSize: typography.sizes.md, fontWeight: 'bold', flex: 1 },
    postMediaPreview: { width: '100%', height: 150, borderRadius: 12, marginBottom: spacing.sm },
    itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.xs },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyTitle: { fontSize: typography.sizes.lg, fontWeight: 'bold', marginTop: spacing.md },
    emptySubtitle: { fontSize: typography.sizes.sm, opacity: 0.6, marginTop: spacing.xs, textAlign: 'center' },
});
