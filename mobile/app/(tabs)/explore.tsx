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

      <View style={styles.header}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('common.campus') || 'Campus'}</ThemedText>
        <NotificationBell category="campus" />
      </View>

      <View style={styles.subtabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollTabs}>
          {SUBTABS.map(item => {
            const isActive = activeTab === item.id;
            return (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.pill,
                  { 
                    backgroundColor: isActive ? colors.primary : colors.card,
                    borderColor: isActive ? colors.primary : colors.border + '40'
                  }
                ]}
                onPress={() => setActiveTab(item.id)}
                activeOpacity={0.8}
              >
                {item.id === 'bulletin' && <Pin size={16} color={isActive ? '#fff' : colors.textSecondary} strokeWidth={2} />}
                {item.id === 'calendar' && <CalendarDays size={16} color={isActive ? '#fff' : colors.textSecondary} strokeWidth={2} />}
                {item.id === 'groups' && <Users size={16} color={isActive ? '#fff' : colors.textSecondary} strokeWidth={2} />}
                <ThemedText style={[
                  styles.pillText,
                  { color: isActive ? '#fff' : colors.textSecondary }
                ]}>
                  {item.label}
                </ThemedText>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: spacing.md, 
    paddingTop: spacing.md, 
    paddingBottom: spacing.sm,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtabBar: { 
    paddingVertical: spacing.md,
  },
  scrollTabs: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    flexDirection: 'row',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 1,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
