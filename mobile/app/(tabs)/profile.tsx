import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { auth, db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { colors, spacing, typography } from '@/constants/styles';

export default function ProfileScreen() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadProfile = async () => {
      if (!currentUser) {
        router.replace('/auth/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ThemedText>Cargando perfil...</ThemedText>
      </ThemedView>
    );
  }

  const displayName = userData?.displayName || currentUser?.displayName || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={{ 
        paddingBottom: Platform.OS === 'android' ? insets.bottom + 80 : insets.bottom + 20 
      }}
    >
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          {userData?.photoURL ? (
            <Image source={{ uri: userData.photoURL }} style={styles.avatar} />
          ) : (
            <ThemedText style={styles.avatarText}>{initial}</ThemedText>
          )}
        </View>

        <ThemedText style={styles.name}>{displayName}</ThemedText>
        <ThemedText style={styles.email}>{currentUser?.email}</ThemedText>

        <TouchableOpacity style={styles.editButton} onPress={() => router.push('../settings')}>
          <ThemedText style={styles.editButtonText}>Editar Perfil</ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
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
        
        <TouchableOpacity style={styles.actionCard}>
          <ThemedText style={styles.actionTitle}>💾 Mensajes Guardados</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Ver tu contenido guardado</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard}>
          <ThemedText style={styles.actionTitle}>👥 Amigos</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Administrar tu lista de amigos</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionCard}>
          <ThemedText style={styles.actionTitle}>⭐ Mejores amigos</ThemedText>
          <ThemedText style={styles.actionSubtitle}>Tus conexiones más cercanas</ThemedText>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#151718',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingTop: spacing.xl,
  },
  avatarContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
  },
  name: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  email: {
    fontSize: typography.sizes.sm,
    opacity: 0.6,
    marginBottom: spacing.lg,
  },
  editButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
  },
  editButtonText: {
    color: '#FFFFFF',
    fontWeight: typography.weights.semibold,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1f2021',
    marginHorizontal: spacing.lg,
    marginVertical: spacing.xl - 20,
    marginTop: spacing.lg,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: typography.sizes.lg + 5,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    fontSize: typography.sizes.xs,
    opacity: 0.6,
    marginTop: spacing.xs,
  },
  section: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  actionCard: {
    backgroundColor: '#151718',
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.sm,
  },
  actionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  actionSubtitle: {
    fontSize: typography.sizes.sm,
    opacity: 0.6,
    marginTop: spacing.xs,
  },
});