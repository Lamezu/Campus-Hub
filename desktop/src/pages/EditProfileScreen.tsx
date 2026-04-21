import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile, signOut } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { spacing } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ChevronLeft, Camera, Globe, Users, LogOut, Check, Trash2 } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { uploadProfilePhoto } from '@/config/cloudinary';
import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar } from '@/components/common/Avatar';

export default function EditProfileScreen() {
    const { colors } = useTheme();
    const navigate = useNavigate();
    const { t, language, setLanguage } = useTranslation();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [alertConfig, setAlertConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type?: 'info' | 'success' | 'error' | 'confirm';
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', message: '' });

    const showAlert = (
        title: string,
        message: string,
        type: 'info' | 'success' | 'error' | 'confirm' = 'info',
        onConfirm?: () => void
    ) => {
        setAlertConfig({ isOpen: true, title, message, type, onConfirm });
    };

    useEffect(() => {
        const loadUserProfile = async () => {
            const currentUser = auth.currentUser;
            if (!currentUser) {
                navigate('/login');
                return;
            }
            try {
                const userRef = doc(db, 'users', currentUser.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setDisplayName(userData.displayName || '');
                    setBio(userData.bio || '');
                    setPhotoURL(userData.photoURL || null);
                }
            } catch {
            } finally {
                setLoading(false);
            }
        };
        loadUserProfile();
    }, [navigate]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPhotoURL(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || saving) return;
        setSaving(true);
        try {
            let finalPhotoURL = photoURL;
            if (selectedFile) {
                finalPhotoURL = await uploadProfilePhoto(selectedFile, currentUser.uid);
            }
            await updateProfile(currentUser, {
                displayName,
                photoURL: finalPhotoURL || undefined
            });
            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                language,
                photoURL: finalPhotoURL,
                updatedAt: serverTimestamp()
            });
            showAlert(t('profile.save_success'), t('profile.save_success_desc'), 'success', () => navigate(-1));
        } catch {
            showAlert(t('common.error'), t('profile.save_error'), 'error');
        } finally {
            setSaving(false);
        }
    };


    if (loading) {
        return (
            <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{
                    width: 40, height: 40,
                    border: `3px solid ${colors.border}`,
                    borderTop: `3px solid ${colors.primary}`,
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite'
                }} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: colors.background }}>
            <div style={{
                padding: `${spacing.sm}px ${spacing.md}px`,
                backgroundColor: colors.card,
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                position: 'sticky',
                top: 0,
                zIndex: 10
            }}>
                <button onClick={() => navigate(-1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.text }}>
                    <ChevronLeft size={24} />
                </button>
                <ThemedText style={{ fontWeight: 'bold' }}>{t('profile.edit_title')}</ThemedText>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: colors.primary, fontWeight: 'bold',
                        opacity: saving ? 0.5 : 1
                    }}
                >
                    {saving ? t('profile.saving') : t('profile.save')}
                </button>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: spacing.xl }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: spacing.xl }}>
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                            width: 120, height: 120, borderRadius: '50%', overflow: 'hidden',
                            backgroundColor: colors.backgroundSecondary, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)', position: 'relative'
                        }}
                    >
                        <Avatar 
                            src={photoURL} 
                            name={displayName} 
                            size={120} 
                        />
                        <div
                            style={{
                                position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                opacity: 0, transition: 'opacity 0.2s'
                            }}
                            onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                            onMouseOut={e => (e.currentTarget.style.opacity = '0')}
                        >
                            <Camera size={24} color="#FFF" />
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                    <ThemedText style={{ fontSize: 14, fontWeight: '600', marginTop: spacing.sm, opacity: 0.7 }}>
                        {t('profile.change_photo')}
                    </ThemedText>
                    
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing.xl }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, marginLeft: 4 }}>
                            {t('profile.username_label')}
                        </ThemedText>
                        <input
                            value={displayName}
                            onChange={e => setDisplayName(e.target.value)}
                            placeholder={t('profile.username_placeholder')}
                            style={{
                                padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, marginLeft: 4 }}>
                            {t('profile.bio_label')}
                        </ThemedText>
                        <textarea
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            placeholder={t('profile.bio_placeholder')}
                            rows={4}
                            style={{
                                padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none',
                                resize: 'none', fontFamily: 'inherit'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.md, marginTop: spacing.md }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                            <Globe size={18} color={colors.primary} />
                            <ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>{t('profile.language_label')}</ThemedText>
                        </div>
                        <div style={{ display: 'flex', gap: spacing.md }}>
                            <button
                                onClick={() => setLanguage('es')}
                                style={{
                                    flex: 1, padding: spacing.md, borderRadius: 12,
                                    border: `1px solid ${language === 'es' ? colors.primary : colors.border}`,
                                    backgroundColor: language === 'es' ? `${colors.primary}15` : colors.card,
                                    color: language === 'es' ? colors.primary : colors.text,
                                    fontWeight: '600', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
                                }}
                            >
                                <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>ES</span> {t('common.languages.es')} {language === 'es' && <Check size={16} />}
                            </button>
                            <button
                                onClick={() => setLanguage('en')}
                                style={{
                                    flex: 1, padding: spacing.md, borderRadius: 12,
                                    border: `1px solid ${language === 'en' ? colors.primary : colors.border}`,
                                    backgroundColor: language === 'en' ? `${colors.primary}15` : colors.card,
                                    color: language === 'en' ? colors.primary : colors.text,
                                    fontWeight: '600', cursor: 'pointer',
                                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8
                                }}
                            >
                                <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>EN</span> {t('common.languages.en')} {language === 'en' && <Check size={16} />}
                            </button>
                        </div>
                    </div>
                </div>

                <button
                    onClick={() => navigate(-1)}
                    style={{
                        width: '100%', padding: spacing.md, borderRadius: 12,
                        border: `1px solid ${colors.danger}`,
                        color: colors.danger, backgroundColor: 'transparent',
                        fontWeight: '600', cursor: 'pointer', marginBottom: spacing.xl
                    }}
                >
                    {t('profile.discard')}
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.sm, marginBottom: spacing.xl }}>
                    <button
                        onClick={() => navigate('/manage-accounts')}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                            color: colors.text, backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
                    >
                        <Users size={18} color={colors.primary} />
                        {t('settings.manage_accounts')}
                    </button>
                    <button
                        onClick={() => {
                            showAlert(
                                t('settings.logout_confirm_title'),
                                t('settings.logout_confirm_desc'),
                                'confirm',
                                async () => {
                                    await signOut(auth);
                                    navigate('/auth/login');
                                }
                            );
                        }}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                            color: colors.text, backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = colors.backgroundSecondary}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
                    >
                        <LogOut size={18} color="#FF9500" />
                        {t('settings.logout')}
                    </button>
                    <button
                        onClick={() => navigate('/delete-account')}
                        style={{
                            width: '100%', padding: '14px', borderRadius: 12, border: `1px solid ${colors.border}`,
                            color: '#FF3B30', backgroundColor: colors.card, fontWeight: '700', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 12, transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#FF3B3010'}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = colors.card}
                    >
                        <Trash2 size={18} color="#FF3B30" />
                        {t('settings.delete_account')}
                    </button>
                </div>
            </div>

            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onConfirm={alertConfig.onConfirm}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </ThemedView>
    );
}
