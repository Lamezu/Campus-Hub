import { useState, useEffect, useCallback } from 'react';
import { eventsService, authService } from '../../services/shared';
import { db } from '../../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
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
        t('explore.calendar.publish_title') || 'Publicar en Canal',
        t('explore.calendar.publish_subtitle') || '¿Quieres anunciar este evento en el canal institucional?',
        [
          { text: t('common.cancel') || 'Cancelar', style: 'cancel', onPress: () => resolve() },
          {
            text: t('explore.calendar.publish_button') || 'Publicar',
            onPress: async () => {
              try {
                const { db } = await import('../../config/firebase');
                const { collection, addDoc, serverTimestamp, doc, updateDoc } = await import('firebase/firestore');

                const msgText = t('explore.calendar.notify_template', {
                  title: event.title,
                  description: event.description || t('explore.calendar.no_desc'),
                  date: new Date(event.date).toLocaleDateString(),
                  time: event.time || t('explore.calendar.all_day')
                });

                await addDoc(collection(db, 'channels', '3', 'messages'), {
                  text: msgText,
                  senderId: currentUser.uid,
                  senderName: currentUser.displayName || (t('roles.admin') || 'Administración'),
                  senderPhoto: currentUser.photoURL || null,
                  createdAt: serverTimestamp(),
                  type: 'event',
                  metadata: {
                    eventId: event.id,
                    eventDate: event.date,
                    eventType: event.type
                  }
                });

                await updateDoc(doc(db, 'events', event.id), {
                  publishedInChannel: true
                });

                resolve();
              } catch (error) {
                console.error('Error publishing event:', error);
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
