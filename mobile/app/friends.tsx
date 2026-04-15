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
                style={[styles.friendCard, { backgroundColor: colors.card + '90', borderColor: colors.border + '15' }]}
                onPress={() => router.push(`/dm/${item.uid}` as any)}
            >
                <View style={styles.friendAvatarWrap}>
                    <View style={[styles.avatarContainer, { borderColor: colors.primary + '15' }]}>
                        {item.photoURL ? (
                            <Image source={{ uri: item.photoURL }} style={styles.friendAvatar} />
                        ) : (
                            <View style={[styles.friendAvatarPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                                <ThemedText style={[styles.avatarText, { color: colors.primary }]}>
                                    {item.displayName.charAt(0).toUpperCase()}
                                </ThemedText>
                            </View>
                        )}
                    </View>
                    {isBest && (
                        <View style={[styles.bestBadge, { backgroundColor: colors.warning, borderColor: colors.card }]}>
                            <Heart size={10} color="#fff" fill="#fff" />
                        </View>
                    )}
                </View>

                <View style={styles.friendInfo}>
                    <ThemedText style={[styles.friendName, { color: colors.text }]}>{item.displayName}</ThemedText>
                    <ThemedText style={[styles.friendRole, { color: colors.textSecondary }]}>{item.role === 'teacher' ? (t('roles.teacher') || 'Educador') : (t('roles.student') || 'Estudiante')}</ThemedText>
                </View>

                <View style={styles.friendActions}>
                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: isBest ? colors.warning + '11' : colors.card + '90', borderColor: isBest ? colors.warning + '30' : colors.border + '15' }]}
                        onPress={() => handleToggleBest(item.uid)}
                    >
                        <Heart size={18} color={isBest ? colors.warning : colors.textSecondary} fill={isBest ? colors.warning : 'transparent'} strokeWidth={2.5} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                        onPress={() => router.push(`/dm/${item.uid}` as any)}
                    >
                        <MessageCircle size={18} color="#fff" strokeWidth={2.5} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.friendActionBtn, { backgroundColor: (colors.danger ?? '#FF3B30') + '11', borderColor: (colors.danger ?? '#FF3B30') + '30' }]}
                        onPress={() => handleRemoveFriend(item.uid, item.displayName)}
                    >
                        <UserMinus size={18} color={colors.danger ?? '#FF3B30'} strokeWidth={2.5} />
                    </TouchableOpacity>
                </View>
            </Pressable>
        );
    };

    return (
        <ThemedView style={styles.container}>
            <Stack.Screen options={{ headerShown: false }} />

            <View style={[styles.customHeader, { paddingTop: insets.top + 8, backgroundColor: colors.background, borderBottomColor: colors.border + '15' }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>
                <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('friends.title') || 'Title'}</ThemedText>
                <View style={{ width: 32 }} />
            </View>

            <View style={[styles.headerOffset, { paddingTop: 16 }]}>
                <View style={[styles.tabBar, { backgroundColor: colors.card + '90', borderColor: colors.border + '15', borderWidth: 1 }]}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'all' && { backgroundColor: colors.primary + '15' }]}
                        onPress={() => setActiveTab('all')}
                    >
                        <Users size={18} color={activeTab === 'all' ? colors.primary : colors.textSecondary} strokeWidth={2.5} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'all' ? colors.primary : colors.textSecondary }]}>
                            {t('friends.tabs.all') || 'Todos'}
                        </ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'best' && { backgroundColor: colors.warning + '15' }]}
                        onPress={() => setActiveTab('best')}
                    >
                        <Heart size={18} color={activeTab === 'best' ? colors.warning : colors.textSecondary} strokeWidth={2.5} fill={activeTab === 'best' ? colors.warning : 'transparent'} />
                        <ThemedText style={[styles.tabText, { color: activeTab === 'best' ? colors.warning : colors.textSecondary }]}>
                            {t('friends.tabs.best') || 'Mejores'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.searchContainer, { backgroundColor: colors.card + '90', borderColor: colors.border + '15', borderWidth: 1 }]}>
                    <Search size={20} color={colors.textSecondary} strokeWidth={2.5} />
                    <ThemedText style={[styles.searchPlaceholder, { color: colors.textSecondary }]}>{t('friends.search_placeholder') || 'Buscar amigos...'}</ThemedText>
                </TouchableOpacity>
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
        paddingHorizontal: 16, paddingBottom: 14,
        borderBottomWidth: 1,
    },
    backBtn: { padding: 4, width: 32 },
    headerTitle: { fontSize: 18, fontWeight: '800', flex: 1, textAlign: 'center', letterSpacing: -0.5 },
    headerOffset: { paddingHorizontal: 20, paddingBottom: 16 },
    tabBar: { flexDirection: 'row', borderRadius: 24, padding: 6, gap: 6, marginBottom: 16 },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 20 },
    tabText: { fontSize: 13, fontWeight: '800' },
    searchContainer: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 22, gap: 12 },
    searchPlaceholder: { fontSize: 14, fontWeight: '600', opacity: 0.6 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 20, paddingTop: 4 },
    friendCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 28, marginBottom: 12, borderWidth: 1 },
    friendAvatarWrap: { position: 'relative' },
    avatarContainer: { width: 56, height: 56, borderRadius: 28, padding: 2, borderWidth: 1 },
    friendAvatar: { width: 52, height: 52, borderRadius: 26 },
    friendAvatarPlaceholder: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 20, fontWeight: '800' },
    bestBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 2.5 },
    friendInfo: { flex: 1, marginLeft: 16 },
    friendName: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    friendRole: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginTop: 4, letterSpacing: 0.5 },
    friendActions: { flexDirection: 'row', gap: 8 },
    friendActionBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center', borderWidth: 1 },
});
