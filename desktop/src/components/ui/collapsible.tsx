import { PropsWithChildren, useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const theme = useColorScheme() ?? 'light';

  const styles = {
    heading: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 6,
      display: 'flex',
      cursor: 'pointer',
      opacity: 1,
    },
    content: {
      marginTop: 6,
      marginLeft: 24,
    },
  };

  return (
    <ThemedView>
      <button
        style={styles.heading as any}
        onClick={() => setIsOpen((value) => !value)}>
        <IconSymbol
          name="chevron.right"
          size={18}
          weight="medium"
          color={theme === 'light' ? Colors.light.icon : Colors.dark.icon}
          style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}
        />

        <ThemedText type="defaultSemiBold">{title}</ThemedText>
      </button>
      {isOpen && <ThemedView style={styles.content as any}>{children}</ThemedView>}
    </ThemedView>
  );
}
