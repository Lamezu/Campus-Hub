import { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, SectionList, TouchableOpacity, View, ActivityIndicator } from 'react-native';
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
import { Settings } from 'lucide-react-native';
import { CHANNELS } from '@/constants/channelData';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToChannelUnread } from '@/services/channelReadService';
import type { Channel, StudyGroup } from '@/types';

function studyGroupToChannel(g: StudyGroup, unreadCount = 0): Channel {
  return {
    id: `sg_${g.id}`,
    name: g.name,
    description: `${g.subject} · ${g.memberCount} miembro${g.memberCount !== 1 ? 's' : ''}`,
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
  const insets = useSafeAreaInsets();
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
            await setDoc(doc(db, 'channels', ch.id, 'members', user.uid), {
              userId: user.uid,
              role: 'member',
              joinedAt: serverTimestamp(),
              notifications: true
            }, { merge: true });
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
      title: 'Canales',
      data: realChannels.map(ch => ({
        channel: { ...ch, unreadCount: unreadCounts[ch.id] ?? 0 },
        realId: ch.id,
      })),
    };
    if (myGroups.length === 0) return [channelSection];
    const groupSection: Section = {
      title: 'Mis grupos',
      data: myGroups.map(g => ({
        channel: studyGroupToChannel(g, unreadCounts[g.id] ?? 0),
        color: g.color,
        realId: g.id,
      })),
    };
    return [channelSection, groupSection];
  }, [myGroups, unreadCounts, realChannels]);

  const handlePress = (item: Section['data'][number]) => {
    router.push({ pathname: '/chat/[id]', params: { id: item.channel.id } });
  };

  if (!user) return null;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border, paddingTop: insets.top + spacing.sm }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Campus Hub</ThemedText>
        <View style={styles.headerActions}>
          <NotificationBell category="channel" />
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/settings')}>
            <Settings size={22} color={colors.text} strokeWidth={1.8} />
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
              <View style={[styles.sectionHeader, { backgroundColor: colors.backgroundSecondary, borderBottomColor: colors.border }]}>
                <ThemedText style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                  {section.title.toUpperCase()}
                </ThemedText>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.center}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                No hay canales disponibles.
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: typography.sizes.xl, fontWeight: 'bold' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: spacing.sm },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: typography.sizes.sm, textAlign: 'center' },
});
