import React from 'react';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { MessageSquareText } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing } from '@/constants/styles';

export default function MessagesScreen() {
  const { colors } = useTheme();

  return (
    <ThemedView style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      textAlign: 'center',
    }}>
      <div style={{
        width: 80,
        height: 80,
        borderRadius: '50%',
        backgroundColor: `${colors.primary}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
      }}>
        <MessageSquareText size={40} color={colors.primary} />
      </div>

      <ThemedText type="title">Mensajes directos</ThemedText>
      
      <ThemedText style={{
        marginTop: spacing.sm,
        fontSize: 16,
        opacity: 0.6,
        maxWidth: 300,
        display: 'block',
      }}>
        Conversaciones privadas con amigos
      </ThemedText>
      
      <div style={{
        marginTop: 32,
        padding: '8px 16px',
        backgroundColor: colors.backgroundSecondary,
        borderRadius: 20,
      }}>
        <ThemedText style={{
          fontSize: 14,
          opacity: 0.7,
          fontWeight: '600',
        }}>
          Próximamente en Sprint 4 💬
        </ThemedText>
      </div>
    </ThemedView>
  );
}
