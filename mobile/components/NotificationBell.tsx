import React, { useState, useEffect } from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Bell } from 'lucide-react-native';
import { router } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { notificationService } from '@/services/notificationService';
import { useTheme } from '@/contexts/ThemeContext';
import type { NotificationCategory } from '@/types';

interface NotificationBellProps {
  categories?: NotificationCategory | NotificationCategory[];
  size?: number;
}

export function NotificationBell({ categories, size = 24 }: NotificationBellProps) {
  const { colors } = useTheme();
  const [count, setCount] = useState(0);

  const categoryList = Array.isArray(categories) ? categories : (categories ? [categories] : []);

  useEffect(() => {
    const updateCount = () => {
      if (categoryList.length > 0) {
        const total = categoryList.reduce((acc, cat) => acc + notificationService.getUnreadCount(cat), 0);
        setCount(total);
      } else {
        const all = notificationService.getAll();
        setCount(all.filter(n => !n.read).length);
      }
    };

    updateCount();
    const unsub = notificationService.subscribe(updateCount);
    return unsub;
  }, [JSON.stringify(categoryList)]);

  const handlePress = () => {
    if (categoryList.length === 0) {
      router.push('/notifications' as never);
    } else {
      const cats = categoryList.join(',');
      router.push(`/notifications?categories=${cats}` as never);
    }
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
    // Premium glow effect
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '700',
    includeFontPadding: false,
  },
});
