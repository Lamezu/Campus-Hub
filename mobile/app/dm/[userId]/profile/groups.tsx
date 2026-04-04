import React, { useState, useEffect } from 'react';
import {
  View, FlatList, StyleSheet, TouchableOpacity, Alert, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, ChevronRight, Users } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { getMutualGroups } from '@/services/contactSettingsService';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { MutualGroup } from '@/types';

export default function DMGroupsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();

  const [groups, setGroups] = useState<MutualGroup[]>([]);
  const [participantFirstName, setParticipantFirstName] = useState(t('post.someone') || 'Someone');

  const meId = auth.currentUser?.uid ?? '';

  useEffect(() => {
    if (!meId || !userId) return;
    getMutualGroups(meId, userId).then(setGroups).catch(() => { });
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const name = (snap.data().displayName as string) ?? '';
        setParticipantFirstName(name.split(' ')[0] || (t('post.someone') || 'Someone'));
      }
    }).catch(() => { });
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
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('dm.profile.mutual_groups.title') || 'Title'}</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          <TouchableOpacity
            style={[styles.createRow, { borderBottomColor: colors.border }]}
            onPress={() => Alert.alert(t('common.loading') || 'Loading', t('common.loading') || 'Loading')}
            activeOpacity={0.7}
          >
            <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
              <Plus size={22} color={colors.primary} strokeWidth={2} />
            </View>
            <ThemedText style={[styles.createLabel, { color: colors.primary }]}>
              {t('dm.profile.create_group_with', { name: participantFirstName }) || `Crear grupo con ${participantFirstName}`}
            </ThemedText>
          </TouchableOpacity>
        }
        renderItem={({ item }: { item: MutualGroup }) => {
          let preview = '';
          const names = item.otherMemberNames || [];
          if (names.length > 0) {
            preview = names.join(', ');
            if (item.memberCount > names.length + 2) {
              preview += t('dm.profile.mutual_groups.and_more', { count: item.memberCount - (names.length + 2) }) || ` y más`;
            }
          } else {
            preview = t('dm.profile.mutual_groups.you_and_contact') || 'You And Contact';
          }

          return (
            <TouchableOpacity
              style={[styles.row, { borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push(`/chat/${item.type === 'studyGroup' ? 'sg_' : ''}${item.id}` as any)}
            >
              <View style={[styles.groupIcon, { backgroundColor: colors.backgroundSecondary }]}>
                <ThemedText style={[styles.groupIconText, { color: colors.textSecondary }]}>
                  {item.name.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.groupInfo}>
                <ThemedText style={[styles.groupName, { color: colors.text }]}>{item.name}</ThemedText>
                <ThemedText style={[styles.groupMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                  {t('chat.info.member_count', { count: item.memberCount }) || `${item.memberCount} miembros`} • {preview}
                </ThemedText>
              </View>
              <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon={Users} title={t('dm.profile.mutual_groups.none') || 'No hay grupos en común'} fill />
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
});
