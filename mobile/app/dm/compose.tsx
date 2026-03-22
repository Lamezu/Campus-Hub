import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, FlatList,
  ActivityIndicator, Image, Platform,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Search, User as UserIcon, Filter, ChevronRight, ChevronLeft as ChevronLeftIcon, ArrowLeft, ArrowRight, ChevronsLeft, ChevronsRight } from 'lucide-react-native';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot, startAfter, QueryConstraint, endBefore, limitToLast } from 'firebase/firestore';
import { db } from '@/config/firebase';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'users'), orderBy('displayName', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User));
      setAllUsers(fetchedUsers);
      setLoading(false);
      setError(null);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('DM Compose Snapshot error:', error);
        setError(t('common.error') || 'Error al cargar usuarios');
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const filteredUsers = useMemo(() => {
    const search = searchText.toLowerCase().trim();
    return allUsers.filter(u => {
      const userRole = u.role || 'student';
      const matchesRole = selectedRole === 'all' || userRole === selectedRole;
      const matchesSearch = !search || u.displayName.toLowerCase().includes(search) || u.email.toLowerCase().includes(search);
      return matchesRole && matchesSearch;
    });
  }, [allUsers, selectedRole, searchText]);

  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredUsers.slice(start, start + PAGE_SIZE);
  }, [filteredUsers, page]);

  const hasMore = filteredUsers.length > page * PAGE_SIZE;

  const renderUserItem = ({ item }: { item: User }) => (
    <TouchableOpacity
      style={[styles.userItem, { borderBottomColor: colors.border }]}
      onPress={() => router.push(`/dm/${item.uid}` as never)}
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
        <ThemedText style={[styles.userEmail, { color: colors.textSecondary }]}>
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
          headerTitle: t('dm.new_message_title') || 'Nuevo mensaje',
        }}
      />

      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder={t('dm.search_by_name') || 'Buscar por nombre...'}
            placeholderTextColor={colors.textSecondary}
            value={searchText}
            onChangeText={setSearchText}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {(['all', 'teacher', 'student', 'admin'] as const).map(role => (
            <TouchableOpacity
              key={role}
              style={[
                styles.filterChip,
                { backgroundColor: selectedRole === role ? colors.primary : colors.backgroundSecondary },
              ]}
              onPress={() => {
                setSelectedRole(role);
                setPage(1);
              }}
            >
              <ThemedText style={[
                styles.filterText,
                { color: selectedRole === role ? '#fff' : colors.textSecondary }
              ]}>
                {t(`dm.filter.${role}`) || (role === 'all' ? 'Todos' : role === 'teacher' ? 'Profesores' : role === 'student' ? 'Alumnos' : 'Admin')}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={paginatedUsers}
        keyExtractor={item => item.uid}
        renderItem={renderUserItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText style={{ color: colors.textSecondary }}>
              {searchText ? (t('dm.no_users_found') || 'No se encontraron usuarios') : (t('dm.loading_directory') || 'Cargando directorio...')}
            </ThemedText>
          </View>
        }
      />

      <View style={[styles.pagination, { borderTopColor: colors.border, backgroundColor: colors.card }]}>
        <View style={styles.paginationContent}>
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
            <ThemedText style={[styles.pageText, { color: colors.primary }]}>{t('dm.page_num', { num: page }) || `Página ${page}`}</ThemedText>
          </View>

          <TouchableOpacity
            disabled={!hasMore}
            onPress={() => setPage(p => p + 1)}
            style={[styles.pagerBtn, { opacity: !hasMore ? 0.3 : 1 }]}
          >
            <ChevronRight size={20} color={colors.primary} />
          </TouchableOpacity>

          <View style={[styles.pagerBtn, { opacity: 0 }]}>
            <ChevronsRight size={20} color={colors.primary} />
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

import { ScrollView } from 'react-native-gesture-handler';

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
  list: {
    paddingBottom: 100,
  },
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
  avatarImg: {
    width: 48,
    height: 48,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  userEmail: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  pagination: {
    paddingVertical: spacing.sm,
    paddingBottom: Platform.OS === 'ios' ? spacing.xl : spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  paginationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pagerBtn: {
    padding: 10,
    borderRadius: 10,
  },
  pageIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    minWidth: 100,
    alignItems: 'center',
  },
  pageText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
});
