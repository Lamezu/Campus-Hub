import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { ChevronLeft, Camera, ShieldCheck, ChevronRight, X } from 'lucide-react';
import { AlertModal } from '@/components/AlertModal';
import { uploadProfilePhoto } from '@/config/cloudinary';

export default function EditProfileScreen() {
    const { colors } = useTheme();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [alertConfig, setAlertConfig] = useState<{ isOpen: boolean; title: string; message: string; type?: 'info' | 'success' | 'error' | 'confirm'; onConfirm?: () => void }>({
        isOpen: false,
        title: '',
        message: '',
    });

    const showAlert = (title: string, message: string, type: 'info' | 'success' | 'error' | 'confirm' = 'info', onConfirm?: () => void) => {
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
            } catch (error) {
                console.error('Error loading profile:', error);
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
                displayName: displayName,
                photoURL: finalPhotoURL || undefined
            });

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                photoURL: finalPhotoURL,
                updatedAt: serverTimestamp()
            });

            // Note: In a real app with high consistency requirements, 
            // we would trigger a Cloud Function here to update all existing posts/messages.
            // For this implementation, we ensure the 'users' collection is the source of truth
            // and future-proof the local state.
            showAlert('Éxito', 'Perfil actualizado correctamente', 'success', () => navigate(-1));
        } catch (error: any) {
            console.error('Error saving profile:', error);
            showAlert('Error', 'No se pudieron guardar los cambios', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 40, height: 40, border: `3px solid ${colors.border}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1, height: '100%', overflowY: 'auto', backgroundColor: colors.background }}>
            {/* Header */}
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
                <ThemedText style={{ fontWeight: 'bold' }}>Editar Perfil</ThemedText>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: colors.primary,
                        fontWeight: 'bold',
                        opacity: saving ? 0.5 : 1
                    }}
                >
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

            <div style={{ maxWidth: 600, margin: '0 auto', padding: spacing.xl }}>
                {/* Avatar Section */}
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
                        {photoURL ? (
                            <img src={photoURL} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                            <Camera size={32} color={colors.primary} />
                        )}
                        <div style={{
                            position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: 0, transition: 'opacity 0.2s'
                        }} onMouseOver={(e) => (e.currentTarget.style.opacity = '1')} onMouseOut={(e) => (e.currentTarget.style.opacity = '0')}>
                             <Camera size={24} color="#FFF" />
                        </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
                    <ThemedText style={{ fontSize: 14, fontWeight: '600', marginTop: spacing.sm, opacity: 0.7 }}>Cambiar foto</ThemedText>
                </div>

                {/* Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, marginBottom: spacing.xl }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, marginLeft: 4 }}>Nombre de usuario</ThemedText>
                        <input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Tu nombre"
                            style={{
                                padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <ThemedText style={{ fontSize: 13, fontWeight: '600', opacity: 0.6, marginLeft: 4 }}>Biografía</ThemedText>
                        <textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Cuéntanos sobre ti..."
                            rows={4}
                            style={{
                                padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                                backgroundColor: colors.backgroundSecondary, color: colors.text, outline: 'none',
                                resize: 'none', fontFamily: 'inherit'
                            }}
                        />
                    </div>
                </div>

                {/* Account Details Shortcut */}
                <div style={{
                    padding: spacing.lg, borderRadius: 20, border: `1px solid ${colors.border}`,
                    backgroundColor: `${colors.primary}05`, marginBottom: spacing.xl
                }}>
                    <ThemedText style={{ fontWeight: 'bold', display: 'block', marginBottom: 4 }}>Cuenta y Privacidad</ThemedText>
                    <ThemedText style={{ fontSize: 12, opacity: 0.6, display: 'block', marginBottom: spacing.md }}>
                        Gestiona tu correo electrónico y seguridad.
                    </ThemedText>
                    <button
                        onClick={() => navigate('/account-details')}
                        style={{
                            width: '100%', display: 'flex', alignItems: 'center', gap: spacing.sm,
                            padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.border}`,
                            backgroundColor: colors.backgroundSecondary, cursor: 'pointer', color: colors.text
                        }}
                    >
                        <ShieldCheck size={20} color={colors.primary} />
                        <span style={{ flex: 1, textAlign: 'left', fontWeight: '600' }}>Datos de la cuenta</span>
                        <ChevronRight size={20} opacity={0.5} />
                    </button>
                </div>

                <button
                    onClick={() => navigate(-1)}
                    style={{
                        width: '100%', padding: spacing.md, borderRadius: 12, border: `1px solid ${colors.danger}`,
                        color: colors.danger, backgroundColor: 'transparent', fontWeight: '600', cursor: 'pointer'
                    }}
                >
                    Descartar Cambios
                </button>
            </div>

            <AlertModal
                isOpen={alertConfig.isOpen}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onConfirm={alertConfig.onConfirm}
                onClose={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
            />

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </ThemedView>
    );
}
