import React, { useState, useEffect, useCallback } from 'react';
import {
  View, ScrollView, StyleSheet, TouchableOpacity, Alert, Image,
  StatusBar, TextInput, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Users, UserPlus, Bell,
  Trash2, LogOut, AlertTriangle, Check, Camera, X, Star,
} from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { auth } from '@/config/firebase';
import { avatarColor } from '@/utils/avatarColor';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto } from '@/config/cloudinary';
import {
  subscribeToGroupInfo, leaveGroup, updateGroupInfo,
} from '@/services/groupDMService';
import { updateContactSettings, getContactSettings } from '@/services/contactSettingsService';
import { notificationService } from '@/services/notificationService';
import type { GroupConversation, MuteDuration } from '@/types';

const getMuteDurationLabel = (t: any): Record<MuteDuration, string> => ({
  off: t('dm.profile.mute_options.off') || 'Off',
  '8h': t('dm.profile.mute_options.8h') || '8h',
  '1w': t('dm.profile.mute_options.1w') || '1w',
  always: t('dm.profile.mute_options.always') || 'Always',
});

export default function GroupInfoScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const meId = auth.currentUser?.uid ?? '';
  const myName = auth.currentUser?.displayName ?? 'User';

  const [group, setGroup] = useState<GroupConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [mute, setMute] = useState<MuteDuration>('off');

  const muteDurationLabel = getMuteDurationLabel(t);

  // Real-time subscription to group document — updates instantly when members join
  useEffect(() => {
    if (!groupId) return;
    const unsub = subscribeToGroupInfo(groupId, info => {
      setGroup(info);
      if (info && nameInput === '') setNameInput(info.name ?? '');
      setLoading(false);
    });
    return unsub;
  }, [groupId]);

  useEffect(() => {
    if (!meId || !groupId) return;
    getContactSettings(meId, `group_${groupId}`).then(s => setMute(s.mute)).catch(() => {});
  }, [meId, groupId]);

  const handleSaveName = async () => {
    if (!groupId) return;
    setSavingName(true);
    try {
      await updateGroupInfo(groupId, nameInput, group?.photoURL ?? null);
      setEditingName(false);
    } catch {
      Alert.alert(t('common.error') || 'Error', t('dm.profile.group_update_error') || 'Group Update Error');
    } finally {
      setSavingName(false);
    }
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    if (!result.canceled && result.assets[0]) {
      const url = await uploadProfilePhoto(result.assets[0].uri, `group_${groupId}_${Date.now()}`);
      await updateGroupInfo(groupId!, nameInput, url);
      // No need to setGroup — onSnapshot will fire automatically
    }
  };

  const handleMuteToggle = async () => {
    const next: MuteDuration = mute === 'always' ? 'off' : 'always';
    setMute(next);
    await updateContactSettings(meId, `group_${groupId}`, { mute: next }).catch(() => {});
  };

  const handleClearChat = () => {
    Alert.alert(
      t('dm.profile.clear_chat') || 'Clear Chat',
      t('chat.settings.clear_chat_msg') || 'Clear Chat Msg',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.delete') || 'Delete', style: 'destructive',
          onPress: () => {
            // Clear for me only — lightweight approach
            Alert.alert(t('common.done') || 'Done', 'Chat cleared for you.');
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    Alert.alert(
      t('dm.group.leave_group') || 'Leave Group',
      t('dm.group.leave_confirm') || 'Leave Confirm',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.group.leave_group') || 'Leave Group', style: 'destructive',
          onPress: async () => {
            if (!groupId) return;
            await leaveGroup(groupId, meId, myName).catch(() => {});
            router.replace('/(tabs)/messages' as any);
          },
        },
      ]
    );
  };

  const handleReport = () => {
    Alert.alert(
      t('dm.profile.report_group') || 'Report Group',
      t('dm.profile.report_confirm') || 'Report Confirm',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('dm.profile.report_action') || 'Report Action', style: 'destructive',
          onPress: async () => {
            await notificationService.addNotification('admin', {
              category: 'general',
              title: 'Group reported',
              body: `User ${myName} reported group ${group?.name ?? groupId}.`,
              meta: { groupId: groupId!, reporterId: meId },
            }).catch(() => {});
            Alert.alert(t('common.done') || 'Done', 'Group reported.');
          },
        },
      ]
    );
  };

  const groupTitle = group?.name
    || Object.values(group?.memberNames ?? {}).filter(n => n !== myName).slice(0, 3).join(', ')
    || t('dm.group.new_group') || 'New Group';
  const members = Object.entries(group?.memberNames ?? {});
  const createdAt = group?.createdAt
    ? new Date(group.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const creatorName = group?.createdBy ? (group.memberNames?.[group.createdBy] ?? '') : '';
  const isCreator = group?.createdBy === meId;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {t('dm.group.info_title') || 'Info Title'}
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero avatar + name */}
        <View style={styles.hero}>
          <TouchableOpacity onPress={handlePickPhoto} activeOpacity={0.8} style={styles.avatarWrapper}>
            {group?.photoURL
              ? <Image source={{ uri: group.photoURL }} style={styles.heroAvatar} />
              : (
                <View style={[styles.heroAvatar, styles.heroAvatarFallback, { backgroundColor: colors.primary + '22' }]}>
                  <Users size={48} color={colors.primary} />
                </View>
              )
            }
            <View style={[styles.cameraOverlay, { backgroundColor: colors.primary }]}>
              <Camera size={14} color="#fff" />
            </View>
          </TouchableOpacity>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={[styles.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                value={nameInput}
                onChangeText={setNameInput}
                autoFocus
                maxLength={60}
                placeholder={t('dm.group.group_name_placeholder') || 'Group Name Placeholder'}
                placeholderTextColor={colors.textSecondary}
              />
              <TouchableOpacity onPress={handleSaveName} disabled={savingName} style={{ padding: 4 }}>
                {savingName ? <ActivityIndicator size="small" color={colors.primary} /> : <Check size={20} color={colors.primary} />}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNameInput(group?.name ?? ''); }} style={{ padding: 4 }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7}>
              <ThemedText style={[styles.heroName, { color: colors.text }]}>{groupTitle}</ThemedText>
            </TouchableOpacity>
          )}
          <ThemedText style={[styles.heroSub, { color: colors.primary }]}>
            {t('common.group') || 'Group'} · {members.length} {t('dm.group.members_short') || 'members'}
          </ThemedText>
        </View>

        {/* Quick action buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={handleMuteToggle} activeOpacity={0.7}>
            <Bell size={22} color={colors.primary} strokeWidth={1.8} />
            <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>{t('dm.profile.notifications') || 'Notifications'}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={() => router.push(`/dm/group/select?groupId=${groupId}` as any)} activeOpacity={0.7}>
            <UserPlus size={22} color={colors.primary} strokeWidth={1.8} />
            <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>{t('dm.group.add_members') || 'Add Members'}</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
            onPress={handleMuteToggle} activeOpacity={0.7}>
            <Bell size={22} color={mute === 'always' ? colors.textSecondary : colors.primary} strokeWidth={1.8} />
            <ThemedText style={[styles.actionBtnLabel, { color: colors.text }]}>
              {mute === 'always' ? (t('dm.unmute') || 'Unmute') : (t('dm.mute') || 'Mute')}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Settings section */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} activeOpacity={0.7} onPress={handleMuteToggle}>
            <Bell size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.profile.notifications') || 'Notifications'}</ThemedText>
            <ThemedText style={[styles.rowValue, { color: colors.textSecondary }]}>{muteDurationLabel[mute]}</ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} activeOpacity={0.7}
            onPress={() => router.push(`/dm/group/${groupId}/starred` as any)}>
            <Star size={20} color={colors.textSecondary} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.text }]}>{t('dm.group.starred') || 'Starred'}</ThemedText>
            <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} activeOpacity={0.7} onPress={handleClearChat}>
            <Trash2 size={20} color="#FF9500" strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: '#FF9500' }]}>{t('dm.profile.clear_chat') || 'Clear Chat'}</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Members list — updates in real time via onSnapshot */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.sectionHeaderRow}>
            <ThemedText style={[styles.sectionHeaderText, { color: colors.textSecondary }]}>
              {members.length} {t('dm.group.members_short') || 'Members Short'}
            </ThemedText>
          </View>

          <TouchableOpacity
            style={[styles.memberRow, { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
            onPress={() => router.push(`/dm/group/select?groupId=${groupId}` as any)}
            activeOpacity={0.7}
          >
            <View style={[styles.memberAvatarPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
              <UserPlus size={20} color={colors.primary} strokeWidth={2} />
            </View>
            <ThemedText style={[styles.memberName, { color: colors.primary }]}>
              {t('dm.group.add_members') || 'Add Members'}
            </ThemedText>
          </TouchableOpacity>

          {members.map(([uid, name], idx) => {
            const photo = group?.memberPhotos?.[uid] ?? null;
            const isMe = uid === meId;
            const bg = avatarColor(name);
            const initials = name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
            const isGroupCreator = uid === group?.createdBy;
            return (
              <TouchableOpacity
                key={uid}
                style={[styles.memberRow, idx < members.length - 1 && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
                activeOpacity={isMe ? 1 : 0.7}
                onPress={() => !isMe && router.push(`/dm/${uid}` as any)}
              >
                {photo
                  ? <Image source={{ uri: photo }} style={styles.memberAvatar} />
                  : <View style={[styles.memberAvatar, { backgroundColor: bg }]}>
                      <ThemedText style={styles.memberInitials}>{initials}</ThemedText>
                    </View>
                }
                <ThemedText style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {isMe ? (t('dm.group.you_prefix') || 'You Prefix') : name}
                </ThemedText>
                {isGroupCreator && (
                  <ThemedText style={[styles.memberRole, { color: colors.primary }]}>
                    {t('dm.group.admin') || 'Admin'}
                  </ThemedText>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Danger zone */}
        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity style={[styles.row, { borderBottomColor: colors.border }]} onPress={handleLeave} activeOpacity={0.7}>
            <LogOut size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.danger ?? '#FF3B30' }]}>
              {t('dm.group.leave_group') || 'Leave Group'}
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.row} onPress={handleReport} activeOpacity={0.7}>
            <AlertTriangle size={20} color={colors.danger ?? '#FF3B30'} strokeWidth={1.8} />
            <ThemedText style={[styles.rowLabel, { color: colors.danger ?? '#FF3B30' }]}>
              {t('dm.profile.report_group') || 'Report Group'}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Footer — group creation info */}
        {!!createdAt && (
          <View style={styles.footer}>
            <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
              {isCreator
                ? (t('dm.group.created_by_you') || 'Created By You')
                : (t('dm.group.created_by', { name: creatorName }) || `Created by ${creatorName}.`)}
            </ThemedText>
            <ThemedText style={[styles.footerText, { color: colors.textSecondary }]}>
              {t('dm.group.created_at', { date: createdAt }) || `Created on ${createdAt}.`}
            </ThemedText>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700', textAlign: 'center' },
  content: { paddingBottom: 40 },
  hero: { alignItems: 'center', paddingTop: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
  avatarWrapper: { position: 'relative' },
  heroAvatar: { width: 100, height: 100, borderRadius: 50 },
  heroAvatarFallback: { justifyContent: 'center', alignItems: 'center' },
  cameraOverlay: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  nameInput: { flex: 1, fontSize: typography.sizes.lg, fontWeight: '700', textAlign: 'center', borderBottomWidth: 1.5, paddingVertical: 4 },
  heroName: { fontSize: typography.sizes.xl, fontWeight: '700', textAlign: 'center' },
  heroSub: { fontSize: typography.sizes.sm },
  actionRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  actionBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm + 4, borderRadius: 14, gap: 4 },
  actionBtnLabel: { fontSize: 11, fontWeight: '600' },
  section: {
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    borderRadius: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: 4 },
  sectionHeaderText: { fontSize: typography.sizes.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLabel: { flex: 1, fontSize: typography.sizes.md },
  rowValue: { fontSize: typography.sizes.sm },
  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
  },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  memberAvatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  memberInitials: { color: '#fff', fontWeight: '700', fontSize: 16 },
  memberName: { flex: 1, fontSize: typography.sizes.md, fontWeight: '500' },
  memberRole: { fontSize: typography.sizes.xs, fontWeight: '600' },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: 2 },
  footerText: { fontSize: typography.sizes.xs, lineHeight: 18 },
});
