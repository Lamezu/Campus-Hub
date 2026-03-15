import React, { useState, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, ChevronRight } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { getMutualGroups } from '@/services/contactSettingsService';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { MutualGroup } from '@/types';

export default function DMGroupsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, theme } = useTheme();

  const [groups, setGroups] = useState<MutualGroup[]>([]);
  const [participantFirstName, setParticipantFirstName] = useState('este usuario');

  const meId = auth.currentUser?.uid ?? '';

  useEffect(() => {
    if (!meId || !userId) return;
    getMutualGroups(meId, userId).then(setGroups).catch(() => {});
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const name = (snap.data().displayName as string) ?? '';
        setParticipantFirstName(name.split(' ')[0] || 'este usuario');
      }
    }).catch(() => {});
  }, [meId, userId]);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Grupos en común</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.createRow, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert('Próximamente', 'Crear grupos estará disponible próximamente')}
            activeOpacity={0.7}
          >
            <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Plus size={22} color={colors.primary} strokeWidth={2} />
            </View>
            <ThemedText style={[styles.createLabel, { color: colors.primary }]}>
              Crear grupo con {participantFirstName}
            </ThemedText>
          </TouchableOpacity>
        }
        renderItem={({ item }: { item: MutualGroup }) => (
          <TouchableOpacity
            style={[styles.row, { borderBottomColor: colors.border }]}
            activeOpacity={0.7}
          >
            <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <ThemedText style={[styles.groupIconText, { color: colors.textSecondary }]}>
                {item.name.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={styles.groupInfo}>
              <ThemedText style={[styles.groupName, { color: colors.text }]}>{item.name}</ThemedText>
              <ThemedText style={[styles.groupMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.memberCount} miembros • {item.memberPreview}
              </ThemedText>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
              No hay grupos en común
            </ThemedText>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
    textAlign: 'center',
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  createLabel: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  groupIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupIconText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 22,
    includeFontPadding: false,
  },
  groupInfo: { flex: 1 },
  groupName: {
    fontSize: typography.sizes.md,
    fontWeight: '500',
    lineHeight: 20,
  },
  groupMeta: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
  },
});
