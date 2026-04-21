import { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '@/config/firebase';
import { uploadPostMedia } from '@/config/cloudinary';
import { useTheme } from '@/contexts/ThemeContext';
import { router } from 'expo-router';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { SongPicker } from '@/components/SongPicker';
import type { JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface MediaAsset {
  uri: string;
  type: 'image' | 'video';
}

interface UserProfile {
  displayName: string;
  photoURL: string | null;
}

export default function CreateScreen() {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [media, setMedia] = useState<MediaAsset | null>(null);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile>({ displayName: '', photoURL: null });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({ displayName: d.displayName ?? user.displayName ?? '', photoURL: d.photoURL ?? null });
      }
    });
  }, []);

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
    const user = auth.currentUser;
    if (!user || !title.trim()) return;

    setLoading(true);
    try {
      const postRef = doc(collection(db, 'posts'));
      let mediaUrl: string | null = null;

      if (media) {
        mediaUrl = await uploadPostMedia(media.uri, media.type, postRef.id);
      }

      await addDoc(collection(db, 'posts'), {
        title: title.trim(),
        content: content.trim(),
        authorId: user.uid,
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
      router.push('/(tabs)/explore');
    } catch {
      Alert.alert('Error', 'No se pudo publicar el post. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const canPublish = title.trim().length > 0 && !loading;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Crear Post</ThemedText>
      </View>

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
        </ScrollView>

        <View style={[styles.footer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.publishButton, { backgroundColor: colors.primary }, !canPublish && styles.publishButtonDisabled]}
            onPress={handlePublish}
            disabled={!canPublish}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ThemedText style={styles.publishButtonText}>Publicar</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: 'bold',
  },
  scrollContent: { padding: spacing.md },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleInput: {
    fontSize: typography.sizes.md,
    fontWeight: '600',
    paddingVertical: spacing.xs,
  },
  charCount: {
    fontSize: typography.sizes.xs,
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
  },
  contentInput: {
    fontSize: typography.sizes.md,
    minHeight: 160,
    paddingVertical: spacing.xs,
    lineHeight: 22,
  },
  mediaButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    minHeight: 120,
    justifyContent: 'center',
  },
  mediaEmpty: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  mediaEmptyText: {
    fontSize: typography.sizes.sm,
  },
  mediaPreview: {
    position: 'relative',
  },
  mediaImage: {
    width: '100%',
    height: 220,
  },
  videoPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  videoLabel: {
    fontSize: typography.sizes.sm,
  },
  removeMedia: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
  },
  songButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
  },
  songEmpty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  songEmptyText: {
    fontSize: typography.sizes.sm,
  },
  songSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  songCover: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  songName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  songArtist: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  footer: {
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  publishButton: {
    paddingVertical: spacing.md,
    borderRadius: 10,
    alignItems: 'center',
  },
  publishButtonDisabled: { opacity: 0.5 },
  publishButtonText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.md,
    fontWeight: '600',
  },
  audioToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: spacing.xs,
  },
  audioToggleText: {
    color: '#FFF',
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
});
