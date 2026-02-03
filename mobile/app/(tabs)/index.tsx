import { StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ChannelCard } from '@/components/ChannelCard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { MOCK_CHANNELS } from '@/constants/mockData';
import { colors, spacing, typography, commonStyles } from '@/constants/styles';
import type { Channel } from '@/constants/mockData';

export default function HomeScreen() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.replace('/auth/login');
        setLoading(false);
        return;
      }

      setUser(currentUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const handleChannelPress = (channel: Channel) => {
    console.log('Channel pressed:', channel.name);
  };

  if (loading) {
    return (
      <ThemedView style={[commonStyles.container, commonStyles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </ThemedView>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.header}>
        <ThemedText type="title">
          Welcome, {userData?.displayName || 'User'}!
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Select a channel to start chatting
        </ThemedText>
      </ThemedView>

      <FlatList
        data={MOCK_CHANNELS}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChannelCard 
            channel={item} 
            onPress={() => handleChannelPress(item)}
          />
        )}
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  subtitle: {
    marginTop: spacing.xs,
    fontSize: typography.sizes.sm,
    opacity: 0.6,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
});