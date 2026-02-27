import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { X } from 'lucide-react-native';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from './themed-text';
import type { ReplyPreview } from '@/types';

interface MessageInputProps {
  onSend: (text: string) => void;
  replyTo?: ReplyPreview | null;
  onCancelReply?: () => void;
  disabled?: boolean;
}

/**
 * Parses a hex color (6 or 8 chars, with or without #) to RGB.
 * Strips any alpha channel suffix.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '').slice(0, 6);
  return {
    r: parseInt(clean.slice(0, 2), 16) || 0,
    g: parseInt(clean.slice(2, 4), 16) || 0,
    b: parseInt(clean.slice(4, 6), 16) || 0,
  };
}

/**
 * Blends foreground (at `alpha` opacity) over background and returns
 * '#1C1C1E' (dark) or '#FFFFFF' (light) whichever contrasts best.
 */
function getContrastForBlend(fgHex: string, bgHex: string, alpha = 0.4): string {
  const fg = hexToRgb(fgHex);
  const bg = hexToRgb(bgHex);
  const r = alpha * fg.r + (1 - alpha) * bg.r;
  const g = alpha * fg.g + (1 - alpha) * bg.g;
  const b = alpha * fg.b + (1 - alpha) * bg.b;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#1C1C1E' : '#FFFFFF';
}

export function MessageInput({ onSend, replyTo, onCancelReply, disabled = false }: MessageInputProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');

  const chatTheme = colors.chat;
  const isDefault = chatTheme.id === 'default';

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      onCancelReply?.();
    }
  };

  // Background of the input bubble: bubbleOther at 40% opacity
  const inputBgColor = isDefault
    ? colors.backgroundSecondary
    : chatTheme.bubbleOther + '66'; // 40% opacity in hex

  // Container background (the bar behind the input)
  const containerBgColor = isDefault ? colors.background : chatTheme.background;

  // Text color computed from the actual blended background luminance
  const inputTextColor = isDefault
    ? colors.text
    : getContrastForBlend(chatTheme.bubbleOther, chatTheme.background, 0.4);

  const placeholderColor = isDefault
    ? colors.textSecondary
    : inputTextColor + '80';

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: containerBgColor,
          borderTopColor: isDefault ? colors.border : 'transparent',
          paddingBottom: Math.max(insets.bottom, spacing.sm),
        },
      ]}
    >
      {replyTo && (
        <View style={[styles.replyBar, { borderLeftColor: colors.primary, backgroundColor: isDefault ? colors.backgroundSecondary : inputBgColor }]}>
          <View style={styles.replyBarContent}>
            <ThemedText style={[styles.replyBarName, { color: colors.primary }]} numberOfLines={1}>
              {replyTo.senderName}
            </ThemedText>
            <ThemedText style={[styles.replyBarText, { color: isDefault ? colors.textSecondary : inputTextColor }]} numberOfLines={1}>
              {replyTo.text}
            </ThemedText>
          </View>
          <TouchableOpacity
            onPress={onCancelReply}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <X size={20} color={isDefault ? colors.textSecondary : inputTextColor} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}
      <View style={styles.inputRow}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: inputBgColor,
              color: inputTextColor,
            },
          ]}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={placeholderColor}
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
            (!text.trim() || disabled) && styles.sendButtonDisabled,
          ]}
          onPress={handleSend}
          disabled={!text.trim() || disabled}
          activeOpacity={0.7}
        >
          <Ionicons name="paper-plane" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: spacing.sm,
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
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 3,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  replyBarContent: { flex: 1 },
  replyBarName: { fontSize: typography.sizes.xs, fontWeight: '600', marginBottom: 2 },
  replyBarText: { fontSize: typography.sizes.xs },
});
