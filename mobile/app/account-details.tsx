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
                    headerTitleStyle: { fontWeight: '800', fontSize: 17 },
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: spacing.xs, padding: 4 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                }}
            />

            <ScrollView contentContainerStyle={styles.container}>
                <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('account_details.security') || 'Seguridad'}</ThemedText>

                    <View style={[styles.infoCard, { backgroundColor: colors.card + '80', borderColor: colors.border + '15' }]}>
                        <View style={styles.infoRow}>
                            <View>
                                <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{t('common.password') || 'Contraseña'}</ThemedText>
                                <ThemedText style={[styles.value, { color: colors.text }]}>
                                    {showPassword ? 'sha256:7b5e...3a1f' : '••••••••••••'}
                                </ThemedText>
                            </View>
                            <View style={styles.rowActions}>
                                <TouchableOpacity onPress={handleRevealPassword}>
                                    <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.primary} style={{ marginRight: 15 }} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => setIsEditingPassword(true)}>
                                    <ThemedText style={{ color: colors.primary, fontWeight: '800' }}>{t('common.change') || 'Cambiar'}</ThemedText>
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
                        <ThemedView style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border + '15' }]}>
                            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('account_details.new_password') || 'Nueva contraseña'}</ThemedText>

                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background + '80', color: colors.text, borderColor: colors.border + '15' }]}
                                placeholder={t('account_details.old_password')}
                                placeholderTextColor={colors.textSecondary}
                                secureTextEntry
                                value={oldPassword}
                                onChangeText={setOldPassword}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background + '80', color: colors.text, borderColor: colors.border + '15' }]}
                                placeholder={t('account_details.new_password')}
                                placeholderTextColor={colors.textSecondary}
                                secureTextEntry
                                value={newPass}
                                onChangeText={setNewPass}
                            />
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.background + '80', color: colors.text, borderColor: colors.border + '15' }]}
                                placeholder={t('account_details.confirm_password')}
                                placeholderTextColor={colors.textSecondary}
                                secureTextEntry
                                value={confirmPass}
                                onChangeText={setConfirmPass}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalBtn} onPress={() => setIsEditingPassword(false)}>
                                    <ThemedText style={{ opacity: 0.6, fontWeight: '700' }}>{t('common.cancel') || 'Cancelar'}</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={handleUpdatePassword}>
                                    {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={{ color: '#fff', fontWeight: '800' }}>{t('common.update') || 'Actualizar'}</ThemedText>}
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
                        <ThemedView style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border + '15' }]}>
                            <View style={[styles.otpIconBox, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name="mail-open" size={32} color={colors.primary} />
                            </View>
                            <ThemedText style={[styles.modalTitle, { color: colors.text }]}>{t('account_details.security') || 'Seguridad'}</ThemedText>
                            <ThemedText style={[styles.modalSub, { color: colors.textSecondary }]}>{t('account_details.otp_tip') || 'Introduce el código enviado'}</ThemedText>

                            <TextInput
                                style={[styles.input, styles.otpInput, { backgroundColor: colors.background + '80', color: colors.text, borderColor: colors.primary }]}
                                placeholder="XXXXX"
                                placeholderTextColor={colors.text + '20'}
                                maxLength={5}
                                autoCapitalize="characters"
                                value={passwordRevealCode}
                                onChangeText={setPasswordRevealCode}
                            />

                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={styles.modalBtn} onPress={() => setIsVerifyingPasswordReveal(false)}>
                                    <ThemedText style={{ opacity: 0.6, fontWeight: '700' }}>{t('common.cancel')}</ThemedText>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={confirmPasswordReveal}>
                                    <ThemedText style={{ color: '#fff', fontWeight: '800' }}>{t('account_details.verify')}</ThemedText>
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
        padding: spacing.xl,
    },
    section: {
        marginBottom: spacing.xl,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '900',
        marginBottom: spacing.md,
        textTransform: 'uppercase',
        letterSpacing: 1.2,
        opacity: 0.6,
    },
    infoCard: {
        borderRadius: 24,
        padding: spacing.lg,
        borderWidth: 1,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    value: {
        fontSize: 16,
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    modalContent: {
        borderRadius: 32,
        padding: 24,
        gap: 16,
        borderWidth: 1,
    },
    otpIconBox: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 8,
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: -0.8,
    },
    modalSub: {
        textAlign: 'center',
        fontSize: 14,
        lineHeight: 20,
        paddingHorizontal: 10,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    otpInput: {
        fontSize: 32,
        textAlign: 'center',
        fontWeight: '900',
        letterSpacing: 12,
        height: 70,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalBtn: {
        flex: 1,
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    primaryBtn: {
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    }
});
