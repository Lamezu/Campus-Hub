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
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import { ChevronLeft } from 'lucide-react-native';
import { auth, db } from '@/config/firebase';
import { uploadPostMedia } from '@/config/cloudinary';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import { ThemedText } from '@/components/themed-text';
import { SongPicker } from '@/components/SongPicker';
import type { JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;

interface NewMedia {
  uri: string;
  type: 'image' | 'video';
}

export default function EditPostScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [existingMediaType, setExistingMediaType] = useState<'image' | 'video' | null>(null);
  const [newMedia, setNewMedia] = useState<NewMedia | null>(null);
  const [mediaRemoved, setMediaRemoved] = useState(false);
  const [muteOriginalAudio, setMuteOriginalAudio] = useState(false);
  const [song, setSong] = useState<JamendoTrack | null>(null);
  const [showSongPicker, setShowSongPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getDoc(doc(db, 'posts', id)).then((snap) => {
      if (!snap.exists()) {
        Alert.alert('Error', 'Post no encontrado.');
        router.back();
        return;
      }
      const d = snap.data();
      if (d.authorId !== auth.currentUser?.uid) {
        Alert.alert('Error', 'No tienes permiso para editar este post.');
        router.back();
        return;
      }
      setTitle(d.title ?? '');
      setContent(d.content ?? '');
      setExistingMediaUrl(d.mediaUrl ?? null);
      setExistingMediaType(d.mediaType ?? null);
      setMuteOriginalAudio(d.muteOriginalAudio ?? false);
      setSong(d.song ?? null);
      setLoading(false);
    });
  }, [id]);

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
      setNewMedia({ uri: asset.uri, type: 'video' });
      setMediaRemoved(false);
      Alert.alert(
        'Audio del vídeo',
        '¿Quieres conservar el audio original del vídeo?',
        [
          { text: 'Quitar audio', style: 'destructive', onPress: () => setMuteOriginalAudio(true) },
          { text: 'Mantener audio', onPress: () => setMuteOriginalAudio(false) },
        ]
      );
    } else {
      setNewMedia({ uri: asset.uri, type: 'image' });
      setMediaRemoved(false);
      setMuteOriginalAudio(false);
      setSong(null);
    }
  };

  const removeMedia = () => {
    setNewMedia(null);
    setExistingMediaUrl(null);
    setExistingMediaType(null);
    setMediaRemoved(true);
    setMuteOriginalAudio(false);
    setSong(null);
  };

  const handleSave = async () => {
    if (!id || !title.trim()) return;
    setSaving(true);
    try {
      let finalMediaUrl: string | null = null;
      let finalMediaType: 'image' | 'video' | null = null;

      if (newMedia) {
        finalMediaUrl = await uploadPostMedia(newMedia.uri, newMedia.type, id);
        finalMediaType = newMedia.type;
      } else if (!mediaRemoved && existingMediaUrl) {
        finalMediaUrl = existingMediaUrl;
        finalMediaType = existingMediaType;
      }

      await updateDoc(doc(db, 'posts', id), {
        title: title.trim(),
        content: content.trim(),
        mediaUrl: finalMediaUrl,
        mediaType: finalMediaType,
        muteOriginalAudio: finalMediaType === 'video' ? muteOriginalAudio : false,
        song: song ?? null,
        updatedAt: serverTimestamp(),
      });

      router.back();
    } catch {
      Alert.alert('Error', 'No se pudo guardar el post. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const currentMediaUri = newMedia?.uri ?? (mediaRemoved ? null : existingMediaUrl);
  const currentMediaType = newMedia?.type ?? (mediaRemoved ? null : existingMediaType);
  const hasMedia = !!currentMediaUri;
  const canSave = title.trim().length > 0 && !saving;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.primary} strokeWidth={2} />
        </TouchableOpacity>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>Editar Post</ThemedText>
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary }, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <ThemedText style={styles.saveBtnText}>Guardar</ThemedText>
          )}
        </TouchableOpacity>
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
            onPress={hasMedia ? undefined : pickMedia}
            activeOpacity={hasMedia ? 1 : 0.7}
          >
            {hasMedia ? (
              <View style={styles.mediaPreview}>
                {currentMediaType === 'image' ? (
                  <Image source={{ uri: currentMediaUri! }} style={styles.mediaImage} resizeMode="cover" />
                ) : (
                  <View style={[styles.videoPlaceholder, { backgroundColor: colors.backgroundSecondary }]}>
                    <Ionicons name="videocam" size={32} color={colors.textSecondary} />
                    <ThemedText style={[styles.videoLabel, { color: colors.textSecondary }]}>
                      {newMedia ? 'Vídeo seleccionado' : 'Vídeo actual'}
                    </ThemedText>
                    <TouchableOpacity
                      style={[styles.audioToggleBtn, { backgroundColor: muteOriginalAudio ? '#FF3B30' : colors.primary }]}
                      onPress={() => setMuteOriginalAudio(prev => !prev)}
                    >
                      <Ionicons name={muteOriginalAudio ? 'volume-mute' : 'volume-medium'} size={14} color="#FFF" />
                      <ThemedText style={styles.audioToggleText}>{muteOriginalAudio ? 'Sin audio' : 'Con audio'}</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
                <View style={styles.mediaActions}>
                  <TouchableOpacity style={[styles.mediaActionBtn, { backgroundColor: colors.primary }]} onPress={pickMedia}>
                    <ThemedText style={styles.mediaActionText}>Cambiar</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.mediaActionBtn, { backgroundColor: '#FF3B30' }]} onPress={removeMedia}>
                    <ThemedText style={styles.mediaActionText}>Eliminar</ThemedText>
                  </TouchableOpacity>
                </View>
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

          {hasMedia && (
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: spacing.xs },
  headerTitle: {
    flex: 1,
    fontSize: typography.sizes.lg,
    fontWeight: 'bold',
    marginLeft: spacing.sm,
  },
  saveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 16,
    minWidth: 72,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#FFF', fontWeight: '600', fontSize: typography.sizes.sm },
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
  mediaEmptyText: { fontSize: typography.sizes.sm },
  mediaPreview: { position: 'relative' },
  mediaImage: { width: '100%', height: 220 },
  videoPlaceholder: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  videoLabel: { fontSize: typography.sizes.sm },
  mediaActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  mediaActionBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    borderRadius: 8,
    alignItems: 'center',
  },
  mediaActionText: { color: '#FFF', fontWeight: '600', fontSize: typography.sizes.sm },
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
  songEmptyText: { fontSize: typography.sizes.sm },
  songSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  songCover: { width: 40, height: 40, borderRadius: 6 },
  songName: { fontSize: typography.sizes.sm, fontWeight: '600' },
  songArtist: { fontSize: typography.sizes.xs, marginTop: 2 },
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
