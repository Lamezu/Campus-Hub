import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Switch,
    Platform,
} from 'react-native';
import { X, Plus, Trash2 } from 'lucide-react-native';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { ThemedText } from './themed-text';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PollModalProps {
    visible: boolean;
    onClose: () => void;
    onSend: (poll: { question: string; options: string[]; multipleAnswers: boolean }) => void;
}

export function PollModal({ visible, onClose, onSend }: PollModalProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [multipleAnswers, setMultipleAnswers] = useState(false);

    const addOption = () => {
        if (options.length < 10) {
            setOptions([...options, '']);
        }
    };

    const removeOption = (index: number) => {
        if (options.length > 2) {
            const newOptions = [...options];
            newOptions.splice(index, 1);
            setOptions(newOptions);
        }
    };

    const updateOption = (text: string, index: number) => {
        const newOptions = [...options];
        newOptions[index] = text;
        setOptions(newOptions);
    };

    const handleSend = () => {
        const validOptions = options.filter(o => o.trim().length > 0);
        if (question.trim().length > 0 && validOptions.length >= 2) {
            onSend({
                question: question.trim(),
                options: validOptions,
                multipleAnswers,
            });
            setQuestion('');
            setOptions(['', '']);
            setMultipleAnswers(false);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <ThemedText style={{ color: colors.primary }}>{t('common.cancel') || 'Cancel'}</ThemedText>
                    </TouchableOpacity>
                    <ThemedText style={styles.title}>{t('dm.poll_create') || 'Poll Create'}</ThemedText>
                    <TouchableOpacity onPress={handleSend} style={styles.headerBtn} disabled={!question.trim() || options.filter(o => o.trim()).length < 2}>
                        <ThemedText style={[styles.sendBtn, { color: colors.primary, opacity: (!question.trim() || options.filter(o => o.trim()).length < 2) ? 0.5 : 1 }]}>
                            {t('common.send') || 'Send'}
                        </ThemedText>
                    </TouchableOpacity>
                </View>

                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
                >
                    <View style={styles.section}>
                        <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{t('dm.poll_question_label') || 'Poll Question Label'}</ThemedText>
                        <TextInput
                            style={[styles.input, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                            placeholder={t('dm.poll_question_placeholder') || 'Poll Question Placeholder'}
                            placeholderTextColor={colors.textSecondary + '80'}
                            value={question}
                            onChangeText={setQuestion}
                            multiline
                        />
                    </View>

                    <View style={styles.section}>
                        <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{t('dm.poll_options_label') || 'Poll Options Label'}</ThemedText>
                        {options.map((opt, index) => (
                            <View key={index} style={styles.optionRow}>
                                <TextInput
                                    style={[styles.optionInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                                    placeholder={t('dm.poll_option_placeholder', { index: index + 1 }) || `Opción ${index + 1}`}
                                    placeholderTextColor={colors.textSecondary + '80'}
                                    value={opt}
                                    onChangeText={(t) => updateOption(t, index)}
                                />
                                {options.length > 2 && (
                                    <TouchableOpacity onPress={() => removeOption(index)} style={styles.removeBtn}>
                                        <Trash2 size={20} color={colors.danger} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        ))}

                        {options.length < 10 && (
                            <TouchableOpacity onPress={addOption} style={styles.addBtn}>
                                <Plus size={20} color={colors.primary} />
                                <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>{t('dm.poll_add_option') || 'Poll Add Option'}</ThemedText>
                            </TouchableOpacity>
                        )}
                    </View>

                    <View style={[styles.settings, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <View style={styles.settingItem}>
                            <ThemedText style={styles.settingLabel}>{t('dm.poll_multiple') || 'Poll Multiple'}</ThemedText>
                            <Switch
                                value={multipleAnswers}
                                onValueChange={setMultipleAnswers}
                                trackColor={{ false: '#767577', true: colors.primary + '80' }}
                                thumbColor={multipleAnswers ? colors.primary : '#f4f3f4'}
                            />
                        </View>
                    </View>
                </ScrollView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    headerBtn: {
        padding: 4,
    },
    title: {
        fontSize: 17,
        fontWeight: '700',
    },
    sendBtn: {
        fontWeight: '700',
        fontSize: 17,
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: spacing.md,
        gap: spacing.lg,
    },
    section: {
        gap: spacing.sm,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginLeft: 4,
    },
    input: {
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
        minHeight: 50,
    },
    optionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        marginBottom: spacing.xs,
    },
    optionInput: {
        flex: 1,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: 16,
    },
    removeBtn: {
        padding: 8,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: spacing.sm,
        paddingHorizontal: 4,
    },
    settings: {
        borderRadius: 12,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: spacing.md,
    },
    settingItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: spacing.md,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '500',
    },
});
