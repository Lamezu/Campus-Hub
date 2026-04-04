import React, { useEffect, useState, useRef } from 'react';
import {
    Modal, View, StyleSheet, TouchableOpacity, TouchableWithoutFeedback,
    Image, Animated, ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { MessageSquare, Phone, Video, Info, X } from 'lucide-react-native';
import { avatarColor } from '@/utils/avatarColor';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import type { User } from '@/types';

interface UserPreviewSheetProps {
    userId: string | null;
    onClose: () => void;
}

export function UserPreviewSheet({ userId, onClose }: UserPreviewSheetProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);
    const slideAnim = useRef(new Animated.Value(300)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (userId) {
            setUser(null);
            setLoading(true);
            getDoc(doc(db, 'users', userId)).then(snap => {
                if (snap.exists()) setUser({ uid: snap.id, ...snap.data() } as User);
                setLoading(false);
            }).catch(() => setLoading(false));

            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }),
                Animated.timing(backdropAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.spring(slideAnim, { toValue: 300, useNativeDriver: true, tension: 80, friction: 12 }),
                Animated.timing(backdropAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
            ]).start();
        }
    }, [userId]);

    const navigate = (path: string) => {
        onClose();
        setTimeout(() => router.push(path as any), 250);
    };

    const roleLabel = (u: User) => {
        const base = t(`roles.${u.role || 'student'}`) || (u.role === 'teacher' ? 'Profesor/a' : u.role === 'admin' ? 'Admin' : 'Alumno/a');
        return u.department ? `${base} · ${u.department}` : base;
    };

    return (
        <Modal visible={!!userId} transparent animationType="none" onRequestClose={onClose}>
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]} />
            </TouchableWithoutFeedback>

            <Animated.View
                style={[
                    styles.sheet,
                    { backgroundColor: colors.card, transform: [{ translateY: slideAnim }] }
                ]}
            >
                <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.backgroundSecondary }]} onPress={onClose}>
                    <X size={16} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>

                {loading || !user ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : (
                    <>
                        <View style={styles.avatarWrap}>
                            {user.photoURL ? (
                                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: avatarColor(user.uid) }]}>
                                    <ThemedText style={styles.avatarInitial}>
                                        {user.displayName.charAt(0).toUpperCase()}
                                    </ThemedText>
                                </View>
                            )}
                        </View>

                        <ThemedText style={styles.name}>{user.displayName}</ThemedText>
                        <ThemedText style={[styles.role, { color: colors.textSecondary }]}>{roleLabel(user)}</ThemedText>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
                                onPress={() => navigate(`/dm/${user.uid}`)}
                            >
                                <MessageSquare size={22} color={colors.text} strokeWidth={1.8} />
                                <ThemedText style={styles.actionLabel}>{t('dm.profile.message') || 'Message'}</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
                                onPress={() => navigate(`/dm/${user.uid}/call?type=audio`)}
                            >
                                <Phone size={22} color={colors.text} strokeWidth={1.8} />
                                <ThemedText style={styles.actionLabel}>{t('dm.profile.call') || 'Call'}</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary }]}
                                onPress={() => navigate(`/dm/${user.uid}/call?type=video`)}
                            >
                                <Video size={22} color={colors.text} strokeWidth={1.8} />
                                <ThemedText style={styles.actionLabel}>{t('dm.profile.video') || 'Video'}</ThemedText>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.infoBtn, { backgroundColor: colors.backgroundSecondary }]}
                            onPress={() => navigate(`/dm/${user.uid}/profile`)}
                        >
                            <Info size={18} color={colors.text} strokeWidth={1.8} />
                            <ThemedText style={[styles.infoBtnText, { color: colors.text }]}>
                                {t('common.info') || 'Info'}
                            </ThemedText>
                        </TouchableOpacity>
                    </>
                )}
            </Animated.View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingBottom: 40,
        alignItems: 'center',
    },
    closeBtn: {
        position: 'absolute',
        top: spacing.md,
        right: spacing.md,
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingWrap: { height: 180, justifyContent: 'center', alignItems: 'center', width: '100%' },
    avatarWrap: { marginBottom: spacing.md },
    avatar: { width: 88, height: 88, borderRadius: 44 },
    avatarFallback: {
        width: 88, height: 88, borderRadius: 44,
        justifyContent: 'center', alignItems: 'center',
    },
    avatarInitial: { color: '#fff', fontSize: 34, fontWeight: '700' },
    name: { fontSize: typography.sizes.xl, fontWeight: '700', marginBottom: 4 },
    role: { fontSize: typography.sizes.sm, marginBottom: spacing.lg },
    actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, width: '100%' },
    actionBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: spacing.md, borderRadius: 16, gap: 6,
    },
    actionLabel: { fontSize: typography.sizes.xs, fontWeight: '600' },
    infoBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, width: '100%', paddingVertical: spacing.md, borderRadius: 16,
    },
    infoBtnText: { fontSize: typography.sizes.sm, fontWeight: '600' },
});
