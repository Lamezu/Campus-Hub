import React, { useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, TouchableWithoutFeedback, Animated, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import type { SaveToPhotosPreference } from '@/types';

interface SaveToPhotosSheetProps {
  visible: boolean;
  current: SaveToPhotosPreference;
  onSelect: (value: SaveToPhotosPreference) => void;
  onClose: () => void;
}

const getOptions = (t: any): { value: SaveToPhotosPreference; label: string; description: string }[] => [
  { value: 'default', label: t('dm.save_to_photos_sheet.options.default.label') || 'Label', description: t('dm.save_to_photos_sheet.options.default.desc') || 'Desc' },
  { value: 'always', label: t('dm.save_to_photos_sheet.options.always.label') || 'Label', description: t('dm.save_to_photos_sheet.options.always.desc') || 'Desc' },
  { value: 'never', label: t('dm.save_to_photos_sheet.options.never.label') || 'Label', description: t('dm.save_to_photos_sheet.options.never.desc') || 'Desc' },
];

export function SaveToPhotosSheet({ visible, current, onSelect, onClose }: SaveToPhotosSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(300)).current;

  const OPTIONS = getOptions(t);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <ThemedText style={[styles.sheetTitle, { color: colors.text }]}>
          {t('dm.save_to_photos_sheet.title') || 'Title'}
        </ThemedText>
        {OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.option, { borderBottomColor: colors.border }]}
            onPress={() => { onSelect(opt.value); onClose(); }}
            activeOpacity={0.7}
          >
            <View style={styles.optionContent}>
              <ThemedText style={[styles.optionLabel, { color: colors.text }]}>{opt.label}</ThemedText>
              <ThemedText style={[styles.optionDescription, { color: colors.textSecondary }]}>{opt.description}</ThemedText>
            </View>
            {current === opt.value && (
              <Check size={20} color={colors.primary} strokeWidth={2.5} />
            )}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.cancelBtn, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel') || 'Cancel'}</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  sheetTitle: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  optionContent: { flex: 1 },
  optionLabel: {
    fontSize: typography.sizes.md,
    lineHeight: 20,
    fontWeight: '500',
  },
  optionDescription: {
    fontSize: typography.sizes.xs,
    lineHeight: 16,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    lineHeight: 20,
  },
});
