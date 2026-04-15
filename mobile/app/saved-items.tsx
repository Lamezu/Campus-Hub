import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Image, TextInput, Animated } from 'react-native';
import { Stack, router } from 'expo-router';
import {
    ChevronLeft, ChevronRight, MessageSquare, Image as ImageIcon,
    Trash2, Bookmark, PlayCircle, Hash, MessageCircle, Search, X, CalendarDays,
} from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/config/firebase';
import { subscribeToSavedMessages, subscribeToSavedPosts, unsaveMessage, toggleSavePost, type SavedMessage } from '@/services/savedItemsService';
import { spacing, typography } from '@/constants/styles';
import type { Post } from '@/types';

type TabType = 'messages' | 'posts';

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
    new Date(2000, i, 1).toLocaleString('default', { month: 'short' })
);

export default function SavedItemsScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [activeTab, setActiveTab] = useState<TabType>('messages');
    const [savedMessages, setSavedMessages] = useState<SavedMessage[]>([]);
    const [savedPosts, setSavedPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const [filterYear, setFilterYear] = useState(new Date().getFullYear());
    const filterAnim = useRef(new Animated.Value(0)).current;
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!currentUser) return;
        const unsubMessages = subscribeToSavedMessages(currentUser.uid, (msgs) => {
            setSavedMessages(msgs);
            setLoading(false);
        });
        const unsubPosts = subscribeToSavedPosts(currentUser.uid, (posts) => {
            setSavedPosts(posts);
            setLoading(false);
        });
        setTimeout(() => setLoading(false), 1500);
        return () => { unsubMessages(); unsubPosts(); };
    }, [currentUser]);

    useEffect(() => {
        setSelectedMonth(null);
        setSearchQuery('');
        closeFilter();
    }, [activeTab]);

    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        if (activeTab === 'messages') {
            savedMessages.forEach(m => { if (m.savedAt) months.add(m.savedAt.substring(0, 7)); });
        } else {
            savedPosts.forEach(p => {
                const ts = (p as any).savedByTimestamps?.[currentUser?.uid ?? ''] ?? p.createdAt;
                if (ts) months.add((ts as string).substring(0, 7));
            });
        }
        return months;
    }, [activeTab, savedMessages, savedPosts, currentUser?.uid]);

    const toggleFilter = () => {
        const opening = !filterOpen;
        setFilterOpen(opening);
        Animated.spring(filterAnim, {
            toValue: opening ? 1 : 0,
            useNativeDriver: false,
            tension: 80,
            friction: 12,
        }).start();
    };

    const closeFilter = () => {
        setFilterOpen(false);
        Animated.spring(filterAnim, { toValue: 0, useNativeDriver: false, tension: 80, friction: 12 }).start();
    };

    const selectMonth = (key: string) => {
        setSelectedMonth(prev => prev === key ? null : key);
        closeFilter();
    };

    const filterPanelHeight = filterAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 224] });
    const filterPanelOpacity = filterAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });

    const filteredMessages = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return savedMessages.filter(msg => {
            if (q && !(msg.senderName.toLowerCase().includes(q) || (msg.text ?? '').toLowerCase().includes(q))) return false;
            if (selectedMonth && !msg.savedAt.startsWith(selectedMonth)) return false;
            return true;
        });
    }, [savedMessages, searchQuery, selectedMonth]);

    const filteredPosts = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        return savedPosts.filter(post => {
            if (q && !(
                post.title.toLowerCase().includes(q) ||
                post.authorName.toLowerCase().includes(q) ||
                post.content.toLowerCase().includes(q)
            )) return false;
            if (selectedMonth) {
                const ts = (post as any).savedByTimestamps?.[currentUser?.uid ?? ''] ?? post.createdAt;
                if (!ts || !(ts as string).startsWith(selectedMonth)) return false;
            }
            return true;
        });
    }, [savedPosts, searchQuery, selectedMonth, currentUser?.uid]);

    const handleUnsaveMessage = async (id: string) => {
        if (!currentUser) return;
        try { await unsaveMessage(currentUser.uid, id); } catch (e) { console.error(e); }
    };

    const handleUnsavePost = async (id: string) => {
        if (!currentUser) return;
        try { await toggleSavePost(currentUser.uid, id); } catch (e) { console.error(e); }
    };

    const renderMessageItem = ({ item }: { item: SavedMessage }) => {
        const hasMedia = item.attachments && item.attachments.length > 0;
        const isAudio = item.attachments?.some(a => a.type === 'audio');
        const isDM = item.chatType === 'dm';

        const handleNavigate = () => {
            if (isDM && item.originalParticipantId) {
                router.push({ pathname: `/dm/${item.originalParticipantId}`, params: { highlightId: item.id } } as any);
            } else if (item.originalChannelId) {
                router.push({ pathname: `/chat/${item.originalChannelId}`, params: { highlightId: item.id } } as any);
            }
        };

        return (
            <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}
                onPress={handleNavigate}
                activeOpacity={0.7}
            >
                <View style={styles.itemHeader}>
                    <View style={styles.senderInfo}>
                        <View style={[styles.avatarSmall, { backgroundColor: colors.primary + '15' }]}>
                            <ThemedText style={[styles.avatarTextSmall, { color: colors.primary }]}>
                                {item.senderName.charAt(0).toUpperCase()}
                            </ThemedText>
                        </View>
                        <ThemedText style={[styles.senderName, { color: colors.text }]}>{item.senderName}</ThemedText>
                    </View>
                    <View style={styles.itemHeaderRight}>
                        <View style={[styles.sourceTag, { backgroundColor: colors.primary + '11' }]}>
                            {isDM
                                ? <MessageCircle size={10} color={colors.primary} strokeWidth={2.5} />
                                : <Hash size={10} color={colors.primary} strokeWidth={2.5} />
                            }
                            <ThemedText style={[styles.sourceTagText, { color: colors.primary }]}>
                                {(isDM ? t('dm.title') || 'CHAT' : t('chat.channel_label') || 'CANAL').toUpperCase()}
                            </ThemedText>
                        </View>
                        <TouchableOpacity onPress={() => handleUnsaveMessage(item.id)} hitSlop={12}>
                            <Trash2 size={18} color={colors.danger} strokeWidth={2} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.itemContent}>
                    {isAudio ? (
                        <View style={styles.mediaPreview}>
                            <View style={styles.mediaIconBox}>
                                <PlayCircle size={18} color={colors.primary} fill={colors.primary + '20'} />
                            </View>
                            <ThemedText style={[styles.mediaLabel, { color: colors.textSecondary }]}>{t('dm.voice_message') || 'Nota de voz'}</ThemedText>
                        </View>
                    ) : hasMedia ? (
                        <View style={styles.mediaPreview}>
                            <View style={styles.mediaIconBox}>
                                <ImageIcon size={18} color={colors.primary} />
                            </View>
                            <ThemedText style={[styles.mediaLabel, { color: colors.textSecondary }]}>{t('common.image_file') || 'Imagen adjunta'}</ThemedText>
                        </View>
                    ) : null}
                    {!!item.text && (
                        <ThemedText style={[styles.itemText, { color: colors.text }]} numberOfLines={3}>{item.text}</ThemedText>
                    )}
                </View>

                <View style={styles.itemFooter}>
                    <ThemedText style={[styles.itemDate, { color: colors.textSecondary }]}>
                        {t('saved.saved_at', { date: new Date(item.savedAt).toLocaleDateString() }) || `Guardado el ${new Date(item.savedAt).toLocaleDateString()}`}
                    </ThemedText>
                    <ChevronRight size={14} color={colors.textSecondary} opacity={0.5} strokeWidth={3} />
                </View>
            </TouchableOpacity>
        );
    };

    const renderPostItem = ({ item }: { item: Post }) => {
        const savedAt = (item as any).savedByTimestamps?.[currentUser?.uid ?? ''];
        const displayDate = savedAt
            ? new Date(savedAt).toLocaleDateString()
            : new Date(item.createdAt).toLocaleDateString();

        return (
            <TouchableOpacity
                style={[styles.itemCard, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}
                onPress={() => router.push(`/post/${item.id}` as any)}
                activeOpacity={0.7}
            >
                <View style={styles.itemHeader}>
                    <ThemedText style={[styles.postTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</ThemedText>
                    <TouchableOpacity onPress={() => handleUnsavePost(item.id)} hitSlop={12}>
                        <Trash2 size={18} color={colors.danger} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View style={styles.itemContent}>
                    {item.mediaUrl && (
                        <Image source={{ uri: item.mediaUrl }} style={styles.postMediaPreview} />
                    )}
                    <ThemedText style={[styles.itemText, { color: colors.text }]} numberOfLines={3}>{item.content}</ThemedText>
                </View>

                <View style={styles.itemFooter}>
                    <View style={styles.senderInfo}>
                        <View style={[styles.avatarSmall, { backgroundColor: colors.primary + '15' }]}>
                            <ThemedText style={[styles.avatarTextSmall, { color: colors.primary }]}>
                                {item.authorName.charAt(0).toUpperCase()}
                            </ThemedText>
                        </View>
                        <ThemedText style={[styles.senderName, { color: colors.textSecondary }]}>{item.authorName}</ThemedText>
                    </View>
                    <ThemedText style={[styles.itemDate, { color: colors.textSecondary }]}>{displayDate}</ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    const hasActiveFilter = !!searchQuery || !!selectedMonth;
    const activeData = activeTab === 'messages' ? filteredMessages : filteredPosts;

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.customHeader, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border + '15' }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('saved.title') || 'Title'}</ThemedText>
                <View style={{ width: 32 }} />
            </View>

            <View style={[styles.headerOffset, { paddingTop: 16 }]}>
                <View style={[styles.tabBar, { backgroundColor: colors.card + '90', borderColor: colors.border + '15', borderWidth: 1 }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'messages' && { backgroundColor: colors.primary + '15' }]}
                        onPress={() => setActiveTab('messages')}
                    >
                        <MessageSquare size={18} color={activeTab === 'messages' ? colors.primary : colors.textSecondary} strokeWidth={2.5} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'messages' ? colors.primary : colors.textSecondary }]}>
                            {t('saved.tabs.messages') || 'Mensajes'}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && { backgroundColor: colors.primary + '15' }]}
                        onPress={() => setActiveTab('posts')}
                    >
                        <Bookmark size={18} color={activeTab === 'posts' ? colors.primary : colors.textSecondary} strokeWidth={2.5} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? colors.primary : colors.textSecondary }]}>
                            {t('saved.tabs.posts') || 'Publicaciones'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.searchRow, { paddingHorizontal: 20 }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}>
                    <Search size={18} color={colors.textSecondary} strokeWidth={2.5} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('saved.search_placeholder') || 'Buscar en guardados...'}
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {!!searchQuery && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={availableMonths.size > 0 ? toggleFilter : undefined}
                    style={[
                        styles.filterBtn,
                        {
                            backgroundColor: selectedMonth ? colors.primary : colors.card + '90',
                            borderColor: selectedMonth ? colors.primary : colors.border + '15',
                            opacity: availableMonths.size === 0 ? 0.35 : 1,
                        }
                    ]}
                >
                    <CalendarDays size={20} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={2.5} />
                    {filterOpen
                        ? <ChevronRight size={14} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={3} style={{ transform: [{ rotate: '-90deg' }] }} />
                        : <ChevronRight size={14} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={3} style={{ transform: [{ rotate: '90deg' }] }} />
                    }
                </TouchableOpacity>
            </View>

            <Animated.View style={[styles.calendarPanel, { height: filterPanelHeight, opacity: filterPanelOpacity, borderColor: colors.border, backgroundColor: colors.backgroundSecondary }]}>
                <View style={styles.yearNav}>
                    <TouchableOpacity onPress={() => setFilterYear(y => y - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <ChevronLeft size={20} color={colors.text} strokeWidth={2} />
                    </TouchableOpacity>
                    <ThemedText style={styles.yearText}>{filterYear}</ThemedText>
                    <TouchableOpacity onPress={() => setFilterYear(y => y + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <ChevronRight size={20} color={colors.text} strokeWidth={2} />
                    </TouchableOpacity>
                </View>

                <View style={styles.monthGrid}>
                    {MONTH_NAMES.map((name, i) => {
                        const key = `${filterYear}-${String(i + 1).padStart(2, '0')}`;
                        const hasItems = availableMonths.has(key);
                        const isSelected = selectedMonth === key;
                        return (
                            <TouchableOpacity
                                key={key}
                                onPress={() => hasItems && selectMonth(key)}
                                style={[
                                    styles.monthCell,
                                    isSelected && { backgroundColor: colors.primary },
                                    !hasItems && { opacity: 0.25 },
                                ]}
                                activeOpacity={hasItems ? 0.7 : 1}
                            >
                                <ThemedText style={[styles.monthCellText, isSelected && { color: '#fff', fontWeight: '700' }]}>
                                    {name}
                                </ThemedText>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </Animated.View>

            {selectedMonth && (
                <View style={[styles.activeFilterRow, { paddingHorizontal: spacing.lg }]}>
                    <View style={[styles.activeFilterChip, { backgroundColor: colors.primary + '22', borderColor: colors.primary }]}>
                        <ThemedText style={[styles.activeFilterText, { color: colors.primary }]}>
                            {new Date(filterYear, parseInt(selectedMonth.split('-')[1]) - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </ThemedText>
                        <TouchableOpacity onPress={() => setSelectedMonth(null)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <X size={13} color={colors.primary} strokeWidth={2.5} />
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={activeData as any[]}
                    renderItem={activeTab === 'messages' ? (renderMessageItem as any) : (renderPostItem as any)}
                    keyExtractor={(item: any) => item.id}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                    ListEmptyComponent={
                        hasActiveFilter
                            ? <EmptyState icon={Search} title={t('saved.no_results')} body={t('saved.no_results_desc')} />
                            : <EmptyState icon={Bookmark} title={t('saved.no_items')} body={t('saved.no_items_desc')} />
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
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4, width: 32 },
    headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center', letterSpacing: -0.5 },
    headerOffset: { paddingHorizontal: 20, paddingBottom: 12 },
    tabBar: { flexDirection: 'row', borderRadius: 24, padding: 6, gap: 6 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 20 },
    tabText: { fontSize: 13, fontWeight: '800' },
    searchRow: { flexDirection: 'row', gap: 10, paddingBottom: 14, alignItems: 'center' },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
        borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, paddingVertical: 10,
    },
    searchInput: { flex: 1, fontSize: 14, fontWeight: '600', paddingVertical: 0 },
    filterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 10,
        borderRadius: 22, borderWidth: 1,
    },
    calendarPanel: {
        overflow: 'hidden',
        marginHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 12,
    },
    yearNav: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingTop: 16, paddingBottom: 10,
    },
    yearText: { fontSize: 16, fontWeight: '800' },
    monthGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: 8, paddingBottom: 16,
    },
    monthCell: {
        width: '33.33%', alignItems: 'center',
        paddingVertical: 10, borderRadius: 12,
    },
    monthCellText: { fontSize: 13, fontWeight: '600' },
    activeFilterRow: { paddingBottom: 12 },
    activeFilterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        alignSelf: 'flex-start',
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: 20, borderWidth: 1,
    },
    activeFilterText: { fontSize: 12, fontWeight: '800' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20, paddingTop: 4 },
    itemCard: { borderWidth: 1, padding: 18, borderRadius: 28, marginBottom: 16 },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    itemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    sourceTagText: { fontSize: 10, fontWeight: '900' },
    senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    avatarSmall: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    avatarTextSmall: { fontSize: 11, fontWeight: '900' },
    senderName: { fontSize: 14, fontWeight: '800' },
    itemContent: { marginBottom: 14, gap: 10 },
    itemText: { fontSize: 15, lineHeight: 22, letterSpacing: -0.2 },
    itemDate: { fontSize: 11, fontWeight: '700', opacity: 0.5 },
    mediaPreview: { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: 0.9 },
    mediaIconBox: { width: 32, height: 32, borderRadius: 10, backgroundColor: 'rgba(128,128,128,0.1)', alignItems: 'center', justifyContent: 'center' },
    mediaLabel: { fontSize: 13, fontWeight: '600' },
    postTitle: { fontSize: 16, fontWeight: '800', flex: 1, letterSpacing: -0.3 },
    postMediaPreview: { width: '100%', height: 180, borderRadius: 20, marginBottom: 12 },
    itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
});
