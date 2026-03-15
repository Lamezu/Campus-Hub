import React, { useState, useEffect } from 'react';
import {
    View, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, Alert, StatusBar, TextInput,
    Modal, FlatList, Pressable, Image,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import {
    doc, updateDoc, setDoc, deleteDoc, arrayRemove, arrayUnion,
    collection, query, where, getDocs, increment, writeBatch,
    limit as firestoreLimit, serverTimestamp, onSnapshot, getDoc,
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/contexts/ThemeContext';
import {
    ChevronLeft, Search, UserPlus, Plus, Check,
    Trash2, LogOut, Edit3, Bell, BellOff, ChevronRight, X,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { useCurrentUser } from '@/contexts/UserContext';
import { uploadGroupPhoto } from '@/config/cloudinary';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@/constants/styles';

function useChannelInfo(id: string) {
    const [channel, setChannel] = useState<any>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isMuted, setIsMuted] = useState(false);
    const [muteUntil, setMuteUntil] = useState<Date | null>(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        if (!id || !currentUser) return;
        const isSG = id.startsWith('sg_');
        const realId = isSG ? id.replace('sg_', '') : id;
        const colName = isSG ? 'studyGroups' : 'channels';

        const unsubChannel = onSnapshot(doc(db, colName, realId), (snap) => {
            if (snap.exists()) setChannel({ id: snap.id, ...snap.data() });
            setLoading(false);
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error('InfoChannel Snapshot error:', error);
            }
            setLoading(false);
        });

        const unsubMembers = onSnapshot(collection(db, colName, realId, 'members'), async (snap) => {
            const memberDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const profiles = await Promise.all(memberDocs.map((m: any) => getDoc(doc(db, 'users', m.id))));
            setMembers(memberDocs.map((m: any, i) => {
                const p = profiles[i];
                return {
                    ...m,
                    displayName: p.exists() ? (p.data()?.displayName || 'Usuario') : 'Usuario',
                    photoURL: p.exists() ? (p.data()?.photoURL || null) : null,
                    bio: p.exists() ? (p.data()?.bio || '') : '',
                    userRole: p.exists() ? (p.data()?.role || 'student') : 'student',
                };
            }));
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error('InfoMembers Snapshot error:', error);
            }
        });

        const unsubMute = onSnapshot(doc(db, colName, realId, 'members', currentUser.uid), (snap) => {
            const data = snap.data();
            const until = data?.muteUntil?.toDate?.() ?? null;
            const nowMuted = until ? until > new Date() : data?.notifications === false;
            setIsMuted(nowMuted);
            setMuteUntil(until);
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error('InfoMute Snapshot error:', error);
            }
        });

        return () => { unsubChannel(); unsubMembers(); unsubMute(); };
    }, [id, currentUser?.uid]);

    return { channel, members, loading, isMuted, muteUntil };
}

const ROLE_FILTERS = [
    { key: 'all', label: 'Todos' },
    { key: 'student', label: 'Estudiantes' },
    { key: 'teacher', label: 'Profesores' },
    { key: 'admin', label: 'Admins' },
];

