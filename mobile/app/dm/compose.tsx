import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Image, ScrollView, Platform, Keyboard,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Search, User as UserIcon, X } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { getOrCreateConversation } from '@/services/dmService';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { User, UserRole } from '@/types';

const PAGE_SIZE = 20;

export default function NewDMScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setAllUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') console.error('DM Compose error:', error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => { setPage(1); }, [searchText, selectedRole]);

  const filteredUsers = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    return allUsers.filter(u => {
      const matchesRole = selectedRole === 'all' || (u.role || 'student') === selectedRole;
      const matchesSearch = !search ||
        u.displayName.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search);
      return matchesRole && matchesSearch;
    });
  }, [allUsers, selectedRole, searchText]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={async () => {
        const meId = auth.currentUser?.uid;
        if (meId) await getOrCreateConversation(meId, item.uid).catch(() => {});
        router.push(`/dm/${item.uid}` as never);
      }}
    >
      <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
        ) : (
          <UserIcon size={20} color={colors.primary} />
        )}
      </View>
      <View style={styles.userInfo}>
        <ThemedText style={styles.userName}>{item.displayName}</ThemedText>
        <ThemedText style={[styles.userRole, { color: colors.textSecondary }]}>
          {t(`roles.${item.role || 'student'}`) || (item.role === 'teacher' ? 'Profesor/a' : item.role === 'admin' ? 'Admin' : 'Alumno/a')}
          {item.department ? ` • ${item.department}` : ''}
        </ThemedText>
      </View>
      <ChevronRight size={18} color={colors.textSecondary} />
    </TouchableOpacity>
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.card },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 4, marginLeft: spacing.xs }}>
              <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
            </TouchableOpacity>
          ),
          headerTitle: t('dm.new_message_title') || 'New Message Title',
        }}
      />

      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            ref={searchRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('dm.search_by_name') || 'Search By Name'}
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
          />
          {!!searchText && (
            <TouchableOpacity
              onPress={() => { setSearchText(''); searchRef.current?.blur(); Keyboard.dismiss(); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={16} color={colors.textSecondary} strokeWidth={2.5} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'teacher', 'student', 'admin'] as const).map(role => (
            <TouchableOpacity
              key={role}
              style={[styles.filterChip, { backgroundColor: selectedRole === role ? colors.primary : colors.backgroundSecondary }]}
              onPress={() => setSelectedRole(role)}
            >
              <ThemedText style={[styles.filterText, { color: selectedRole === role ? '#fff' : colors.textSecondary }]}>
                {t(`dm.filter.${role}`) || (role === 'all' ? 'Todos' : role === 'teacher' ? 'Profesores' : role === 'student' ? 'Alumnos' : 'Admin')}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={paginatedUsers}
          keyExtractor={item => item.uid}
          renderItem={renderUserItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState icon={UserIcon} title={t('dm.no_users_found')} />
          }
        />
      )}

      {!loading && filteredUsers.length > 0 && (
        <View style={[styles.pagination, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage(1)}
            style={[styles.pagerBtn, { opacity: page === 1 ? 0.3 : 1 }]}
          >
            <ChevronsLeft size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            disabled={page === 1}
            onPress={() => setPage(p => p - 1)}
            style={[styles.pagerBtn, { opacity: page === 1 ? 0.3 : 1 }]}
          >
            <ChevronLeft size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={[styles.pageIndicator, { backgroundColor: colors.primary + '15' }]}>
            <ThemedText style={[styles.pageText, { color: colors.primary }]}>
              {page} / {totalPages}
            </ThemedText>
            <ThemedText style={[styles.pageCount, { color: colors.primary }]}>
              {'· ' + filteredUsers.length + ' ' + (t('dm.users_total') || 'usuarios')}
            </ThemedText>
          </View>

          <TouchableOpacity
            disabled={page >= totalPages}
            onPress={() => setPage(p => p + 1)}
            style={[styles.pagerBtn, { opacity: page >= totalPages ? 0.3 : 1 }]}
          >
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            disabled={page >= totalPages}
            onPress={() => setPage(totalPages)}
            style={[styles.pagerBtn, { opacity: page >= totalPages ? 0.3 : 1 }]}
          >
            <ChevronsRight size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchContainer: {
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    height: 44,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    height: '100%',
  },
  filterRow: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  list: { paddingBottom: 80 },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImg: { width: 48, height: 48 },
  userInfo: { flex: 1 },
  userName: { fontSize: typography.sizes.md, fontWeight: '600' },
  userRole: { fontSize: typography.sizes.xs, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pagerBtn: { padding: 10, borderRadius: 10 },
  pageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pageText: { fontSize: typography.sizes.sm, fontWeight: '700' },
  pageCount: { fontSize: typography.sizes.xs, opacity: 0.8 },
});
