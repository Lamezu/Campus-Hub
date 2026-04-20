import React, { useState } from 'react';
import {
    View, StyleSheet, TouchableOpacity, Modal, ScrollView, Image, Dimensions
} from 'react-native';
import { X, Plus } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography, chatThemes } from '@/constants/styles';
import * as ImagePicker from 'expo-image-picker';
import { ChatBackgroundEditor } from '@/components/chat/ChatBackgroundEditor';

interface ChatSettingsSheetProps {
    visible: boolean;
    onClose: () => void;
    onClearChat?: () => void;
    showClearChat?: boolean;
}

export function ChatSettingsSheet({ visible, onClose, onClearChat, showClearChat }: ChatSettingsSheetProps) {
    const {
        colors, chatSettings, setChatSettings,
        customChatThemes, addCustomChatTheme, deleteCustomChatTheme
    } = useTheme();
    const { t } = useTranslation();

    const [editorVisible, setEditorVisible] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: false,
            quality: 0.7,
        });

        if (!result.canceled) {
            setSelectedImage(result.assets[0].uri);
            setEditorVisible(true);
        }
    };

    const handleSaveCustomTheme = async (themeId: string, offsetX: number, offsetY: number, scale: number) => {
        if (!selectedImage) return;

        const baseTheme = chatThemes.default;
        await addCustomChatTheme({
            ...baseTheme,
            id: themeId,
            name: t('chat.settings.custom_bg_name'),
            backgroundImage: selectedImage,
            offsetX,
            offsetY,
            scale,
        });

        await setChatSettings({ themeId });
        setEditorVisible(false);
        setSelectedImage(null);
    };

    const allChatThemes = [...Object.values(chatThemes), ...customChatThemes];

    return (
        <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <View style={styles.overlay}>
                <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
                <View style={[styles.sheet, { backgroundColor: colors.card + 'F0' }]}>
                    <View style={[styles.handle, { backgroundColor: colors.text + '20' }]} />
                    <View style={[styles.modalHeader, { borderBottomColor: colors.border + '15' }]}>
                        <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('chat.settings.title')}</ThemedText>
                        <TouchableOpacity onPress={onClose} style={[styles.doneBtn, { backgroundColor: colors.primary }]}>
                            <ThemedText style={styles.doneText}>{t('common.done') || 'Listo'}</ThemedText>
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        <View style={styles.settingsSection}>
                            <ThemedText style={styles.settingsLabel}>{t('chat.settings.themes')}</ThemedText>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.themeScrollContent}>
                                <TouchableOpacity
                                    style={[styles.themeItem, { borderColor: colors.border, borderStyle: 'dashed' }]}
                                    onPress={pickImage}
                                >
                                    <View style={[styles.themePreview, { backgroundColor: colors.backgroundSecondary, alignItems: 'center', justifyContent: 'center' }]}>
                                        <Plus color={colors.textSecondary} size={24} />
                                    </View>
                                    <ThemedText style={styles.themeName}>{t('chat.settings.add_custom')}</ThemedText>
                                </TouchableOpacity>

                                {allChatThemes.map(theme => {
                                    const hasTransform = theme.offsetX !== undefined || theme.offsetY !== undefined || theme.scale !== undefined;
                                    const factor = 0.3;
                                    const thumbScale = theme.scale ? theme.scale * factor : 1;

                                    return (
                                        <TouchableOpacity
                                            key={theme.id}
                                            style={[styles.themeItem, { borderColor: chatSettings.themeId === theme.id ? colors.primary : colors.border }]}
                                            onPress={() => setChatSettings({ themeId: theme.id })}
                                            onLongPress={() => {
                                                if (theme.id.startsWith('custom_')) deleteCustomChatTheme(theme.id);
                                            }}
                                        >
                                            <View style={[styles.themePreview, { backgroundColor: theme.background === 'transparent' ? colors.background : theme.background, overflow: 'hidden' }]}>
                                                {theme.backgroundImage && (
                                                    <Image
                                                        source={{ uri: theme.backgroundImage }}
                                                        style={[
                                                            StyleSheet.absoluteFill,
                                                            hasTransform ? {
                                                                transform: [
                                                                    { translateX: (theme.offsetX || 0) * factor },
                                                                    { translateY: (theme.offsetY || 0) * factor },
                                                                    { scale: theme.scale || 1 },
                                                                ]
                                                            } : {}
                                                        ]}
                                                        resizeMode="cover"
                                                    />
                                                )}
                                                <View style={[styles.bubblePreview, { backgroundColor: theme.bubbleOwn, alignSelf: 'flex-end', opacity: 0.6 }]} />
                                                <View style={[styles.bubblePreview, { backgroundColor: theme.bubbleOther, alignSelf: 'flex-start', opacity: 0.6 }]} />
                                            </View>
                                            <ThemedText numberOfLines={2} style={[styles.themeName, chatSettings.themeId === theme.id && { color: colors.primary }]}>
                                                {theme.id.startsWith('custom_') ? t('chat.settings.custom_bg_name') : theme.name}
                                            </ThemedText>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        <View style={styles.settingsSection}>
                            <ThemedText style={styles.settingsLabel}>{t('chat.settings.font_size')} ({chatSettings.fontSize}px)</ThemedText>
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
                            <ThemedText style={styles.settingsLabel}>{t('chat.settings.font_style')}</ThemedText>
                            <View style={styles.row}>
                                <TouchableOpacity
                                    style={[
                                        styles.styleButton,
                                        { borderColor: colors.border },
                                        chatSettings.fontWeight === 'bold' && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}
                                    onPress={() => setChatSettings({ fontWeight: chatSettings.fontWeight === 'bold' ? '400' : 'bold' })}
                                >
                                    <ThemedText style={[chatSettings.fontWeight === 'bold' && { color: '#FFF' }]}>{t('chat.settings.bold')}</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.styleButton,
                                        { borderColor: colors.border, marginLeft: spacing.sm },
                                        chatSettings.fontStyle === 'italic' && { backgroundColor: colors.primary, borderColor: colors.primary },
                                    ]}
                                    onPress={() => setChatSettings({ fontStyle: chatSettings.fontStyle === 'italic' ? 'normal' : 'italic' })}
                                >
                                    <ThemedText style={[chatSettings.fontStyle === 'italic' && { color: '#FFF' }]}>{t('chat.settings.italic')}</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {showClearChat && onClearChat && (
                            <View style={[styles.settingsSection, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.lg }]}>
                                <TouchableOpacity
                                    style={[styles.clearChatBtn, { borderColor: '#FF3B30' }]}
                                    onPress={() => { onClose(); setTimeout(onClearChat, 300); }}
                                >
                                    <ThemedText style={[styles.clearChatBtnText, { color: '#FF3B30' }]}>
                                        {t('chat.settings.clear_chat')}
                                    </ThemedText>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>

            <ChatBackgroundEditor
                visible={editorVisible}
                imageUri={selectedImage}
                onClose={() => setEditorVisible(false)}
                onSave={handleSaveCustomTheme}
            />
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    sheet: {
        height: '80%',
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        padding: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    handle: { width: 40, height: 5, borderRadius: 2.5, alignSelf: 'center', marginBottom: spacing.md },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.md,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        marginBottom: spacing.lg,
    },
    modalTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
    doneBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    doneText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    modalBody: { flex: 1 },
    settingsSection: { marginBottom: spacing.xl },
    settingsLabel: {
        fontSize: 12,
        fontWeight: '900',
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.6,
    },
    themeScrollContent: { paddingRight: spacing.xl, gap: 12 },
    themeItem: { width: 110, padding: 8, borderRadius: 24, borderWidth: 2, alignItems: 'center' },
    themePreview: { width: '100%', height: 120, borderRadius: 20, padding: 8, justifyContent: 'center', gap: 6, marginBottom: 8 },
    bubblePreview: { width: 24, height: 12, borderRadius: 6 },
    themeName: { fontSize: 12, fontWeight: '800', textAlign: 'center', minHeight: 16 },
    row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 },
    sizeButton: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    sizeButtonActive: { transform: [{ scale: 1.1 }] },
    styleButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 16, borderWidth: 1, minWidth: 100, alignItems: 'center' },
    clearChatBtn: {
        width: '100%',
        paddingVertical: 18,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        marginTop: spacing.sm,
    },
    clearChatBtnText: { fontSize: 15, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
});
