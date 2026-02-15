import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
} from 'react-native';
import { colors, spacing, typography } from '@/constants/styles';

interface MessageInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled = false }: MessageInputProps) { 
  const [text, setText] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const handleSend = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
    }
  };

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates?.height || 0);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const basePadding = Platform.OS === 'android' ? spacing.lg + 16 : spacing.md;
  const androidCap = 70;
  const appliedPadding = basePadding + (Platform.OS === 'android' ? Math.min(keyboardHeight, androidCap) : 0);

  const behavior = Platform.OS === 'ios' ? 'padding' : 'height';
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 90 : 0;

  return (
    <KeyboardAvoidingView behavior={behavior} keyboardVerticalOffset={keyboardVerticalOffset}>
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[
          styles.container,
          { paddingBottom: appliedPadding },
        ]}>
          <TextInput
            style={styles.input}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.textSecondary}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={5000}
            editable={!disabled}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!text.trim() || disabled) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!text.trim() || disabled}
            activeOpacity={0.7}
          >
            <View style={styles.sendIconContainer}>
              <View style={styles.sendIcon} />
            </View>
          </TouchableOpacity>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: spacing.md,
    paddingBottom: Platform.OS === 'android' ? spacing.lg + 16 : spacing.md,
    marginBottom: Platform.OS === 'android' ? 12 : 0,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#ffffffff',
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginRight: spacing.sm,
    fontSize: typography.sizes.md,
    maxHeight: 100,
    color: '#030303ff',
  },
  sendButton: {
    backgroundColor: colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIconContainer: {
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendIcon: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderLeftColor: '#ffffffff',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    marginLeft: 2,
  },
});