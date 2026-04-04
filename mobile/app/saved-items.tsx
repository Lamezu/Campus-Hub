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
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={handleNavigate}
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
                    <View style={styles.itemHeaderRight}>
                        <View style={[styles.sourceTag, { backgroundColor: colors.backgroundSecondary }]}>
                            {isDM
                                ? <MessageCircle size={11} color={colors.textSecondary} strokeWidth={2} />
                                : <Hash size={11} color={colors.textSecondary} strokeWidth={2} />
                            }
                            <ThemedText style={[styles.sourceTagText, { color: colors.textSecondary }]}>
                                {isDM ? t('dm.title') || 'Title' : t('chat.channel_label') || 'Channel Label'}
                            </ThemedText>
                        </View>
                        <TouchableOpacity onPress={() => handleUnsaveMessage(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Trash2 size={18} color={colors.danger} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.itemContent}>
                    {isAudio ? (
                        <View style={styles.mediaPreview}>
                            <PlayCircle size={20} color={colors.primary} />
                            <ThemedText style={styles.mediaLabel}>{t('dm.voice_message') || 'Voice Message'}</ThemedText>
                        </View>
                    ) : hasMedia ? (
                        <View style={styles.mediaPreview}>
                            <ImageIcon size={20} color={colors.primary} />
                            <ThemedText style={styles.mediaLabel}>{t('common.image_file') || 'Image File'}</ThemedText>
                        </View>
                    ) : null}
                    {!!item.text && (
                        <ThemedText style={styles.itemText} numberOfLines={3}>{item.text}</ThemedText>
                    )}
                </View>

                <ThemedText style={styles.itemDate}>
                    {t('saved.saved_at', { date: new Date(item.savedAt).toLocaleDateString() }) || `Guardado el ${new Date(item.savedAt).toLocaleDateString()}`}
                </ThemedText>
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
                style={[styles.itemCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/post/${item.id}` as any)}
            >
                <View style={styles.itemHeader}>
                    <ThemedText style={styles.postTitle} numberOfLines={1}>{item.title}</ThemedText>
                    <TouchableOpacity onPress={() => handleUnsavePost(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Trash2 size={18} color={colors.danger} />
                    </TouchableOpacity>
                </View>

                <View style={styles.itemContent}>
                    {item.mediaUrl && (
                        <Image source={{ uri: item.mediaUrl }} style={styles.postMediaPreview} />
                    )}
                    <ThemedText style={styles.itemText} numberOfLines={3}>{item.content}</ThemedText>
                </View>

                <View style={styles.itemFooter}>
                    <ThemedText style={styles.senderName}>{(t('common.from') || 'From') + ' ' + item.authorName}</ThemedText>
                    <ThemedText style={styles.itemDate}>{displayDate}</ThemedText>
                </View>
            </TouchableOpacity>
        );
    };

    const hasActiveFilter = !!searchQuery || !!selectedMonth;
    const activeData = activeTab === 'messages' ? filteredMessages : filteredPosts;

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('saved.title') || 'Title'}</ThemedText>
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
                            {t('saved.tabs.messages') || 'Messages'}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'posts' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                        onPress={() => setActiveTab('posts')}
                    >
                        <Bookmark size={18} color={activeTab === 'posts' ? colors.primary : colors.textSecondary} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'posts' ? colors.text : colors.textSecondary }]}>
                            {t('saved.tabs.posts') || 'Posts'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={[styles.searchRow, { paddingHorizontal: spacing.lg }]}>
                <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                    <Search size={16} color={colors.textSecondary} strokeWidth={2} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('saved.search_placeholder') || 'Search Placeholder'}
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        returnKeyType="search"
                    />
                    {!!searchQuery && (
                        <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <X size={15} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <TouchableOpacity
                    onPress={availableMonths.size > 0 ? toggleFilter : undefined}
                    style={[
                        styles.filterBtn,
                        {
                            backgroundColor: selectedMonth ? colors.primary : colors.backgroundSecondary,
                            borderColor: selectedMonth ? colors.primary : colors.border,
                            opacity: availableMonths.size === 0 ? 0.35 : 1,
                        }
                    ]}
                >
                    <CalendarDays size={18} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={2} />
                    {filterOpen
                        ? <ChevronRight size={12} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={2.5} style={{ transform: [{ rotate: '-90deg' }] }} />
                        : <ChevronRight size={12} color={selectedMonth ? '#fff' : colors.textSecondary} strokeWidth={2.5} style={{ transform: [{ rotate: '90deg' }] }} />
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
        paddingHorizontal: spacing.md, paddingBottom: spacing.sm + 2,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    backBtn: { padding: 4, width: 32 },
    headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', flex: 1, textAlign: 'center' },
    headerOffset: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
    tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
    tabText: { fontSize: typography.sizes.sm, fontWeight: '600' },
    searchRow: { flexDirection: 'row', gap: 10, paddingBottom: spacing.sm, alignItems: 'center' },
    searchBar: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
        borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
    },
    searchInput: { flex: 1, fontSize: typography.sizes.sm, paddingVertical: 0 },
    filterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 9,
        borderRadius: 12, borderWidth: 1,
    },
    calendarPanel: {
        overflow: 'hidden',
        marginHorizontal: spacing.lg,
        borderRadius: 14,
        borderWidth: StyleSheet.hairlineWidth,
        marginBottom: spacing.sm,
    },
    yearNav: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 6,
    },
    yearText: { fontSize: typography.sizes.md, fontWeight: '700' },
    monthGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        paddingHorizontal: spacing.xs, paddingBottom: spacing.sm,
    },
    monthCell: {
        width: '33.33%', alignItems: 'center',
        paddingVertical: 9, borderRadius: 8,
    },
    monthCellText: { fontSize: typography.sizes.sm },
    activeFilterRow: { paddingBottom: spacing.sm },
    activeFilterChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        alignSelf: 'flex-start',
        paddingHorizontal: 10, paddingVertical: 4,
        borderRadius: 20, borderWidth: 1,
    },
    activeFilterText: { fontSize: typography.sizes.xs, fontWeight: '600', textTransform: 'capitalize' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: spacing.lg, paddingTop: spacing.xs },
    itemCard: { borderWidth: 1, padding: spacing.md, borderRadius: 16, marginBottom: spacing.md },
    itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
    itemHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    sourceTag: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    sourceTagText: { fontSize: 10, lineHeight: 14 },
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
});
