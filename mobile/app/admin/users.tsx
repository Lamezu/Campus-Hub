import React, { useState, useEffect, useMemo } from 'react';
import {
  View, FlatList, TouchableOpacity, TextInput, StyleSheet,
  Modal, Alert, ActivityIndicator, Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, orderBy, query } from 'firebase/firestore';
import { Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { db } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { spacing, typography } from '@/constants/styles';
import { ROLE_LABELS, SUBROLE_LABELS } from '@/utils/permissions';
import type { User, UserRole, UserSubrole } from '@/types';

type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'student', label: 'Alumnos' },
  { value: 'teacher', label: 'Profesores' },
  { value: 'admin', label: 'Admins' },
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

function UserAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.backgroundSecondary }]}>
      <Text style={[styles.avatarText, { color: colors.text, fontSize: size * 0.38 }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const color = ROLE_COLORS[role];
  return (
    <View style={[styles.badge, { backgroundColor: color + '20', borderColor: color + '50' }]}>
      <Text style={[styles.badgeText, { color }]}>{ROLE_LABELS[role]}</Text>
    </View>
  );
}

function SubroleBadge({ subrole }: { subrole: NonNullable<UserSubrole> }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>{SUBROLE_LABELS[subrole]}</Text>
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
      Alert.alert('Error', 'No se pudo actualizar el rol');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>Cambiar rol</ThemedText>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ThemedText style={[styles.sheetUser, { color: colors.textSecondary }]}>{user.displayName}</ThemedText>

          <ThemedText style={[styles.sheetSection, { color: colors.text }]}>Rol</ThemedText>
          {(['student', 'teacher', 'admin'] as UserRole[]).map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.option, { borderColor: selectedRole === role ? colors.primary : colors.border }, selectedRole === role && { backgroundColor: colors.primary + '11' }]}
              onPress={() => { setSelectedRole(role); setSelectedSubrole(null); }}
            >
              <View style={styles.optionLeft}>
                <View style={[styles.roleCircle, { backgroundColor: ROLE_COLORS[role] + '30' }]}>
                  <View style={[styles.roleCircleDot, { backgroundColor: ROLE_COLORS[role] }]} />
                </View>
                <ThemedText style={[styles.optionLabel, selectedRole === role && { color: colors.primary }]}>
                  {ROLE_LABELS[role]}
                </ThemedText>
              </View>
              {selectedRole === role && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
            </TouchableOpacity>
          ))}

          {hasSubroles && (
            <>
              <ThemedText style={[styles.sheetSection, { color: colors.text, marginTop: spacing.md }]}>Subrol</ThemedText>
              {availableSubroles.map(subrole => (
                <TouchableOpacity
                  key={subrole ?? 'none'}
                  style={[styles.option, { borderColor: selectedSubrole === subrole ? colors.primary : colors.border }, selectedSubrole === subrole && { backgroundColor: colors.primary + '11' }]}
                  onPress={() => setSelectedSubrole(subrole)}
                >
                  <ThemedText style={[styles.optionLabel, selectedSubrole === subrole && { color: colors.primary }]}>
                    {subrole ? SUBROLE_LABELS[subrole] : 'Ninguno'}
                  </ThemedText>
                  {selectedSubrole === subrole && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </>
          )}

          <View style={styles.sheetActions}>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.backgroundSecondary }]}
              onPress={onClose}
            >
              <ThemedText style={styles.btnText}>Cancelar</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[styles.btnText, { color: '#fff' }]}>Guardar</Text>
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
      style={[styles.userRow, { borderBottomColor: colors.border }]}
      onPress={() => setEditingUser(item)}
      activeOpacity={0.7}
    >
      <UserAvatar name={item.displayName} />
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
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <ChevronLeft size={26} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Gestión de usuarios</ThemedText>
        <View style={{ width: 26 }} />
      </View>

      <View style={[styles.searchRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Buscar por nombre o email…"
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <X size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.filterRow}>
        {ROLE_FILTERS.map(f => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filterChip, { borderColor: roleFilter === f.value ? colors.primary : colors.border }, roleFilter === f.value && { backgroundColor: colors.primary + '15' }]}
            onPress={() => setRoleFilter(f.value)}
          >
            <Text style={[styles.filterText, { color: roleFilter === f.value ? colors.primary : colors.textSecondary }]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading
        ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        : (
          <FlatList
            data={filtered}
            keyExtractor={u => u.uid}
            renderItem={renderUser}
            ListEmptyComponent={
              <ThemedText style={[styles.empty, { color: colors.textSecondary }]}>
                {search ? 'Sin resultados.' : 'No hay usuarios.'}
              </ThemedText>
            }
            contentContainerStyle={{ paddingBottom: 40 }}
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
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.md, marginVertical: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  searchInput: { flex: 1, fontSize: typography.sizes.md, paddingVertical: 2 },
  filterRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterText: { fontSize: typography.sizes.sm, fontWeight: '500' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  avatar: { justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontWeight: '700', textAlign: 'center', lineHeight: undefined },
  userInfo: { flex: 1, gap: 2 },
  userName: { fontSize: typography.sizes.md, fontWeight: '600' },
  userEmail: { fontSize: typography.sizes.sm },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, borderWidth: 1 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  empty: { textAlign: 'center', marginTop: 40 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing.lg, paddingBottom: spacing.xl + 8 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  sheetTitle: { fontSize: typography.sizes.lg, fontWeight: '700' },
  sheetUser: { fontSize: typography.sizes.sm, marginBottom: spacing.md },
  sheetSection: { fontSize: typography.sizes.sm, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm, opacity: 0.6 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: spacing.xs },
  optionLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  optionLabel: { fontSize: typography.sizes.md, fontWeight: '500' },
  roleCircle: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  roleCircleDot: { width: 10, height: 10, borderRadius: 5 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  btn: { flex: 1, paddingVertical: spacing.md, borderRadius: 12, alignItems: 'center' },
  btnText: { fontSize: typography.sizes.md, fontWeight: '600' },
});
