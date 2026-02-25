import { StyleSheet } from 'react-native';
import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function ExploreScreen() {
  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title">Buscar</ThemedText>
      <ThemedText style={styles.subtitle}>
        Busca usuarios, grupos y eventos en tu campus
      </ThemedText>
      <ThemedText style={styles.comingSoon}>
        Próximamente en Sprint 3 🔍
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.6,
    textAlign: 'center',
  },
  comingSoon: {
    marginTop: 20,
    fontSize: 18,
    opacity: 0.5,
  },
});