import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Channel } from '@/types';

interface ChannelCardProps {
  channel: Channel;
  onPress: () => void;
}

export function ChannelCard({ channel, onPress }: ChannelCardProps) {
  const { colors } = useTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.container, { borderBottomColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.backgroundSecondary }]}>
          <Text style={styles.icon}>{channel.icon}</Text>
        </View>

        <View style={styles.content}>
          <Text style={[styles.name, { color: colors.text }]}>{channel.name}</Text>
          <Text style={[styles.description, { color: colors.text }]} numberOfLines={1}>
            {channel.description}
          </Text>
        </View>

        <Text style={[styles.chevron, { color: colors.textSecondary }]}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    borderBottomWidth: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    opacity: 0.6,
  },
  chevron: {
    fontSize: 24,
    marginLeft: spacing.sm,
  },
});