import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Image, StyleSheet, Platform, Text } from 'react-native';
import { UserStar, SaveAll, Users, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { useTranslation } from '@/hooks/useTranslation';
import { NotificationBell } from '@/components/NotificationBell';

function formatNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return num.toString();
}

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { isAdmin } = useCurrentUser();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Profile Snapshot error:', error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const [channelsCount, setChannelsCount] = useState(0);
  const [friendsCount, setFriendsCount] = useState(0);

  useEffect(() => {
    if (!currentUser) return;

    let cCount = 0;
    let sgCount = 0;

    const unsubChannels = onSnapshot(
      query(collection(db, 'channels'), where('memberIds', 'array-contains', currentUser.uid)),
      (snap) => {
        cCount = snap.size;
        setChannelsCount(cCount + sgCount);
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error('ProfileChannels Snapshot error:', error);
        }
      }
    );

    const unsubStudyGroups = onSnapshot(
      query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', currentUser.uid)),
      (sgSnap) => {
        sgCount = sgSnap.size;
        setChannelsCount(cCount + sgCount);
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error('ProfileGroups Snapshot error:', error);
        }
      }
    );

    const unsubFriends = onSnapshot(
      collection(db, 'users', currentUser.uid, 'friends'),
      (snap) => {
        setFriendsCount(snap.size);
      }, (error) => {
        if (error.code !== 'permission-denied') {
          console.error('ProfileFriends Snapshot error:', error);
        }
      }
    );

    return () => {
      unsubChannels();
      unsubStudyGroups();
      unsubFriends();
    };
  }, [currentUser]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>{t('profile.loading') || 'Loading'}</ThemedText>
      </ThemedView>
    );
  }

  const displayName = userData?.displayName || currentUser?.displayName || t('common.user') || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: Platform.OS === 'android' ? insets.bottom + 80 : insets.bottom + 20
      }}
    >
      <View style={[
        styles.header,
        {
          paddingTop: Platform.OS === 'ios' ? insets.top + spacing.xl : spacing.xl
        }
      ]}>
        <View style={styles.bellWrapper}>
          <NotificationBell category="friend" />
        </View>
        
        <View style={[styles.avatarContainer, { backgroundColor: colors.backgroundSecondary }]}>
          {userData?.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.avatar} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.text }]}>{initial}</Text>
          )}
        </View>

        <View style={styles.nameRow}>
          <ThemedText style={styles.name}>{displayName}</ThemedText>
          {(userData?.role === 'teacher' || userData?.role === 'admin') && (
            <UserStar size={18} color={colors.primary} strokeWidth={1.8} />
          )}
        </View>
        <ThemedText style={styles.email}>{userData?.email || currentUser?.email}</ThemedText>

        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/edit-profile' as any)}
        >
          <ThemedText style={styles.editButtonText}>{t('profile.edit_profile') || 'Edit Profile'}</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: colors.card, borderColor: colors.border + '20' }]}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statValue} numberOfLines={1}>{formatNumber(channelsCount)}</ThemedText>
          <ThemedText style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{t('common.channels') || 'Channels'}</ThemedText>
        </View>

        <View style={styles.statItem}>
          <ThemedText style={styles.statValue} numberOfLines={1}>{formatNumber(userData?.messageCount || 0)}</ThemedText>
          <ThemedText style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{t('profile.messages') || 'Messages'}</ThemedText>
        </View>

        <View style={styles.statItem}>
          <ThemedText style={styles.statValue} numberOfLines={1}>{formatNumber(friendsCount)}</ThemedText>
          <ThemedText style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{t('profile.friends') || 'Friends'}</ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>{t('profile.quick_actions') || 'Quick Actions'}</ThemedText>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}
          onPress={() => router.push('/saved-items' as any)}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <SaveAll size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.actionText}>
            <ThemedText style={styles.actionTitle}>{t('profile.saved_messages') || 'Saved Messages'}</ThemedText>
            <ThemedText style={styles.actionSubtitle}>{t('profile.view_saved') || 'View Saved'}</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}
          onPress={() => router.push('/friends' as any)}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <Users size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.actionText}>
            <ThemedText style={styles.actionTitle}>{t('profile.friends') || 'Friends'}</ThemedText>
            <ThemedText style={styles.actionSubtitle}>{t('profile.manage_friends') || 'Manage Friends'}</ThemedText>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionCard, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}
          onPress={() => router.push({ pathname: '/friends', params: { tab: 'best' } } as any)}
        >
          <View style={[styles.iconContainer, { backgroundColor: colors.primary + '15' }]}>
            <UserStar size={20} color={colors.primary} strokeWidth={2} />
          </View>
          <View style={styles.actionText}>
            <ThemedText style={styles.actionTitle}>{t('profile.best_friends') || 'Best Friends'}</ThemedText>
            <ThemedText style={styles.actionSubtitle}>{t('profile.close_connections') || 'Close Connections'}</ThemedText>
          </View>
        </TouchableOpacity>
      </View>

      {isAdmin && (
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>{t('profile.administration') || 'Administration'}</ThemedText>
          <TouchableOpacity
            style={[styles.actionCard, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}
            onPress={() => router.push('/admin/users' as any)}
          >
            <View style={[styles.iconContainer, { backgroundColor: '#AF52DE' + '15' }]}>
              <ShieldCheck size={20} color="#AF52DE" strokeWidth={2} />
            </View>
            <View style={styles.actionText}>
              <ThemedText style={styles.actionTitle}>{t('profile.user_management') || 'User Management'}</ThemedText>
              <ThemedText style={styles.actionSubtitle}>{t('profile.assign_roles') || 'Assign Roles'}</ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg },
  bellWrapper: { position: 'absolute', top: spacing.xl + 8, right: spacing.md, zIndex: 1 },
  avatarContainer: { 
    width: 110, 
    height: 110, 
    borderRadius: 55, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginBottom: spacing.lg, 
    marginTop: spacing.md,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  avatar: { width: 110, height: 110, borderRadius: 55 },
  avatarText: { fontSize: 40, fontWeight: '800', textAlign: 'center', lineHeight: 40, paddingTop: 6, includeFontPadding: false },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  name: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  email: { fontSize: 13, opacity: 0.6, marginBottom: spacing.lg, fontWeight: '600' },
  editButton: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16 },
  editButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  statsContainer: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginHorizontal: spacing.lg, 
    marginVertical: spacing.md, 
    paddingVertical: spacing.lg, 
    paddingHorizontal: spacing.md, 
    borderRadius: 24, 
    borderWidth: 1,
  },
  statItem: { alignItems: 'center', flex: 1, paddingHorizontal: 4 },
  statValue: { fontSize: 22, fontWeight: '800', letterSpacing: -0.2 },
  statLabel: { fontSize: 10, opacity: 0.5, marginTop: 4, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  section: { padding: spacing.lg, paddingTop: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: spacing.md, letterSpacing: -0.2 },
  actionCard: { 
    borderWidth: 1, 
    padding: spacing.md, 
    borderRadius: 20, 
    marginBottom: spacing.sm, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: spacing.md 
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 16, fontWeight: '700' },
  actionSubtitle: { fontSize: 13, opacity: 0.5, marginTop: 2, fontWeight: '500' }
});
