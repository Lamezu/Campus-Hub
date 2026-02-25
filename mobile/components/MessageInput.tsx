import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const chatTheme = colors.chat;

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  return (
    <View style={[
      styles.container,
      {
        backgroundColor: chatTheme.id === 'default' ? colors.background : chatTheme.background,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, spacing.sm)
      }
    ]}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: chatTheme.id === 'default' ? colors.backgroundSecondary : chatTheme.bubbleOther + '40',
            color: chatTheme.id === 'default' ? colors.text : chatTheme.textOther
          }
        ]}
        placeholder="Escribe un mensaje..."
        placeholderTextColor={chatTheme.id === 'default' ? colors.textSecondary : chatTheme.textOther + '80'}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={5000}
        editable={!disabled}
      />
      <TouchableOpacity
        style={[
          styles.sendButton,
          { backgroundColor: colors.primary },
          (!text.trim() || disabled) && styles.sendButtonDisabled
        ]}
        onPress={handleSend}
        disabled={!text.trim() || disabled}
        activeOpacity={0.7}
      >
        <Ionicons name="paper-plane" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    marginRight: spacing.sm,
    fontSize: typography.sizes.md,
    maxHeight: 120,
    minHeight: 40,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
