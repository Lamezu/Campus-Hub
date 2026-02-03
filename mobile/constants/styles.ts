import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#007AFF',
  secondary: '#5856D6',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',
  background: '#FFFFFF',
  backgroundSecondary: '#F5F5F5',
  text: '#000000',
  textSecondary: '#999999',
  border: '#DDDDDD',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    semibold: '600' as const,
    bold: 'bold' as const,
  },
};

export const commonStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.md,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.md,
    fontSize: typography.sizes.md,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});