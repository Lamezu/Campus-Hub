import React, { useState, useEffect, useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Modal, Alert, ActivityIndicator, Text, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { Stack, router } from 'expo-router';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, orderBy, query } from 'firebase/firestore';
import { Check, ChevronLeft, Search, X, Users } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { spacing, typography } from '@/constants/styles';
import { ROLE_LABELS, SUBROLE_LABELS } from '@/utils/permissions';
import type { User, UserRole, UserSubrole } from '@/types';

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { value: RoleFilter; key: string }[] = [
  { value: 'all', key: 'admin.filters.all' },
  { value: 'student', key: 'admin.filters.students' },
  { value: 'teacher', key: 'admin.filters.teachers' },
  { value: 'admin', key: 'admin.filters.admins' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#34C759',
  teacher: '#007AFF',
  admin: '#FF9500',
};

const SUBROLES_FOR_ROLE: Record<UserRole, (UserSubrole)[]> = {
  student: [null, 'delegate'],
  teacher: [null, 'coordinator'],
  admin: [null],
};

function UserAvatar({ name, size = 48, photoURL }: { name: string; size?: number; photoURL?: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.avatarWrap}>
      <View style={[styles.avatarGlow, { backgroundColor: colors.primary + '15', width: size + 8, height: size + 8, borderRadius: (size + 8) / 2 }]} />
      {photoURL ? (
        <Image
          source={{ uri: photoURL }}
          style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: '#fff' }}
        />
      ) : (
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.primary + '15', borderWidth: 2, borderColor: '#fff' }]}>
          <Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.4 }]}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
    </View>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const { t } = useTranslation();
  const color = ROLE_COLORS[role];
  return (
    <View style={[styles.badge, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <Text style={[styles.badgeText, { color }]}>{t(`roles.${role}`)}</Text>
    </View>
  );
}

function SubroleBadge({ subrole }: { subrole: NonNullable<UserSubrole> }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={[styles.badge, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '15' }]}>
      <Text style={[styles.badgeText, { color: colors.primary }]}>{t(`roles.${subrole}`)}</Text>
    </View>
  );
}

interface EditModalProps {
  user: User | null;
  onClose: () => void;
  onSave: (uid: string, role: UserRole, subrole: UserSubrole) => Promise<void>;
}

