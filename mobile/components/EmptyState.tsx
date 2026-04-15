import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';

interface EmptyStateProps {
    icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
    title: string;
    body?: string;
    action?: {
        label: string;
        onPress: () => void;
    };
    fill?: boolean;
}

export function EmptyState({ icon: Icon, title, body, action, fill = false }: EmptyStateProps) {
    const { colors } = useTheme();
    return (
        <View style={[styles.container, fill && styles.fill]}>
            <View style={[styles.iconBox, { backgroundColor: colors.primary + '08' }]}>
                <Icon size={64} color={colors.primary} strokeWidth={1.2} />
            </View>
            <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
            {!!body && (
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{body}</ThemedText>
            )}
            {action && (
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={action.onPress}
                    activeOpacity={0.8}
                >
                    <ThemedText style={styles.actionText}>{action.label}</ThemedText>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
        paddingTop: 80,
        gap: 12,
    },
    fill: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 0,
    },
    iconBox: {
        width: 100,
        height: 100,
        borderRadius: 50,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 28,
        letterSpacing: -0.5,
    },
    body: {
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        opacity: 0.6,
        paddingHorizontal: 20,
    },
    actionBtn: {
        marginTop: spacing.md,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    actionText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 15,
        letterSpacing: -0.2,
    },
});
