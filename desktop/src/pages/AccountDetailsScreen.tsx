import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    reauthenticateWithCredential,
    EmailAuthProvider,
    updatePassword,
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { spacing } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ChevronLeft, Eye, EyeOff, Shield, Mail } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { useTranslation } from '@/contexts/LanguageContext';

function generateOtpCode(): string {
    const charPool = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
        code += charPool.charAt(Math.floor(Math.random() * charPool.length));
    }
    return code;
}

export default function AccountDetailsScreen() {
    const { colors } = useTheme();
    const navigate = useNavigate();
    const { t } = useTranslation();
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

    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'info' | 'success' | 'error';
    }>({ isOpen: false, title: '', message: '' });

    const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setAlertConfig({ isOpen: true, title, message, type });
    };

    const handleRevealPassword = () => {
        const code = generateOtpCode();
        setPasswordRevealExpected(code);
        setIsVerifyingPasswordReveal(true);
        showAlert(t('account_details.verify_title'), `${t('account_details.code_sent')} ${code}`);
    };

    const confirmPasswordReveal = () => {
        if (passwordRevealCode.toUpperCase() !== passwordRevealExpected) {
            showAlert(t('common.error'), t('account_details.invalid_code'), 'error');
            return;
        }
        setShowPassword(true);
        setIsVerifyingPasswordReveal(false);
        setPasswordRevealCode('');
        showAlert(t('account_details.verified_title'), t('account_details.verified_msg'), 'success');
    };

    const handleUpdatePassword = async () => {
        if (!currentUser || !oldPassword || !newPass || !confirmPass) {
            showAlert(t('common.error'), t('account_details.fill_fields'));
            return;
        }
        if (newPass !== confirmPass) {
            showAlert(t('common.error'), t('account_details.passwords_no_match'), 'error');
            return;
        }
        setLoading(true);
        try {
            const credential = EmailAuthProvider.credential(currentUser.email!, oldPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPass);
            showAlert(t('common.info'), t('account_details.update_success'), 'success');
            setIsEditingPassword(false);
            setOldPassword('');
            setNewPass('');
            setConfirmPass('');
        } catch {
            showAlert(t('common.error'), t('account_details.update_error'), 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!currentUser) return null;

    return (
        <ThemedView style={{ flex: 1, height: '100%', backgroundColor: colors.background }}>
            <div style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                backgroundColor: colors.card,
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: spacing.md
            }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}>
                    <ChevronLeft size={24} />
                </button>
                <ThemedText style={{ fontWeight: 'bold' }}>{t('account_details.title')}</ThemedText>
            </div>

            <div style={{ maxWidth: 800, margin: '0 auto', padding: spacing.xl }}>
                <section style={{ marginBottom: spacing.xl }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md, opacity: 0.7 }}>
                        <Shield size={20} />
                        <ThemedText style={{ fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {t('account_details.security')}
                        </ThemedText>
                    </div>

                    <div style={{ backgroundColor: colors.card, borderRadius: 16, padding: spacing.lg, border: `1px solid ${colors.border}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <ThemedText style={{ fontSize: 12, opacity: 0.5, display: 'block', marginBottom: 2 }}>
                                    {t('account_details.password_label')}
                                </ThemedText>
                                <ThemedText style={{ fontWeight: '600' }}>
                                    {showPassword ? 'sha256:7b5e...3a1f' : '••••••••••••'}
                                </ThemedText>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
                                <button
                                    onClick={handleRevealPassword}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary }}
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                                <button
                                    onClick={() => setIsEditingPassword(true)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: 'bold' }}
                                >
                                    {t('account_details.change_btn')}
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {isEditingPassword && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl,
                        width: 400, display: 'flex', flexDirection: 'column', gap: spacing.md
                    }}>
                        <ThemedText style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
                            {t('account_details.change_password_title')}
                        </ThemedText>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
                            <input
                                type="password"
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                placeholder={t('account_details.old_password')}
                                style={{
                                    padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.background, color: colors.text, outline: 'none'
                                }}
                            />
                            <input
                                type="password"
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                placeholder={t('account_details.new_password')}
                                style={{
                                    padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.background, color: colors.text, outline: 'none'
                                }}
                            />
                            <input
                                type="password"
                                value={confirmPass}
                                onChange={e => setConfirmPass(e.target.value)}
                                placeholder={t('account_details.confirm_password')}
                                style={{
                                    padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                    backgroundColor: colors.background, color: colors.text, outline: 'none'
                                }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: spacing.md, marginTop: spacing.md }}>
                            <button
                                onClick={() => setIsEditingPassword(false)}
                                style={{ flex: 1, padding: '12px', border: 'none', background: 'transparent', color: colors.text, opacity: 0.6, cursor: 'pointer' }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={handleUpdatePassword}
                                disabled={loading}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, backgroundColor: colors.primary,
                                    color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                            >
                                {loading ? t('account_details.updating') : t('account_details.update_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isVerifyingPasswordReveal && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001,
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{
                        backgroundColor: colors.card, borderRadius: 20, padding: spacing.xl,
                        width: 350, textAlign: 'center', userSelect: 'text'
                    }}>
                        <Mail size={48} color={colors.primary} style={{ margin: '0 auto 16px' }} />
                        <ThemedText style={{ fontSize: 24, fontWeight: 'bold', display: 'block', marginBottom: 8 }}>
                            {t('account_details.verify_title')}
                        </ThemedText>
                        <ThemedText style={{ fontSize: 14, opacity: 0.6, display: 'block', marginBottom: spacing.xl }}>
                            {t('account_details.verify_desc')}
                        </ThemedText>

                        <input
                            autoFocus
                            value={passwordRevealCode}
                            onChange={e => setPasswordRevealCode(e.target.value.toUpperCase())}
                            placeholder="XXXXX"
                            maxLength={5}
                            style={{
                                width: '100%', padding: spacing.md, textAlign: 'center', fontSize: 24, fontWeight: 'bold',
                                letterSpacing: 8, borderRadius: 12, border: `2px solid ${colors.primary}`,
                                backgroundColor: colors.background, color: colors.text, outline: 'none',
                                marginBottom: spacing.xl, pointerEvents: 'auto', position: 'relative', zIndex: 1002
                            }}
                        />

                        <div style={{ display: 'flex', gap: spacing.md }}>
                            <button
                                onClick={() => setIsVerifyingPasswordReveal(false)}
                                style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: colors.text, opacity: 0.6, cursor: 'pointer' }}
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                onClick={confirmPasswordReveal}
                                style={{
                                    flex: 1, padding: '12px', borderRadius: 12, backgroundColor: colors.primary,
                                    color: '#FFF', border: 'none', fontWeight: 'bold', cursor: 'pointer'
                                }}
                            >
                                {t('account_details.verify_btn')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />
        </ThemedView>
    );
}
