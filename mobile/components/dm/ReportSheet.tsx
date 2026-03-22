import React, { useEffect, useRef } from 'react';
import { View, Modal, TouchableOpacity, TouchableWithoutFeedback, Animated, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';

interface ReportSheetProps {
  visible: boolean;
  userName: string;
  onReportOnly: () => void;
  onReportAndBlock: () => void;
  onClose: () => void;
}

export function ReportSheet({ visible, userName, onReportOnly, onReportAndBlock, onClose }: ReportSheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const slideAnim = useRef(new Animated.Value(300)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      <Animated.View
        style={[styles.sheet, { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
        <ThemedText style={[styles.title, { color: colors.text }]}>
          {t('dm.report_sheet.title', { name: userName }) || `Reportar a ${userName}`}
        </ThemedText>
        <ThemedText style={[styles.description, { color: colors.textSecondary }]}>
          {t('dm.report_sheet.desc') || 'Tu reporte será revisado por el equipo de Campus Hub. Puedes reportar y bloquear al usuario simultáneamente.'}
        </ThemedText>
        <TouchableOpacity
          style={[styles.option, styles.destructive]}
          onPress={() => { onReportAndBlock(); onClose(); }}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.destructiveText}>{t('dm.report_sheet.report_and_block') || 'Reportar y bloquear'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, styles.destructiveSoft]}
          onPress={() => { onReportOnly(); onClose(); }}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.destructiveSoftText}>{t('dm.report_sheet.report_only') || 'Solo reportar'}</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.option, { backgroundColor: colors.backgroundSecondary }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <ThemedText style={[styles.cancelText, { color: colors.text }]}>{t('common.cancel') || 'Cancelar'}</ThemedText>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
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
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: {
    fontSize: typography.sizes.md,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.md,
  },
  option: {
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  destructive: { backgroundColor: '#FF3B30' },
  destructiveSoft: { backgroundColor: 'rgba(255,59,48,0.12)' },
  destructiveText: { color: '#fff', fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  destructiveSoftText: { color: '#FF3B30', fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
  cancelText: { fontSize: typography.sizes.md, fontWeight: '600', lineHeight: 20 },
});
