import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, SectionList, TouchableOpacity, View, ActivityIndicator, Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, where, orderBy, onSnapshot, Timestamp,
  doc, arrayUnion, setDoc, increment, serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';
import { registerForPushNotifications } from '@/utils/notifications';
import { ChannelCard } from '@/components/ChannelCard';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { Settings, Hash } from 'lucide-react-native';
import { EmptyState } from '@/components/EmptyState';
import { CHANNELS } from '@/constants/channelData';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { subscribeToChannelUnread } from '@/services/channelReadService';
import { useTranslation } from '@/hooks/useTranslation';
import esLocale from '@/locales/es.json';
import type { Channel, StudyGroup } from '@/types';

const SUBJECT_ES_TO_KEY: Record<string, string> = Object.fromEntries(
  Object.entries((esLocale as any).explore.groups.subjects_list).map(([k, v]) => [v as string, k])
);

function resolveSubject(subject: string, t: (key: string) => string): string {
  const byKey = t(`explore.groups.subjects_list.${subject}`);
  if (byKey) return byKey;
  const key = SUBJECT_ES_TO_KEY[subject];
  return key ? (t(`explore.groups.subjects_list.${key}`) || subject) : subject;
}

function studyGroupToChannel(g: StudyGroup, t: (key: string, params?: any) => string, unreadCount = 0): Channel {
  return {
    id: `sg_${g.id}`,
    name: g.name,
    description: `${resolveSubject(g.subject, t)} · ${t('chat.info.member_count', { count: g.memberCount })}`,
    type: g.isPrivate ? 'private' : 'public',
    createdBy: g.createdBy,
    createdAt: g.createdAt,
    memberCount: g.memberCount,
    lastMessageAt: null,
    departmentRestricted: false,
    allowedDepartments: [],
    icon: 'users',
    photoURL: g.photoURL,
    unreadCount,
  };
}

type Section = { title: string; data: Array<{ channel: Channel; color?: string; realId: string }> };

