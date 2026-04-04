import React, { useState } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
    Modal,
    Platform,
    StatusBar,
    KeyboardAvoidingView
} from 'react-native';
import { Stack, router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth } from '@/config/firebase';
import {
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
} from 'firebase/auth';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { Ionicons } from '@expo/vector-icons';

function generateOtpCode(): string {
    const charPool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += charPool.charAt(Math.floor(Math.random() * charPool.length));
    }
    return code;
}

export default function AccountDetails() {
    const { t } = useTranslation();
    const { colors, theme } = useTheme();
    const currentUser = auth.currentUser;

    const [showPassword, setShowPassword] = useState(false);
    const [isEditingPassword, setIsEditingPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const [isVerifyingPasswordReveal, setIsVerifyingPasswordReveal] = useState(false);
    const [passwordRevealCode, setPasswordRevealCode] = useState('');
    const [passwordRevealExpected, setPasswordRevealExpected] = useState('');

    const [oldPassword, setOldPassword] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');

    const handleRevealPassword = () => {
        const code = generateOtpCode();
        setPasswordRevealExpected(code);
        setIsVerifyingPasswordReveal(true);
        Alert.alert(t('account_details.email_simulation') || 'Email Simulation', (t('account_details.code_sent') || `Code Sent`) + code);
    };

    const confirmPasswordReveal = () => {
        if (passwordRevealCode.toUpperCase() !== passwordRevealExpected) {
            Alert.alert(t('common.error') || 'Error', t('account_details.invalid_code') || 'Invalid Code');
            return;
        }
        setShowPassword(true);
        setIsVerifyingPasswordReveal(false);
        setPasswordRevealCode('');
        Alert.alert(t('account_details.verified_title') || 'Verified Title', t('account_details.verified_msg') || 'Verified Msg');
    };

    const handleUpdatePassword = async () => {
        if (!currentUser || !oldPassword || !newPass || !confirmPass) {
            Alert.alert(t('common.error') || 'Error', t('roles.errors.all_fields') || 'All Fields');
            return;
        }

        if (newPass !== confirmPass) {
            Alert.alert(t('common.error') || 'Error', t('roles.errors.passwords_dont_match') || 'Passwords Dont Match');
            return;
        }

        setLoading(true);
        try {
            const credential = EmailAuthProvider.credential(currentUser.email!, oldPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPass);
            Alert.alert(t('common.success') || 'Success', t('account_details.password_updated') || 'Password Updated');
            setIsEditingPassword(false);
            setOldPassword('');
            setNewPass('');
            setConfirmPass('');
        } catch (error: any) {
            Alert.alert(t('common.error') || 'Error', t('account_details.wrong_old_password') || 'Wrong Old Password');
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser) return null;

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent={true} />
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: t('account_details.header_title') || 'Header Title',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: spacing.xs, padding: 4 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>{t('account_details.security') || 'Security'}</ThemedText>

                    <View style={[styles.infoCard, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}>
                        <View style={styles.infoRow}>
                            <View>
                                <ThemedText style={styles.label}>{t('common.password') || 'Password'}</ThemedText>
                                <ThemedText style={styles.value}>
                                    {showPassword ? 'sha256:7b5e...3a1f' : '••••••••••••'}
                                </ThemedText>
                            </View>
                            <View style={styles.rowActions}>
                                <TouchableOpacity onPress={handleRevealPassword}>
                                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.primary} style={{ marginRight: 15 }} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsEditingPassword(true)}>
                                    <ThemedText style={{ color: colors.primary, fontWeight: 'bold' }}>{t('common.change') || 'Change'}</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>

                <Modal visible={isEditingPassword} transparent animationType="slide">
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.modalOverlay}
                    >
                        <ThemedView style={styles.modalContent}>
                            <ThemedText style={styles.modalTitle}>{t('account_details.new_password') || 'New Password'}</ThemedText>

                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder={t('account_details.old_password')}
                                secureTextEntry
                                value={oldPassword}
                                onChangeText={setOldPassword}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder={t('account_details.new_password')}
                                secureTextEntry
                                value={newPass}
                                onChangeText={setNewPass}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]}
                                placeholder={t('account_details.confirm_password')}
                                secureTextEntry
                                value={confirmPass}
                                onChangeText={setConfirmPass}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalBtn} onPress={() => setIsEditingPassword(false)}>
                                    <ThemedText style={{ opacity: 0.6 }}>{t('common.cancel') || 'Cancel'}</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleUpdatePassword}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={{ color: '#fff' }}>{t('common.update') || 'Update'}</ThemedText>}
                                </TouchableOpacity>
                            </View>
                        </ThemedView>
                    </KeyboardAvoidingView>
                </Modal>

                <Modal visible={isVerifyingPasswordReveal} transparent animationType="fade">
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        style={styles.modalOverlay}
                    >
                        <ThemedView style={styles.modalContent}>
                            <Ionicons name="mail-open" size={40} color={colors.primary} style={{ alignSelf: 'center', marginBottom: 15 }} />
                            <ThemedText style={styles.modalTitle}>{t('account_details.security') || 'Security'}</ThemedText>
                            <ThemedText style={styles.modalSub}>{t('account_details.otp_tip') || 'Otp Tip'}</ThemedText>

                            <TextInput
                                style={[styles.input, styles.otpInput, { backgroundColor: colors.background, color: colors.text, borderColor: colors.primary }]}
                                placeholder="XXXXX"
                                maxLength={5}
                                autoCapitalize="characters"
                                value={passwordRevealCode}
                                onChangeText={setPasswordRevealCode}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalBtn} onPress={() => setIsVerifyingPasswordReveal(false)}>
                                    <ThemedText style={{ opacity: 0.6 }}>{t('common.cancel')}</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={confirmPasswordReveal}>
                                    <ThemedText style={{ color: '#fff' }}>{t('account_details.verify')}</ThemedText>
                                </TouchableOpacity>
                            </View>
                        </ThemedView>
                    </KeyboardAvoidingView>
                </Modal>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: spacing.lg,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.bold,
        opacity: 0.7,
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    infoCard: {
        borderRadius: 16,
        padding: spacing.md,
        borderWidth: 1,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing.sm,
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: typography.sizes.xs,
        opacity: 0.5,
        marginBottom: 2,
    },
    value: {
        fontSize: typography.sizes.md,
        fontWeight: typography.weights.semibold,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        borderRadius: 20,
        padding: spacing.xl,
        gap: spacing.md,
    },
    modalTitle: {
        fontSize: typography.sizes.xl,
        fontWeight: typography.weights.bold,
        textAlign: 'center',
    },
    modalSub: {
        textAlign: 'center',
        opacity: 0.6,
        fontSize: typography.sizes.sm,
        marginBottom: spacing.md,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.sizes.md,
    },
    otpInput: {
        fontSize: 24,
        textAlign: 'center',
        fontWeight: 'bold',
        letterSpacing: 8,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: spacing.md,
        marginTop: spacing.md,
    },
    modalBtn: {
        flex: 1,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    primaryBtn: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    }
});
