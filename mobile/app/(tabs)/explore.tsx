import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pin, CalendarDays, Users } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { useTheme } from '@/contexts/ThemeContext';
import { useCurrentUser } from '@/contexts/UserContext';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { spacing, typography } from '@/constants/styles';
import { allowedEventTypes } from '@/utils/permissions';

import { AnnouncementsTab } from '@/components/explore/AnnouncementsTab';
import { CalendarTab } from '@/components/explore/CalendarTab';
import { GroupsTab } from '@/components/explore/GroupsTab';

const SUBTABS = ['Tablón', 'Calendario', 'Grupos'] as const;
type Subtab = typeof SUBTABS[number];

export default function CampusScreen() {
  const { colors, theme } = useTheme();
  const { can, role, subrole } = useCurrentUser();
  const { revealHighlight, tab, highlightDay } = useLocalSearchParams<{ revealHighlight: string; tab: string; highlightDay: string }>();
  const [activeTab, setActiveTab] = useState<Subtab>('Tablón');

  useEffect(() => {
    if (revealHighlight) setActiveTab('Tablón');
  }, [revealHighlight]);

  useEffect(() => {
    if (tab === 'Calendario') setActiveTab('Calendario');
  }, [tab]);

  const eventTypes = allowedEventTypes(role, subrole);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Campus</ThemedText>
        <NotificationBell category="campus" />
      </View>

      <View style={[styles.subtabBar, { borderBottomColor: colors.border + '33', backgroundColor: colors.background }]}>
        {SUBTABS.map(tab => (
          <TouchableOpacity
            key={tab}
            style={styles.subtab}
            onPress={() => setActiveTab(tab)}
            activeOpacity={0.7}
          >
            <View style={styles.subtabInner}>
              {tab === 'Tablón' && <Pin size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
              {tab === 'Calendario' && <CalendarDays size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
              {tab === 'Grupos' && <Users size={16} color={activeTab === tab ? colors.primary : colors.textSecondary} strokeWidth={activeTab === tab ? 2.5 : 2} />}
              <ThemedText style={[
                styles.subtabText,
                {
                  color: activeTab === tab ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === tab ? '700' : '600'
                }
              ]}>
                {tab}
              </ThemedText>
            </View>
            {activeTab === tab && (
              <Animated.View
                style={[styles.subtabUnderline, { backgroundColor: colors.primary }]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, display: activeTab === 'Tablón' ? 'flex' : 'none' }}>
        <AnnouncementsTab canCreateAnnouncement={can('createAnnouncement')} highlightId={revealHighlight} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'Calendario' ? 'flex' : 'none' }}>
        <CalendarTab eventTypes={eventTypes} highlightDay={highlightDay} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'Grupos' ? 'flex' : 'none' }}>
        <GroupsTab canCreate={can('createStudyGroup')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { fontSize: typography.sizes.xl, fontWeight: 'bold' },
  subtabBar: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  subtab: { flex: 1, alignItems: 'center', paddingTop: spacing.sm },
  subtabInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: spacing.sm },
  subtabText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  subtabUnderline: { height: 3, width: '60%', borderRadius: 1.5, marginTop: -1.5 },
});