function AddMembersModal({ visible, onClose, onAdd, existingMemberIds }: {
    visible: boolean;
    onClose: () => void;
    onAdd: (user: any) => void;
    existingMemberIds: string[];
}) {
    const { colors, theme } = useTheme();
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!visible) { setSearch(''); setRoleFilter('all'); setResults([]); return; }
        const timer = setTimeout(() => doSearch(), 300);
        return () => clearTimeout(timer);
    }, [search, roleFilter, visible]);

    const doSearch = async () => {
        setLoading(true);
        try {
            const baseQuery = search.length >= 2
                ? query(collection(db, 'users'), where('displayName', '>=', search), where('displayName', '<=', search + '\uF8FF'), firestoreLimit(20))
                : query(collection(db, 'users'), firestoreLimit(30));
            const snap = await getDocs(baseQuery);
            let res = snap.docs
                .map(d => ({ id: d.id, ...d.data() }))
                .filter((u: any) => !existingMemberIds.includes(u.id) && u.id !== auth.currentUser?.uid);
            if (roleFilter !== 'all') res = res.filter((u: any) => u.role === roleFilter);
            setResults(res);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={amStyles.overlay}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
                <View style={[amStyles.sheet, { backgroundColor: theme === 'dark' ? '#1C1C1E' : '#F2F2F7' }]}>
                    <View style={[amStyles.handle, { backgroundColor: colors.border }]} />
                    <View style={amStyles.header}>
                        <ThemedText style={amStyles.title}>Añadir miembros</ThemedText>
                        <TouchableOpacity onPress={onClose} style={[amStyles.closeBtn, { backgroundColor: colors.border + '44' }]}>
                            <X size={18} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={[amStyles.searchWrap, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#fff' }]}>
                        <Search size={18} color={colors.primary} />
                        <TextInput
                            style={[amStyles.searchInput, { color: colors.text }]}
                            placeholder="Buscar por nombre..."
                            placeholderTextColor={colors.textSecondary}
                            value={search}
                            onChangeText={setSearch}
                        />
                        {search.length > 0 && (
                            <TouchableOpacity onPress={() => setSearch('')}>
                                <X size={16} color={colors.textSecondary} />
                            </TouchableOpacity>
                        )}
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={amStyles.filtersScroll}
                        contentContainerStyle={amStyles.filters}
                    >
                        {ROLE_FILTERS.map(f => (
                            <TouchableOpacity
                                key={f.key}
                                style={[
                                    amStyles.filterChip,
                                    { backgroundColor: roleFilter === f.key ? colors.primary : (theme === 'dark' ? '#2C2C2E' : '#fff') },
                                    roleFilter === f.key && amStyles.activeFilter
                                ]}
                                onPress={() => setRoleFilter(f.key)}
                            >
                                <ThemedText style={[
                                    amStyles.filterLabel,
                                    { color: roleFilter === f.key ? '#fff' : colors.text }
                                ]}>
                                    {f.label}
                                </ThemedText>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {loading ? (
                        <View style={amStyles.loadingCenter}>
                            <ActivityIndicator size="small" color={colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ paddingHorizontal: spacing.md, paddingBottom: 40 }}
                            ListEmptyComponent={
                                <View style={amStyles.emptyWrap}>
                                    <ThemedText style={[amStyles.empty, { color: colors.textSecondary }]}>
                                        {search.length < 2 ? 'Busca personas para añadir' : 'No se encontraron resultados'}
                                    </ThemedText>
                                </View>
                            }
                            renderItem={({ item }) => {
                                const initials = item.displayName?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';
                                return (
                                    <TouchableOpacity
                                        style={[amStyles.userRow, { backgroundColor: theme === 'dark' ? '#2C2C2E' : '#fff' }]}
                                        onPress={() => onAdd(item)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={amStyles.avatarWrap}>
                                            {item.photoURL ? (
                                                <Image source={{ uri: item.photoURL }} style={amStyles.avatar} />
                                            ) : (
                                                <View style={[amStyles.avatarPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                                                    <ThemedText style={{ color: colors.primary, fontWeight: '700' }}>{initials}</ThemedText>
                                                </View>
                                            )}
                                        </View>
                                        <View style={amStyles.userInfo}>
                                            <ThemedText style={amStyles.userName}>{item.displayName || 'Usuario'}</ThemedText>
                                            <ThemedText style={[amStyles.userRole, { color: colors.textSecondary }]}>
                                                {item.role === 'teacher' ? 'Profesor' : item.role === 'admin' ? 'Administrador' : 'Estudiante'} • {item.department || 'Campus'}
                                            </ThemedText>
                                        </View>
                                        <View style={[amStyles.addBtn, { backgroundColor: colors.primary + '15' }]}>
                                            <Plus size={20} color={colors.primary} />
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
}

const amStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: {
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '85%',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 20,
    },
    handle: { width: 40, height: 5, borderRadius: 2.5, alignSelf: 'center', marginTop: 12, opacity: 0.5 },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.xl,
        paddingTop: 20,
        paddingBottom: 15,
    },
    title: { fontSize: 20, fontWeight: '800' },
    closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: spacing.md,
        paddingHorizontal: 16,
        height: 48,
        borderRadius: 24,
        gap: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
    },
    searchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
    filtersScroll: { flexGrow: 0, marginVertical: 12 },
    filters: { paddingHorizontal: spacing.md, gap: 10 },
    filterChip: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    activeFilter: { transform: [{ scale: 1.05 }] },
    filterLabel: { fontSize: 13, fontWeight: '700' },
    userRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderRadius: 20,
        marginBottom: 10,
        gap: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 3,
        elevation: 1,
    },
    avatarWrap: { width: 48, height: 48 },
    avatar: { width: 48, height: 48, borderRadius: 24 },
    avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
    userInfo: { flex: 1 },
    userName: { fontSize: 16, fontWeight: '700' },
    userRole: { fontSize: 12, marginTop: 2, fontWeight: '500' },
    addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    loadingCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 40 },
    emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60 },
    empty: { textAlign: 'center', fontSize: 15, fontWeight: '500', opacity: 0.7 },
});

const MUTE_OPTIONS = [
    { label: '8 horas', hours: 8 },
    { label: '1 semana', hours: 24 * 7 },
    { label: 'Siempre', hours: 24 * 365 * 10 },
];

function MuteModal({ visible, isMuted, muteUntil, onClose, onMute, onUnmute }: {
    visible: boolean;
    isMuted: boolean;
    muteUntil: Date | null;
    onClose: () => void;
    onMute: (hours: number) => void;
    onUnmute: () => void;
}) {
    const { colors } = useTheme();
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable style={muteStyles.overlay} onPress={onClose}>
                <Pressable style={[muteStyles.sheet, { backgroundColor: colors.background }]} onPress={() => { }}>
                    <View style={[muteStyles.handle, { backgroundColor: colors.border }]} />
                    <View style={[muteStyles.header, { borderBottomColor: colors.border }]}>
                        <ThemedText style={muteStyles.title}>Silenciar notificaciones</ThemedText>
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <X size={20} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                    <View style={{ paddingHorizontal: spacing.md, paddingTop: 8, paddingBottom: 24 }}>
                        {isMuted && (
                            <TouchableOpacity style={[muteStyles.option, { borderBottomColor: colors.border }]} onPress={onUnmute}>
                                <ThemedText style={[muteStyles.optionLabel, { color: colors.primary }]}>Desactivar silencio</ThemedText>
                                <Check size={18} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        {MUTE_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.label}
                                style={[muteStyles.option, { borderBottomColor: colors.border }]}
                                onPress={() => onMute(opt.hours)}
                            >
                                <ThemedText style={muteStyles.optionLabel}>{opt.label}</ThemedText>
                            </TouchableOpacity>
                        ))}
                        {isMuted && muteUntil && muteUntil.getFullYear() < 2100 && (
                            <ThemedText style={[muteStyles.muteInfo, { color: colors.textSecondary }]}>
                                Silenciado hasta {muteUntil.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
                            </ThemedText>
                        )}
                        {isMuted && muteUntil && muteUntil.getFullYear() >= 2100 && (
                            <ThemedText style={[muteStyles.muteInfo, { color: colors.textSecondary }]}>
                                Silenciado indefinidamente
                            </ThemedText>
                        )}
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const muteStyles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 4 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
    title: { fontSize: 17, fontWeight: '700' },
    option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
    optionLabel: { fontSize: 16 },
    muteInfo: { fontSize: 13, marginTop: 16, textAlign: 'center' },
});

function MemberRow({ member, isCreator, isSelf, canRemove, onPress, onRemove }: any) {
    const { colors } = useTheme();
    const roleLabel = isCreator ? 'Creador' : (member.role === 'admin' || member.role === 'coordinator') ? 'Admin.' : null;
    const initials = member.displayName?.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase() || '?';

    const handleLongPress = () => {
        if (!canRemove || isSelf) return;
        Alert.alert(
            member.displayName,
            '¿Qué quieres hacer?',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Eliminar del grupo', style: 'destructive', onPress: onRemove },
            ]
        );
    };

    return (
        <TouchableOpacity
            style={styles.memberRow}
            onPress={onPress}
            onLongPress={handleLongPress}
            activeOpacity={0.7}
        >
            <View style={styles.memberAvatarWrap}>
                {member.photoURL ? (
                    <Image source={{ uri: member.photoURL }} style={styles.memberAvatarImg} />
                ) : (
                    <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '33' }]}>
                        <ThemedText style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{initials}</ThemedText>
                    </View>
                )}
            </View>
            <View style={{ flex: 1 }}>
                <ThemedText style={styles.memberName}>{isSelf ? 'Tú' : (member.displayName || 'Usuario')}</ThemedText>
                {member.bio ? <ThemedText style={[styles.memberBio, { color: colors.textSecondary }]} numberOfLines={1}>{member.bio}</ThemedText> : null}
            </View>
            {roleLabel && <ThemedText style={[styles.roleLabel, { color: colors.textSecondary }]}>{roleLabel}</ThemedText>}
            {!isSelf && <ChevronRight size={16} color={colors.border} />}
        </TouchableOpacity>
    );
}

export default function ChannelInfoScreen() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const { colors, theme } = useTheme();
    const { role: userRole, subrole } = useCurrentUser();
    const { channel, members, loading, isMuted, muteUntil } = useChannelInfo(id || '');

    const [updating, setUpdating] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showMuteModal, setShowMuteModal] = useState(false);
    const [showMemberSearch, setShowMemberSearch] = useState(false);
    const [memberFilter, setMemberFilter] = useState('');

    const isSG = id?.startsWith('sg_');
    const realId = isSG ? id!.replace('sg_', '') : id!;
    const colName = isSG ? 'studyGroups' : 'channels';
    const currentUser = auth.currentUser;
    const canEdit = userRole === 'admin' || subrole === 'coordinator' || channel?.createdBy === currentUser?.uid;

    const filteredMembers = memberFilter
        ? members.filter(m => m.displayName?.toLowerCase().includes(memberFilter.toLowerCase()))
        : members;

    const creatorMember = members.find(m => m.id === channel?.createdBy);

    const handleUpdateImage = async () => {
        if (!canEdit) return;
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') return;
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true, aspect: [1, 1], quality: 0.7,
            });
            if (!result.canceled) {
                setUpdating(true);
                const url = await uploadGroupPhoto(result.assets[0].uri, realId);
                await setDoc(doc(db, colName, realId), { photoURL: url }, { merge: true });
            }
        } catch (e) { console.error(e); Alert.alert('Error', 'No se pudo subir la imagen.'); }
        finally { setUpdating(false); }
    };

    const handleMute = async (hours: number) => {
        if (!currentUser || !realId) return;
        const until = new Date(Date.now() + hours * 60 * 60 * 1000);
        await setDoc(doc(db, colName, realId, 'members', currentUser.uid), { notifications: false, muteUntil: until }, { merge: true });
        setShowMuteModal(false);
    };

    const handleUnmute = async () => {
        if (!currentUser || !realId) return;
        await setDoc(doc(db, colName, realId, 'members', currentUser.uid), { notifications: true, muteUntil: null }, { merge: true });
        setShowMuteModal(false);
    };

    const handleAddMember = async (user: any) => {
        if (!realId) return;
        try {
            await setDoc(doc(db, colName, realId), { memberIds: arrayUnion(user.id), memberCount: increment(1) }, { merge: true });
            await setDoc(doc(db, colName, realId, 'members', user.id), {
                userId: user.id, role: 'member', joinedAt: serverTimestamp(), notifications: true,
            });
            Alert.alert('Éxito', `${user.displayName} añadido.`);
        } catch (e) { console.error(e); }
    };

    const handleRemoveMember = async (member: any) => {
        if (!realId) return;
        try {
            await updateDoc(doc(db, colName, realId), {
                memberIds: arrayRemove(member.id), memberCount: increment(-1),
            });
            await deleteDoc(doc(db, colName, realId, 'members', member.id));
        } catch (e) { console.error(e); }
    };

    const handleClearChat = () => {
        const buttons: any[] = [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Eliminar para mí', onPress: async () => {
                    if (!currentUser || !realId) return;
                    setUpdating(true);
                    try {
                        const snap = await getDocs(query(collection(db, colName, realId, 'messages'), firestoreLimit(200)));
                        if (!snap.empty) {
                            const batch = writeBatch(db);
                            snap.docs.forEach(d => batch.update(d.ref, { deletedForUsers: arrayUnion(currentUser.uid) }));
                            await batch.commit();
                        }
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                }
            },
        ];
        if (userRole === 'admin') {
            buttons.push({
                text: 'Eliminar para todos', style: 'destructive', onPress: async () => {
                    if (!realId) return;
                    setUpdating(true);
                    try {
                        const snap = await getDocs(query(collection(db, colName, realId, 'messages'), firestoreLimit(200)));
                        if (!snap.empty) {
                            const batch = writeBatch(db);
                            snap.docs.forEach(d => batch.delete(d.ref));
                            await batch.commit();
                        }
                    } catch (e) { console.error(e); }
                    setUpdating(false);
                }
            });
        }
        Alert.alert('Vaciar chat', '¿Cómo quieres vaciar el chat?', buttons);
    };

    const handleLeave = () => {
        Alert.alert('Salir del grupo', '¿Seguro que quieres abandonar este grupo?', [
            { text: 'Cancelar', style: 'cancel' },
            {
                text: 'Salir', style: 'destructive', onPress: async () => {
                    if (!currentUser || !realId) return;
                    await updateDoc(doc(db, colName, realId), { memberIds: arrayRemove(currentUser.uid), memberCount: increment(-1) });
                    await deleteDoc(doc(db, colName, realId, 'members', currentUser.uid));
                    router.replace('/(tabs)');
                }
            }
        ]);
    };

    if (loading || updating) {
        return (
            <ThemedView style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ThemedView>
        );
    }

    const createdAt = channel?.createdAt?.toDate?.();
    const createdAtStr = createdAt
        ? createdAt.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : null;

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <Stack.Screen options={{ headerShown: false }} />
            <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

            <View style={[styles.navbar, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.navIcon}>
                    <ChevronLeft size={28} color={colors.text} />
                </TouchableOpacity>
                <ThemedText style={styles.navTitle} numberOfLines={1}>
                    {channel?.name || (isSG ? 'Grupo' : 'Canal')}
                </ThemedText>
                <View style={{ width: 44 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.hero}>
                    <TouchableOpacity activeOpacity={canEdit ? 0.7 : 1} onPress={handleUpdateImage} style={styles.heroImgWrap}>
                        {channel?.photoURL ? (
                            <Image source={{ uri: channel.photoURL }} style={styles.heroImg} />
                        ) : (
                            <View style={[styles.heroImgPlaceholder, { backgroundColor: colors.primary + '22' }]}>
                                <ThemedText style={[styles.heroInitial, { color: colors.primary }]}>
                                    {channel?.name?.[0]?.toUpperCase() || '?'}
                                </ThemedText>
                            </View>
                        )}
                        {canEdit && (
                            <View style={[styles.editBadge, { backgroundColor: colors.primary }]}>
                                <Edit3 size={13} color="#fff" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <ThemedText style={styles.heroName}>{channel?.name}</ThemedText>
                    <ThemedText style={[styles.heroSub, { color: colors.textSecondary }]}>
                        {isSG ? 'Grupo de Estudio' : 'Canal del Campus'} • {members.length} {members.length === 1 ? 'miembro' : 'miembros'}
                    </ThemedText>
                    {channel?.description ? (
                        <ThemedText style={[styles.heroDesc, { color: colors.textSecondary }]}>{channel.description}</ThemedText>
                    ) : null}
                </View>

                <View style={styles.sectionHeader}>
                    <ThemedText style={[styles.sectionCount, { color: colors.textSecondary }]}>
                        {members.length} {members.length === 1 ? 'MIEMBRO' : 'MIEMBROS'}
                    </ThemedText>
                    <TouchableOpacity
                        onPress={() => { setShowMemberSearch(!showMemberSearch); setMemberFilter(''); }}
                        style={styles.searchIconBtn}
                    >
                        <Search size={18} color={showMemberSearch ? colors.primary : colors.textSecondary} />
                    </TouchableOpacity>
                </View>

                {showMemberSearch && (
                    <View style={[styles.memberSearchWrap, { backgroundColor: colors.backgroundSecondary }]}>
                        <Search size={14} color={colors.textSecondary} />
                        <TextInput
                            style={[styles.memberSearchInput, { color: colors.text }]}
                            placeholder="Buscar miembro..."
                            placeholderTextColor={colors.textSecondary}
                            value={memberFilter}
                            onChangeText={setMemberFilter}
                            autoFocus
                        />
                    </View>
                )}

                <View style={[styles.card, { backgroundColor: colors.card }]}>
                    {canEdit && (
                        <>
                            <TouchableOpacity style={styles.addRow} onPress={() => setShowAddModal(true)} activeOpacity={0.7}>
                                <View style={[styles.addIconWrap, { backgroundColor: colors.primary + '18' }]}>
                                    <UserPlus size={20} color={colors.primary} />
                                </View>
                                <ThemedText style={[styles.addLabel, { color: colors.primary }]}>Añadir miembros</ThemedText>
                            </TouchableOpacity>
                            <View style={[styles.divider, { backgroundColor: colors.border }]} />
                        </>
                    )}
                    {filteredMembers.map((m, idx) => (
                        <React.Fragment key={m.id}>
                            <MemberRow
                                member={m}
                                isCreator={m.id === channel?.createdBy}
                                isSelf={m.id === currentUser?.uid}
                                canRemove={canEdit && m.id !== channel?.createdBy && m.id !== currentUser?.uid}
                                onPress={() => m.id !== currentUser?.uid && router.push(`/dm/${m.id}` as any)}
                                onRemove={() => handleRemoveMember(m)}
                            />
                            {idx < filteredMembers.length - 1 && (
                                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                            )}
                        </React.Fragment>
                    ))}
                </View>

                <View style={[styles.card, { backgroundColor: colors.card, marginTop: 16 }]}>
                    <TouchableOpacity style={styles.actionRow} onPress={() => setShowMuteModal(true)}>
                        {isMuted
                            ? <BellOff size={20} color={colors.textSecondary} />
                            : <Bell size={20} color={colors.textSecondary} />}
                        <ThemedText style={[styles.actionLabel, { color: colors.text }]}>
                            {isMuted ? 'Silenciado' : 'Silenciar notificaciones'}
                        </ThemedText>
                    </TouchableOpacity>
                    <View style={[styles.divider, { backgroundColor: colors.border }]} />
                    <TouchableOpacity style={styles.actionRow} onPress={handleClearChat}>
                        <Trash2 size={20} color={colors.danger} />
                        <ThemedText style={[styles.actionLabel, { color: colors.danger }]}>Vaciar chat</ThemedText>
                    </TouchableOpacity>
                </View>

                <View style={[styles.card, { backgroundColor: colors.card, marginTop: 8 }]}>
                    <TouchableOpacity style={styles.actionRow} onPress={handleLeave}>
                        <LogOut size={20} color={colors.danger} />
                        <ThemedText style={[styles.actionLabel, { color: colors.danger }]}>Salir del grupo</ThemedText>
                    </TouchableOpacity>
                </View>

                {createdAtStr && (
                    <View style={styles.footer}>
                        {creatorMember && (
                            <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
                                Creado por {creatorMember.id === currentUser?.uid ? 'ti' : creatorMember.displayName}.
                            </ThemedText>
                        )}
                        <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
                            Creado el {createdAtStr}.
                        </ThemedText>
                    </View>
                )}
            </ScrollView>

            <MuteModal
                visible={showMuteModal}
                isMuted={isMuted}
                muteUntil={muteUntil}
                onClose={() => setShowMuteModal(false)}
                onMute={handleMute}
                onUnmute={handleUnmute}
            />
            <AddMembersModal
                visible={showAddModal}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddMember}
                existingMemberIds={members.map(m => m.id)}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    navbar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 8, height: 56, borderBottomWidth: StyleSheet.hairlineWidth,
    },
    navIcon: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    navTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
    hero: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: spacing.md },
    heroImgWrap: { width: 96, height: 96, borderRadius: 48, position: 'relative', marginBottom: 12 },
    heroImg: { width: 96, height: 96, borderRadius: 48 },
    heroImgPlaceholder: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
    heroInitial: { fontSize: 38, fontWeight: 'bold' },
    editBadge: {
        position: 'absolute', right: 0, bottom: 0,
        width: 28, height: 28, borderRadius: 14,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: '#fff',
    },
    heroName: { fontSize: 22, fontWeight: '700', textAlign: 'center' },
    heroSub: { fontSize: 13, marginTop: 4, textAlign: 'center' },
    heroDesc: { fontSize: 14, marginTop: 8, textAlign: 'center', lineHeight: 20 },
    sectionHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginHorizontal: spacing.md, marginTop: 20, marginBottom: 6,
    },
    sectionCount: { fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
    searchIconBtn: { padding: 4 },
    memberSearchWrap: {
        flexDirection: 'row', alignItems: 'center',
        marginHorizontal: spacing.md, marginBottom: 8,
        paddingHorizontal: 12, height: 38, borderRadius: 10, gap: 8,
    },
    memberSearchInput: { flex: 1, fontSize: 14 },
    card: { marginHorizontal: spacing.md, borderRadius: 16, overflow: 'hidden' },
    addRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, gap: 14 },
    addIconWrap: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
    addLabel: { fontSize: 16, fontWeight: '600' },
    memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: spacing.md },
    memberAvatarWrap: { width: 46, height: 46 },
    memberAvatarImg: { width: 46, height: 46, borderRadius: 23 },
    memberAvatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center' },
    memberName: { fontSize: 15, fontWeight: '600' },
    memberBio: { fontSize: 12, marginTop: 1 },
    roleLabel: { fontSize: 13, marginRight: 4 },
    divider: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md + 46 + 12 },
    actionRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md, gap: 16 },
    actionLabel: { fontSize: 16, fontWeight: '500' },
    footer: { marginTop: 16, paddingHorizontal: spacing.lg, gap: 2 },
    footerText: { fontSize: 13 },
});
