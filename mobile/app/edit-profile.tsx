import React, { useState, useEffect } from 'react';
import {
    View,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    Image,
    Alert,
    ActivityIndicator,
    Platform,
    KeyboardAvoidingView,
    StatusBar,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { Ionicons } from '@expo/vector-icons';
import { Stack, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTranslation } from '@/hooks/useTranslation';
import { uploadProfilePhoto } from '@/config/cloudinary';

export default function EditProfileScreen() {
    const { colors, theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [displayName, setDisplayName] = useState('');
    const [bio, setBio] = useState('');
    const [photoURL, setPhotoURL] = useState<string | null>(null);
    const { t, language, setLanguage } = useTranslation();

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            router.replace('/auth/login');
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
            Alert.alert(t('common.error') || 'Error', t('profile.loading_error') || 'No se pudo cargar el perfil');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.permission_denied') || 'Permiso denegado', t('explore.gallery_permission_msg') || 'Necesitamos acceso a tu galería para cambiar la foto.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
        });

        if (!result.canceled) {
            setPhotoURL(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        const currentUser = auth.currentUser;
        if (!currentUser || saving) return;

        setSaving(true);
        try {
            let finalPhotoURL = photoURL;
            if (photoURL && (photoURL.startsWith('file://') || photoURL.includes('ExponentExperienceData'))) {
                finalPhotoURL = await uploadProfilePhoto(photoURL, currentUser.uid);
            }

            await updateProfile(currentUser, {
                displayName: displayName,
                photoURL: finalPhotoURL
            });

            const userRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userRef, {
                displayName,
                bio,
                photoURL: finalPhotoURL,
                updatedAt: serverTimestamp()
            });

            Alert.alert(t('common.success') || 'Éxito', t('profile.save_success') || 'Perfil actualizado correctamente');
            router.back();
        } catch (error: any) {
            console.error('Error saving profile:', error);

            if (error.code === 'auth/requires-recent-login') {
                Alert.alert(t('common.error') || 'Error', t('auth.recent_login_required') || 'Por favor, cierra sesión e inicia de nuevo para cambiar el email.');
            } else if (error.code === 'auth/email-already-in-use') {
                Alert.alert(t('common.error') || 'Error', t('auth.email_already_in_use') || 'Este correo ya está en uso por otra cuenta.');
            } else if (error.code === 'auth/wrong-password') {
                Alert.alert(t('common.error') || 'Error', t('auth.wrong_password') || 'Contraseña incorrecta.');
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert(t('common.error') || 'Error', t('auth.invalid_email') || 'Formato de email inválido.');
            } else {
                Alert.alert(t('common.error') || 'Error', t('profile.save_error') || 'No se pudieron guardar los cambios');
            }
        } finally {
            setSaving(false);
        }
    };

    const headerHeight = useHeaderHeight();
    const insets = useSafeAreaInsets();

    if (loading) {
        return (
            <ThemedView style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary} />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={{ flex: 1 }}>
            <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
            <Stack.Screen
                options={{
                    headerShown: true,
                    headerTitle: t('profile.edit_profile') || 'Editar Perfil',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: spacing.xs, padding: 4 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
                        </TouchableOpacity>
                    ),
                    headerRight: () => (
                        <TouchableOpacity onPress={handleSave} disabled={saving} style={{ marginRight: spacing.sm, padding: 4 }}>
                            {saving ? (
                                <ActivityIndicator size="small" color={colors.primary} />
                            ) : (
                                <ThemedText style={[styles.saveButtonText, { color: colors.primary }]}>{t('common.save') || 'Guardar'}</ThemedText>
                            )}
                        </TouchableOpacity>
                    ),
                }}
            />

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
                keyboardVerticalOffset={headerHeight}
            >
                <ScrollView
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.avatarSection}>
                        <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                            {photoURL ? (
                                <Image source={{ uri: photoURL }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                                    <Ionicons name="camera" size={32} color={colors.primary} />
                                </View>
                            )}
                        </TouchableOpacity>
                        <ThemedText style={styles.changePhotoText}>{t('profile.change_photo') || 'Cambiar foto'}</ThemedText>
                    </View>

                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>{t('profile.username_label') || 'Nombre de usuario'}</ThemedText>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder={t('profile.bio_placeholder') || 'Tu nombre'}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={styles.label}>{t('profile.bio_label') || 'Biografía'}</ThemedText>
                            <TextInput
                                style={[styles.input, styles.textArea, { backgroundColor: colors.backgroundSecondary, color: colors.text, borderColor: colors.border }]}
                                value={bio}
                                onChangeText={setBio}
                                placeholder={t('profile.describe_yourself') || 'Cuéntanos sobre ti...'}
                                placeholderTextColor={colors.textSecondary}
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                            />
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.primarySaveButton, { backgroundColor: colors.primary }]}
                        onPress={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <ThemedText style={styles.primarySaveButtonText}>{t('profile.save_changes') || 'Guardar Cambios'}</ThemedText>
                        )}
                    </TouchableOpacity>

                    <View style={styles.formSection}>
                        <ThemedText style={styles.sectionTitle}>{t('settings.change_language')}</ThemedText>
                        <View style={styles.languageContainer}>
                            {[
                                { id: 'es', label: t('common.spanish') || 'Español', flag: '🇪🇸' },
                                { id: 'en', label: t('common.english') || 'English', flag: '🇺🇸' }
                            ].map((item) => {
                                const isSelected = language === item.id;
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[
                                            styles.langBtn,
                                            { backgroundColor: isSelected ? colors.primary + '15' : colors.backgroundSecondary, borderColor: isSelected ? colors.primary : colors.border }
                                        ]}
                                        onPress={() => setLanguage(item.id as any)}
                                        activeOpacity={0.7}
                                    >
                                        <ThemedText style={styles.langFlag}>{item.flag}</ThemedText>
                                        <ThemedText style={[styles.langText, { color: isSelected ? colors.primary : colors.text }]}>
                                            {item.label}
                                        </ThemedText>
                                        {isSelected && <Check size={16} color={colors.primary} strokeWidth={3} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    <View style={styles.dangerZone}>
                        <ThemedText style={styles.sectionTitle}>{t('profile.account_privacy') || 'Cuenta y Privacidad'}</ThemedText>
                        <ThemedText style={styles.sectionDescription}>{t('profile.manage_account_desc') || 'Gestiona tu correo electrónico y seguridad desde una sección protegida.'}</ThemedText>

                        <TouchableOpacity
                            style={[styles.manageAccountButton, { backgroundColor: colors.backgroundSecondary, borderColor: colors.border }]}
                            onPress={() => router.push('/account-details' as any)}
                        >
                            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                            <ThemedText style={styles.manageAccountText}>{t('profile.account_data') || 'Datos de la cuenta'}</ThemedText>
                            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: colors.danger }]}
                        onPress={() => router.back()}
                    >
                        <ThemedText style={{ color: colors.danger, fontWeight: '600' }}>{t('profile.discard_changes') || 'Descartar Cambios'}</ThemedText>
                    </TouchableOpacity>
                </ScrollView>
            </KeyboardAvoidingView>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollContent: {
        padding: spacing.xl,
        paddingTop: spacing.md,
    },
    avatarSection: {
        alignItems: 'center',
        marginBottom: spacing.xl,
    },
    avatarContainer: {
        width: 120,
        height: 120,
        borderRadius: 60,
        overflow: 'hidden',
        marginBottom: spacing.sm,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    avatar: {
        width: '100%',
        height: '100%',
    },
    avatarPlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    changePhotoText: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        opacity: 0.7,
    },
    formSection: {
        gap: spacing.lg,
        marginBottom: spacing.xl,
    },
    inputGroup: {
        gap: spacing.xs,
    },
    label: {
        fontSize: typography.sizes.sm,
        fontWeight: '600',
        opacity: 0.6,
        marginLeft: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 12,
        padding: spacing.md,
        fontSize: typography.sizes.md,
    },
    textArea: {
        minHeight: 100,
        paddingTop: spacing.md,
    },
    saveButtonText: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
    },
    primarySaveButton: {
        height: 56,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    primarySaveButtonText: {
        color: '#fff',
        fontSize: typography.sizes.md,
        fontWeight: '700',
    },
    dangerZone: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        padding: spacing.lg,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.1)',
        backgroundColor: 'rgba(255, 0, 0, 0.02)',
    },
    sectionTitle: {
        fontSize: typography.sizes.md,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    sectionDescription: {
        fontSize: typography.sizes.xs,
        opacity: 0.6,
        marginBottom: spacing.md,
        lineHeight: 18,
    },
    manageAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
    },
    manageAccountText: {
        flex: 1,
        marginLeft: spacing.sm,
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
    cancelButton: {
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    languageContainer: {
        marginTop: spacing.xs,
        flexDirection: 'row',
        gap: spacing.sm,
    },
    langBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        gap: spacing.sm,
    },
    langFlag: {
        fontSize: 20,
    },
    langText: {
        flex: 1,
        fontSize: typography.sizes.sm,
        fontWeight: '600',
    },
});
