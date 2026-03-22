import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { forumService } from '../../services/shared';
import { auth } from '../../config/firebase';
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
  const currentUser = auth.currentUser;
  const { t } = useTranslation();
  const [pinnedAnnouncements, setPinnedAnnouncements] = useState<Post[]>([]);
  const [normalAnnouncements, setNormalAnnouncements] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);

  // Suscripción para anuncios fijados
  useEffect(() => {
    try {
      const unsubscribe = forumService.subscribeToPinnedAnnouncements((pinned: any[]) => {
        setPinnedAnnouncements(pinned.map((p: any) => ({
          ...p,
          createdAt: p.createdAt?.toDate?.()?.toISOString() ?? p.createdAt ?? new Date().toISOString(),
        })));
      });
      return unsubscribe;
    } catch (error) {
      console.error('Error subscribing to pinned announcements:', error);
      return () => { };
    }
  }, []);

  // Carga inicial de anuncios normales
  useEffect(() => {
    fetchInitial();
  }, []);

  const fetchInitial = async () => {
    setLoading(true);
    try {
      const result = await forumService.getPosts(null, 10, null, 'announcement');
      const filtered = result.docs.filter((p: any) => !p.pinned);
      setNormalAnnouncements(filtered.map((p: any) => ({
        ...p,
        createdAt: p.createdAt?.toDate?.()?.toISOString() ?? p.createdAt ?? new Date().toISOString(),
      })));
      setLastDoc(result.lastDoc);
      setHasMore(result.docs.length === 10);
    } catch (e: any) {
      console.error('Error fetching announcements:', e);
      if (e.message?.includes('index')) {
        console.warn('Falta un índice en Firestore:', e.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const result = await forumService.getPosts(null, 10, lastDoc, 'announcement');
      const filtered = result.docs.filter((p: any) => !p.pinned);
      setNormalAnnouncements(prev => [
        ...prev,
        ...filtered.map((p: any) => ({
          ...p,
          createdAt: p.createdAt?.toDate?.()?.toISOString() ?? p.createdAt ?? new Date().toISOString(),
        }))
      ]);
      setLastDoc(result.lastDoc);
      setHasMore(result.docs.length === 10);
    } catch (e) {
      console.error('Error loading more announcements:', e);
    } finally {
      setLoadingMore(false);
    }
  };

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
