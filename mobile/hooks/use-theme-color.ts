import { useTheme } from '@/contexts/ThemeContext';
import { type ThemeColors } from '@/constants/styles';

type StringColorKey = { [K in keyof ThemeColors]: ThemeColors[K] extends string ? K : never }[keyof ThemeColors];

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: StringColorKey
): string {
  const { theme, colors } = useTheme();

  if (theme === 'light' && props.light) {
    return props.light;
  }
  if (theme === 'dark' && props.dark) {
    return props.dark;
  }

  return colors[colorName] as string;
}
