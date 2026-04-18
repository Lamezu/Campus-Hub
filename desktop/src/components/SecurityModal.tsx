import React, { useState } from 'react';
import { 
    reauthenticateWithCredential, 
    EmailAuthProvider, 
    updatePassword 
} from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/contexts/LanguageContext';
import { ThemedText } from '@/components/themed-text';
import { 
    Lock, KeyRound, CheckCircle2, X, 
    ShieldCheck, Eye, EyeOff, Loader2 
} from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';

interface SecurityModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function SecurityModal({ isOpen, onClose }: SecurityModalProps) {
    const { colors } = useTheme();
    const { t } = useTranslation();
    const currentUser = auth.currentUser;

    const [oldPassword, setOldPassword] = useState('');
    const [newPass, setNewPass] = useState('');
    const [confirmPass, setConfirmPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState(false);

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' }>({
        isOpen: false,
        title: '',
        message: '',
    });

    if (!isOpen || !currentUser) return null;

    const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setAlertConfig({ isOpen: true, title, message, type });
    };

    const handleUpdatePassword = async () => {
        if (!oldPassword || !newPass || !confirmPass) {
            showAlert(t('common.error'), t('auth.fill_all_fields'), 'error');
            return;
        }

        if (newPass !== confirmPass) {
            showAlert(t('common.error'), t('auth.passwords_dont_match'), 'error');
            return;
        }

        setLoading(true);
        try {
            const credential = EmailAuthProvider.credential(currentUser.email!, oldPassword);
            await reauthenticateWithCredential(currentUser, credential);
            await updatePassword(currentUser, newPass);
            showAlert(t('common.success'), t('account_details.password_updated'), 'success');
            
            // Clear fields
            setOldPassword('');
            setNewPass('');
            setConfirmPass('');
            
            // Optional: close after success after a delay
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error: any) {
            console.error(error);
            showAlert(t('common.error'), t('account_details.wrong_old_password'), 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', inset: 0, 
            backgroundColor: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', 
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
        }}>
            <div style={{
                backgroundColor: colors.card,
                width: '100%',
                maxWidth: 480,
                borderRadius: 32,
                overflow: 'hidden',
                border: `1px solid ${colors.border}`,
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                position: 'relative'
            }}>
                {/* Header */}
                <div style={{ 
                    padding: '32px 32px 20px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start' 
                }}>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <div style={{ 
                            width: 50, height: 50, borderRadius: 16, 
                            backgroundColor: `${colors.primary}15`, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: colors.primary
                        }}>
                             <ShieldCheck size={28} />
                        </div>
                        <div>
                            <ThemedText style={{ fontSize: 22, fontWeight: '900' }}>{t('common.password')}</ThemedText>
                            <ThemedText style={{ fontSize: 13, opacity: 0.6 }}>{currentUser.email}</ThemedText>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{ 
                            background: colors.backgroundSecondary, 
                            border: 'none', 
                            borderRadius: '50%', 
                            width: 36, height: 36, 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: colors.textSecondary
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div style={{ padding: '0 32px 32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: 16, top: 16, opacity: 0.3 }} />
                            <input
                                type={showPasswords ? "text" : "password"}
                                value={oldPassword}
                                onChange={e => setOldPassword(e.target.value)}
                                placeholder={t('account_details.old_password')}
                                style={{ 
                                    width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16, 
                                    border: `2px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, 
                                    color: colors.text, outline: 'none', fontSize: 15, fontWeight: '600'
                                }}
                            />
                        </div>

                        <div style={{ height: 1, backgroundColor: colors.border, margin: '8px 0' }} />

                        <div style={{ position: 'relative' }}>
                            <KeyRound size={18} style={{ position: 'absolute', left: 16, top: 16, opacity: 0.3 }} />
                            <input
                                type={showPasswords ? "text" : "password"}
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                                placeholder={t('account_details.new_password')}
                                style={{ 
                                    width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16, 
                                    border: `2px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, 
                                    color: colors.text, outline: 'none', fontSize: 15, fontWeight: '600'
                                }}
                            />
                        </div>

                        <div style={{ position: 'relative' }}>
                            <CheckCircle2 size={18} style={{ position: 'absolute', left: 16, top: 16, opacity: 0.3 }} />
                            <input
                                type={showPasswords ? "text" : "password"}
                                value={confirmPass}
                                onChange={e => setConfirmPass(e.target.value)}
                                placeholder={t('account_details.confirm_password')}
                                style={{ 
                                    width: '100%', padding: '16px 16px 16px 48px', borderRadius: 16, 
                                    border: `2px solid ${colors.border}`, backgroundColor: colors.backgroundSecondary, 
                                    color: colors.text, outline: 'none', fontSize: 15, fontWeight: '600'
                                }}
                            />
                        </div>

                        <button 
                            onClick={() => setShowPasswords(!showPasswords)}
                            style={{ 
                                alignSelf: 'flex-end', background: 'none', border: 'none', 
                                color: colors.primary, fontSize: 13, fontWeight: '700', 
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6
                            }}
                        >
                            {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                            {showPasswords ? t('common.hide') : t('common.show')}
                        </button>

                        <button
                            onClick={handleUpdatePassword}
                            disabled={loading}
                            style={{
                                width: '100%', padding: '18px', borderRadius: 20, backgroundColor: colors.primary,
                                color: '#FFF', border: 'none', fontWeight: '900', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: `0 12px 24px ${colors.primary}30`, transition: 'all 0.2s',
                                marginTop: 12, fontSize: 16
                            }}
                        >
                            {loading ? <div className="spinner" /> : t('common.update')}
                        </button>
                    </div>
                </div>

                <AlertModal
                    isOpen={alertConfig.isOpen}
                    title={alertConfig.title}
                    message={alertConfig.message}
                    type={alertConfig.type}
                    onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                />

                <style>{`
                    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .spinner {
                        width: 20px; height: 20px;
                        border: 3px solid rgba(255,255,255,0.3);
                        border-top-color: white; borderRadius: 50%;
                        animation: spin 0.8s linear infinite;
                    }
                    @keyframes spin { to { transform: rotate(360deg); } }
                `}</style>
            </div>
        </div>
    );
}
