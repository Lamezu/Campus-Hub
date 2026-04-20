import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { House, GraduationCap, Compass, MessagesSquare, UserRound } from 'lucide-react-native';

import { HapticTab } from '@/components/haptic-tab';
import { useTheme } from '@/contexts/ThemeContext';
import { notificationService } from '@/services/notificationService';
import { useTranslation } from '@/hooks/useTranslation';
import { useState, useEffect } from 'react';

export default function TabLayout() {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [counts, setCounts] = useState({ home: 0, messages: 0, campus: 0, profile: 0 });
  
  useEffect(() => {
    const update = () => {
      setCounts({
        home: notificationService.getUnreadCount('channel'),
        messages: notificationService.getUnreadCount('dm') + notificationService.getUnreadCount('support'),
        campus: notificationService.getUnreadCount('campus'),
        profile: notificationService.getUnreadCount('friend') + notificationService.getUnreadCount('social'),
      });
    };
    update();
    return notificationService.subscribe(update);
  }, []);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: Platform.select({
          ios: {
            position: 'absolute',
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            elevation: 0,
            shadowOpacity: 0,
          },
          default: {
            backgroundColor: colors.card,
            borderTopColor: colors.border,
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
        }),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home') || 'Home',
          tabBarIcon: ({ color }) => (
            <House size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.home > 0 ? counts.home : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: t('tabs.campus') || 'Campus',
          tabBarIcon: ({ color }) => (
            <GraduationCap size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.campus > 0 ? counts.campus : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.explore') || 'Explore',
          tabBarIcon: ({ color }) => (
            <Compass size={26} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages') || 'Messages',
          tabBarIcon: ({ color }) => (
            <MessagesSquare size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.messages > 0 ? counts.messages : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile') || 'Profile',
          tabBarIcon: ({ color }) => (
            <UserRound size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.profile > 0 ? counts.profile : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
    </Tabs>
  );
}
