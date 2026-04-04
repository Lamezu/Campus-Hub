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
import { useTranslation } from '@/hooks/useTranslation';

import { AnnouncementsTab } from '@/components/explore/AnnouncementsTab';
import { CalendarTab } from '@/components/explore/CalendarTab';
import { GroupsTab } from '@/components/explore/GroupsTab';

export default function CampusScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { can, role, subrole } = useCurrentUser();
  const { revealHighlight, tab, highlightDay, eventId } = useLocalSearchParams<{ revealHighlight: string; tab: string; highlightDay: string; eventId: string }>();

  const SUBTABS = [
    { id: 'bulletin', label: t('common.bulletin_board') || 'Bulletin Board' },
    { id: 'calendar', label: t('common.calendar') || 'Calendar' },
    { id: 'groups', label: t('common.groups') || 'Groups' }
  ] as const;

  const [activeTab, setActiveTab] = useState<typeof SUBTABS[number]['id']>('bulletin');

  useEffect(() => {
    if (revealHighlight) setActiveTab('bulletin');
  }, [revealHighlight]);

  useEffect(() => {
    if (tab === 'Calendario' || tab === 'calendar') setActiveTab('calendar');
  }, [tab]);

  const eventTypes = allowedEventTypes(role, subrole);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('common.campus') || 'Campus'}</ThemedText>
        <NotificationBell category="campus" />
      </View>

      <View style={[styles.subtabBar, { borderBottomColor: colors.border + '33', backgroundColor: colors.background }]}>
        {SUBTABS.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.subtab}
            onPress={() => setActiveTab(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.subtabInner}>
              {item.id === 'bulletin' && <Pin size={16} color={activeTab === item.id ? colors.primary : colors.textSecondary} strokeWidth={activeTab === item.id ? 2.5 : 2} />}
              {item.id === 'calendar' && <CalendarDays size={16} color={activeTab === item.id ? colors.primary : colors.textSecondary} strokeWidth={activeTab === item.id ? 2.5 : 2} />}
              {item.id === 'groups' && <Users size={16} color={activeTab === item.id ? colors.primary : colors.textSecondary} strokeWidth={activeTab === item.id ? 2.5 : 2} />}
              <ThemedText style={[
                styles.subtabText,
                {
                  color: activeTab === item.id ? colors.primary : colors.textSecondary,
                  fontWeight: activeTab === item.id ? '700' : '600'
                }
              ]}>
                {item.label}
              </ThemedText>
            </View>
            {activeTab === item.id && (
              <Animated.View
                style={[styles.subtabUnderline, { backgroundColor: colors.primary }]}
              />
            )}
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ flex: 1, display: activeTab === 'bulletin' ? 'flex' : 'none' }}>
        <AnnouncementsTab canCreateAnnouncement={can('createAnnouncement')} highlightId={revealHighlight} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'calendar' ? 'flex' : 'none' }}>
        <CalendarTab eventTypes={eventTypes} highlightDay={highlightDay} highlightEventId={eventId} />
      </View>
      <View style={{ flex: 1, display: activeTab === 'groups' ? 'flex' : 'none' }}>
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
  subtab: { flex: 1, alignItems: 'center', paddingTop: spacing.md },
  subtabInner: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingBottom: spacing.md },
  subtabText: { fontSize: typography.sizes.sm, fontWeight: '600' },
  subtabUnderline: { height: 3, width: '60%', borderRadius: 1.5, marginTop: -1.5 },
});
