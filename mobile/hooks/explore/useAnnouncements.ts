import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { forumService } from '../../services/shared';
import { auth } from '../../config/firebase';
import { useCurrentUser } from '../../contexts/UserContext';
import type { Post } from '../../types';
import { Alert } from 'react-native';

interface AnnouncementForm {
  title: string;
  content: string;
  pinned: boolean;
  pinnedUntil: string | null;
  category?: string | null;
  imageUrl?: string | null;
  imageOffsetY?: number | null;
}

export function useAnnouncements() {
  const { firebaseUser } = useCurrentUser();
  const currentUser = auth.currentUser;
  const { t } = useTranslation();
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<Post[]>([]);
  const [normalAnnouncements, setNormalAnnouncements] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) {
      setLoading(false);
      return;
    }
    try {
      const unsubscribe = (forumService as any).subscribeToAnnouncements((all: any[]) => {
        const mapped = all.map((p: any) => ({
          ...p,
          createdAt: p.createdAt?.toDate?.()?.toISOString() ?? p.createdAt ?? new Date().toISOString(),
        }));
        setPinnedAnnouncements(mapped.filter((p: any) => p.pinned));
        setNormalAnnouncements(mapped.filter((p: any) => !p.pinned));
        setLoading(false);
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to announcements:', error);
      setLoading(false);
      return () => { };
    }
  }, [firebaseUser?.uid]);

  const loadMore = () => { };
  const loadingMore = false;
  const hasMore = false;

  const allAnnouncements = useMemo(() => {
    return [...pinnedAnnouncements, ...normalAnnouncements];
  }, [pinnedAnnouncements, normalAnnouncements]);

  const createAnnouncement = async (form: AnnouncementForm) => {
    if (!currentUser) return;
    await forumService.createPost({
      ...form,
      authorName: currentUser.displayName ?? (t('roles.teacher') || 'Profesor/a'),
      authorPhoto: currentUser.photoURL ?? null,
      postType: 'announcement',
      likes: [],
    }, currentUser.uid);
  };

  const updateAnnouncement = async (id: string, form: AnnouncementForm) => {
    await forumService.updatePost(id, form);
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    await forumService.updatePost(id, { pinned: !currentPinned, pinnedUntil: null });
  };

  const deleteAnnouncement = async (id: string) => {
    return new Promise<void>((resolve) => {
      Alert.alert(
        t('explore.announcements.alerts.delete_title') || 'Eliminar anuncio',
        t('explore.announcements.alerts.delete_subtitle') || '¿Seguro que quieres eliminar este anuncio?',
        [
          { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
          {
            text: t('common.delete') || 'Eliminar', style: 'destructive', onPress: async () => {
              await forumService.deletePost(id);
              resolve();
            }
          },
        ]);
    });
  };

  const publishAsSocialPost = async (announcement: Post) => {
    if (!currentUser) return;
    try {
      const socialId = await forumService.createPost({
        title: announcement.title,
        content: announcement.content,
        authorName: announcement.authorName,
        authorPhoto: announcement.authorPhoto,
        postType: 'post',
        likes: [],
        tags: ['anuncio'],
        mediaUrl: announcement.imageUrl || null,
        mediaType: announcement.imageUrl ? 'image' : null,
        imageOffsetY: announcement.imageUrl ? announcement.imageOffsetY : null,
        originalAnnouncementId: announcement.id,
      }, announcement.authorId);

      await forumService.updatePost(announcement.id, { socialId });
      Alert.alert(
        t('explore.announcements.alerts.published_title') || 'Publicado',
        t('explore.announcements.alerts.published_subtitle') || 'El anuncio ya está en el feed social.'
      );
    } catch (e) {
      console.error(e);
      Alert.alert(
        t('explore.announcements.alerts.error_title') || 'Error',
        t('explore.announcements.alerts.error_subtitle') || 'No se pudo publicar.'
      );
    }
  };

  return {
    announcements: allAnnouncements,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    createAnnouncement,
    updateAnnouncement,
    togglePin,
    deleteAnnouncement,
    publishAsSocialPost,
  };
}
