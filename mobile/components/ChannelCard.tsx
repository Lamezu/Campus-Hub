import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { colors, spacing, typography } from '@/constants/styles';
import type { Channel } from '@/types';

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
}

export function ChannelCard({ channel, onPress }: ChannelCardProps) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={styles.container}>
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{channel.icon}</Text>
        </View>
        
        <View style={styles.content}>
          <Text style={styles.name}>{channel.name}</Text>
          <Text style={styles.description} numberOfLines={1}>
            {channel.description}
          </Text>
        </View>
        
        <Text style={styles.chevron}>›</Text>
      </View>
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
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.background,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.background,
    opacity: 0.6,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
    marginLeft: spacing.sm,
  },
}); 