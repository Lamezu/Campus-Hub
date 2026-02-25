import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Image, StyleSheet, Platform, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  useEffect(() => {
    if (!currentUser) {
      router.replace('/auth/login');
      return;
    }

    const userRef = doc(db, 'users', currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        setUserData(doc.data());
      }
      setLoading(false);
    }, (error) => {
      console.error('Error listening to user profile:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Cargando perfil...</ThemedText>
      </ThemedView>
    );
  }

  const displayName = userData?.displayName || currentUser?.displayName || 'Usuario';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingBottom: Platform.OS === 'android' ? insets.bottom + 80 : insets.bottom + 20
      }}
    >
      <View style={[
        styles.header,
        {
          borderBottomColor: colors.border,
          paddingTop: Platform.OS === 'ios' ? insets.top + spacing.xl : spacing.xl
        }
      ]}>
        <View style={[styles.avatarContainer, { backgroundColor: colors.backgroundSecondary }]}>
          {userData?.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.avatar} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.text }]}>{initial}</Text>
          )}
        </View>

        <ThemedText style={styles.name}>{displayName}</ThemedText>
        <ThemedText style={styles.email}>{userData?.email || currentUser?.email}</ThemedText>

        <TouchableOpacity
          style={[styles.editButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/edit-profile' as any)}
        >
          <ThemedText style={styles.editButtonText}>Editar Perfil</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsContainer, { backgroundColor: colors.backgroundSecondary }]}>
        <View style={styles.statItem}>
          <ThemedText style={styles.statValue}>12</ThemedText>
          <ThemedText style={styles.statLabel}>Canales</ThemedText>
        </View>

        <View style={styles.statItem}>
          <ThemedText style={styles.statValue}>48</ThemedText>
          <ThemedText style={styles.statLabel}>Mensajes</ThemedText>
        </View>

        <View style={styles.statItem}>
          <ThemedText style={styles.statValue}>5</ThemedText>
          <ThemedText style={styles.statLabel}>Amigos</ThemedText>
        </View>
      </View>

      <View style={styles.section}>
        <ThemedText style={styles.sectionTitle}>Acciones Rápidas</ThemedText>

        <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ThemedText style={styles.actionTitle}>💾 Mensajes Guardados</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Ver contenido guardado</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ThemedText style={styles.actionTitle}>👥 Amigos</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Gestionar lista de amigos</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <ThemedText style={styles.actionTitle}>⭐ Mejores Amigos</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Tus conexiones más cercanas</ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { alignItems: 'center', paddingVertical: spacing.xl, paddingHorizontal: spacing.lg, borderBottomWidth: 1 },
  avatarContainer: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.lg, marginTop: spacing.md },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarText: { fontSize: 32, fontWeight: typography.weights.bold, textAlign: 'center', lineHeight: 32, paddingTop: 6, includeFontPadding: false },
  name: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, marginBottom: spacing.xs },
  email: { fontSize: typography.sizes.sm, opacity: 0.6, marginBottom: spacing.lg },
  editButton: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 20 },
  editButtonText: { color: '#ffffff', fontWeight: typography.weights.semibold },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: spacing.lg, marginVertical: spacing.xl - 30, marginTop: spacing.lg, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderRadius: 30 },
  statItem: { alignItems: 'center', flex: 1 },
  statValue: { fontSize: typography.sizes.lg + 5, fontWeight: typography.weights.bold },
  statLabel: { fontSize: typography.sizes.xs, opacity: 0.6, marginTop: spacing.xs },
  section: { padding: spacing.lg, paddingTop: spacing.md },
  sectionTitle: { fontSize: typography.sizes.lg, fontWeight: typography.weights.bold, marginBottom: spacing.md },
  actionCard: { borderWidth: 1, padding: spacing.md, borderRadius: 12, marginBottom: spacing.sm },
  actionTitle: { fontSize: typography.sizes.md, fontWeight: typography.weights.semibold },
  actionSubtitle: { fontSize: typography.sizes.sm, opacity: 0.6, marginTop: spacing.xs }
});