function EditRoleModal({ user, onClose, onSave }: EditModalProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole>('student');
  const [selectedSubrole, setSelectedSubrole] = useState<UserSubrole>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setSelectedRole((user.role as any) || 'student');
      setSelectedSubrole(user.subrole ?? null);
    }
  }, [user]);

  if (!user) return null;

  const availableSubroles = SUBROLES_FOR_ROLE[selectedRole] ?? [null];
  const hasSubroles = availableSubroles.some(s => s !== null);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(user.uid, selectedRole, selectedSubrole);
      onClose();
    } catch {
      Alert.alert(t('common.error') || 'Error', t('admin.update_error') || 'Error al actualizar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card + 'F8' }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.text + '20' }]} />

          <View style={styles.sheetHeader}>
            <View>
              <ThemedText style={styles.sheetTitle}>{t('admin.change_role.title') || 'Cambiar Rol'}</ThemedText>
              <ThemedText style={[styles.sheetUser, { color: colors.textSecondary }]}>{user.displayName}</ThemedText>
            </View>
            <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.border + '15' }]}>
              <X size={18} color={colors.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          <ThemedText style={[styles.sheetSection, { color: colors.text }]}>{t('admin.change_role.role_label') || 'Seleccionar Rol'}</ThemedText>
          <View style={styles.optionsWrap}>
            {(['student', 'teacher', 'admin'] as UserRole[]).map(role => (
              <TouchableOpacity
                key={role}
                style={[styles.option, { borderColor: selectedRole === role ? colors.primary : colors.border + '15' }, selectedRole === role && { backgroundColor: colors.primary + '08' }]}
                onPress={() => { setSelectedRole(role); setSelectedSubrole(null); }}
              >
                <View style={styles.optionLeft}>
                  <View style={[styles.roleCircle, { backgroundColor: ROLE_COLORS[role] + '15' }]}>
                    <View style={[styles.roleCircleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                  </View>
                  <ThemedText style={[styles.optionLabel, { color: selectedRole === role ? colors.text : colors.textSecondary }]}>
                    {t(`roles.${role}`)}
                  </ThemedText>
                </View>
                {selectedRole === role && <Check size={18} color={colors.primary} strokeWidth={3} />}
              </TouchableOpacity>
            ))}
          </View>

          {hasSubroles && (
            <>
              <ThemedText style={[styles.sheetSection, { color: colors.text, marginTop: spacing.md }]}>{t('admin.change_role.subrole_label') || 'Sub-rol'}</ThemedText>
              <View style={styles.optionsWrap}>
                {availableSubroles.map(subrole => (
                  <TouchableOpacity
                    key={subrole ?? 'none'}
                    style={[styles.option, { borderColor: selectedSubrole === subrole ? colors.primary : colors.border + '15' }, selectedSubrole === subrole && { backgroundColor: colors.primary + '08' }]}
                    onPress={() => setSelectedSubrole(subrole)}
                  >
                    <ThemedText style={[styles.optionLabel, { color: selectedSubrole === subrole ? colors.text : colors.textSecondary }]}>
                      {subrole ? t(`roles.${subrole}`) : t('roles.none')}
                    </ThemedText>
                    {selectedSubrole === subrole && <Check size={18} color={colors.primary} strokeWidth={3} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.btn, styles.primaryBtn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.btnText, { color: '#fff' }]}>{t('common.save') || 'Guardar Cambios'}</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

async function seedSubrolesIfNeeded() {
  try {
    const snap = await getDoc(doc(db, 'subroles', 'delegate'));
    if (snap.exists()) return;

    await setDoc(doc(db, 'subroles', 'delegate'), {
      id: 'delegate',
      label: 'Delegado/a',
      applicableTo: ['student'],
      extraPermissions: ['createGeneralEvent', 'createStudyGroup'],
    });
    await setDoc(doc(db, 'subroles', 'coordinator'), {
      id: 'coordinator',
      label: 'Coordinador/a',
      applicableTo: ['teacher'],
      extraPermissions: ['createChannel'],
    });

    await setDoc(doc(db, 'roles', 'student'), { subroles: ['delegate'] }, { merge: true });
    await setDoc(doc(db, 'roles', 'teacher'), { subroles: ['coordinator'] }, { merge: true });
    await setDoc(doc(db, 'roles', 'admin'), { subroles: [] }, { merge: true });
  } catch { }
}

export default function AdminUsersScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/(tabs)');
    }
  }, [isAdmin]);

  useEffect(() => {
    seedSubrolesIfNeeded();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    return onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => d.data() as User));
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('AdminUsers Snapshot error:', error);
      }
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(u => {
      const userRole = u.role || 'student';
      const matchesRole = roleFilter === 'all' || userRole === roleFilter;
      const matchesSearch = !q || u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      return matchesRole && matchesSearch;
    });
  }, [users, search, roleFilter]);

  const handleSave = async (uid: string, role: UserRole, subrole: UserSubrole) => {
    await updateDoc(doc(db, 'users', uid), { role, subrole: subrole ?? null });
  };

  const renderUser = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userRow, { backgroundColor: colors.card + '50', borderColor: colors.border + '10' }]}
      onPress={() => setEditingUser(item)}
      activeOpacity={0.7}
    >
      <UserAvatar name={item.displayName} photoURL={item.photoURL} />
      <View style={styles.userInfo}>
        <ThemedText style={styles.userName}>{item.displayName}</ThemedText>
        <ThemedText style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.email}
        </ThemedText>
        <View style={styles.badgeRow}>
          <RoleBadge role={item.role || 'student'} />
          {item.subrole && <SubroleBadge subrole={item.subrole} />}
        </View>
      </View>
      <ChevronLeft size={18} color={colors.textSecondary} style={{ transform: [{ rotate: '180deg' }], opacity: 0.5 }} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border + '15' }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backBtn, { backgroundColor: colors.border + '10' }]}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{t('admin.user_mgmt_title') || 'Gestión de Usuarios'}</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}>
        <Search size={18} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('admin.search_placeholder') || 'Buscar por nombre o correo...'}
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <X size={14} color={colors.card} strokeWidth={3} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={ROLE_FILTERS}
          keyExtractor={f => f.value}
          contentContainerStyle={{ gap: 10, paddingHorizontal: spacing.md }}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                { borderColor: roleFilter === f.value ? colors.primary : colors.border + '10' },
                roleFilter === f.value && { backgroundColor: colors.primary + '15' }
              ]}
              onPress={() => setRoleFilter(f.value)}
            >
              <Text style={[styles.filterText, { color: roleFilter === f.value ? colors.primary : colors.textSecondary }]}>
                {t(f.key)}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={u => u.uid}
            renderItem={renderUser}
            ListEmptyComponent={
              <EmptyState icon={Users} title={search ? t('dm.no_results') : t('admin.no_users')} />
            }
            contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 60 }}
          />
        )
      }

      <EditRoleModal
        user={editingUser}
        onClose={() => setEditingUser(null)}
        onSave={handleSave}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 2 },
  clearBtn: { width: 18, height: 18, borderRadius: 9, backgroundColor: '#999', justifyContent: 'center', alignItems: 'center' },
  filterRow: { marginBottom: spacing.md },
  filterChip: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  filterText: { fontSize: 14, fontWeight: '800' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 16,
    borderRadius: 24,
    borderWidth: 1,
  },
  avatarWrap: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  avatarGlow: { position: 'absolute' },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '900', textAlign: 'center' },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  userEmail: { fontSize: 13, opacity: 0.6 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    padding: spacing.lg,
    paddingBottom: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sheetHandle: { width: 40, height: 5, borderRadius: 2.5, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  sheetTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  sheetUser: { fontSize: 14, fontWeight: '700', opacity: 0.6 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  sheetSection: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    opacity: 0.5,
    marginLeft: 4,
  },
  optionsWrap: { gap: 8, marginBottom: spacing.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionLabel: { fontSize: 16, fontWeight: '700' },
  roleCircle: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  roleCircleDot: { width: 12, height: 12, borderRadius: 6 },
  sheetActions: { marginTop: spacing.lg },
  btn: { width: '100%', paddingVertical: 18, borderRadius: 20, alignItems: 'center' },
  primaryBtn: {
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  btnText: { fontSize: 16, fontWeight: '900' },
});
