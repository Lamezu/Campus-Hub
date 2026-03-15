import React from 'react';
import {
    View, StyleSheet, TouchableOpacity, Modal, ScrollView, Image,
} from 'react-native';
import { X } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography, chatThemes } from '@/constants/styles';

interface DMSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
}

export function DMSettingsSheet({ visible, onClose }: DMSettingsSheetProps) {
    const { colors, chatSettings, setChatSettings } = useTheme();

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: colors.background }]}>
                    <View style={styles.handle} />
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                        <ThemedText style={styles.modalTitle}>Personalizar Chat</ThemedText>
                        <TouchableOpacity onPress={onClose}>
                            <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>Hecho</ThemedText>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        <View style={styles.settingsSection}>
                            <ThemedText style={styles.settingsLabel}>Temas del Chat</ThemedText>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>
                                {Object.values(chatThemes).map(t => (
                                    <TouchableOpacity
                                        key={t.id}
                                        style={[styles.themeItem, { borderColor: chatSettings.themeId === t.id ? colors.primary : colors.border }]}
                                        onPress={() => setChatSettings({ themeId: t.id })}
                                    >
                                        <View style={[styles.themePreview, { backgroundColor: t.background === 'transparent' ? colors.background : t.background, overflow: 'hidden' }]}>
                                            {t.backgroundImage && <Image source={{ uri: t.backgroundImage }} style={StyleSheet.absoluteFill} />}
                                            <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOwn, alignSelf: 'flex-end', opacity: 0.9 }]} />
                                            <View style={[styles.bubblePreview, { backgroundColor: t.bubbleOther, alignSelf: 'flex-start', opacity: 0.9 }]} />
                                        </View>
                                        <ThemedText style={[styles.themeName, chatSettings.themeId === t.id && { color: colors.primary }]}>
                                            {t.name}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>

                        <View style={styles.settingsSection}>
                            <ThemedText style={styles.settingsLabel}>Tamaño de Letra ({chatSettings.fontSize}px)</ThemedText>
                            <View style={styles.row}>
                                {[12, 14, 16, 18, 20].map(size => (
                                    <TouchableOpacity
                                        key={size}
                                        style={[
                                            styles.sizeButton,
                                            { borderColor: colors.border },
                                            chatSettings.fontSize === size && { backgroundColor: colors.primary, borderColor: colors.primary },
                                        ]}
                                        onPress={() => setChatSettings({ fontSize: size })}
                                    >
                                        <ThemedText style={{ color: chatSettings.fontSize === size ? '#FFF' : colors.text }}>
                                            {size}
                                        </ThemedText>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.settingsSection}>
                            <ThemedText style={styles.settingsLabel}>Estilo de Letra</ThemedText>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[
                                        styles.styleButton,
                                        { borderColor: colors.border },
                                        chatSettings.fontWeight === 'bold' && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}
                                    onPress={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}
                                >
                                    <ThemedText style={[chatSettings.fontWeight === 'bold' && { color: '#FFF' }]}>Negrita</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.styleButton,
                                        { borderColor: colors.border, marginLeft: spacing.sm },
                                        chatSettings.fontStyle === 'italic' && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}
                                    onPress={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                >
                                    <ThemedText style={[chatSettings.fontStyle === 'italic' && { color: '#FFF' }]}>Cursiva</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    sheet: { height: '70%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
    handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ccc', alignSelf: 'center', marginBottom: spacing.md },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: spacing.md, borderBottomWidth: 1 },
    modalTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold },
    modalBody: { marginTop: spacing.lg },
    settingsSection: { marginBottom: spacing.xl },
    settingsLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold, marginBottom: spacing.md },
    themeScrollContent: { paddingRight: spacing.xl, gap: spacing.md },
    themeItem: { width: 100, padding: spacing.sm, borderRadius: 16, borderWidth: 2, alignItems: 'center' },
    themePreview: { width: '100%', height: 80, borderRadius: 12, padding: 8, justifyContent: 'center', gap: 6, marginBottom: 8 },
    bubblePreview: { width: '80%', height: 14, borderRadius: 7 },
    themeName: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
    row: { flexDirection: 'row', alignItems: 'center' },
    sizeButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: spacing.sm },
    styleButton: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: 18, borderWidth: 1 },
});
