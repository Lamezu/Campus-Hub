import { useState, useEffect, useCallback } from 'react';
import { eventsService, authService, forumService } from '../../services/shared';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from 'firebase/firestore';
import { auth } from '../../config/firebase';
import { useCurrentUser } from '../../contexts/UserContext';
import { notificationService } from '../../services/notificationService';
import { useTranslation } from '../../hooks/useTranslation';
import type { CalendarEvent, CalendarEventType } from '../../types';
import { Alert } from 'react-native';

export function useCalendarEvents() {
  const currentUser = auth.currentUser;
  const { firebaseUser } = useCurrentUser();
  const { t } = useTranslation();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsubscribe = eventsService.subscribeToEvents((newEvents: any[]) => {
      const mappedEvents = newEvents.map(data => ({
        id: data.id,
        title: data.title ?? '',
        description: data.description ?? '',
        date: (data.startDate as any)?.toDate?.()?.toISOString() ?? (data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString()),
        endDate: (data.endDate as any)?.toDate?.()?.toISOString() ?? null,
        allDay: data.allDay ?? true,
        time: data.time ?? null,
        type: (data.category ?? data.type ?? 'event') as CalendarEventType,
        authorId: data.creatorId ?? data.authorId ?? '',
        authorName: data.authorName ?? '',
        createdAt: (data.createdAt as any)?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        linkedAnnouncementId: data.linkedAnnouncementId ?? null,
        departmentId: data.departmentId ?? null,
        publishedInChannel: data.publishedInChannel ?? false,
      } as CalendarEvent));

      setAllEvents(mappedEvents);
    });

    return typeof unsubscribe === 'function' ? unsubscribe : () => { };
  }, [firebaseUser?.uid]);

  const runResilienceCheck = useCallback(async (events: CalendarEvent[]) => {
    if (!currentUser?.uid || events.length === 0) return;

    try {
      const userDoc: any = await authService.getUserData(currentUser.uid);
      const canPublish = userDoc?.role === 'admin' || userDoc?.subrole === 'coordinator' || userDoc?.subrole === 'delegate';

      if (canPublish) {
        for (const event of events) {
          if (event.publishedInChannel) {
            const q = query(
              collection(db, 'channels', '3', 'messages'),
              where('type', '==', 'event'),
              where('metadata.eventId', '==', event.id)
            );
            const snap = await getDocs(q);
            if (snap.empty) {
              await updateDoc(doc(db, 'events', event.id), { publishedInChannel: false });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Resilience check error:', e);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    if (allEvents.length > 0) {
      runResilienceCheck(allEvents);
    }
  }, [allEvents.length, runResilienceCheck]);

  const saveEvent = async (event: any, editingId: string | null = null) => {
    if (!currentUser) return;

    if (editingId) {
      await eventsService.updateEvent(editingId, event);
    } else {
      const eventId = await eventsService.createEvent({
        ...event,
        authorName: currentUser.displayName ?? '',
        status: 'upcoming',
      }, currentUser.uid);

      notificationService.addNotification(currentUser.uid, {
        category: 'campus',
        title: 'Nuevo evento creado',
        body: `Has creado ${event.title}.`,
        meta: { eventId }
      });
    }
  };

  const createLinkedEvent = async (
    announcementId: string,
    eventData: { title: string; date: Date; time: string | null; type: CalendarEventType; departmentId?: string | null }
  ): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      const eventId = await eventsService.createEvent({
        title: eventData.title,
        description: '',
        startDate: eventData.date,
        allDay: !eventData.time,
        time: eventData.time ?? null,
        category: eventData.type,
        linkedAnnouncementId: announcementId,
        departmentId: eventData.departmentId ?? null,
        authorName: currentUser.displayName ?? '',
        status: 'upcoming',
      }, currentUser.uid);

      import('firebase/firestore').then(async ({ doc, updateDoc }) => {
        const { db } = await import('../../config/firebase');
        await updateDoc(doc(db, 'posts', announcementId), { linkedEventId: eventId });
      });

      return eventId;
    } catch {
      return null;
    }
  };

  const deleteEvent = async (eventId: string) => {
    return new Promise<void>((resolve) => {
      Alert.alert(
        t('explore.calendar.delete_title') || 'Eliminar evento',
        t('explore.calendar.delete_subtitle') || '¿Seguro que quieres borrar este evento?',
        [
          { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
          {
            text: t('common.delete') || 'Borrar', style: 'destructive', onPress: async () => {
              await eventsService.deleteEvent(eventId);
              resolve();
            }
          },
        ]);
    });
  };

  const publishEventToChannel = async (event: CalendarEvent) => {
    if (!currentUser) return;
    return new Promise<void>((resolve) => {
      Alert.alert(
        t('explore.calendar.publish_title') || 'Publicar en Explore',
        t('explore.calendar.publish_subtitle') || '¿Quieres publicar este evento en el feed social?',
        [
          { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
          {
            text: t('explore.calendar.publish_button') || 'Publicar',
            onPress: async () => {
              try {
                // Case 1: event was created from an announcement → publish that announcement as social post
                if (event.linkedAnnouncementId) {
                  const announcementSnap = await getDoc(doc(db, 'posts', event.linkedAnnouncementId));
                  if (announcementSnap.exists()) {
                    const ann = announcementSnap.data();
                    // If already published as social post, just mark event
                    let socialId = ann.socialId ?? null;
                    if (!socialId) {
                      socialId = await (forumService as any).createPost({
                        title: ann.title,
                        content: ann.content,
                        authorName: ann.authorName,
                        authorPhoto: ann.authorPhoto ?? null,
                        postType: 'post',
                        likes: [],
                        tags: ['anuncio'],
                        mediaUrl: ann.imageUrl ?? null,
                        mediaType: ann.imageUrl ? 'image' : null,
                        imageOffsetY: ann.imageUrl ? (ann.imageOffsetY ?? null) : null,
                        originalAnnouncementId: event.linkedAnnouncementId,
                        linkedEventId: event.id,
                      }, ann.authorId ?? currentUser.uid);
                      // Mark announcement as published (syncs the "AVISADO" badge in AnnouncementsTab)
                      await updateDoc(doc(db, 'posts', event.linkedAnnouncementId), { socialId });
                    }
                    // Mark event as published
                    await updateDoc(doc(db, 'events', event.id), { publishedInChannel: true, socialId });
                  }
                } else {
                  // Case 2: standalone event → create a new social post from event data
                  const dateStr = new Date(event.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
                  const timeStr = event.time ? ` · ${event.time}` : '';
                  const content = [
                    dateStr + timeStr,
                    event.description || '',
                  ].filter(Boolean).join('\n\n');

                  const socialId = await (forumService as any).createPost({
                    title: event.title,
                    content,
                    authorName: currentUser.displayName || (t('roles.admin') || 'Administración'),
                    authorPhoto: currentUser.photoURL ?? null,
                    postType: 'post',
                    likes: [],
                    tags: ['evento'],
                    mediaUrl: null,
                    mediaType: null,
                    linkedEventId: event.id,
                  }, currentUser.uid);

                  await updateDoc(doc(db, 'events', event.id), { publishedInChannel: true, socialId });
                }

                resolve();
              } catch (error) {
                console.error('Error publishing event to social:', error);
                Alert.alert(t('common.error') || 'Error', 'No se pudo publicar.');
                resolve();
              }
            }
          }
        ]
      );
    });
  };

  return {
    allEvents,
    saveEvent,
    createLinkedEvent,
    deleteEvent,
    publishEventToChannel,
  };
}
