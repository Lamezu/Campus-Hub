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
  const [counts, setCounts] = useState({ channel: 0, dm: 0, total: 0 });

  useEffect(() => {
    const update = () => {
      setCounts({
        channel: notificationService.getUnreadCount('channel'),
        dm: notificationService.getUnreadCount('dm'),
        total: notificationService.getUnreadCount()
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
          title: t('tabs.home') || 'Inicio',
          tabBarIcon: ({ color }) => (
            <House size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.channel > 0 ? counts.channel : undefined,
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
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: t('tabs.explore') || 'Explorar',
          tabBarIcon: ({ color }) => (
            <Compass size={26} color={color} strokeWidth={2} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: t('tabs.messages') || 'Mensajes',
          tabBarIcon: ({ color }) => (
            <MessagesSquare size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: counts.dm > 0 ? counts.dm : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t('tabs.profile') || 'Perfil',
          tabBarIcon: ({ color }) => (
            <UserRound size={26} color={color} strokeWidth={2} />
          ),
          tabBarBadge: (counts.total - counts.channel - counts.dm) > 0 ? (counts.total - counts.channel - counts.dm) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.primary, fontSize: 10 },
        }}
      />
    </Tabs>
  );
}
