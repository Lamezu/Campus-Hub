import { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, serverTimestamp, doc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import type { Post } from '../../types';
import { Alert } from 'react-native';

interface AnnouncementForm {
  title: string;
  content: string;
  pinned: boolean;
  pinnedUntil: string | null;
  category?: string | null;
  imageUrl?: string | null;
}

export function useAnnouncements() {
  const currentUser = auth.currentUser;
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
          updatedAt: null,
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
    await updateDoc(doc(db, 'posts', id), { pinned: !currentPinned, pinnedUntil: null });
  };

  const deleteAnnouncement = async (id: string) => {
    return new Promise<void>((resolve) => {
      Alert.alert('Eliminar anuncio', '¿Seguro que quieres eliminar este anuncio?', [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve() },
        {
          text: 'Eliminar', style: 'destructive', onPress: async () => {
            await deleteDoc(doc(db, 'posts', id));
            resolve();
          }
        },
      ]);
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
      });
      await updateDoc(doc(db, 'posts', announcement.id), { socialId: docRef.id });
      Alert.alert('Publicado', 'El anuncio ya está en el feed social.');
    } catch {
      Alert.alert('Error', 'No se pudo publicar.');
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
