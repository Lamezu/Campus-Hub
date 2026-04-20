import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, TextInput,
  StatusBar, Image, ScrollView, ActivityIndicator, SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Check, Search, UserPlus } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { avatarColor } from '@/utils/avatarColor';
import { addMembersToGroup } from '@/services/groupDMService';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'.split('');

interface SelectableUser {
  id: string;
  name: string;
  photo: string | null;
  role: string;
}

export default function GroupSelectScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { preselectedId, groupId } = useLocalSearchParams<{ preselectedId?: string; groupId?: string }>();
  const isAddingToGroup = !!groupId;

  const [allUsers, setAllUsers] = useState<SelectableUser[]>([]);
  const [existingMemberIds, setExistingMemberIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listRef = useRef<SectionList>(null);
  const meId = auth.currentUser?.uid ?? '';

  useEffect(() => {
    const meId = auth.currentUser?.uid ?? '';
    const loadData = async () => {
      // Load existing members if adding to group
      let existing = new Set<string>();
      if (groupId) {
        const snap = await getDoc(doc(db, 'groupConversations', groupId)).catch(() => null);
        const members: string[] = snap?.data()?.members ?? [];
        existing = new Set(members);
        setExistingMemberIds(existing);
      }

      const snap = await getDocs(collection(db, 'users'));
      const users: SelectableUser[] = snap.docs
        .filter(d => d.id !== meId && !existing.has(d.id))
        .map(d => ({
          id: d.id,
          name: d.data().displayName ?? 'User',
          photo: d.data().photoURL ?? null,
          role: d.data().role ?? 'student',
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setAllUsers(users);
      if (preselectedId && !existing.has(preselectedId)) {
        setSelected(new Set([preselectedId]));
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const toggleUser = useCallback((userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }, []);

  const selectedUsers = useMemo(
    () => allUsers.filter(u => selected.has(u.id)),
    [allUsers, selected]
  );

  const sections = useMemo(() => {
    const filtered = query.trim()
      ? allUsers.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))
      : allUsers;

    if (!query.trim()) {
      const frequent = filtered.slice(0, 7);
      const rest = filtered.slice(7);
      const byLetter: Record<string, SelectableUser[]> = {};
      rest.forEach(u => {
        const letter = u.name[0]?.toUpperCase() ?? '#';
        const key = /[A-Z]/.test(letter) ? letter : '#';
        if (!byLetter[key]) byLetter[key] = [];
        byLetter[key].push(u);
      });
      const result: { title: string; data: SelectableUser[] }[] = [];
      if (frequent.length > 0) result.push({ title: t('dm.group.frequent_contacts') || 'Frequent Contacts', data: frequent });
      Object.keys(byLetter).sort().forEach(letter => {
        result.push({ title: letter, data: byLetter[letter] });
      });
      return result;
    }

    return [{ title: '', data: filtered }];
  }, [allUsers, query]);

  const sectionKeys = useMemo(() => {
    return sections.map(s => s.title);
  }, [sections]);

  const handleGoToCreate = async () => {
    if (selected.size === 0) return;

    if (isAddingToGroup && groupId) {
      // Add to existing group
      setAdding(true);
      try {
        const myName = auth.currentUser?.displayName ?? 'Someone';
        const newMembers = allUsers
          .filter(u => selected.has(u.id))
          .map(u => ({ id: u.id, name: u.name, photo: u.photo }));
        await addMembersToGroup(groupId, newMembers, myName);
        router.back();
      } catch {
        // silently ignore
      } finally {
        setAdding(false);
      }
    } else {
      // Create new group
      const encoded = encodeURIComponent(JSON.stringify(Array.from(selected)));
      router.push(`/dm/group/create?memberIds=${encoded}` as any);
    }
  };

  const renderUser = ({ item }: { item: SelectableUser }) => {
    const isSelected = selected.has(item.id);
    const bgColor = avatarColor(item.name);
    const initials = item.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    return (
      <TouchableOpacity
        style={[styles.userRow, { borderBottomColor: colors.border }]}
        onPress={() => toggleUser(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.avatarWrapper}>
          {item.photo
            ? <Image source={{ uri: item.photo }} style={styles.avatar} />
            : <View style={[styles.avatar, { backgroundColor: bgColor }]}>
                <ThemedText style={styles.initials}>{initials}</ThemedText>
              </View>
          }
        </View>
        <ThemedText style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <View style={[
          styles.checkbox,
          isSelected
            ? { backgroundColor: colors.primary, borderColor: colors.primary }
            : { backgroundColor: 'transparent', borderColor: colors.border },
        ]}>
          {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <X size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
            {t('dm.group.add_members') || 'Add Members'}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            {selected.size}/{allUsers.length}
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={handleGoToCreate}
          disabled={selected.size === 0 || adding}
          style={[styles.nextBtn, { backgroundColor: selected.size > 0 ? colors.primary : colors.border }]}
        >
          {adding
            ? <ActivityIndicator size="small" color="#fff" />
            : <ThemedText style={styles.nextBtnText}>
                {isAddingToGroup ? (t('dm.group.add') || 'Add') : (t('dm.group.next') || 'Next')}
              </ThemedText>
          }
        </TouchableOpacity>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
        <Search size={16} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('dm.group.search_placeholder') || 'Search Placeholder'}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
            <X size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {selectedUsers.length > 0 && (
        <ScrollView
          horizontal
          style={[styles.selectedStrip, { backgroundColor: colors.card }]}
          contentContainerStyle={styles.selectedStripContent}
          showsHorizontalScrollIndicator={false}
        >
          {selectedUsers.map(u => {
            const bgColor = avatarColor(u.name);
            const initials = u.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
            return (
              <View key={u.id} style={styles.selectedChip}>
                <View style={styles.selectedAvatarWrapper}>
                  {u.photo
                    ? <Image source={{ uri: u.photo }} style={styles.selectedAvatar} />
                    : <View style={[styles.selectedAvatar, { backgroundColor: bgColor }]}>
                        <ThemedText style={styles.selectedInitials}>{initials}</ThemedText>
                      </View>
                  }
                  <TouchableOpacity
                    style={[styles.chipRemove, { backgroundColor: colors.textSecondary }]}
                    onPress={() => toggleUser(u.id)}
                  >
                    <X size={9} color="#fff" strokeWidth={3} />
                  </TouchableOpacity>
                </View>
                <ThemedText style={[styles.chipName, { color: colors.textSecondary }]} numberOfLines={1}>
                  {u.name.split(' ')[0]}
                </ThemedText>
              </View>
            );
          })}
        </ScrollView>
      )}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      ) : (
        <View style={{ flex: 1 }}>
          <SectionList
            ref={listRef}
            sections={sections}
            keyExtractor={item => item.id}
            renderItem={renderUser}
            renderSectionHeader={({ section }) =>
              section.title ? (
                <View style={[styles.sectionHeader, { backgroundColor: colors.background }]}>
                  <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                    {section.title}
                  </ThemedText>
                </View>
              ) : null
            }
            stickySectionHeadersEnabled
            keyboardShouldPersistTaps="handled"
            style={{ flex: 1 }}
          />

          <View style={styles.alphabetSidebar}>
            {ALPHABET.map(letter => (
              <TouchableOpacity
                key={letter}
                onPress={() => {
                  const idx = sectionKeys.indexOf(letter);
                  if (idx >= 0) listRef.current?.scrollToLocation({ sectionIndex: idx, itemIndex: 0, animated: true });
                }}
                hitSlop={2}
              >
                <ThemedText style={[styles.alphabetLetter, { color: colors.primary }]}>{letter}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeBtn: { padding: 4, marginRight: spacing.sm },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  headerSubtitle: { fontSize: typography.sizes.xs },
  nextBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: 999,
  },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.sizes.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: 12,
    gap: spacing.xs,
  },
  searchInput: { flex: 1, fontSize: typography.sizes.sm },
  selectedStrip: { maxHeight: 90, flexGrow: 0 },
  selectedStripContent: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.sm },
  selectedChip: { alignItems: 'center', width: 64 },
  selectedAvatarWrapper: { position: 'relative' },
  selectedAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
  selectedInitials: { color: '#fff', fontWeight: '700', fontSize: 16 },
  chipRemove: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipName: { fontSize: 10, marginTop: 4, width: 64, textAlign: 'center' },
  sectionHeader: { paddingHorizontal: spacing.md, paddingVertical: 4 },
  sectionTitle: { fontSize: typography.sizes.xs, fontWeight: '600' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarWrapper: { marginRight: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  initials: { color: '#fff', fontWeight: '700', fontSize: 16 },
  userName: { flex: 1, fontSize: typography.sizes.sm, fontWeight: '500' },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alphabetSidebar: {
    position: 'absolute',
    right: 2,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    gap: 1,
  },
  alphabetLetter: { fontSize: 10, fontWeight: '600', paddingHorizontal: 4 },
});
