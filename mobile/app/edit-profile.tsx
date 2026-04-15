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
import { updateProfile, signOut } from 'firebase/auth';
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
            Alert.alert(t('common.error') || 'Error', t('profile.loading_error') || 'Loading Error');
        } finally {
            setLoading(false);
        }
    };

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert(t('common.permission_denied') || 'Permission Denied', t('explore.gallery_permission_msg') || 'Gallery Permission Msg');
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

            Alert.alert(t('common.success') || 'Success', t('profile.save_success') || 'Save Success');
            router.back();
        } catch (error: any) {
            console.error('Error saving profile:', error);

            if (error.code === 'auth/requires-recent-login') {
                Alert.alert(t('common.error') || 'Error', t('auth.recent_login_required') || 'Recent Login Required');
            } else if (error.code === 'auth/email-already-in-use') {
                Alert.alert(t('common.error') || 'Error', t('auth.email_already_in_use') || 'Email Already In Use');
            } else if (error.code === 'auth/wrong-password') {
                Alert.alert(t('common.error') || 'Error', t('auth.wrong_password') || 'Wrong Password');
            } else if (error.code === 'auth/invalid-email') {
                Alert.alert(t('common.error') || 'Error', t('auth.invalid_email') || 'Invalid Email');
            } else {
                Alert.alert(t('common.error') || 'Error', t('profile.save_error') || 'Save Error');
            }
        } finally {
            setSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert(
            t('common.logout') || 'Logout',
            t('common.logout_confirm') || 'Logout Confirm',
            [
                { text: t('common.cancel') || 'Cancel', style: 'cancel' },
                {
                    text: t('common.logout') || 'Logout',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await signOut(auth);
                        } catch {
                            Alert.alert(t('common.error') || 'Error', t('settings.logout_error') || 'Logout Error');
                        }
                    },
                },
            ]
        );
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
                    headerTitle: t('profile.edit_profile') || 'Edit Profile',
                    headerLeft: () => (
                        <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: spacing.xs, padding: 4 }}>
                            <Ionicons name="chevron-back" size={24} color={colors.text} />
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
                        <TouchableOpacity onPress={pickImage} style={[styles.avatarContainer, { borderColor: colors.border + '15' }]}>
                            <View style={[styles.avatarGlow, { backgroundColor: colors.primary + '15' }]} />
                            {photoURL ? (
                                <Image source={{ uri: photoURL }} style={styles.avatar} />
                            ) : (
                                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.backgroundSecondary + '80' }]}>
                                    <Ionicons name="camera" size={40} color={colors.primary} />
                                </View>
                            )}
                        </TouchableOpacity>
                        <ThemedText style={[styles.changePhotoText, { color: colors.primary }]}>{t('profile.change_photo') || 'Cambiar foto'}</ThemedText>
                    </View>

                    <View style={styles.formSection}>
                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{t('profile.username_label') || 'Nombre de usuario'}</ThemedText>
                            <TextInput
                                style={[styles.input, { backgroundColor: colors.card + '80', color: colors.text, borderColor: colors.border + '15' }]}
                                value={displayName}
                                onChangeText={setDisplayName}
                                placeholder={t('profile.bio_placeholder') || 'Escribe tu nombre...'}
                                placeholderTextColor={colors.textSecondary}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <ThemedText style={[styles.label, { color: colors.textSecondary }]}>{t('profile.bio_label') || 'Biografía'}</ThemedText>
                            <TextInput
                                style={[styles.input, styles.textArea, { backgroundColor: colors.card + '80', color: colors.text, borderColor: colors.border + '15' }]}
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
                            <ThemedText style={styles.primarySaveButtonText}>{t('profile.save_changes') || 'Save Changes'}</ThemedText>
                        )}
                    </TouchableOpacity>

                    <View style={styles.formSection}>
                        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('settings.change_language')}</ThemedText>
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
                                            { backgroundColor: isSelected ? colors.primary + '15' : colors.card + '80', borderColor: isSelected ? colors.primary : colors.border + '15' }
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
                        <ThemedText style={[styles.sectionTitle, { color: colors.text }]}>{t('profile.account_privacy') || 'Privacidad de cuenta'}</ThemedText>
                        <ThemedText style={[styles.sectionDescription, { color: colors.textSecondary }]}>{t('profile.manage_account_desc') || 'Gestiona tus datos y preferencias de cuenta'}</ThemedText>

                        <TouchableOpacity
                            style={[styles.manageAccountButton, { backgroundColor: colors.card + '50', borderColor: colors.border + '10' }]}
                            onPress={() => router.push('/account-details' as any)}
                        >
                            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
                            <ThemedText style={[styles.manageAccountText, { color: colors.text }]}>{t('profile.account_data') || 'Datos de la cuenta'}</ThemedText>
                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.manageAccountButton, { backgroundColor: colors.card + '50', borderColor: colors.border + '10' }]}
                            onPress={() => router.push('/accounts' as any)}
                        >
                            <Ionicons name="people-outline" size={20} color={colors.primary} />
                            <ThemedText style={[styles.manageAccountText, { color: colors.text }]}>{t('settings.manage_accounts') || 'Gestionar cuentas'}</ThemedText>
                            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.manageAccountButton, { backgroundColor: '#FF3B3010', borderColor: '#FF3B3015' }]}
                            onPress={() => router.push('/delete-account' as any)}
                        >
                            <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                            <ThemedText style={[styles.manageAccountText, { color: '#FF3B30' }]}>{t('settings.delete_account') || 'Eliminar cuenta'}</ThemedText>
                            <Ionicons name="chevron-forward" size={18} color="#FF3B30" />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[styles.logoutButton, { borderColor: colors.danger }]}
                        onPress={handleLogout}
                    >
                        <Ionicons name="log-out-outline" size={20} color={colors.danger} />
                        <ThemedText style={{ color: colors.danger, fontWeight: '600' }}>{t('common.logout') || 'Logout'}</ThemedText>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.cancelButton, { borderColor: colors.border }]}
                        onPress={() => router.back()}
                    >
                        <ThemedText style={{ color: colors.textSecondary, fontWeight: '600' }}>{t('profile.discard_changes') || 'Discard Changes'}</ThemedText>
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
        width: 130,
        height: 130,
        borderRadius: 65,
        borderWidth: 1,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.md,
    },
    avatarGlow: { position: 'absolute', width: 140, height: 140, borderRadius: 70, opacity: 0.5 },
    avatar: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 4,
        borderColor: '#fff',
    },
    avatarPlaceholder: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    changePhotoText: {
        fontSize: 13,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    formSection: {
        gap: spacing.lg,
        marginBottom: spacing.xl,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
        letterSpacing: 1,
        opacity: 0.5,
        marginLeft: 4,
    },
    input: {
        borderWidth: 1,
        borderRadius: 16,
        padding: 16,
        fontSize: 16,
        fontWeight: '600',
    },
    textArea: {
        minHeight: 120,
        paddingTop: 16,
    },
    primarySaveButton: {
        height: 60,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.xl,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
    },
    primarySaveButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.3,
    },
    dangerZone: {
        marginTop: spacing.sm,
        marginBottom: spacing.xl,
        padding: spacing.lg,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(255, 0, 0, 0.1)',
        backgroundColor: 'rgba(255, 0, 0, 0.02)',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: -0.5,
    },
    sectionDescription: {
        fontSize: 13,
        lineHeight: 18,
        marginBottom: 8,
    },
    manageAccountButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 12,
    },
    manageAccountText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '700',
    },
    logoutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    cancelButton: {
        padding: 18,
        borderRadius: 16,
        borderWidth: 1,
        alignItems: 'center',
    },
    languageContainer: {
        flexDirection: 'row',
        gap: 10,
    },
    langBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        gap: 10,
    },
    langFlag: {
        fontSize: 20,
    },
    langText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '800',
    },
});
