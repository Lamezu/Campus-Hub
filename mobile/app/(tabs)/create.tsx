import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, onSnapshot, limit,
  doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc,
  increment, runTransaction,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { uploadPostMedia } from '@/config/cloudinary';
import { PostCard } from '@/components/PostCard';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { SongPicker } from '@/components/SongPicker';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import type { Post, JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;
type SubTab = 'descubrir' | 'publicar';

export default function ExplorarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const [subTab, setSubTab] = useState<SubTab>('descubrir');
  const [user, setUser] = useState<any>(null);

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [profile, setProfile] = useState<{ displayName: string; photoURL: string | null }>({
    displayName: '',
    photoURL: null,
  });

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    const u = auth.currentUser;
    if (!u) return;
    getDoc(doc(db, 'users', u.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({ displayName: d.displayName ?? u.displayName ?? '', photoURL: d.photoURL ?? null });
      }
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(50));
    const unsub = onSnapshot(q, (snap) => {
      const all: Post[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
            updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
          } as Post;
        })
        .filter((p) => p.postType !== 'announcement');
      setPosts(all);
      setPostsLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Explorer Snapshot error:', error);
      }
      setPostsLoading(false);
    });
    return () => unsub();
  }, [user]);

  const handleLike = useCallback(async (postId: string) => {
    if (!user) return;
    const postRef = doc(db, 'posts', postId);

    try {
      await runTransaction(db, async (transaction) => {
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) return;

        const data = postDoc.data();
        const currentLikes = data.likes || [];
        const hasLiked = currentLikes.includes(user.uid);

        if (hasLiked) {
          transaction.update(postRef, {
            likes: arrayRemove(user.uid),
            likesCount: increment(-1)
          });
        } else {
          transaction.update(postRef, {
            likes: arrayUnion(user.uid),
            likesCount: increment(1)
          });
        }
      });
    } catch (error) {
      console.error('Like transaction failed:', error);
    }
  }, [user]);

  const handleSave = useCallback(async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const hasSaved = post.savedBy?.includes(user.uid);
    await updateDoc(doc(db, 'posts', postId), {
      savedBy: hasSaved ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  }, [user, posts]);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para subir archivos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      allowsEditing: false,
      quality: 0.85,
      videoMaxDuration: 60,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.type === 'video') {
      setMedia({ uri: asset.uri, type: 'video' });
      Alert.alert(
        'Audio del vídeo',
        '¿Quieres conservar el audio original del vídeo?',
        [
          { text: 'Quitar audio', style: 'destructive', onPress: () => setMuteOriginalAudio(true) },
          { text: 'Mantener audio', onPress: () => setMuteOriginalAudio(false) },
        ]
      );
    } else {
      setMedia({ uri: asset.uri, type: 'image' });
      setMuteOriginalAudio(false);
      setSong(null);
    }
  };

  const removeMedia = () => {
    setMedia(null);
    setMuteOriginalAudio(false);
    setSong(null);
  };

  const handlePublish = async () => {
    const u = auth.currentUser;
    if (!u || !title.trim()) return;
    setPublishing(true);
    try {
      const postRef = doc(collection(db, 'posts'));
      let mediaUrl: string | null = null;
      if (media) {
        mediaUrl = await uploadPostMedia(media.uri, media.type, postRef.id);
      }
      await addDoc(collection(db, 'posts'), {
        title: title.trim(),
        content: content.trim(),
        authorId: u.uid,
        authorName: profile.displayName,
        authorPhoto: profile.photoURL,
        createdAt: serverTimestamp(),
        updatedAt: null,
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        mediaUrl: mediaUrl ?? null,
        mediaType: media?.type ?? null,
        muteOriginalAudio: media?.type === 'video' ? muteOriginalAudio : false,
        song: song ?? null,
      });
      setTitle('');
      setContent('');
      setMedia(null);
      setMuteOriginalAudio(false);
      setSong(null);
      setSubTab('descubrir');
    } catch {
      Alert.alert('Error', 'No se pudo publicar el post. Inténtalo de nuevo.');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = title.trim().length > 0 && !publishing;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Explorar</ThemedText>
        <NotificationBell category="social" />
      </View>

      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        {(['descubrir', 'publicar'] as SubTab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tabBtn, subTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setSubTab(tab)}
            activeOpacity={0.7}
          >
            <ThemedText style={[styles.tabLabel, { color: subTab === tab ? colors.primary : colors.textSecondary }]}>
              {tab === 'descubrir' ? 'Descubrir' : 'Publicar'}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {subTab === 'descubrir' ? (
        postsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PostCard
                post={item}
                currentUserId={user?.uid}
                onPress={() => router.push(`/post/${item.id}` as never)}
                onDoubleTap={() => handleLike(item.id)}
                onSave={() => handleSave(item.id)}
              />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
            ListEmptyComponent={
              <View style={styles.center}>
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No hay publicaciones aún.
                </ThemedText>
              </View>
            }
          />
        )
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.titleInput, { color: colors.text }]}
                placeholder="Título del post"
                placeholderTextColor={colors.textSecondary}
                value={title}
                onChangeText={(t) => setTitle(t.slice(0, TITLE_MAX))}
                maxLength={TITLE_MAX}
                returnKeyType="next"
              />
              <ThemedText style={[styles.charCount, { color: colors.textSecondary }]}>
                {title.length}/{TITLE_MAX}
              </ThemedText>
            </View>

            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card, marginTop: spacing.md }]}>
              <TextInput
                style={[styles.contentInput, { color: colors.text }]}
                placeholder="Escribe tu post aquí..."
                placeholderTextColor={colors.textSecondary}
                value={content}
                onChangeText={(t) => setContent(t.slice(0, CONTENT_MAX))}
                maxLength={CONTENT_MAX}
                multiline
                textAlignVertical="top"
              />
            </View>

            <TouchableOpacity
              style={[styles.mediaButton, { borderColor: colors.border, backgroundColor: colors.card }]}
              onPress={media ? undefined : pickMedia}
              activeOpacity={media ? 1 : 0.7}
            >
              {media ? (
                <View style={styles.mediaPreview}>
                  {media.type === 'image' ? (
                    <Image source={{ uri: media.uri }} style={styles.mediaImage} resizeMode="cover" />
                  ) : (
                    <View style={[styles.videoPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                      <Ionicons name="videocam" size={32} color={colors.textSecondary} />
                      <ThemedText style={[styles.videoLabel, { color: colors.textSecondary }]}>Vídeo seleccionado</ThemedText>
                      <TouchableOpacity
                        style={[styles.audioToggleBtn, { backgroundColor: muteOriginalAudio ? '#FF3B30' : colors.primary }]}
                        onPress={() => setMuteOriginalAudio(prev => !prev)}
                      >
                        <Ionicons name={muteOriginalAudio ? 'volume-mute' : 'volume-medium'} size={14} color="#FFF" />
                        <ThemedText style={styles.audioToggleText}>{muteOriginalAudio ? 'Sin audio' : 'Con audio'}</ThemedText>
                      </TouchableOpacity>
                    </View>
                  )}
                  <TouchableOpacity style={styles.removeMedia} onPress={removeMedia}>
                    <Ionicons name="close-circle" size={26} color="#FF3B30" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mediaEmpty}>
                  <Ionicons name="images-outline" size={28} color={colors.textSecondary} />
                  <ThemedText style={[styles.mediaEmptyText, { color: colors.textSecondary }]}>
                    Añadir foto o vídeo
                  </ThemedText>
                </View>
              )}
            </TouchableOpacity>

            {media && (
              <TouchableOpacity
                style={[styles.songButton, { borderColor: song ? colors.primary : colors.border, backgroundColor: colors.card }]}
                onPress={() => setShowSongPicker(true)}
                activeOpacity={0.7}
              >
                {song ? (
                  <View style={styles.songSelected}>
                    {song.coverUrl ? (
                      <Image source={{ uri: song.coverUrl }} style={styles.songCover} />
                    ) : (
                      <View style={[styles.songCover, { backgroundColor: colors.backgroundSecondary, justifyContent: 'center', alignItems: 'center' }]}>
                        <Ionicons name="musical-notes" size={18} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <ThemedText style={[styles.songName, { color: colors.text }]} numberOfLines={1}>{song.name}</ThemedText>
                      <ThemedText style={[styles.songArtist, { color: colors.textSecondary }]} numberOfLines={1}>{song.artistName}</ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => setSong(null)} hitSlop={8}>
                      <Ionicons name="close-circle" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.songEmpty}>
                    <Ionicons name="musical-notes-outline" size={22} color={colors.textSecondary} />
                    <ThemedText style={[styles.songEmptyText, { color: colors.textSecondary }]}>Añadir canción</ThemedText>
                  </View>
                )}
              </TouchableOpacity>
            )}

            <View style={{ height: spacing.xl }} />
          </ScrollView>

          <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: tabBarHeight + spacing.sm }]}>
            <TouchableOpacity
              style={[styles.publishButton, { backgroundColor: colors.primary }, !canPublish && styles.publishButtonDisabled]}
              onPress={handlePublish}
              disabled={!canPublish}
              activeOpacity={0.8}
            >
              {publishing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <ThemedText style={styles.publishButtonText}>Publicar</ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      <SongPicker
        visible={showSongPicker}
        onClose={() => setShowSongPicker(false)}
        onSelect={setSong}
        selected={song}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: typography.sizes.xl, fontWeight: 'bold' },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: typography.sizes.sm, fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: typography.sizes.sm, textAlign: 'center' },
  scrollContent: { padding: spacing.md },
  card: { borderWidth: 1, borderRadius: 12, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  titleInput: { fontSize: typography.sizes.md, fontWeight: '600', paddingVertical: spacing.xs },
  charCount: { fontSize: typography.sizes.xs, alignSelf: 'flex-end', marginTop: spacing.xs },
  contentInput: { fontSize: typography.sizes.md, minHeight: 160, paddingVertical: spacing.xs, lineHeight: 22 },
  mediaButton: { marginTop: spacing.md, borderWidth: 1, borderRadius: 12, overflow: 'hidden', minHeight: 120, justifyContent: 'center' },
  mediaEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm },
  mediaEmptyText: { fontSize: typography.sizes.sm },
  mediaPreview: { position: 'relative' },
  mediaImage: { width: '100%', height: 220 },
  videoPlaceholder: { height: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  videoLabel: { fontSize: typography.sizes.sm },
  removeMedia: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  songButton: { marginTop: spacing.md, borderWidth: 1, borderRadius: 12, padding: spacing.md },
  songEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  songEmptyText: { fontSize: typography.sizes.sm },
  songSelected: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  songCover: { width: 40, height: 40, borderRadius: 6 },
  songName: { fontSize: typography.sizes.sm, fontWeight: '600' },
  songArtist: { fontSize: typography.sizes.xs, marginTop: 2 },
  footer: { padding: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  publishButton: { paddingVertical: spacing.md, borderRadius: 10, alignItems: 'center' },
  publishButtonDisabled: { opacity: 0.5 },
  publishButtonText: { color: '#FFFFFF', fontSize: typography.sizes.md, fontWeight: '600' },
  audioToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: 12, marginTop: spacing.xs },
  audioToggleText: { color: '#FFF', fontSize: typography.sizes.xs, fontWeight: '600' },
});
