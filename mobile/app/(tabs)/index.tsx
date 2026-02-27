import { StyleSheet, FlatList, TouchableOpacity, View } from 'react-native';
import { Settings } from 'lucide-react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChannelCard } from '@/components/ChannelCard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Channel } from '@/types';

export default function HomeScreen() {
  const { colors } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/auth/login');
        setLoading(false);
        return;
      }
      setUser(currentUser);

      const userRef = doc(db, 'users', currentUser.uid);
      unsubscribeSnapshot = onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
          setUserData(doc.data());
        }
        setLoading(false);
      }, (error) => {
        console.error('Error listening to user data:', error);
        setLoading(false);
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const handleChannelPress = (channel: Channel) => {
    router.push({ pathname: '/chat/[id]', params: { id: channel.id } });
  };

  if (!user) return null;

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <View style={styles.headerContent}>
          <ThemedText type="title">Bienvenido, {userData?.displayName || user.displayName || 'User'}!</ThemedText>
          <TouchableOpacity style={styles.settingsButton} onPress={() => router.push('/settings')}>
            <Settings size={24} color={colors.text} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>
        <ThemedText style={styles.subtitle}>Selecciona un canal para comenzar a chatear.</ThemedText>
      </View>
      <FlatList
        data={MOCK_CHANNELS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChannelCard channel={item} onPress={() => handleChannelPress(item)} />}
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, borderBottomWidth: 1, paddingTop: 60 },
  headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsButton: { padding: spacing.sm },
  subtitle: { marginTop: spacing.xs, fontSize: typography.sizes.sm, opacity: 0.6 },
  listContent: { paddingBottom: spacing.lg }
});
