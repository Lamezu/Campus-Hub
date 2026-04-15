import { useState, useEffect, useCallback } from 'react';
import {
  View, FlatList, TouchableOpacity, StyleSheet,
  TextInput, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView, Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '@/hooks/useTranslation';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection, query, orderBy, onSnapshot, limit,
  doc, updateDoc, arrayUnion, arrayRemove, addDoc, serverTimestamp, getDoc,
  increment, runTransaction, deleteField,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Newspaper } from 'lucide-react-native';
import { uploadPostMedia } from '@/config/cloudinary';
import { EmptyState } from '@/components/EmptyState';
import { PostCard } from '@/components/PostCard';
import { ThemedText } from '@/components/themed-text';
import { NotificationBell } from '@/components/NotificationBell';
import { SongPicker } from '@/components/SongPicker';
import { spacing, typography } from '@/constants/styles';
import { useTheme } from '@/contexts/ThemeContext';
import { forumService } from '@/services/shared';
import type { Post, JamendoTrack } from '@/types';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;
type SubTab = 'descubrir' | 'publicar';

export default function ExplorarScreen() {
  const { colors } = useTheme();
  const { t } = useTranslation();
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
    try {
      await forumService.toggleLike(postId, user.uid);
    } catch (error) {
      console.error('Like update failed:', error);
    }
  }, [user]);

  const handleSave = useCallback(async (postId: string) => {
    if (!user) return;
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const hasSaved = post.savedBy?.includes(user.uid);
    await updateDoc(doc(db, 'posts', postId), {
      savedBy: hasSaved ? arrayRemove(user.uid) : arrayUnion(user.uid),
      [`savedByTimestamps.${user.uid}`]: hasSaved ? deleteField() : new Date().toISOString(),
    });
  }, [user, posts]);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.permission_denied') || 'Permission Denied', t('explore.gallery_permission_msg') || 'Gallery Permission Msg');
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
        t('explore.video_audio_title') || 'Video Audio Title',
        t('explore.video_audio_msg') || 'Video Audio Msg',
        [
          { text: t('explore.remove_audio') || 'Remove Audio', style: 'destructive', onPress: () => setMuteOriginalAudio(true) },
          { text: t('explore.keep_audio') || 'Keep Audio', onPress: () => setMuteOriginalAudio(false) },
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
      Alert.alert(t('common.error') || 'Error', t('explore.publish_error') || 'Publish Error');
    } finally {
      setPublishing(false);
    }
  };

  const canPublish = title.trim().length > 0 && !publishing;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ThemedText style={[styles.headerTitle, { color: colors.text }]}>{t('explore.title') || 'Title'}</ThemedText>
        <NotificationBell category="social" />
      </View>

      <View style={styles.tabBar}>
        {(['descubrir', 'publicar'] as SubTab[]).map((tab) => {
          const isActive = subTab === tab;
          return (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, { borderBottomColor: isActive ? colors.primary : 'transparent' }]}
              onPress={() => setSubTab(tab)}
              activeOpacity={0.7}
            >
              <ThemedText style={[styles.tabLabel, { 
                color: isActive ? colors.primary : colors.textSecondary,
                fontWeight: isActive ? '800' : '600'
              }]}>
                {tab === 'descubrir' ? (t('explore.discover') || 'Discover') : (t('explore.publish_tab') || 'Publish Tab')}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
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
                onShare={() => router.push(`/forward?postId=${encodeURIComponent(item.id)}&postTitle=${encodeURIComponent(item.title ?? '')}&postContent=${encodeURIComponent(item.content ?? '')}&postImageUrl=${encodeURIComponent(item.mediaType === 'image' ? (item.mediaUrl ?? '') : '')}&postAuthorName=${encodeURIComponent(item.authorName ?? '')}&postAuthorPhoto=${encodeURIComponent(item.authorPhoto ?? '')}` as never)}
              />
            )}
            contentContainerStyle={{ paddingBottom: insets.bottom + spacing.md }}
            ListEmptyComponent={
              <EmptyState
                icon={Newspaper}
                title={t('explore.no_posts') || 'No Posts'}
              />
            }
          />
        )
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <TextInput
                style={[styles.titleInput, { color: colors.text }]}
                placeholder={t('explore.social_placeholders.post_title') || 'Post Title'}
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
                placeholder={t('explore.social_placeholders.post_content') || 'Post Content'}
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
                      <ThemedText style={[styles.videoLabel, { color: colors.textSecondary }]}>{t('explore.video_selected') || 'Video Selected'}</ThemedText>
                      <TouchableOpacity
                        style={[styles.audioToggleBtn, { backgroundColor: muteOriginalAudio ? '#FF3B30' : colors.primary }]}
                        onPress={() => setMuteOriginalAudio(prev => !prev)}
                      >
                        <Ionicons name={muteOriginalAudio ? 'volume-mute' : 'volume-medium'} size={14} color="#FFF" />
                        <ThemedText style={styles.audioToggleText}>{muteOriginalAudio ? (t('explore.mute') || 'Mute') : (t('explore.unmute') || 'Unmute')}</ThemedText>
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
                    {t('explore.add_media') || 'Add Media'}
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
                    <ThemedText style={[styles.songEmptyText, { color: colors.textSecondary }]}>{t('explore.add_song') || 'Add Song'}</ThemedText>
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
                <ThemedText style={styles.publishButtonText}>{t('explore.publish_btn') || 'Publish Button'}</ThemedText>
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
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: { 
    fontSize: 24, 
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tabBar: {
    flexDirection: 'row',
  },
  tabBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 3,
  },
  tabLabel: { 
    fontSize: 16, 
    letterSpacing: -0.3,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  scrollContent: { padding: spacing.md },
  card: { 
    borderWidth: 1, 
    borderRadius: 16, 
    paddingHorizontal: spacing.md, 
    paddingVertical: spacing.sm,
  },
  titleInput: { fontSize: 16, fontWeight: '700', paddingVertical: spacing.xs },
  charCount: { fontSize: 11, alignSelf: 'flex-end', marginTop: 2, opacity: 0.6 },
  contentInput: { fontSize: 15, minHeight: 160, paddingVertical: spacing.xs, lineHeight: 22 },
  mediaButton: { 
    marginTop: spacing.md, 
    borderWidth: 1.5, 
    borderRadius: 16, 
    overflow: 'hidden', 
    minHeight: 120, 
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  mediaEmpty: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.xs },
  mediaEmptyText: { fontSize: 14, fontWeight: '600' },
  mediaPreview: { position: 'relative' },
  mediaImage: { width: '100%', height: 280 },
  videoPlaceholder: { height: 160, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  videoLabel: { fontSize: 14 },
  removeMedia: { position: 'absolute', top: spacing.sm, right: spacing.sm },
  songButton: { marginTop: spacing.md, borderWidth: 1, borderRadius: 16, padding: spacing.md },
  songEmpty: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  songEmptyText: { fontSize: 14 },
  songSelected: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  songCover: { width: 44, height: 44, borderRadius: 10 },
  songName: { fontSize: 14, fontWeight: '700' },
  songArtist: { fontSize: 12, marginTop: 2, opacity: 0.7 },
  footer: { 
    padding: spacing.md, 
    borderTopWidth: 1,
  },
  publishButton: { 
    paddingVertical: spacing.md, 
    borderRadius: 16, 
    alignItems: 'center',
  },
  publishButtonDisabled: { opacity: 0.4 },
  publishButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  audioToggleBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, marginTop: spacing.sm },
  audioToggleText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
});
