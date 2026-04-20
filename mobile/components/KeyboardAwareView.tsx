import React from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, ViewStyle } from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';

interface KeyboardAwareViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  extraOffset?: number;
}

export function KeyboardAwareView({ children, style, extraOffset = 0 }: KeyboardAwareViewProps) {
  const headerHeight = useHeaderHeight();
  return (
    <KeyboardAvoidingView
      style={[styles.container, style]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight + extraOffset}
      enabled={Platform.OS === 'ios'}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
