import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { notificationService } from '@/services/notificationService';
import { useTheme } from '@/contexts/ThemeContext';
import type { NotificationCategory } from '@/types';

interface NotificationBellProps {
  category?: NotificationCategory;
  size?: number;
}

export function NotificationBell({ category, size = 24 }: NotificationBellProps) {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);

  useEffect(() => {
    const updateCount = () => {
      if (category) {
        setCount(notificationService.getUnreadCount(category));
      } else {
        const all = notificationService.getAll();
        setCount(all.filter(n => !n.read).length);
      }
    };

    updateCount();
    const unsub = notificationService.subscribe(updateCount);
    return unsub;
  }, [category]);

  const handlePress = () => {
    const params = category ? `?category=${category}` : '';
    router.push(`/notifications${params}` as never);
  };

  return (
    <TouchableOpacity onPress={handlePress} style={styles.container} activeOpacity={0.7}>
      <Bell size={size} color={colors.text} strokeWidth={1.8} />
      {count > 0 && (
        <View style={[styles.badge, { backgroundColor: colors.danger ?? '#FF3B30' }]}>
          <ThemedText style={styles.badgeText}>
            {count > 99 ? '99+' : String(count)}
          </ThemedText>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
