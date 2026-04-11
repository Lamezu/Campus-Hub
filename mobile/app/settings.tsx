import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { spacing, typography, type AppTheme } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { previewTone } from '@/utils/toneGenerator';
import { useTranslation } from '@/hooks/useTranslation';
import type { MuteDuration } from '@/types';

const MUTE_OPTIONS = (t: any): { value: MuteDuration; label: string }[] => [
  { value: '8h', label: t('settings.mute_options.8h') || '8h' },
  { value: '1w', label: t('settings.mute_options.1w') || '1w' },
  { value: 'always', label: t('settings.mute_options.always') || 'Always' },
  { value: 'off', label: t('settings.mute_options.off') || 'Off' },
];

const ALERT_TONES = (t: any) => [
  { value: 'default', label: t('settings.alert_tones.default') || 'Alert Tones default' },
  { value: 'classic', label: t('settings.alert_tones.classic') || 'Classic' },
  { value: 'soft', label: t('settings.alert_tones.soft') || 'Soft' },
  { value: 'melody', label: t('settings.alert_tones.melody') || 'Melody' },
  { value: 'bell', label: t('settings.alert_tones.bell') || 'Bell' },
  { value: 'pulse', label: t('settings.alert_tones.pulse') || 'Pulse' },
  { value: 'none', label: t('settings.alert_tones.none') || 'None' }
];

