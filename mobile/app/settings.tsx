import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { spacing, typography, type AppTheme } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { previewTone } from '@/utils/toneGenerator';
import type { MuteDuration } from '@/types';

const MUTE_OPTIONS: { value: MuteDuration; label: string }[] = [
  { value: '8h', label: '8 horas' },
  { value: '1w', label: '1 semana' },
  { value: 'always', label: 'Siempre' },
  { value: 'off', label: 'No silenciar' },
];

const ALERT_TONES = ['Predeterminado', 'Clásico', 'Suave', 'Melodía', 'Campana', 'Pulso', 'Sin tono'];

const PRESET_COLORS = [
  '#007AFF', '#FF2D55', '#5856D6', '#AF52DE',
  '#FF9500', '#FFCC00', '#34C759', '#5AC8FA',
  '#FF3B30', '#8E8E93', '#E91E63', '#9C27B0',
  '#3F51B5', '#00BCD4', '#009688', '#4CAF50',
  '#FFEB3B', '#FF9800', '#FF5722', '#795548'
];

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [showFullEmail, setShowFullEmail] = useState(false);
  const [globalMute, setGlobalMute] = useState<MuteDuration>('off');
  const [globalTone, setGlobalTone] = useState('Melodía');
  const currentUser = auth.currentUser;
  const { theme, colors, setTheme, setCustomPrimary, customPrimary } = useTheme();

  useEffect(() => {
    if (!currentUser) return;

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Settings Snapshot error:', error);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleLogout = async () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut(auth);
              router.replace('/auth/login');
            } catch (error) {
              Alert.alert('Error', 'No se pudo cerrar sesión');
            }
          }
        }
      ]
    );
  };

  const ThemeOption = ({ id, label, current }: { id: AppTheme; label: string; current: boolean }) => (
    <TouchableOpacity
      style={[
        styles.themeOption,
        { borderColor: current ? colors.primary : colors.border },
        current && { backgroundColor: colors.primary + '11' }
      ]}
      onPress={() => setTheme(id)}
    >
      <ThemedText style={[styles.themeLabel, current && { color: colors.primary }]}>{label}</ThemedText>
      {current && <ThemedText style={{ color: colors.primary }}>✓</ThemedText>}
    </TouchableOpacity>
  );

  const handleMuteChange = async (value: MuteDuration) => {
    setGlobalMute(value);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalMute': value });
    }
  };

  const handleToneChange = async (tone: string) => {
    setGlobalTone(tone);
    previewTone(tone);
    if (currentUser) {
      await updateDoc(doc(db, 'users', currentUser.uid), { 'settings.globalTone': tone });
    }
  };

  useEffect(() => {
    if (userData?.settings?.globalMute) setGlobalMute(userData.settings.globalMute);
    if (userData?.settings?.globalTone) setGlobalTone(userData.settings.globalTone);
  }, [userData]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.card }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.card} translucent={false} />
      <Stack.Screen options={{
        title: 'Ajustes',
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerBackTitle: '',
      }} />
      <ThemedView style={styles.container}>
        <ScrollView contentContainerStyle={{ paddingBottom: Platform.OS === 'ios' ? 40 : 20 }}>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Tema General</ThemedText>
            <View style={styles.themeGrid}>
              <ThemeOption id="light" label="Modo Claro" current={theme === 'light'} />
              <ThemeOption id="dark" label="Modo Oscuro" current={theme === 'dark'} />
              <ThemeOption id="high-contrast" label="Modo de Alta Contraste" current={theme === 'high-contrast'} />
              <ThemeOption id="pastel" label="Pastel" current={theme === 'pastel'} />
            </View>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Color Personalizado</ThemedText>
            <ThemedText style={styles.sectionDescription}>Selecciona un color para personalizar la interfaz instantáneamente.</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.colorScroll}>
              {PRESET_COLORS.map(color => (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: color },
                    customPrimary === color && theme === 'monochromatic' && { borderWidth: 3, borderColor: colors.text }
                  ]}
                  onPress={() => setCustomPrimary(color)}
                />
              ))}
            </ScrollView>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Información del Perfil</ThemedText>
            <View style={styles.infoRow}>
              <ThemedText style={styles.label}>Nombre</ThemedText>
              <ThemedText style={styles.value}>{userData?.displayName || currentUser?.displayName || 'User'}</ThemedText>
            </View>
            <TouchableOpacity
              style={styles.infoColumn}
              activeOpacity={0.7}
              onPress={() => setShowFullEmail(v => !v)}
            >
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedText
                style={styles.value}
                numberOfLines={showFullEmail ? 0 : 1}
                ellipsizeMode="tail"
              >
                {userData?.email || currentUser?.email}
              </ThemedText>
            </TouchableOpacity>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Notificaciones</ThemedText>
            <ThemedText style={styles.sectionDescription}>Silenciar todas las notificaciones de la aplicación.</ThemedText>
            <View style={styles.notifGroup}>
              {MUTE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.notifOption, { borderColor: globalMute === opt.value ? colors.primary : colors.border }, globalMute === opt.value && { backgroundColor: colors.primary + '11' }]}
                  onPress={() => handleMuteChange(opt.value)}
                >
                  <ThemedText style={[styles.notifLabel, globalMute === opt.value && { color: colors.primary }]}>{opt.label}</ThemedText>
                  {globalMute === opt.value && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
            <ThemedText style={[styles.sectionDescription, { marginTop: spacing.md }]}>Tono de alerta global.</ThemedText>
            <View style={styles.notifGroup}>
              {ALERT_TONES.map(tone => (
                <TouchableOpacity
                  key={tone}
                  style={[styles.notifOption, { borderColor: globalTone === tone ? colors.primary : colors.border }, globalTone === tone && { backgroundColor: colors.primary + '11' }]}
                  onPress={() => handleToneChange(tone)}
                >
                  <ThemedText style={[styles.notifLabel, globalTone === tone && { color: colors.primary }]}>{tone}</ThemedText>
                  {globalTone === tone && <Check size={16} color={colors.primary} strokeWidth={2.5} />}
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={[styles.section, { borderBottomColor: colors.border }]}>
            <ThemedText style={styles.sectionTitle}>Cuenta</ThemedText>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.danger }]} onPress={handleLogout}>
              <ThemedText style={styles.buttonText}>Cerrar Sesión</ThemedText>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  section: { padding: spacing.lg, borderBottomWidth: 1 },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  sectionDescription: { fontSize: typography.sizes.sm, opacity: 0.6, marginBottom: spacing.md },
  themeGrid: { marginTop: spacing.sm },
  themeOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: spacing.sm },
  themeLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  colorScroll: { flexDirection: 'row', marginTop: spacing.sm },
  colorSwatch: { width: 44, height: 44, borderRadius: 22, marginRight: spacing.md },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
  infoColumn: { paddingVertical: spacing.sm, gap: 4 },
  label: { fontSize: typography.sizes.md, opacity: 0.6 },
  value: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  button: { padding: spacing.md, borderRadius: 8, alignItems: 'center', marginTop: spacing.sm },
  buttonText: { color: '#FFFFFF', fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  notifGroup: { marginTop: spacing.xs },
  notifOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.sm + 2, borderRadius: 10, borderWidth: 1, marginBottom: spacing.xs },
  notifLabel: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold }
});
