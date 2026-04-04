import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, AlertTriangle, Eye, EyeOff } from 'lucide-react-native';
import { signOut } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import { deleteUserAccount } from '@/services/userService';

export default function DeleteAccountScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = password.trim().length > 0 && confirmed && !loading;

  const handleDelete = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await deleteUserAccount(password);
      await signOut(auth);
      router.replace('/auth/login');
    } catch (err: any) {
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        setError(t('delete_account.error_wrong_password'));
      } else {
        setError(t('delete_account.error_generic'));
      }
    } finally {
      setLoading(false);
    }
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
          {t('delete_account.title')}
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Warning banner */}
        <View style={[styles.warningCard, { backgroundColor: '#FF3B3015', borderColor: '#FF3B30' }]}>
          <AlertTriangle size={22} color="#FF3B30" strokeWidth={2} />
          <ThemedText style={[styles.warningText, { color: '#FF3B30' }]}>
            {t('delete_account.warning')}
          </ThemedText>
        </View>

        {/* Password */}
        <ThemedText style={[styles.label, { color: colors.textSecondary }]}>
          {t('delete_account.password_label')}
        </ThemedText>
        <View style={[styles.inputRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder={t('delete_account.password_placeholder')}
            placeholderTextColor={colors.textSecondary}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={v => { setPassword(v); setError(''); }}
            autoCapitalize="none"
          />
          <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
            {showPassword
              ? <EyeOff size={20} color={colors.textSecondary} strokeWidth={1.8} />
              : <Eye size={20} color={colors.textSecondary} strokeWidth={1.8} />
            }
          </TouchableOpacity>
        </View>

        {error ? (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        ) : null}

        {/* Confirmation checkbox */}
        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setConfirmed(v => !v)}
          activeOpacity={0.7}
        >
          <View style={[
            styles.checkbox,
            { borderColor: confirmed ? '#FF3B30' : colors.border },
            confirmed && { backgroundColor: '#FF3B30' },
          ]}>
            {confirmed && <ThemedText style={styles.checkmark}>✓</ThemedText>}
          </View>
          <ThemedText style={[styles.checkLabel, { color: colors.text }]}>
            {t('delete_account.checkbox')}
          </ThemedText>
        </TouchableOpacity>

        {/* Delete button */}
        <TouchableOpacity
          style={[
            styles.deleteBtn,
            { backgroundColor: canSubmit ? '#FF3B30' : colors.border },
          ]}
          onPress={handleDelete}
          disabled={!canSubmit}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.deleteBtnText}>
              {t('delete_account.confirm_btn')}
            </ThemedText>
          )}
        </TouchableOpacity>
      </ScrollView>
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
  body: { padding: spacing.lg, gap: spacing.lg },
  warningCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    padding: spacing.md, borderRadius: 12, borderWidth: 1.5,
  },
  warningText: { flex: 1, fontSize: typography.sizes.sm, lineHeight: 20, fontWeight: '600' },
  label: { fontSize: typography.sizes.sm, fontWeight: '600', marginBottom: -spacing.sm },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  input: { flex: 1, fontSize: typography.sizes.md, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  eyeBtn: { padding: 4 },
  errorText: { color: '#FF3B30', fontSize: typography.sizes.sm, marginTop: -spacing.sm },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: {
    width: 24, height: 24, borderRadius: 6, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '800', lineHeight: 18 },
  checkLabel: { flex: 1, fontSize: typography.sizes.md, lineHeight: 22 },
  deleteBtn: {
    paddingVertical: spacing.md + 2, borderRadius: 14,
    alignItems: 'center', marginTop: spacing.sm,
  },
  deleteBtnText: { color: '#fff', fontSize: typography.sizes.md, fontWeight: '700' },
});
