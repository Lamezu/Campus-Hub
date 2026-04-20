import React, { useState, useEffect } from 'react';
import {
  View, StyleSheet, TouchableOpacity, TextInput, Image,
  ScrollView, ActivityIndicator, StatusBar, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Camera, X } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';
import { uploadProfilePhoto } from '@/config/cloudinary';
import { createGroupConversation } from '@/services/groupDMService';
import { avatarColor } from '@/utils/avatarColor';

interface MemberInfo {
  id: string;
  name: string;
  photo: string | null;
}

export default function GroupCreateScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { memberIds: memberIdsParam } = useLocalSearchParams<{ memberIds: string }>();

  const [groupName, setGroupName] = useState('');
  const [groupPhoto, setGroupPhoto] = useState<string | null>(null);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const currentUser = auth.currentUser;

  useEffect(() => {
    let raw = memberIdsParam ?? '[]';
    try { raw = decodeURIComponent(raw); } catch {}
    const ids: string[] = JSON.parse(raw);
    const fetchMembers = async () => {
      const fetched: MemberInfo[] = [];
      for (const id of ids) {
        const snap = await getDoc(doc(db, 'users', id));
        if (snap.exists()) {
          const data = snap.data();
          fetched.push({ id, name: data.displayName ?? 'User', photo: data.photoURL ?? null });
        }
      }
      setMembers(fetched);
      setLoadingMembers(false);
    };
    fetchMembers().catch(() => setLoadingMembers(false));
  }, [memberIdsParam]);

  const removeMember = (id: string) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  const pickGroupPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      const url = await uploadProfilePhoto(result.assets[0].uri, `group_${Date.now()}`);
      setGroupPhoto(url);
    }
  };

  const handleCreate = async () => {
    if (!currentUser) return;
    if (members.length === 0) {
      Alert.alert('', t('dm.group.error_min_members') || 'Error Min Members');
      return;
    }
    setLoading(true);
    try {
      const creatorMember: MemberInfo = {
        id: currentUser.uid,
        name: currentUser.displayName ?? 'User',
        photo: currentUser.photoURL ?? null,
      };
      const allMembers = [creatorMember, ...members.filter(m => m.id !== currentUser.uid)];
      const groupId = await createGroupConversation(allMembers, groupName, groupPhoto, currentUser.uid);
      router.replace(`/dm/group/${groupId}` as any);
    } catch (err) {
      console.error('[GroupCreate]', err);
      Alert.alert('Error', t('dm.group.error_create') || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const totalUsers = members.length;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {t('dm.group.new_group') || 'New Group'}
        </ThemedText>
        <TouchableOpacity
          onPress={handleCreate}
          disabled={loading || members.length === 0}
          style={[styles.createBtn, { backgroundColor: colors.primary, opacity: members.length === 0 ? 0.5 : 1 }]}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <ThemedText style={styles.createBtnText}>{t('dm.group.create') || 'Create'}</ThemedText>
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.nameRow, { backgroundColor: colors.card, borderRadius: 16 }]}>
          <TouchableOpacity onPress={pickGroupPhoto} style={[styles.photoBtn, { backgroundColor: colors.border }]}>
            {groupPhoto
              ? <Image source={{ uri: groupPhoto }} style={styles.groupPhoto} />
              : <Camera size={28} color={colors.textSecondary} />
            }
          </TouchableOpacity>
          <TextInput
            style={[styles.nameInput, { color: colors.text }]}
            placeholder={t('dm.group.group_name_placeholder') || 'Group Name Placeholder'}
            placeholderTextColor={colors.textSecondary}
            value={groupName}
            onChangeText={setGroupName}
            maxLength={60}
          />
        </View>

        <ThemedText style={[styles.membersLabel, { color: colors.textSecondary }]}>
          {t('dm.group.members_label', { count: members.length, total: totalUsers }) || `MEMBERS: ${members.length} OF ${totalUsers}`}
        </ThemedText>

        {loadingMembers ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersStrip}>
            {members.map(m => {
              const bg = avatarColor(m.name);
              const initials = m.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
              return (
                <View key={m.id} style={styles.memberChip}>
                  <View style={styles.memberAvatarWrapper}>
                    {m.photo
                      ? <Image source={{ uri: m.photo }} style={styles.memberAvatar} />
                      : <View style={[styles.memberAvatar, { backgroundColor: bg }]}>
                          <ThemedText style={styles.memberInitials}>{initials}</ThemedText>
                        </View>
                    }
                    <TouchableOpacity
                      style={[styles.memberRemove, { backgroundColor: colors.textSecondary }]}
                      onPress={() => removeMember(m.id)}
                    >
                      <X size={9} color="#fff" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                  <ThemedText style={[styles.memberName, { color: colors.textSecondary }]} numberOfLines={1}>
                    {m.name.split(' ')[0]}
                  </ThemedText>
                </View>
              );
            })}
          </ScrollView>
        )}
      </ScrollView>
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
  backBtn: { padding: 4, marginRight: spacing.sm },
  headerTitle: { flex: 1, fontSize: typography.sizes.md, fontWeight: '700' },
  createBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 999 },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: typography.sizes.sm },
  content: { padding: spacing.md, gap: spacing.md },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    gap: spacing.sm,
  },
  photoBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  groupPhoto: { width: 56, height: 56, borderRadius: 28 },
  nameInput: { flex: 1, fontSize: typography.sizes.sm, paddingVertical: 8 },
  membersLabel: { fontSize: typography.sizes.xs, fontWeight: '600', marginTop: spacing.sm },
  membersStrip: { gap: spacing.sm, paddingVertical: spacing.xs },
  memberChip: { alignItems: 'center', width: 64 },
  memberAvatarWrapper: { position: 'relative' },
  memberAvatar: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center' },
  memberInitials: { color: '#fff', fontWeight: '700', fontSize: 18 },
  memberRemove: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberName: { fontSize: 10, marginTop: 4, width: 64, textAlign: 'center' },
});
