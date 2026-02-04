import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { colors, spacing, typography } from '@/constants/styles';
import type { Channel } from '@/constants/mockData';

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
}

export function ChannelCard({ channel, onPress }: ChannelCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <ThemedView style={styles.container}>
        <View style={styles.iconContainer}>
          <ThemedText style={styles.icon}>{channel.icon}</ThemedText>
        </View>
        
        <View style={styles.content}>
          <View style={styles.header}>
            <ThemedText style={styles.name}>{channel.name}</ThemedText>
            {channel.unreadCount > 0 && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>
                  {channel.unreadCount}
                </ThemedText>
              </View>
            )}
          </View>
          
          <ThemedText style={styles.description} numberOfLines={1}>
            {channel.lastMessage || channel.description}
          </ThemedText>
        </View>
        
        {channel.lastMessageTime && (
          <ThemedText style={styles.time}>
            {channel.lastMessageTime}
          </ThemedText>
        )}
      </ThemedView>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  description: {
    fontSize: typography.sizes.sm,
    opacity: 0.6,
  },
  badge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  time: {
    fontSize: typography.sizes.xs,
    opacity: 0.5,
    marginLeft: spacing.sm,
  },
});