import type { PropsWithChildren, ReactElement } from 'react';

import { ThemedView } from '@/components/themed-view';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const HEADER_HEIGHT = 250;

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
}: Props) {
  const backgroundColor = useThemeColor({}, 'background');
  const colorScheme = useColorScheme() ?? 'light';

  const styles = {
    container: {
      flex: 1,
    },
    header: {
      height: HEADER_HEIGHT,
      overflow: 'hidden' as const,
      backgroundColor: headerBackgroundColor[colorScheme as 'dark' | 'light'],
    },
    content: {
      flex: 1,
      padding: 32,
      gap: 16,
      overflow: 'hidden' as const,
    },
  };

  return (
    <div style={{ backgroundColor, flex: 1, display: 'flex', flexDirection: 'column', height: '100vh', overflowY: 'auto' }}>
      <div style={styles.header as any}>
        {headerImage}
      </div>
      <ThemedView style={styles.content as any}>{children}</ThemedView>
    </div>
  );
}
