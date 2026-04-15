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
                    { backgroundColor: colors.card + 'F0', transform: [{ translateY: slideAnim }] }
                ]}
            >
                <TouchableOpacity style={[styles.closeBtn, { backgroundColor: colors.border + '15' }]} onPress={onClose}>
                    <X size={16} color={colors.text} strokeWidth={2.5} />
                </TouchableOpacity>

                {loading || !user ? (
                    <View style={styles.loadingWrap}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : (
                    <>
                        <View style={styles.avatarWrap}>
                            <View style={[styles.avatarGlow, { backgroundColor: colors.primary + '15' }]} />
                            {user.photoURL ? (
                                <Image source={{ uri: user.photoURL }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarFallback, { backgroundColor: avatarColor(user.uid) + '20' }]}>
                                    <ThemedText style={[styles.avatarInitial, { color: avatarColor(user.uid) }]}>
                                        {user.displayName.charAt(0).toUpperCase()}
                                    </ThemedText>
                                </View>
                            )}
                        </View>

                        <ThemedText style={styles.name}>{user.displayName}</ThemedText>
                        <ThemedText style={[styles.role, { color: colors.textSecondary }]}>{roleLabel(user)}</ThemedText>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.primary + '11' }]}
                                onPress={() => navigate(`/dm/${user.uid}`)}
                            >
                                <MessageSquare size={22} color={colors.primary} strokeWidth={1.8} />
                                <ThemedText style={[styles.actionLabel, { color: colors.primary }]}>{t('dm.profile.message') || 'Message'}</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary + '80' }]}
                                onPress={() => navigate(`/dm/${user.uid}/call?type=audio`)}
                            >
                                <Phone size={22} color={colors.text} strokeWidth={1.8} />
                                <ThemedText style={styles.actionLabel}>{t('dm.profile.call') || 'Call'}</ThemedText>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: colors.backgroundSecondary + '80' }]}
                                onPress={() => navigate(`/dm/${user.uid}/call?type=video`)}
                            >
                                <Video size={22} color={colors.text} strokeWidth={1.8} />
                                <ThemedText style={styles.actionLabel}>{t('dm.profile.video') || 'Video'}</ThemedText>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            style={[styles.infoBtn, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}
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
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    sheet: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        borderTopLeftRadius: 36,
        borderTopRightRadius: 36,
        paddingTop: spacing.xl,
        paddingHorizontal: spacing.lg,
        paddingBottom: 44,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    closeBtn: {
        position: 'absolute',
        top: 20,
        right: 20,
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingWrap: { height: 180, justifyContent: 'center', alignItems: 'center', width: '100%' },
    avatarWrap: { marginBottom: spacing.md, position: 'relative', alignItems: 'center', justifyContent: 'center' },
    avatarGlow: { position: 'absolute', width: 110, height: 110, borderRadius: 55 },
    avatar: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: '#fff' },
    avatarFallback: {
        width: 100, height: 100, borderRadius: 50,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: 3, borderColor: '#fff',
    },
    avatarInitial: { fontSize: 40, fontWeight: '800' },
    name: { fontSize: 26, fontWeight: '900', marginBottom: 4, letterSpacing: -0.5 },
    role: { fontSize: 13, fontWeight: '700', marginBottom: spacing.lg, opacity: 0.6 },
    actions: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md, width: '100%' },
    actionBtn: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        paddingVertical: 18, borderRadius: 20, gap: 8,
    },
    actionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
    infoBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: spacing.sm, width: '100%', paddingVertical: 18, borderRadius: 20,
        borderWidth: 1,
    },
    infoBtnText: { fontSize: 14, fontWeight: '800' },
});
