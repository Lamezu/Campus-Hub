import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Music } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { useTranslation } from '@/hooks/useTranslation';
import { previewTone } from '@/utils/toneGenerator';
import { getContactSettings, updateContactSettings } from '@/services/contactSettingsService';
import { auth } from '@/config/firebase';
import type { MuteDuration } from '@/types';

const getMuteOptions = (t: any): { value: MuteDuration; label: string; description: string }[] => [
  { value: '8h', label: t('dm.profile.notifications_settings.mute_options.8h.label') || 'Label', description: t('dm.profile.notifications_settings.mute_options.8h.desc') || 'Desc' },
  { value: '1w', label: t('dm.profile.notifications_settings.mute_options.1w.label') || 'Label', description: t('dm.profile.notifications_settings.mute_options.1w.desc') || 'Desc' },
  { value: 'always', label: t('dm.profile.notifications_settings.mute_options.always.label') || 'Label', description: t('dm.profile.notifications_settings.mute_options.always.desc') || 'Desc' },
  { value: 'off', label: t('dm.profile.notifications_settings.mute_options.off.label') || 'Label', description: t('dm.profile.notifications_settings.mute_options.off.desc') || 'Desc' },
];

const ALERT_TONES = [
  'Default',
  'Classic',
  'Soft',
  'Melody',
  'Bell',
  'Pulse',
  'None',
];

export default function DMNotificationsScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { colors, theme } = useTheme();
  const { t } = useTranslation();

  const [mute, setMute] = useState<MuteDuration>('off');
  const [alertTone, setAlertTone] = useState('Default');

  const MUTE_OPTIONS = getMuteOptions(t);

  const meId = auth.currentUser?.uid ?? '';

  useEffect(() => {
    if (!meId || !userId) return;
    getContactSettings(meId, userId).then(s => {
      setMute(s.mute);
      setAlertTone(s.alertTone);
    }).catch(() => { });
  }, [meId, userId]);

  const handleMuteSelect = (value: MuteDuration) => {
    setMute(value);
    if (meId && userId) {
      updateContactSettings(meId, userId, { mute: value }).catch(() => { });
    }
  };

  const handleToneSelect = (tone: string) => {
    setAlertTone(tone);
    if (meId && userId) {
      updateContactSettings(meId, userId, { alertTone: tone }).catch(() => { });
    }
    previewTone(tone);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar
        barStyle={theme === 'dark' ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background}
      />
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('dm.profile.notifications_settings.title') || 'Title'}</ThemedText>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.sectionHeaderWrapper}>
          <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('dm.profile.notifications_settings.mute_title') || 'Mute Title'}
          </ThemedText>
        </View>
        <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {MUTE_OPTIONS.map((opt, idx) => (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.optionRow,
                idx < MUTE_OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
              onPress={() => handleMuteSelect(opt.value)}
              activeOpacity={0.7}
            >
              <View style={styles.optionText}>
                <ThemedText style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</ThemedText>
                <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>
                  {opt.description}
                </ThemedText>
              </View>
              {mute === opt.value && (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.sectionHeaderWrapper}>
          <ThemedText style={[styles.sectionLabel, { color: colors.textSecondary }]}>
            {t('dm.profile.notifications_settings.tone_title') || 'Tone Title'}
          </ThemedText>
        </View>
        <View style={[styles.sectionBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {ALERT_TONES.map((tone, idx) => (
            <TouchableOpacity
              key={tone}
              style={[
                styles.optionRow,
                idx < ALERT_TONES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
              ]}
              onPress={() => handleToneSelect(tone)}
              activeOpacity={0.7}
            >
              <Music size={18} color={colors.textSecondary} strokeWidth={1.8} />
              <ThemedText style={[styles.optionLabel, { color: colors.text, flex: 1, marginLeft: spacing.sm }]}>
                {t(`dm.profile.notifications_settings.tones.${tone}`) || tone}
              </ThemedText>
              {alertTone === tone && (
                <Check size={20} color={colors.primary} strokeWidth={2.5} />
              )}
            </TouchableOpacity>
          ))}
        </View>
        <ThemedText style={[styles.toneNote, { color: colors.textSecondary }]}>
          {t('dm.profile.notifications_settings.tone_preview_note') || 'Tone Preview Note'}
        </ThemedText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    justifyContent: 'space-between',
  },
  backBtn: { padding: 4, width: 32 },
  headerTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 20,
    flex: 1,
    textAlign: 'center',
  },
  sectionHeaderWrapper: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
    lineHeight: 16,
    letterSpacing: 0.5,
  },
  sectionBox: {
    marginHorizontal: spacing.md,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
  },
  optionText: { flex: 1 },
  optionLabel: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
  },
  optionDescription: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  toneNote: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    fontStyle: 'italic',
  },
});