export default function HomeScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [myGroups, setMyGroups] = useState<StudyGroup[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const unsubsRef = useRef<Array<() => void>>([]);
  const autoJoinAttempted = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (!u) router.replace('/auth/login');
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (user?.uid) registerForPushNotifications(user.uid);
  }, [user?.uid]);

  const [realChannels, setRealChannels] = useState<Channel[]>(CHANNELS);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
    );
    return onSnapshot(q, snap => {
      setMyGroups(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name ?? '',
          description: data.description ?? '',
          subject: data.subject ?? '',
          createdBy: data.createdBy ?? '',
          createdByName: data.createdByName ?? '',
          memberIds: data.memberIds ?? [],
          memberCount: data.memberIds?.length ?? data.memberCount ?? 0,
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          color: data.color ?? colors.primary,
          photoURL: data.photoURL ?? null,
          isPrivate: data.isPrivate ?? false,
          allowedRoles: data.allowedRoles ?? [],
          invitedUserIds: data.invitedUserIds ?? [],
        } as StudyGroup;
      }));
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Home Groups Snapshot error:', error);
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'channels'));
    return onSnapshot(q, (snap) => {
      const firestoreChannels = snap.docs.reduce((acc, d) => {
        acc[d.id] = { id: d.id, ...d.data() };
        return acc;
      }, {} as Record<string, any>);

      setRealChannels(CHANNELS.map(staticCh => {
        const dynamic = firestoreChannels[staticCh.id];
        if (dynamic) {
          return {
            ...staticCh,
            ...dynamic,
            memberCount: dynamic.memberIds?.length ?? dynamic.memberCount ?? staticCh.memberCount ?? 0,
            icon: dynamic.icon || staticCh.icon
          };
        }
        return staticCh;
      }));
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Home Channels Snapshot error:', error);
      }
    });
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid || !realChannels.length || autoJoinAttempted.current) return;

    const autoJoin = async () => {
      autoJoinAttempted.current = true;
      for (const ch of realChannels) {
        const isDefault = CHANNELS.find(c => c.id === ch.id);
        if (isDefault && (!ch.memberIds || !ch.memberIds.includes(user.uid))) {
          try {
            await Promise.all([
              setDoc(doc(db, 'channels', ch.id, 'members', user.uid), {
                userId: user.uid,
                role: 'member',
                joinedAt: serverTimestamp(),
                notifications: true
              }, { merge: true }),
              setDoc(doc(db, 'channels', ch.id), {
                memberIds: arrayUnion(user.uid),
              }, { merge: true }),
            ]);
          } catch (e: any) {
            if (e.code !== 'permission-denied') {
              console.error(`[AutoJoin] Failed for channel ${ch.name}:`, e.message);
            }
          }
        }
      }
    };

    autoJoin();
  }, [user?.uid, realChannels]);

  const activeSubs = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!user?.uid) return;

    const currentIds = new Set([
      ...realChannels.map(c => c.id),
      ...myGroups.map(g => g.id),
    ]);

    for (const subId of activeSubs.current) {
      if (!currentIds.has(subId)) {
        const index = unsubsRef.current.findIndex((u: any) => u.channelId === subId);
        if (index > -1) {
          unsubsRef.current[index]();
          unsubsRef.current.splice(index, 1);
        }
        activeSubs.current.delete(subId);
      }
    }

    for (const channelId of currentIds) {
      if (!activeSubs.current.has(channelId)) {
        const unsub = subscribeToChannelUnread(channelId, user.uid, (count) => {
          setUnreadCounts(prev => ({ ...prev, [channelId]: count }));
        });
        (unsub as any).channelId = channelId;
        unsubsRef.current.push(unsub);
        activeSubs.current.add(channelId);
      }
    }

    return () => {
      if (!user?.uid) {
        unsubsRef.current.forEach(u => u());
        unsubsRef.current = [];
        activeSubs.current.clear();
      }
    };
  }, [user?.uid, myGroups.length, realChannels.length]);

  const sections: Section[] = useMemo(() => {
    const channelSection: Section = {
      title: t('common.channels') || 'Channels',
      data: realChannels.map(ch => ({
        channel: { ...ch, unreadCount: unreadCounts[ch.id] ?? 0 },
        realId: ch.id,
      })),
    };
    if (myGroups.length === 0) return [channelSection];
    const groupSection: Section = {
      title: t('common.my_groups') || 'My Groups',
      data: myGroups.map(g => ({
        channel: studyGroupToChannel(g, t, unreadCounts[g.id] ?? 0),
        color: g.color,
        realId: g.id,
      })),
    };
    return [channelSection, groupSection];
  }, [myGroups, unreadCounts, realChannels, t]);

  const handlePress = (item: Section['data'][number]) => {
    if (item.realId === '3') {
      router.push('/events' as never);
      return;
    }
    router.push({ pathname: '/chat/[id]', params: { id: item.channel.id } });
  };

  if (!user) return null;

  return (
    <ThemedView style={styles.container}>
      {/* Decorative background element for depth */}
      <View style={[styles.glow, { backgroundColor: colors.primary + '15' }]} />
      
      <View style={[styles.header, { borderBottomColor: colors.border + '30', paddingTop: insets.top + spacing.sm }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          Campus<ThemedText style={{ color: colors.primary }}>Hub</ThemedText>
        </ThemedText>
        <View style={styles.headerActions}>
          <NotificationBell category="channel" />
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <Settings size={22} color={colors.text} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={item => item.channel.id}
          renderItem={({ item }) => (
            <ChannelCard
              channel={item.channel}
              onPress={() => handlePress(item)}
              accentColor={item.color}
            />
          )}
          renderSectionHeader={({ section }) =>
            sections.length > 1 ? (
              <View style={styles.sectionHeader}>
                <View style={[styles.sectionIndicator, { backgroundColor: colors.primary }]} />
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {section.title.toUpperCase()}
                </ThemedText>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: tabBarHeight + spacing.xl + (Platform.OS === 'ios' ? 0 : spacing.md) }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <EmptyState
              icon={Hash}
              title={t('home.no_channels') || 'No Channels'}
            />
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  glow: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.6,
    transform: [{ scale: 1.5 }],
    zIndex: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    zIndex: 1,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800', 
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { 
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: 8,
  },
  sectionIndicator: {
    width: 4,
    height: 14,
    borderRadius: 2,
    opacity: 0.8,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    opacity: 0.6,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
});
