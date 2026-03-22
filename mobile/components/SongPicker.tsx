import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { searchTracks } from '@/config/jamendo';
import { ThemedText } from './themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { spacing, typography } from '@/constants/styles';
import type { JamendoTrack } from '@/types';

interface SongPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: JamendoTrack | null) => void;
  selected: JamendoTrack | null;
}

export function SongPicker({ visible, onClose, onSelect, selected }: SongPickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setTracks([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setTracks(await searchTracks(query));
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const stopPreview = async () => {
    await soundRef.current?.unloadAsync();
    soundRef.current = null;
    setPlayingId(null);
  };

  const togglePreview = async (track: JamendoTrack) => {
    if (playingId === track.id) {
      await stopPreview();
      return;
    }
    await stopPreview();
    setPlayingId(track.id);
    try {
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) setPlayingId(null);
      });
    } catch {
      setPlayingId(null);
    }
  };

  const handleClose = async () => {
    await stopPreview();
    onClose();
  };

  const handleSelect = async (track: JamendoTrack) => {
    await stopPreview();
    onSelect(selected?.id === track.id ? null : track);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <ThemedText style={[styles.title, { color: colors.text }]}>{t('post.song_picker.title') || 'Elegir canción'}</ThemedText>
            <TouchableOpacity onPress={handleClose}>
              <ThemedText style={{ color: colors.primary, fontWeight: '600' }}>{t('post.song_picker.close') || 'Cerrar'}</ThemedText>
            </TouchableOpacity>
          </View>

          <View style={[styles.searchRow, { backgroundColor: colors.backgroundSecondary }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={t('post.song_picker.placeholder') || "Buscar canción o artista..."}
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
          ) : (
            <FlatList
              data={tracks}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const isSelected = selected?.id === item.id;
                const isPlaying = playingId === item.id;
                return (
                  <TouchableOpacity
                    style={[
                      styles.trackRow,
                      { borderBottomColor: colors.border },
                      isSelected && { backgroundColor: colors.primary + '18' },
                    ]}
                    onPress={() => handleSelect(item)}
                    activeOpacity={0.7}
                  >
                    {item.coverUrl ? (
                      <Image source={{ uri: item.coverUrl }} style={styles.cover} />
                    ) : (
                      <View style={[styles.cover, styles.coverFallback, { backgroundColor: colors.backgroundSecondary }]}>
                        <Ionicons name="musical-notes" size={20} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.trackInfo}>
                      <ThemedText style={[styles.trackName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </ThemedText>
                      <ThemedText style={[styles.artistName, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.artistName}
                      </ThemedText>
                    </View>
                    <TouchableOpacity onPress={() => togglePreview(item)} style={styles.previewBtn} hitSlop={8}>
                      <Ionicons
                        name={isPlaying ? 'pause-circle' : 'play-circle'}
                        size={34}
                        color={colors.primary}
                      />
                    </TouchableOpacity>
                    {isSelected && (
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} style={{ marginLeft: spacing.xs }} />
                    )}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {query.trim() ? (t('post.song_picker.no_results') || 'No se encontraron canciones') : (t('post.song_picker.empty') || 'Busca una canción para añadir a tu post')}
                </ThemedText>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    height: '80%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.md,
    paddingVertical: 0,
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  cover: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  coverFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  trackName: {
    fontSize: typography.sizes.sm,
    fontWeight: '600',
  },
  artistName: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  previewBtn: {
    padding: spacing.xs,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: typography.sizes.sm,
    padding: spacing.xl,
    lineHeight: 22,
  },
});
