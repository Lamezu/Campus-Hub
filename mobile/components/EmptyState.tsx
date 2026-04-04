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
            <Icon size={56} color={colors.border} strokeWidth={1.2} />
            <ThemedText style={[styles.title, { color: colors.text }]}>{title}</ThemedText>
            {!!body && (
                <ThemedText style={[styles.body, { color: colors.textSecondary }]}>{body}</ThemedText>
            )}
            {action && (
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={action.onPress}
                    activeOpacity={0.85}
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
        gap: spacing.sm,
    },
    fill: {
        flex: 1,
        justifyContent: 'center',
        paddingTop: 0,
    },
    title: {
        fontSize: typography.sizes.lg,
        fontWeight: '700',
        textAlign: 'center',
        lineHeight: 26,
    },
    body: {
        fontSize: typography.sizes.sm,
        textAlign: 'center',
        lineHeight: 20,
    },
    actionBtn: {
        marginTop: spacing.md,
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.sm + 2,
        borderRadius: 12,
    },
    actionText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: typography.sizes.sm,
        lineHeight: 20,
    },
});
