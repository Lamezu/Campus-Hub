import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { Stack, router } from 'expo-router';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { colors, spacing, typography } from '@/constants/styles';

export default function SettingsScreen() {
  const [userData, setUserData] = useState<any>(null);
  const currentUser = auth.currentUser;

  useEffect(() => {
    const loadUserData = async () => {
      if (!currentUser) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error loading user:', error);
      }
    };

    loadUserData();
  }, []);

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

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'student': return 'Student';
      case 'teacher': return 'Teacher';
      case 'admin': return 'Administrator';
      default: return role;
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Settings', headerShown: true }} />
      <ThemedView style={styles.container}>
        <ScrollView>
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Profile</ThemedText>
            
            <View style={styles.infoRow}>
              <ThemedText style={styles.label}>Name</ThemedText>
              <ThemedText style={styles.value}>
                {userData?.displayName || currentUser?.displayName || 'User'}
              </ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText style={styles.label}>Email</ThemedText>
              <ThemedText style={styles.value}>{currentUser?.email}</ThemedText>
            </View>

            <View style={styles.infoRow}>
              <ThemedText style={styles.label}>Role</ThemedText>
              <ThemedText style={styles.value}>
                {getRoleDisplay(userData?.role || 'student')}
              </ThemedText>
            </View>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Account</ThemedText>
            
            <TouchableOpacity style={styles.button} onPress={handleLogout}>
              <ThemedText style={[styles.buttonText, styles.logoutText]}>
                Cerrar Sesión
              </ThemedText>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Coming Soon</ThemedText>
            <ThemedText style={styles.comingSoon}>
              • Theme Settings{'\n'}
              • Timezone{'\n'}
              • Saved Messages{'\n'}
              • Delete Account
            </ThemedText>
          </View>
        </ScrollView>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  label: {
    fontSize: typography.sizes.md,
    opacity: 0.6,
  },
  value: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  button: {
    backgroundColor: colors.primary,
    padding: spacing.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  logoutText: {
    color: '#ffffffff',
  },
  comingSoon: {
    fontSize: typography.sizes.sm,
    opacity: 0.5,
    lineHeight: 24,
  },
});