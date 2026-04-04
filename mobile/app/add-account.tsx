import React, { useState } from 'react';
import {
  View, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native';
import { initializeApp, deleteApp } from 'firebase/app';
import { initializeAuth, inMemoryPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { useAccounts } from '@/contexts/AccountsContext';
import { spacing, typography } from '@/constants/styles';
import defaultApp from '@/config/firebase';

export default function AddAccountScreen() {
  const { colors, theme } = useTheme();
  const { t } = useTranslation();
  const { addAccount, activeUid, accounts } = useAccounts();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = email.trim().length > 0 && password.length > 0 && !loading;

  const handleAdd = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');

    const tempAppName = `add-account-${Date.now()}`;
    const tempApp = initializeApp((defaultApp as any).options, tempAppName);
    const tempAuth = initializeAuth(tempApp, { persistence: inMemoryPersistence });

    try {
      const credential = await signInWithEmailAndPassword(tempAuth, email.trim(), password);
      const { uid, displayName, photoURL, refreshToken } = credential.user;

      if (uid === activeUid) {
        setError(t('accounts.error_already_active'));
        await signOut(tempAuth);
        return;
      }

      if (accounts.some(a => a.uid === uid)) {
        setError(t('accounts.error_already_added'));
        await signOut(tempAuth);
        return;
      }

      addAccount({
        uid,
        email: credential.user.email ?? email.trim(),
        displayName: displayName ?? email.trim(),
        photoURL: photoURL ?? null,
        refreshToken,
        _pw: btoa(password),
      });

      await signOut(tempAuth);
      router.back();
    } catch (err: any) {
      const code = err?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError(t('roles.errors.invalid_credentials') || 'Invalid Credentials');
      } else if (code === 'auth/invalid-email') {
        setError(t('auth.invalid_email') || 'Invalid Email');
      } else {
        setError(t('common.error') || 'Error');
      }
    } finally {
      setLoading(false);
      await deleteApp(tempApp).catch(() => { });
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
          {t('accounts.add_account_title')}
        </ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <ThemedText style={[styles.hint, { color: colors.textSecondary }]}>
            {t('accounts.add_account_hint')}
          </ThemedText>

          <View style={[styles.inputRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              value={email}
              onChangeText={v => { setEmail(v); setError(''); }}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={[styles.inputRow, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
            <TextInput
              style={[styles.input, { color: colors.text }]}
              placeholder={t('auth.password') || 'Password'}
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

          {error ? <ThemedText style={styles.errorText}>{error}</ThemedText> : null}

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: canSubmit ? colors.primary : colors.border }]}
            onPress={handleAdd}
            disabled={!canSubmit}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" size="small" />
              : <ThemedText style={styles.submitBtnText}>{t('accounts.add_account')}</ThemedText>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  body: { padding: spacing.lg, gap: spacing.md },
  hint: { fontSize: typography.sizes.sm, lineHeight: 20 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
  },
  input: { flex: 1, fontSize: typography.sizes.md, paddingVertical: Platform.OS === 'ios' ? 14 : 10 },
  eyeBtn: { padding: 4 },
  errorText: { color: '#FF3B30', fontSize: typography.sizes.sm },
  submitBtn: {
    paddingVertical: spacing.md + 2, borderRadius: 14,
    alignItems: 'center', marginTop: spacing.sm,
  },
  submitBtnText: { color: '#fff', fontSize: typography.sizes.md, fontWeight: '700' },
});
