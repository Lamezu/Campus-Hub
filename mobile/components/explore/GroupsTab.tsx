import React, { useState, useMemo, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Modal, ScrollView, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, StyleSheet, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, X, Search, Check, ChevronLeft, Globe, Lock, User as UserIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { useStudyGroups } from '../../hooks/explore/useStudyGroups';
import { useCurrentUser } from '../../contexts/UserContext';
import { ThemedText } from '../themed-text';
import { GroupCard } from './GroupCard';
import { spacing, typography } from '../../constants/styles';
import { auth } from '../../config/firebase';
import type { StudyGroup, UserRole } from '../../types';

const GROUP_CATEGORIES = ['subjects', 'departments', 'cycles'] as const;
type GroupCategory = typeof GROUP_CATEGORIES[number];

const GROUP_SUBJECTS_MAP: Record<GroupCategory, string[]> = {
    subjects: [
        'math', 'physics', 'chemistry', 'history', 'english', 'french',
        'philosophy', 'economy', 'technology', 'programming', 'other'
    ],
    departments: [
        'hospitality', 'health', 'it_comms', 'sports', 'admin_mgmt',
        'social_services', 'energy_water', 'wood_furniture', 'security_env',
        'languages', 'fol', 'counseling', 'innovation'
    ],
    cycles: [
        'asir', 'dam', 'daw', 'smr', 'tseas', 'tcae', 'emergencies',
        'hygiene', 'childhood_ed', 'social_care', 'admin_mgmt_cycle',
        'finance_insurance', 'tourist_guide', 'other'
    ]
};

const ROLE_OPTIONS: Array<{ label: string; desc: string; value: UserRole[] }> = [
    { label: 'Todos', desc: 'Cualquier usuario puede unirse', value: [] },
    { label: 'Solo profesores', desc: 'Profesores y coordinadores', value: ['teacher'] },
    { label: 'Solo alumnos', desc: 'Estudiantes y delegados', value: ['student'] },
    { label: 'Solo administradores', desc: 'Equipo directivo', value: ['admin'] },
];

const GROUP_COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5AC8FA', '#FF2D55', '#FFCC00'];

interface GroupsTabProps {
    canCreate: boolean;
}

export function GroupsTab({ canCreate }: GroupsTabProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const currentUser = auth.currentUser;
    const { isAdmin } = useCurrentUser();
    const { groups, allUsers, loadingUsers, joinGroup, leaveGroup, createGroup, updateGroup, deleteGroup, loadUsers } = useStudyGroups();

    const [showCreate, setShowCreate] = useState(false);
    const [step, setStep] = useState(0);
    const [form, setForm] = useState({
        name: '',
        description: '',
        subject: GROUP_SUBJECTS_MAP.subjects[0],
        color: GROUP_COLORS[0],
        isPrivate: false,
        allowedRoles: [] as string[],
        invitedUserIds: [] as string[]
    });

    const [editingGroup, setEditingGroup] = useState<StudyGroup | null>(null);
    const [editForm, setEditForm] = useState({ name: '', description: '', subject: GROUP_SUBJECTS_MAP.subjects[0], color: GROUP_COLORS[0] });
    const [editTab, setEditTab] = useState<'info' | 'members'>('info');
    const [editMembers, setEditMembers] = useState<string[]>([]);
    const [memberSearch, setMemberSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [groupSearch, setGroupSearch] = useState('');
    const [subjectCategory, setSubjectCategory] = useState<GroupCategory>('subjects');

    const filteredUsers = useMemo(() => {
        const q = userSearch.trim().toLowerCase();
        if (!q) return allUsers;
        return allUsers.filter(u =>
            u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
        );
    }, [allUsers, userSearch]);

    const filteredMemberSearch = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        return allUsers.filter(u =>
            (u.displayName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        );
    }, [allUsers, memberSearch]);

    const filteredGroups = useMemo(() => {
        const q = groupSearch.trim().toLowerCase();
        if (!q) return groups;
        return groups.filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.subject.toLowerCase().includes(q) ||
            g.description?.toLowerCase().includes(q)
        );
    }, [groups, groupSearch]);

    const STEPS = [
        t('explore.groups.steps.name') || 'Nombre',
        t('explore.groups.steps.subject') || 'Asignatura',
        t('explore.groups.steps.color') || 'Color',
        t('explore.groups.steps.access') || 'Acceso',
        t('explore.groups.steps.invite') || 'Invitar'
    ];

    const handleCreateSubmit = async () => {
        if (!form.name.trim() || !currentUser) return;
        await createGroup(form);
        setForm({
            name: '',
            description: '',
            subject: GROUP_SUBJECTS_MAP.subjects[0],
            color: GROUP_COLORS[0],
            isPrivate: false,
            allowedRoles: [],
            invitedUserIds: []
        });
        setStep(0);
        setUserSearch('');
        setShowCreate(false);
    };

    const openEdit = (group: StudyGroup) => {
        setEditingGroup(group);
        setEditForm({ name: group.name, description: group.description, subject: group.subject, color: group.color });
        setEditMembers([...group.memberIds]);
        setEditTab('info');
        loadUsers();
    };

    const handleSaveEdit = async () => {
        if (!editingGroup || !editForm.name.trim()) return;
        await updateGroup(editingGroup.id, {
            ...editForm,
            memberIds: editMembers,
            memberCount: editMembers.length
        });
        setEditingGroup(null);
    };

    return (
        <View style={{ flex: 1 }}>
            <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder={t('explore.groups.search_placeholder') || 'Buscar grupos...'}
                    placeholderTextColor={colors.textSecondary}
                    value={groupSearch}
                    onChangeText={setGroupSearch}
                />
            </View>

            {canCreate && (
                <TouchableOpacity
                    style={[styles.createBtn, { backgroundColor: colors.primary }]}
                    onPress={() => {
                        loadUsers();
                        setShowCreate(true);
                    }}
                >
                    <Plus size={18} color="#fff" strokeWidth={2.5} />
                    <ThemedText style={styles.createBtnText}>{t('explore.groups.create_btn') || 'Crear grupo de estudio'}</ThemedText>
                </TouchableOpacity>
            )}

            <FlatList
                data={filteredGroups}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                    const canManage = isAdmin || item.createdBy === currentUser?.uid;
                    return (
                        <GroupCard
                            group={item}
                            userId={currentUser?.uid ?? ''}
                            onJoin={() => joinGroup(item.id)}
                            onLeave={() => leaveGroup(item.id)}
                            onNavigate={() => router.push(`/chat/sg_${item.id}` as never)}
                            onEdit={canManage ? () => openEdit(item) : undefined}
                            onDelete={canManage ? () => deleteGroup(item.id) : undefined}
                        />
                    );
                }}
                contentContainerStyle={[styles.listPad, { paddingBottom: insets.bottom + spacing.md }]}
                ListEmptyComponent={
                    <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {groupSearch ? (t('explore.groups.no_results') || 'No se encontraron grupos.') : (t('explore.groups.no_groups') || 'No hay grupos aún.')}
                    </ThemedText>
                }
            />

            <Modal visible={!!editingGroup} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditingGroup(null)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top']}>
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <TouchableOpacity onPress={() => setEditingGroup(null)}>
                                <X size={22} color={colors.text} strokeWidth={2} />
                            </TouchableOpacity>
                            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('explore.groups.edit_title') || 'Editar grupo'}</ThemedText>
                            <TouchableOpacity onPress={handleSaveEdit} disabled={!editForm.name.trim()}>
                                <ThemedText style={[styles.modalAction, { color: editForm.name.trim() ? colors.primary : colors.textSecondary }]}>{t('common.save') || 'Guardar'}</ThemedText>
                            </TouchableOpacity>
                        </View>

                        <View style={[styles.editTabBar, { borderBottomColor: colors.border }]}>
                            {(['info', 'members'] as const).map(t_id => {
                                const label = t_id === 'info' ? (t('explore.groups.tabs.info') || 'Información') : `${t('explore.groups.tabs.members') || 'Miembros'} (${editMembers.length})`;
                                return (
                                    <TouchableOpacity key={t_id} style={styles.editTabItem} onPress={() => setEditTab(t_id)} activeOpacity={0.7}>
                                        <ThemedText style={[styles.editTabLabel, { color: editTab === t_id ? colors.primary : colors.textSecondary }]}>{label}</ThemedText>
                                        {editTab === t_id && <View style={[styles.tabUnderline, { backgroundColor: colors.primary }]} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {editTab === 'info' ? (
                            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
                                <TextInput style={[styles.modalInput, styles.titleInput, { color: colors.text, borderBottomColor: colors.border }]} placeholder={t('explore.groups.placeholders.name') || 'Nombre del grupo'} placeholderTextColor={colors.textSecondary} value={editForm.name} onChangeText={t => setEditForm(f => ({ ...f, name: t }))} />
                                <TextInput style={[styles.modalInput, { color: colors.text, minHeight: 80 }]} placeholder={t('explore.groups.placeholders.desc') || 'Descripción (opcional)'} placeholderTextColor={colors.textSecondary} value={editForm.description} onChangeText={t => setEditForm(f => ({ ...f, description: t }))} multiline />

                                <View style={styles.sectionHeader}>
                                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('explore.groups.subject_category') || 'Asignatura / Categoría'}</ThemedText>
                                </View>
                                <View style={styles.categoryTabs}>
                                    {GROUP_CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.categoryTab, { borderColor: subjectCategory === cat ? colors.primary : colors.border, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent' }]}
                                            onPress={() => setSubjectCategory(cat)}
                                        >
                                            <ThemedText style={[styles.categoryTabText, { color: subjectCategory === cat ? colors.primary : colors.textSecondary }]}>
                                                {t(`explore.groups.categories.${cat}`)}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <View style={styles.subjectGrid}>
                                    {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                                        <TouchableOpacity key={s} style={[styles.subjectChip, { borderColor: editForm.subject === s ? colors.primary : colors.border, backgroundColor: editForm.subject === s ? colors.primary + '15' : 'transparent' }]} onPress={() => setEditForm(f => ({ ...f, subject: s }))}>
                                            <ThemedText style={[styles.subjectChipText, { color: editForm.subject === s ? colors.primary : colors.text }]}>
                                                {t(`explore.groups.subjects_list.${s}`) || s}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={styles.sectionHeader}>
                                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('explore.groups.group_color') || 'Color identificativo'}</ThemedText>
                                </View>
                                <View style={styles.colorGrid}>
                                    {GROUP_COLORS.map(c => (
                                        <TouchableOpacity key={c} style={[styles.colorBubble, { backgroundColor: c, borderColor: editForm.color === c ? colors.text : 'transparent', borderWidth: 3 }]} onPress={() => setEditForm(f => ({ ...f, color: c }))} />
                                    ))}
                                </View>
                            </ScrollView>
                        ) : (
                            <View style={{ flex: 1 }}>
                                <View style={styles.memberSearchWrap}>
                                    <View style={[styles.searchBarInline, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                                        <Search size={16} color={colors.textSecondary} />
                                        <TextInput
                                            style={[styles.searchInputInline, { color: colors.text }]}
                                            placeholder={t('explore.groups.placeholders.search_users') || 'Buscar personas...'}
                                            value={memberSearch}
                                            onChangeText={setMemberSearch}
                                        />
                                    </View>
                                </View>
                                <FlatList
                                    data={filteredMemberSearch}
                                    keyExtractor={u => u.uid}
                                    renderItem={({ item }) => {
                                        const isMember = editMembers.includes(item.uid);
                                        const isOwner = item.uid === editingGroup?.createdBy;
                                        return (
                                            <View style={[styles.memberRow, { borderBottomColor: colors.border }]}>
                                                <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                                                    {item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.avatarImg} /> : <UserIcon size={16} color={colors.primary} />}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={[styles.memberName, { color: colors.text }]}>{item.displayName}</ThemedText>
                                                    <ThemedText style={[styles.memberRole, { color: colors.textSecondary }]}>{item.role}{isOwner ? ` (${t('explore.groups.actions.creator') || 'Creador'})` : ''}</ThemedText>
                                                </View>
                                                {!isOwner && (
                                                    <TouchableOpacity
                                                        onPress={() => setEditMembers(prev => isMember ? prev.filter(id => id !== item.uid) : [...prev, item.uid])}
                                                        style={[styles.memberActionBtn, { backgroundColor: isMember ? '#FF3B30' + '15' : colors.primary + '15' }]}
                                                    >
                                                        <ThemedText style={{ color: isMember ? '#FF3B30' : colors.primary, fontWeight: '600', fontSize: 13 }}>
                                                            {isMember ? (t('explore.groups.actions.remove') || 'Eliminar') : (t('explore.groups.actions.add') || 'Añadir')}
                                                        </ThemedText>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    }}
                                />
                            </View>
                        )}
                    </SafeAreaView>
                </KeyboardAvoidingView>
            </Modal>

            <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCreate(false)}>
                <SafeAreaView style={[styles.modalSafe, { backgroundColor: colors.background }]} edges={['top']}>
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <TouchableOpacity onPress={() => step > 0 ? setStep(s => s - 1) : setShowCreate(false)}>
                            {step > 0 ? <ChevronLeft size={24} color={colors.text} /> : <X size={22} color={colors.text} />}
                        </TouchableOpacity>
                        <View style={styles.wizardProgress}>
                            {STEPS.map((_, i) => (
                                <View key={i} style={[styles.progressDot, { backgroundColor: i <= step ? colors.primary : colors.border }]} />
                            ))}
                        </View>
                        <TouchableOpacity onPress={step === STEPS.length - 1 ? handleCreateSubmit : () => setStep(s => s + 1)} disabled={step === 0 && !form.name.trim()}>
                            <ThemedText style={[styles.modalAction, { color: (step === 0 && !form.name.trim()) ? colors.textSecondary : colors.primary }]}>
                                {step === STEPS.length - 1 ? (t('explore.groups.create_btn') || 'Crear') : (t('common.next') || 'Siguiente')}
                            </ThemedText>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.wizardBody}>
                        <ThemedText style={[styles.wizardTitle, { color: colors.text }]}>{STEPS[step]}</ThemedText>

                        {step === 0 && (
                            <View style={styles.stepContent}>
                                <ThemedText style={[styles.stepHint, { color: colors.textSecondary }]}>{t('explore.groups.placeholders.name_hint') || 'Escribe un nombre claro para que otros alumnos lo identifiquen.'}</ThemedText>
                                <TextInput
                                    autoFocus
                                    style={[styles.wizardInput, { color: colors.text, borderBottomColor: colors.primary }]}
                                    placeholder={t('explore.groups.placeholders.name') || 'Nombre del grupo'}
                                    placeholderTextColor={colors.textSecondary}
                                    value={form.name}
                                    onChangeText={t => setForm(f => ({ ...f, name: t }))}
                                />
                                <TextInput
                                    style={[styles.wizardInput, { color: colors.text, borderBottomColor: colors.border, fontSize: 16, marginTop: spacing.md }]}
                                    placeholder={t('explore.groups.placeholders.desc') || 'Descripción (opcional)'}
                                    placeholderTextColor={colors.textSecondary}
                                    value={form.description}
                                    onChangeText={t => setForm(f => ({ ...f, description: t }))}
                                    multiline
                                />
                            </View>
                        )}

                        {step === 1 && (
                            <View style={styles.stepContent}>
                                <View style={styles.categoryTabs}>
                                    {GROUP_CATEGORIES.map(cat => (
                                        <TouchableOpacity
                                            key={cat}
                                            style={[styles.categoryTab, { borderColor: subjectCategory === cat ? colors.primary : colors.border, backgroundColor: subjectCategory === cat ? colors.primary + '10' : 'transparent' }]}
                                            onPress={() => setSubjectCategory(cat)}
                                        >
                                            <ThemedText style={[styles.categoryTabText, { color: subjectCategory === cat ? colors.primary : colors.textSecondary }]}>
                                                {t(`explore.groups.categories.${cat}`)}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <ScrollView showsVerticalScrollIndicator={false}>
                                    <View style={styles.subjectGrid}>
                                        {GROUP_SUBJECTS_MAP[subjectCategory].map(s => (
                                            <TouchableOpacity key={s} style={[styles.subjectChipLarge, { borderColor: form.subject === s ? colors.primary : colors.border, backgroundColor: form.subject === s ? colors.primary + '10' : 'transparent' }]} onPress={() => setForm(f => ({ ...f, subject: s }))}>
                                                <ThemedText style={[styles.subjectChipTextLarge, { color: form.subject === s ? colors.primary : colors.text }]}>{t(`explore.groups.subjects_list.${s}`) || s}</ThemedText>
                                                {form.subject === s && <Check size={16} color={colors.primary} strokeWidth={3} />}
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        {step === 2 && (
                            <View style={styles.stepContent}>
                                <View style={styles.colorGridLarge}>
                                    {GROUP_COLORS.map(c => (
                                        <TouchableOpacity key={c} style={[styles.colorOption, { backgroundColor: c, borderColor: form.color === c ? colors.text : 'transparent', borderWidth: 4 }]} onPress={() => setForm(f => ({ ...f, color: c }))}>
                                            {form.color === c && <Check size={24} color="#fff" strokeWidth={3} />}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        )}

                        {step === 3 && (
                            <ScrollView showsVerticalScrollIndicator={false} style={styles.stepContent}>
                                <TouchableOpacity style={[styles.accessOption, { borderColor: !form.isPrivate ? colors.primary : colors.border, backgroundColor: !form.isPrivate ? colors.primary + '08' : 'transparent' }]} onPress={() => setForm(f => ({ ...f, isPrivate: false }))}>
                                    <View style={[styles.accessIcon, { backgroundColor: !form.isPrivate ? colors.primary : colors.border + '44' }]}><Globe size={20} color={!form.isPrivate ? '#fff' : colors.textSecondary} /></View>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText style={styles.accessLabel}>{t('explore.groups.access_public') || 'Público'}</ThemedText>
                                        <ThemedText style={[styles.accessDesc, { color: colors.textSecondary }]}>{t('explore.groups.access_public_desc') || 'Cualquier usuario que cumpla los requisitos de rol podrá verlo y unirse.'}</ThemedText>
                                    </View>
                                    {!form.isPrivate && <Check size={20} color={colors.primary} strokeWidth={3} />}
                                </TouchableOpacity>

                                <TouchableOpacity style={[styles.accessOption, { borderColor: form.isPrivate ? colors.primary : colors.border, backgroundColor: form.isPrivate ? colors.primary + '08' : 'transparent' }]} onPress={() => setForm(f => ({ ...f, isPrivate: true }))}>
                                    <View style={[styles.accessIcon, { backgroundColor: form.isPrivate ? colors.primary : colors.border + '44' }]}><Lock size={20} color={form.isPrivate ? '#fff' : colors.textSecondary} /></View>
                                    <View style={{ flex: 1 }}>
                                        <ThemedText style={styles.accessLabel}>{t('explore.groups.access_private') || 'Privado'}</ThemedText>
                                        <ThemedText style={[styles.accessDesc, { color: colors.textSecondary }]}>{t('explore.groups.access_private_desc') || 'Solo los usuarios invitados podrán ver y acceder a este grupo.'}</ThemedText>
                                    </View>
                                    {form.isPrivate && <Check size={20} color={colors.primary} strokeWidth={3} />}
                                </TouchableOpacity>

                                <ThemedText style={[styles.sectionTitle, { color: colors.text, marginTop: spacing.lg, marginBottom: spacing.md }]}>{t('explore.groups.who_can_join') || '¿Quién puede unirse?'}</ThemedText>
                                {ROLE_OPTIONS.map(opt => {
                                    const isSelected = JSON.stringify(form.allowedRoles) === JSON.stringify(opt.value);
                                    const optLabel = opt.value.length === 0 ? (t('explore.groups.roles.everyone') || 'Todos') :
                                        opt.value.includes('teacher') ? (t('explore.groups.roles.teachers_only') || 'Solo profesores') :
                                            opt.value.includes('student') ? (t('explore.groups.roles.students_only') || 'Solo alumnos') :
                                                (t('explore.groups.roles.admins_only') || 'Solo administradores');

                                    const optDesc = opt.value.length === 0 ? (t('explore.groups.roles.everyone_desc') || 'Cualquier usuario puede unirse') :
                                        opt.value.includes('teacher') ? (t('explore.groups.roles.teachers_only_desc') || 'Profesores y coordinadores') :
                                            opt.value.includes('student') ? (t('explore.groups.roles.students_only_desc') || 'Estudiantes y delegados') :
                                                (t('explore.groups.roles.admins_only_desc') || 'Equipo directivo');

                                    return (
                                        <TouchableOpacity key={opt.label} style={[styles.roleOption, { borderBottomColor: colors.border }]} onPress={() => setForm(f => ({ ...f, allowedRoles: opt.value }))}>
                                            <View style={{ flex: 1 }}>
                                                <ThemedText style={[styles.roleLabel, { color: isSelected ? colors.primary : colors.text }]}>{optLabel}</ThemedText>
                                                <ThemedText style={[styles.roleDesc, { color: colors.textSecondary }]}>{optDesc}</ThemedText>
                                            </View>
                                            {isSelected && <Check size={18} color={colors.primary} strokeWidth={3} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}

                        {step === 4 && (
                            <View style={{ flex: 1 }}>
                                <View style={[styles.searchBarInline, { marginHorizontal: spacing.md, marginBottom: spacing.sm, backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                                    <Search size={16} color={colors.textSecondary} />
                                    <TextInput style={[styles.searchInputInline, { color: colors.text }]} placeholder={t('explore.groups.placeholders.search_users') || 'Buscar por nombre o email...'} value={userSearch} onChangeText={setUserSearch} />
                                </View>
                                <FlatList
                                    data={filteredUsers}
                                    keyExtractor={u => u.uid}
                                    renderItem={({ item }) => {
                                        const isInvited = form.invitedUserIds.includes(item.uid);
                                        return (
                                            <TouchableOpacity
                                                style={[styles.userRow, { borderBottomColor: colors.border }]}
                                                onPress={() => setForm(f => ({ ...f, invitedUserIds: isInvited ? f.invitedUserIds.filter(id => id !== item.uid) : [...f.invitedUserIds, item.uid] }))}
                                            >
                                                <View style={[styles.memberAvatar, { backgroundColor: colors.primary + '20' }]}>
                                                    {item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.avatarImg} /> : <UserIcon size={16} color={colors.primary} />}
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <ThemedText style={[styles.memberName, { color: colors.text }]}>{item.displayName}</ThemedText>
                                                    <ThemedText style={[styles.memberRole, { color: colors.textSecondary }]}>{t(`roles.${item.role}`) || item.role}</ThemedText>
                                                </View>
                                                <View style={[styles.checkCircle, { borderColor: isInvited ? colors.primary : colors.border, backgroundColor: isInvited ? colors.primary : 'transparent' }]}>
                                                    {isInvited && <Check size={14} color="#fff" strokeWidth={3} />}
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    }}
                                    ListEmptyComponent={loadingUsers ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.primary} /> : <ThemedText style={styles.emptyText}>{t('explore.groups.no_results') || 'No se encontraron usuarios'}</ThemedText>}
                                />
                            </View>
                        )}
                    </View>
                </SafeAreaView>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    searchBar: { flexDirection: 'row', alignItems: 'center', margin: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
    searchInput: { flex: 1, fontSize: 16, padding: 0 },
    createBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, marginHorizontal: spacing.md, marginBottom: spacing.md, paddingVertical: 14, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
    createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    listPad: { paddingHorizontal: spacing.md, paddingBottom: spacing.xl, gap: spacing.sm },
    emptyText: { textAlign: 'center', marginTop: 40, fontSize: 15, opacity: 0.6 },
    modalSafe: { flex: 1 },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
    modalTitle: { fontSize: 17, fontWeight: '700' },
    modalAction: { fontSize: 16, fontWeight: '600' },
    wizardProgress: { flexDirection: 'row', gap: 6 },
    progressDot: { width: 8, height: 8, borderRadius: 4 },
    wizardBody: { flex: 1, paddingTop: spacing.lg },
    wizardTitle: { fontSize: 24, fontWeight: '800', marginHorizontal: spacing.md, marginBottom: spacing.lg },
    stepContent: { paddingHorizontal: spacing.md, gap: spacing.md },
    stepHint: { fontSize: 14, lineHeight: 20 },
    wizardInput: { fontSize: 22, fontWeight: '600', paddingVertical: 12, borderBottomWidth: 2 },
    categoryTabs: { flexDirection: 'row', gap: 8, marginBottom: 12, marginHorizontal: spacing.md },
    categoryTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5 },
    categoryTabText: { fontSize: 13, fontWeight: '700' },
    subjectGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: spacing.md },
    subjectChipLarge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '48%', paddingHorizontal: 14, paddingVertical: 16, borderRadius: 16, borderWidth: 1.5, gap: 4 },
    subjectChipTextLarge: { fontSize: 14, fontWeight: '600', flex: 1 },
    colorGridLarge: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center', paddingTop: spacing.xl },
    colorOption: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center' },
    accessOption: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderRadius: 20, borderWidth: 2, marginBottom: 12 },
    accessIcon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    accessLabel: { fontSize: 16, fontWeight: '700' },
    accessDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
    roleOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
    roleLabel: { fontSize: 16, fontWeight: '600' },
    roleDesc: { fontSize: 13, marginTop: 2 },
    userRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    checkCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    editTabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
    editTabItem: { flex: 1, alignItems: 'center', paddingVertical: 16 },
    editTabLabel: { fontSize: 14, fontWeight: '600' },
    tabUnderline: { position: 'absolute', bottom: 0, left: 24, right: 24, height: 3, borderRadius: 1.5 },
    modalBody: { padding: spacing.md, gap: spacing.md },
    modalInput: { fontSize: 16, paddingVertical: 12 },
    titleInput: { fontSize: 20, fontWeight: '700', borderBottomWidth: StyleSheet.hairlineWidth },
    sectionHeader: { marginTop: spacing.md, marginBottom: spacing.xs },
    sectionTitle: { fontSize: 15, fontWeight: '700', opacity: 0.8 },
    subjectChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    subjectChipText: { fontSize: 13, fontWeight: '600' },
    colorGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    colorBubble: { width: 42, height: 42, borderRadius: 21 },
    memberSearchWrap: { padding: spacing.md },
    searchBarInline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, gap: 8 },
    searchInputInline: { flex: 1, fontSize: 15, padding: 0 },
    memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, marginHorizontal: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
    memberAvatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avatarImg: { width: '100%', height: '100%' },
    memberName: { fontSize: 15, fontWeight: '600' },
    memberRole: { fontSize: 12, opacity: 0.6 },
    memberActionBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
});