const PRESET_COLORS = [
  '#007AFF', '#FF2D55', '#5856D6', '#AF52DE',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#FF3B30', '#8E8E93', '#E91E63', '#9C27B0',
  '#3F51B5', '#00BCD4', '#009688', '#4CAF50',
  '#FFEB3B', '#FF9800', '#FF5722', '#795548'
];

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [globalMute, setGlobalMute] = useState<MuteDuration>('off');
  const [globalTone, setGlobalTone] = useState('Melody');
  const currentUser = auth.currentUser;
  const { theme, colors, setTheme, setCustomPrimary, customPrimary } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Settings Snapshot error:', error);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogout = async () => {
    Alert.alert(
      t('common.logout'),
      t('common.logout_confirm') || 'Logout Confirm',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.logout'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/auth/login');
            } catch (error) {
              Alert.alert(t('common.error') || 'Error', t('settings.logout_error') || 'Logout Error');
            }
          }
        }
      ]
    );
  };

  const ThemeOption = ({ id, label, current }: { id: AppTheme; label: string; current: boolean }) => (
    <TouchableOpacity
      style={[
        styles.themeOption,
        { borderColor: current ? colors.primary : colors.border },
        current && { backgroundColor: colors.primary + '11' }
      ]}
      onPress={() => setTheme(id)}
    >
      <ThemedText style={[styles.themeLabel, current && { color: colors.primary }]}>{label}</ThemedText>
      {current && <ThemedText style={{ color: colors.primary }}>✓</ThemedText>}
    </TouchableOpacity>
  );

  const handleMuteChange = async (value: MuteDuration) => {
    setGlobalMute(value);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalMute': value });
    }
  };

  const handleToneChange = async (toneValue: string) => {
    setGlobalTone(toneValue);
    previewTone(toneValue);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalTone': toneValue });
    }
  };

  useEffect(() => {
    if (userData?.settings?.globalMute) setGlobalMute(userData.settings.globalMute);
    if (userData?.settings?.globalTone) setGlobalTone(userData.settings.globalTone);
  }, [userData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.card }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.card} translucent={false} />
      <Stack.Screen options={{
        title: t('settings.title'),
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerBackTitle: '',
      }} />
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('settings.change_language')}</ThemedText>
            <View style={styles.languageContainer}>
              {[
                { id: 'es', label: t('common.spanish') || 'Spanish', flag: '🇪🇸' },
                { id: 'en', label: t('common.english') || 'English', flag: '🇺🇸' }
              ].map((item) => {
                const isSelected = language === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.langBtn,
                      { backgroundColor: isSelected ? colors.primary + '15' : colors.backgroundSecondary, borderColor: isSelected ? colors.primary : colors.border }
                    ]}
                    onPress={() => setLanguage(item.id as any)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={styles.langFlag}>{item.flag}</ThemedText>
                    <ThemedText style={[styles.langText, { color: isSelected ? colors.primary : colors.text }]}>
                      {item.label}
                    </ThemedText>
                    {isSelected && <Check size={16} color={colors.primary} strokeWidth={3} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('settings.appearance')}</ThemedText>
            <View style={styles.themeGrid}>
              <ThemeOption id="light" label={t('common.theme_light') || 'Theme Light'} current={theme === 'light'} />
              <ThemeOption id="dark" label={t('common.theme_dark') || 'Theme Dark'} current={theme === 'dark'} />
              <ThemeOption id="high-contrast" label={t('common.theme_high_contrast') || 'Theme High Contrast'} current={theme === 'high-contrast'} />
              <ThemeOption id="pastel" label={t('common.theme_pastel') || 'Theme Pastel'} current={theme === 'pastel'} />
            </View>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('settings.custom_color') || 'Custom Color'}</ThemedText>
            <ThemedText style={styles.sectionDescription}>{t('settings.custom_color_desc') || 'Custom Color Desc'}</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
              {PRESET_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    customPrimary === color && theme === 'monochromatic' && { borderWidth: 3, borderColor: colors.text }
                  ]}
                  onPress={() => setCustomPrimary(color)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('common.profile')}</ThemedText>
            <View style={styles.infoColumn}>
              <ThemedText style={styles.label}>{t('common.name') || 'Name'}</ThemedText>
              <ThemedText style={styles.value}>{userData?.displayName || currentUser?.displayName || 'User'}</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.infoColumn}
              activeOpacity={0.7}
              onPress={() => setShowFullEmail(v => !v)}
            >
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedText
                style={styles.value}
                numberOfLines={showFullEmail ? 0 : 1}
                ellipsizeMode="tail"
              >
                {userData?.email || currentUser?.email}
              </ThemedText>
            </TouchableOpacity>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('settings.notifications')}</ThemedText>
            <ThemedText style={styles.sectionDescription}>{t('settings.mute_description') || 'Mute Description'}</ThemedText>
            <View style={styles.notifGroup}>
              {MUTE_OPTIONS(t).map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.notifOption, { borderColor: globalMute === opt.value ? colors.primary : colors.border }, globalMute === opt.value && { backgroundColor: colors.primary + '11' }]}
                  onPress={() => handleMuteChange(opt.value)}
                >
                  <ThemedText style={[styles.notifLabel, globalMute === opt.value && { color: colors.primary }]}>{opt.label}</ThemedText>
                  {globalMute === opt.value && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
            <ThemedText style={[styles.sectionDescription, { marginTop: spacing.md }]}>{t('settings.global_alert_tone') || 'Global Alert Tone'}</ThemedText>
            <View style={styles.notifGroup}>
              {ALERT_TONES(t).map(tone => (
                <TouchableOpacity
                  key={tone.value}
                  style={[styles.notifOption, { borderColor: globalTone === tone.value ? colors.primary : colors.border }, globalTone === tone.value && { backgroundColor: colors.primary + '11' }]}
                  onPress={() => handleToneChange(tone.value)}
                >
                  <ThemedText style={[styles.notifLabel, globalTone === tone.value && { color: colors.primary }]}>{tone.label}</ThemedText>
                  {globalTone === tone.value && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>{t('settings.account')}</ThemedText>
            <TouchableOpacity
              style={[styles.button, { backgroundColor: colors.backgroundSecondary, borderWidth: 1, borderColor: colors.border }]}
              onPress={() => router.push('/accounts' as never)}
            >
              <ThemedText style={[styles.buttonText, { color: colors.text }]}>
                {t('settings.manage_accounts')}
              </ThemedText>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.danger, marginTop: spacing.sm }]} onPress={handleLogout}>
              <ThemedText style={styles.buttonText}>{t('common.logout')}</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.deleteAccountBtn]}
              onPress={() => router.push('/delete-account' as never)}
            >
              <ThemedText style={[styles.buttonText, styles.deleteAccountText]}>
                {t('settings.delete_account')}
              </ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { padding: spacing.lg, borderBottomWidth: 1 },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  sectionDescription: { fontSize: typography.sizes.sm, opacity: 0.6, marginBottom: spacing.md },
  themeGrid: { marginTop: spacing.sm },
  themeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: spacing.sm },
  themeLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  colorScroll: { flexDirection: 'row', marginTop: spacing.sm },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  infoColumn: { paddingVertical: spacing.sm, gap: 4 },
  label: { fontSize: typography.sizes.md, opacity: 0.6 },
  value: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  button: { padding: spacing.md, borderRadius: 8, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  notifGroup: { marginTop: spacing.xs },
  notifOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm + 2, borderRadius: 10, borderWidth: 1, marginBottom: spacing.xs },
  notifLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  languageContainer: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  langBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
  },
  langFlag: {
    fontSize: 20,
  },
  langText: {
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  deleteAccountBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    marginTop: spacing.sm,
  },
  deleteAccountText: {
    color: '#FF3B30',
  },
});
