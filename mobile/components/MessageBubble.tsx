import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { colors, spacing, typography } from '@/constants/styles';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, isOwnMessage && styles.ownContainer]}>
      {!isOwnMessage && (
        <Text style={styles.senderName}>{message.senderName}</Text>
      )}
      
      <View style={[styles.bubble, isOwnMessage && styles.ownBubble]}>
        <Text style={[styles.messageText, isOwnMessage && styles.ownMessageText]}>
          {message.text}
        </Text>
        <Text style={[styles.time, isOwnMessage && styles.ownTime]}>
          {formatTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
    alignItems: 'flex-start',
  },
  ownContainer: {
    alignItems: 'flex-end',
  },
  senderName: {
    fontSize: typography.sizes.xs,
    color: colors.background,
    opacity: 0.7,
    marginBottom: spacing.xs,
    marginLeft: spacing.sm,
    fontWeight: typography.weights.semibold,
  },
  bubble: {
    backgroundColor: '#e6ebe8ff',
    padding: spacing.md,
    borderRadius: 18,
    maxWidth: '80%',
  },
  ownBubble: {
    backgroundColor: colors.primary,
  },
  messageText: {
    fontSize: typography.sizes.md,
    color: '#000000ff',
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#ffffffff',
  },
  time: {
    fontSize: typography.sizes.xs,
    color: '#000000ff',
    opacity: 0.5,
    marginTop: spacing.xs,
  },
  ownTime: {
    color: '#ffffffff',
    opacity: 0.8,
  },
}); 