import React, { useEffect } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  StatusBar, Alert, ActivityIndicator, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Plus, Check, Trash2, User as UserIcon } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useAccounts, type StoredAccount } from '@/contexts/AccountsContext';
import { spacing, typography } from '@/constants/styles';
import { EmptyState } from '@/components/EmptyState';

export default function AccountsScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { accounts, activeUid, switching, switchAccount, removeAccount } = useAccounts();

  useEffect(() => {
    accounts
      .filter(a => a.uid !== activeUid && !a._pw)
      .forEach(a => removeAccount(a.uid));
  }, [accounts, activeUid]);

  const visibleAccounts = accounts.filter(a => a.uid === activeUid || !!a._pw);

  const handleSwitch = async (account: StoredAccount) => {
    if (account.uid === activeUid || switching) return;
    try {
      await switchAccount(account);
      router.replace('/(tabs)');
    } catch {
      Alert.alert(t('common.error') || 'Error', t('accounts.error_switch'));
    }
  };

  const handleRemove = (account: StoredAccount) => {
    if (account.uid === activeUid) return;
    Alert.alert(
      t('accounts.remove_confirm_title'),
      t('accounts.remove_confirm_msg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('accounts.remove'), style: 'destructive', onPress: () => removeAccount(account.uid) },
      ]
    );
  };

  const renderItem = ({ item }: { item: StoredAccount }) => {
    const isActive = item.uid === activeUid;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: colors.border }, isActive && { backgroundColor: colors.primary + '08' }]}
        onPress={() => handleSwitch(item)}
        activeOpacity={isActive ? 1 : 0.7}
        disabled={switching}
      >
        <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
          {item.photoURL
            ? <Image source={{ uri: item.photoURL }} style={styles.avatarImg} />
            : <UserIcon size={22} color={colors.primary} strokeWidth={1.8} />
          }
        </View>
        <View style={styles.info}>
          <ThemedText style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {item.displayName || item.email}
          </ThemedText>
          <ThemedText style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.email}
          </ThemedText>
        </View>
        <View style={styles.rowRight}>
          {isActive
            ? <Check size={20} color={colors.primary} strokeWidth={2.5} />
            : switching
              ? <ActivityIndicator size="small" color={colors.primary} />
              : (
                <TouchableOpacity onPress={() => handleRemove(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Trash2 size={18} color={colors.textSecondary} strokeWidth={1.8} />
                </TouchableOpacity>
              )
          }
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.background} />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>
          {t('accounts.title')}
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <FlatList
        data={visibleAccounts}
        keyExtractor={item => item.uid}
        renderItem={renderItem}
        ListEmptyComponent={
          <EmptyState icon={UserIcon} title={t('accounts.no_accounts')} />
        }
        ListFooterComponent={
          <TouchableOpacity
            style={[styles.addBtn, { borderColor: colors.primary }]}
            onPress={() => router.push('/add-account' as never)}
            activeOpacity={0.7}
            disabled={switching}
          >
            <Plus size={18} color={colors.primary} strokeWidth={2.5} />
            <ThemedText style={[styles.addBtnText, { color: colors.primary }]}>
              {t('accounts.add_account')}
            </ThemedText>
          </TouchableOpacity>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: { fontSize: typography.sizes.md, fontWeight: '700' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    justifyContent: 'center', alignItems: 'center', overflow: 'hidden', flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%' },
  info: { flex: 1, gap: 2 },
  name: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  email: { fontSize: typography.sizes.sm, lineHeight: 18 },
  rowRight: { flexShrink: 0, width: 28, alignItems: 'center' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, margin: spacing.lg, padding: spacing.md,
    borderRadius: 14, borderWidth: 1.5,
  },
  addBtnText: { fontSize: typography.sizes.md, fontWeight: '600' },
});
