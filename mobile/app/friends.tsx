import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, TouchableOpacity, Platform, ActivityIndicator, Image, Pressable, Alert } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Users, UserStar, Search, UserPlus, UserMinus, Heart, MessageCircle } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { auth, db } from '@/config/firebase';
import { subscribeToFriends, toggleBestFriend, removeFriend } from '@/services/friendsService';
import { spacing, typography } from '@/constants/styles';
import type { User } from '@/types';

type TabType = 'all' | 'best';

export default function FriendsScreen() {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const params = useLocalSearchParams<{ tab?: string }>();

    const [activeTab, setActiveTab] = useState<TabType>((params.tab as TabType) || 'all');
    const [allFriends, setAllFriends] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const currentUser = auth.currentUser;

    const bestFriends = allFriends.filter((f: any) => f.isBestFriend === true);

    useEffect(() => {
        if (!currentUser) return;

        const unsubAll = subscribeToFriends(currentUser.uid, (friends) => {
            setAllFriends(friends);
            setLoading(false);
        });

        return () => unsubAll();
    }, [currentUser]);

    const handleToggleBest = async (friendId: string) => {
        if (!currentUser) return;
        try {
            await toggleBestFriend(currentUser.uid, friendId);
        } catch (error) {
            console.error(error);
        }
    };

    const handleRemoveFriend = (friendId: string, friendName: string) => {
        Alert.alert(
            t('dm.profile.remove_friend_title') || 'Remove Friend Title',
            t('dm.profile.remove_friend_confirm', { name: friendName }) || `Remove ${friendName} from your friends?`,
            [
                { text: t('common.cancel') || 'Cancel', style: 'cancel' },
                {
                    text: t('dm.profile.remove_friend_action') || 'Remove Friend Action',
                    style: 'destructive',
                    onPress: async () => {
                        if (!currentUser) return;
                        await removeFriend(currentUser.uid, friendId);
                    },
                },
            ]
        );
    };

    const filteredFriends = (activeTab === 'all' ? allFriends : bestFriends).filter(f =>
        f.displayName.toLowerCase().includes(search.toLowerCase()) ||
        f.email.toLowerCase().includes(search.toLowerCase())
    );

    const renderFriendItem = ({ item }: { item: User }) => {
        const isBest = bestFriends.some(f => f.uid === item.uid);

        return (
            <Pressable
                style={[styles.friendCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => router.push(`/dm/${item.uid}` as any)}
            >
                <View style={styles.friendAvatarWrap}>
                    {item.photoURL ? (
                        <Image source={{ uri: item.photoURL }} style={styles.friendAvatar} />
                    ) : (
                        <View style={[styles.friendAvatarPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                            <ThemedText style={[styles.avatarText, { color: colors.primary }]}>
                                {item.displayName.charAt(0).toUpperCase()}
                            </ThemedText>
                        </View>
                    )}
                    {isBest && (
                        <View style={styles.bestBadge}>
                            <Heart size={10} color="#fff" fill="#fff" />
                        </View>
                    )}
                </View>

                <View style={styles.friendInfo}>
                    <ThemedText style={styles.friendName}>{item.displayName}</ThemedText>
                    <ThemedText style={styles.friendRole}>{item.role === 'teacher' ? (t('roles.teacher') || 'Teacher') : (t('roles.student') || 'Student')}</ThemedText>
                </View>

                <View style={styles.friendActions}>
                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: colors.backgroundSecondary }]}
                        onPress={() => handleToggleBest(item.uid)}
                    >
                        <UserStar size={20} color={isBest ? colors.warning : colors.textSecondary} fill={isBest ? colors.warning : 'transparent'} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push(`/dm/${item.uid}` as any)}
                    >
                        <MessageCircle size={20} color="#fff" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: (colors.danger ?? '#FF3B30') + '22' }]}
                        onPress={() => handleRemoveFriend(item.uid, item.displayName)}
                    >
                        <UserMinus size={20} color={colors.danger ?? '#FF3B30'} />
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.customHeader, { paddingTop: insets.top, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('friends.title') || 'Title'}</ThemedText>
                <View style={{ width: 32 }} />
            </View>

            <View style={[styles.headerOffset, { paddingTop: spacing.md }]}>
                <View style={[styles.tabBar, { backgroundColor: colors.backgroundSecondary }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'all' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Users size={18} color={activeTab === 'all' ? colors.primary : colors.textSecondary} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'all' ? colors.text : colors.textSecondary }]}>
                            {t('friends.tabs.all') || 'All'}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'best' && { backgroundColor: colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 }]}
                        onPress={() => setActiveTab('best')}
                    >
                        <UserStar size={18} color={activeTab === 'best' ? colors.warning : colors.textSecondary} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'best' ? colors.text : colors.textSecondary }]}>
                            {t('friends.tabs.best') || 'Best'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={[styles.searchContainer, { backgroundColor: colors.backgroundSecondary }]}>
                    <Search size={20} color={colors.textSecondary} />
                    <ThemedText style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>{t('friends.search_placeholder') || 'Search Placeholder'}</ThemedText>
                </View>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={filteredFriends}
                    renderItem={renderFriendItem}
                    keyExtractor={(item) => item.uid}
                    contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 20 }]}
                    ListEmptyComponent={
                        <EmptyState
                            icon={Users}
                            title={activeTab === 'all' ? t('friends.empty.no_friends') : t('friends.empty.no_best')}
                            body={activeTab === 'all' ? t('friends.empty.start_connecting') : t('friends.empty.add_best_desc')}
                        />
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
    tabBar: { flexDirection: 'row', borderRadius: 12, padding: 4, gap: 4, marginBottom: spacing.md },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderRadius: 10 },
    tabText: { fontSize: typography.sizes.sm, fontWeight: '600' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', padding: spacing.sm, borderRadius: 12, gap: spacing.sm },
    searchPlaceholder: { fontSize: typography.sizes.sm },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: spacing.lg, paddingTop: spacing.xs },
    friendCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 20, marginBottom: spacing.sm, borderWidth: 1 },
    friendAvatarWrap: { position: 'relative' },
    friendAvatar: { width: 50, height: 50, borderRadius: 25 },
    friendAvatarPlaceholder: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 20, fontWeight: 'bold' },
    bestBadge: { position: 'absolute', bottom: -2, right: -2, backgroundColor: '#FF2D55', width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff' },
    friendInfo: { flex: 1, marginLeft: spacing.md },
    friendName: { fontSize: typography.sizes.md, fontWeight: 'bold' },
    friendRole: { fontSize: typography.sizes.xs, opacity: 0.6, marginTop: 2 },
    friendActions: { flexDirection: 'row', gap: spacing.xs },
    friendActionBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
});
