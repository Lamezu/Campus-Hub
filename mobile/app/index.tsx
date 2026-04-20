import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';
import { router } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAccounts } from '@/contexts/AccountsContext';

export default function Index() {
  const hasRedirected = useRef(false);
  const { switching } = useAccounts();

  useEffect(() => {    if (hasRedirected.current || switching) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (hasRedirected.current || switching) return;
      hasRedirected.current = true;

      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth/login');
      }
    });

    const timeout = setTimeout(() => {
      if (!hasRedirected.current && !switching) {
        hasRedirected.current = true;
        router.replace('/auth/login');
      }
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, [switching]);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">CampusHub</ThemedText>
      <ActivityIndicator size="large" color="#007bffff" style={styles.loader} />
      <ThemedText style={styles.loadingText}>Cargando...</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loader: {
    marginTop: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    opacity: 0.7,
  },
});