import React from 'react';
import { View, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { Users, Lock, MoreVertical, Check, MessageSquare } from 'lucide-react-native';
import { ThemedText } from '../themed-text';
import { useTheme } from '../../contexts/ThemeContext';
import { spacing, typography } from '../../constants/styles';
import { useTranslation } from '../../hooks/useTranslation';
import type { StudyGroup } from '../../types';

interface GroupCardProps {
    group: StudyGroup;
    userId: string;
    onJoin: () => void;
    onLeave: () => void;
    onNavigate?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
}

export function GroupCard({
    group, userId, onJoin, onLeave, onNavigate, onEdit, onDelete,
}: GroupCardProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const isMember = group.memberIds.includes(userId);

    const handleOptions = () => {
        const options: any[] = [];
        if (onEdit) options.push({ text: t('explore.groups.actions.edit') || 'Edit', onPress: onEdit });
        if (onDelete) options.push({ text: t('explore.groups.actions.delete') || 'Delete', style: 'destructive', onPress: onDelete });
        options.push({ text: t('explore.groups.actions.cancel') || 'Cancel', style: 'cancel' });
        Alert.alert(group.name, undefined, options);
    };

    const handleMemberBtn = () => {
        Alert.alert(group.name, undefined, [
            { text: t('explore.groups.actions.go_to_channel') || 'Go To Channel', onPress: onNavigate },
            { text: t('explore.groups.actions.leave_group') || 'Leave Group', style: 'destructive', onPress: onLeave },
            { text: t('explore.groups.actions.cancel') || 'Cancel', style: 'cancel' },
        ]);
    };

    return (
        <TouchableOpacity
            style={[
                styles.groupCard, 
                { 
                    backgroundColor: colors.card + '90', 
                    borderColor: colors.border + '15' 
                }
            ]}
            activeOpacity={isMember ? 0.72 : 1}
            onPress={isMember ? onNavigate : undefined}
        >
            <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                <ThemedText style={styles.groupIconText}>{group.name.charAt(0).toUpperCase()}</ThemedText>
            </View>
            <View style={styles.groupInfo}>
                <View style={styles.groupNameRow}>
                    <ThemedText style={[styles.groupName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{group.name}</ThemedText>
                    {group.isPrivate && (
                        <Lock size={12} color={colors.textSecondary} strokeWidth={2} style={{ marginRight: 4 }} />
                    )}
                    {(onEdit || onDelete) && (
                        <TouchableOpacity onPress={handleOptions} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <MoreVertical size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
                <ThemedText style={[styles.groupSubject, { color: group.color }]} numberOfLines={1}>
                    {(() => {
                        const keys = (group.subjects && group.subjects.length > 0) ? group.subjects : (group.subject ? [group.subject] : []);
                        const labels = keys.slice(0, 3).map(s => { const k = `explore.groups.subjects_list.${s}`; const r = t(k); return r === k ? s : r; });
                        return labels.join(' · ') + (keys.length > 3 ? '...' : '');
                    })()}
                </ThemedText>
                {!!group.description && (
                    <ThemedText style={[styles.groupDesc, { color: colors.textSecondary }]} numberOfLines={2}>{group.description}</ThemedText>
                )}
                {(group.allowedRoles?.length ?? 0) > 0 && (
                    <ThemedText style={[styles.groupDesc, { color: colors.textSecondary }]} numberOfLines={1}>
                        {t('explore.groups.actions.only') || 'Only'}: {group.allowedRoles!.map(r => t(`roles.labels.${r}`) || r).join(', ')}
                    </ThemedText>
                )}
                <View style={styles.groupFooter}>
                    <View style={styles.groupMembers}>
                        <Users size={12} color={colors.textSecondary} strokeWidth={2} />
                        <ThemedText style={[styles.groupMemberCount, { color: colors.textSecondary }]}>{group.memberCount} {t('explore.groups.member_count') || 'miembros'}</ThemedText>
                    </View>
                    {isMember ? (
                        <TouchableOpacity
                            style={[styles.joinBtn, { backgroundColor: group.color + '20', borderWidth: 1, borderColor: group.color }]}
                            onPress={handleMemberBtn}
                        >
                            <MessageSquare size={11} color={group.color} strokeWidth={2.5} />
                            <ThemedText style={[styles.joinBtnText, { color: group.color }]}>{t('explore.groups.actions.go_to_channel') || 'Go To Channel'}</ThemedText>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={[styles.joinBtn, { backgroundColor: group.color }]}
                            onPress={onJoin}
                        >
                            <ThemedText style={[styles.joinBtnText, { color: '#fff' }]}>{t('explore.groups.actions.join') || 'Join'}</ThemedText>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    groupCard: {
        flexDirection: 'row',
        borderRadius: 24,
        borderWidth: 1,
        padding: spacing.md + 4,
        gap: spacing.md,
        marginBottom: spacing.md,
    },
    groupIcon: { width: 56, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
    groupIconText: { color: '#fff', fontSize: 24, fontWeight: '800' },
    groupInfo: { flex: 1, gap: 2 },
    groupNameRow: { flexDirection: 'row', alignItems: 'center' },
    groupName: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
    groupSubject: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', opacity: 0.8 },
    groupDesc: { fontSize: 14, lineHeight: 20, marginTop: 2, opacity: 0.7 },
    groupFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
    groupMembers: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    groupMemberCount: { fontSize: 12, fontWeight: '600', opacity: 0.5 },
    joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
    joinBtnText: { fontSize: 13, fontWeight: '800' },
});
