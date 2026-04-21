import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, deleteDoc, doc, 
  Timestamp, serverTimestamp, getDoc, 
  setDoc, increment, where 
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useAlert } from '@/contexts/AlertContext';
import type { CalendarEvent, CalendarEventType } from '@/types';

export function useCalendarEvents() {
  const currentUser = auth.currentUser;
  const { showAlert } = useAlert();
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [rsvpMap, setRsvpMap] = useState<Record<string, 'going' | 'not_going'>>({});
  const [loading, setLoading] = useState(true);

  // 1. Cargar eventos generales
  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
    const unsubscribe = onSnapshot(q, snap => {
      const mapped = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title ?? '',
          description: data.description ?? '',
          date: data.startDate instanceof Timestamp
            ? data.startDate.toDate().toISOString()
            : (data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString()),
          endDate: data.endDate instanceof Timestamp
            ? data.endDate.toDate().toISOString()
            : null,
          allDay: data.allDay ?? true,
          time: data.time ?? null,
          type: (data.category ?? data.type ?? 'event') as CalendarEventType,
          authorId: data.creatorId ?? data.authorId ?? '',
          authorName: data.authorName ?? '',
          createdAt: data.createdAt instanceof Timestamp
            ? data.createdAt.toDate().toISOString()
            : new Date().toISOString(),
          linkedAnnouncementId: data.linkedAnnouncementId ?? null,
          departmentId: data.departmentId ?? null,
          attendeesCount: data.attendeesCount ?? 0,
          isPublished: data.isPublished ?? false,
        } as CalendarEvent;
      });
      setAllEvents(mapped);
      setLoading(false);
    }, (error) => {
      console.error('CalendarEvents Snapshot error:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Sincronizar RSVPs del usuario actual
  useEffect(() => {
    if (!currentUser) {
      setRsvpMap({});
      return;
    }

    const rsvpsQuery = query(
      collection(db, 'rsvps'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(rsvpsQuery, snap => {
      const map: Record<string, 'going' | 'not_going'> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.eventId) {
          map[data.eventId] = data.status;
        }
      });
      setRsvpMap(map);
    }, (err) => {
      console.error('Error fetching RSVPs:', err);
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const saveEvent = async (event: any, editingId: string | null = null) => {
    if (!currentUser) return;

    // Convert date string and time string to a single Date object and then to Timestamp
    const [year, month, day] = event.date.split('-').map(Number);
    const [hours, minutes] = (event.time || '00:00').split(':').map(Number);
    const startDate = new Date(year, month - 1, day, hours, minutes);

    const data = {
      title: event.title,
      description: event.description,
      startDate: Timestamp.fromDate(startDate),
      time: event.time,
      allDay: !event.time,
      category: event.type, // Map 'type' from UI to 'category' in DB
      updatedAt: serverTimestamp(),
    };

    if (editingId) {
      await updateDoc(doc(db, 'events', editingId), data);
    } else {
      await addDoc(collection(db, 'events'), {
        ...data,
        creatorId: currentUser.uid,
        authorName: currentUser.displayName ?? '',
        status: 'upcoming',
        attendeesCount: 0,
        createdAt: serverTimestamp(),
      });
    }
  };

  const createLinkedEvent = async (
    announcementId: string,
    eventData: { title: string; date: Date; time: string | null; type: CalendarEventType; departmentId?: string | null }
  ): Promise<string | null> => {
    if (!currentUser) return null;
    try {
      const docRef = await addDoc(collection(db, 'events'), {
        title: eventData.title,
        description: '',
        startDate: Timestamp.fromDate(eventData.date),
        allDay: !eventData.time,
        time: eventData.time ?? null,
        category: eventData.type,
        linkedAnnouncementId: announcementId,
        departmentId: eventData.departmentId ?? null,
        creatorId: currentUser.uid,
        authorName: currentUser.displayName ?? '',
        status: 'upcoming',
        attendeesCount: 0,
        createdAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'posts', announcementId), { linkedEventId: docRef.id });
      return docRef.id;
    } catch (error) {
      console.error('Error creating linked event:', error);
      return null;
    }
  };

  const deleteEvent = async (eventId: string) => {
    showAlert({
      title: 'Borrar evento',
      message: '¿Seguro que quieres borrar este evento?',
      type: 'confirm',
      showCancelButton: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'events', eventId));
          showAlert({ title: 'Borrado', message: 'El evento ha sido borrado.', type: 'success' });
        } catch (err) {
          showAlert({ title: 'Error', message: 'No se pudo borrar el evento.', type: 'error' });
        }
      }
    });
  };

  const toggleRSVP = async (eventId: string, status: 'going' | 'not_going') => {
    if (!currentUser) return;
    try {
      const rsvpId = `${eventId}_${currentUser.uid}`;
      const rsvpRef = doc(db, 'rsvps', rsvpId);
      
      const oldStatus = rsvpMap[eventId] || null;
      
      if (oldStatus === status) {
        // Al darle de nuevo al mismo estado, cancelamos el RSVP (borramos el documento)
        await deleteDoc(rsvpRef);
        // Si el estado anterior era 'going', restamos del contador
        if (oldStatus === 'going') {
          await updateDoc(doc(db, 'events', eventId), { attendeesCount: increment(-1) });
        }
      } else {
        // Creamos o actualizamos el RSVP.
        await setDoc(rsvpRef, {
          eventId,
          userId: currentUser.uid,
          status,
          updatedAt: serverTimestamp()
        }, { merge: true });

        // Si el nuevo estado es 'going' y el anterior NO lo era, sumamos 1
        if (status === 'going' && oldStatus !== 'going') {
          await updateDoc(doc(db, 'events', eventId), { attendeesCount: increment(1) });
        } 
        // Si el nuevo estado es 'not_going' y el anterior era 'going', restamos 1
        else if (status === 'not_going' && oldStatus === 'going') {
          await updateDoc(doc(db, 'events', eventId), { attendeesCount: increment(-1) });
        }
      }
    } catch (err) {
      console.error('Error toggling RSVP:', err);
    }
  };

  const publishEventToSocial = async (event: CalendarEvent) => {
    if (!currentUser) return;
    try {
      if (event.linkedAnnouncementId) {
        // Update original announcement to be discoverable
        await updateDoc(doc(db, 'posts', event.linkedAnnouncementId), {
          isPublished: true,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create a new post based on the event
        await addDoc(collection(db, 'posts'), {
          title: event.title,
          content: event.description || `Evento programado para el ${new Date(event.date).toLocaleDateString()}`,
          authorId: currentUser.uid,
          authorName: currentUser.displayName || 'Campus Admin',
          authorPhoto: currentUser.photoURL,
          createdAt: serverTimestamp(),
          likes: [],
          likesCount: 0,
          commentsCount: 0,
          postType: 'post',
          linkedEventId: event.id
        });
      }

      // Mark event as published
      await updateDoc(doc(db, 'events', event.id), {
        isPublished: true
      });

      showAlert({ title: 'Publicado', message: 'El evento ahora es visible en Explorar.', type: 'success' });
    } catch (err) {
      console.error('Error publishing event:', err);
      showAlert({ title: 'Error', message: 'No se pudo publicar el evento.', type: 'error' });
    }
  };

  return {
    allEvents,
    rsvpMap,
    loading,
    saveEvent,
    createLinkedEvent,
    deleteEvent,
    toggleRSVP,
    publishEventToSocial,
  };
}
