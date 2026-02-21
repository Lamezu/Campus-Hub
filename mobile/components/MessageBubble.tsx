import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from './themed-text';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Message } from '@/types';

interface MessageBubbleProps {
  message: Message;
  isOwnMessage: boolean;
}

export function MessageBubble({ message, isOwnMessage }: MessageBubbleProps) {
  const { colors } = useTheme();
  const chatTheme = colors.chat;
  const settings = colors.chatSettings;

  return (
    <View style={[styles.container, isOwnMessage ? styles.ownContainer : styles.otherContainer]}>
      {!isOwnMessage && (
        <ThemedText style={[styles.senderName, { color: chatTheme.nameColor }]}>
          {message.senderName}
        </ThemedText>
      )}
      <View style={[
        styles.bubble,
        {
          backgroundColor: isOwnMessage ? chatTheme.bubbleOwn : chatTheme.bubbleOther,
          borderBottomRightRadius: isOwnMessage ? 4 : 20,
          borderBottomLeftRadius: isOwnMessage ? 20 : 4,
        }
      ]}>
        <ThemedText style={[
          styles.messageText,
          {
            color: isOwnMessage ? chatTheme.textOwn : chatTheme.textOther,
            fontSize: settings.fontSize,
            fontWeight: settings.fontWeight,
            fontStyle: settings.fontStyle
          }
        ]}>
          {message.text}
        </ThemedText>
        <ThemedText style={[
          styles.time,
          {
            color: isOwnMessage ? chatTheme.textOwn + '99' : chatTheme.textOther + '99',
            fontSize: Math.max(10, settings.fontSize - 4)
          }
        ]}>
          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: spacing.sm, maxWidth: '80%' },
  ownContainer: { alignSelf: 'flex-end' },
  otherContainer: { alignSelf: 'flex-start' },
  senderName: { fontSize: typography.sizes.xs, marginBottom: 4, marginLeft: 12 },
  bubble: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 20, elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 1 },
  messageText: { fontSize: typography.sizes.md },
  time: { fontSize: 10, alignSelf: 'flex-end', marginTop: 2 }
});
