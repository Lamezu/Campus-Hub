import React, { useState, useCallback, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, TextInput, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { PenSquare, Search, MessageSquare } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { DMConversationItem } from '@/components/dm/DMConversationItem';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { auth } from '@/config/firebase';
import { subscribeToConversations } from '@/services/dmService';
import { useTranslation } from '@/hooks/useTranslation';
import type { DMConversation } from '@/types';

export default function MessagesScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [conversations, setConversations] = useState<DMConversation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const meId = auth.currentUser?.uid;
    if (!meId) return;
    const unsub = subscribeToConversations(meId, setConversations, (err) => {
      console.error('Messages subscription error:', err);
      if (err.code === 'failed-precondition') {
        setError(t('dm.db_index_error') || 'Falta un índice en la base de datos para cargar las conversaciones.');
      }
    });
    return unsub;
  }, []);

  const filtered = query.trim()
    ? conversations.filter(c =>
      c.participantName.toLowerCase().includes(query.toLowerCase())
    )
    : conversations;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleConversationPress = useCallback((conversation: DMConversation) => {
    router.push(`/dm/${conversation.participantId}` as never);
  }, []);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.title, { color: colors.text }]}>{t('dm.title') || 'Mensajes'}</ThemedText>
        <View style={styles.headerActions}>
          <NotificationBell category="dm" />
          <TouchableOpacity
            onPress={() => router.push('/dm/compose' as never)}
            style={styles.newButton}
            activeOpacity={0.7}
          >
            <PenSquare size={24} color={colors.primary} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchBar, { backgroundColor: colors.backgroundSecondary }]}>
        <Search size={16} color={colors.textSecondary} strokeWidth={2} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder={t('dm.search_conversations') || 'Buscar conversación...'}
          placeholderTextColor={colors.textSecondary}
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <DMConversationItem
            conversation={item}
            onPress={handleConversationPress}
          />
        )}
        refreshing={refreshing}
        onRefresh={handleRefresh}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            {error ? (
              <>
                <ThemedText style={[styles.errorText, { color: colors.danger ?? '#FF3B30' }]}>
                  ⚠️ {error}
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {t('dm.db_index_help') || 'Por favor, revisa la consola de Firebase para crear el índice necesario.'}
                </ThemedText>
              </>
            ) : (
              <>
                <MessageSquare size={48} color={colors.textSecondary} strokeWidth={1.5} />
                <ThemedText style={[styles.emptyTitle, { color: colors.text }]}>
                  {query ? (t('dm.no_results') || 'Sin resultados') : (t('dm.no_messages_title') || 'Sin mensajes')}
                </ThemedText>
                <ThemedText style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
                  {query
                    ? (t('dm.no_results_with', { query }) || `No hay conversaciones con "${query}"`)
                    : (t('dm.start_dm_help') || 'Empieza una conversación con alguien')}
                </ThemedText>
              </>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: typography.sizes.xl,
    lineHeight: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  newButton: {
    padding: spacing.xs,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm + 2 : spacing.xs,
    gap: spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    includeFontPadding: false,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    lineHeight: 24,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    textAlign: 'center',
  },
});
