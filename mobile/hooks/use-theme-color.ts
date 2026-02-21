import { useTheme } from '@/contexts/ThemeContext';
import { type ThemeColors } from '@/constants/styles';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof ThemeColors
) {
  const { theme, colors } = useTheme();

  // If the user provided a direct color for light/dark, respect it (legacy/manual override)
  if (theme === 'light' && props.light) {
    return props.light;
  }
  if (theme === 'dark' && props.dark) {
    return props.dark;
  }

  // Otherwise return the themed color from our new context
  return colors[colorName as keyof ThemeColors];
}
