import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { useAlert } from '@/contexts/AlertContext';
import type { Post } from '@/types';

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
  const { showAlert } = useAlert();
  const [announcements, setAnnouncements] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      where('postType', '==', 'announcement'),
      orderBy('createdAt', 'desc'),
    );
    const unsubscribe = onSnapshot(q, snap => {
      setAnnouncements(snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? null,
        } as Post;
      }));
      setLoading(false);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Announcements Snapshot error:', error);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const sortedAnnouncements = useMemo(() => {
    return [...announcements].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [announcements]);

  const createAnnouncement = async (form: AnnouncementForm) => {
    if (!currentUser) return;
    await addDoc(collection(db, 'posts'), {
      ...form,
      authorId: currentUser.uid,
      authorName: currentUser.displayName ?? 'Profesor/a',
      authorPhoto: currentUser.photoURL ?? null,
      postType: 'announcement',
      likes: [],
      likesCount: 0,
      commentsCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: null,
    });
  };

  const updateAnnouncement = async (id: string, form: AnnouncementForm) => {
    await updateDoc(doc(db, 'posts', id), {
      ...form,
      updatedAt: serverTimestamp(),
    });
  };

  const togglePin = async (id: string, currentPinned: boolean) => {
    try {
      const docRef = doc(db, 'posts', id);
      await updateDoc(docRef, { 
        pinned: !currentPinned, 
        pinnedUntil: null,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Error toggling pin:', err);
      const message = err instanceof Error ? err.message : 'Error desconocido';
      showAlert({ title: 'Error', message: `Error al cambiar estado de fijado: ${message}`, type: 'error' });
    }
  };

  const deleteAnnouncement = async (id: string) => {
    showAlert({
      title: 'Eliminar anuncio',
      message: '¿Seguro que quieres eliminar este anuncio?',
      type: 'confirm',
      showCancelButton: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'posts', id));
          showAlert({ title: 'Eliminado', message: 'El anuncio ha sido eliminado.', type: 'success' });
        } catch (err) {
          showAlert({ title: 'Error', message: 'No se pudo eliminar el anuncio.', type: 'error' });
        }
      }
    });
  };

  const publishAsSocialPost = async (announcement: Post) => {
    if (!currentUser) return;
    try {
      const docRef = await addDoc(collection(db, 'posts'), {
        title: announcement.title,
        content: announcement.content,
        authorId: announcement.authorId,
        authorName: announcement.authorName,
        authorPhoto: announcement.authorPhoto,
        postType: 'post',
        likes: [],
        likesCount: 0,
        commentsCount: 0,
        viewsCount: 0,
        views: [],
        createdAt: serverTimestamp(),
        updatedAt: null,
        tags: ['anuncio'],
        linkedAnnouncementId: announcement.id,
        linkedAnnouncementTitle: announcement.title,
      });
      await updateDoc(doc(db, 'posts', announcement.id), { socialId: docRef.id });
      showAlert({ title: 'Publicado', message: 'El anuncio ya está en el feed social.', type: 'success' });
    } catch (error) {
      console.error('Error publishing social post:', error);
      showAlert({ title: 'Error', message: 'No se pudo publicar.', type: 'error' });
    }
  };

  return {
    announcements: sortedAnnouncements,
    loading,
    createAnnouncement,
    updateAnnouncement,
    togglePin,
    deleteAnnouncement,
    publishAsSocialPost,
  };
}
