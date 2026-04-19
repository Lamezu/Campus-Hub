import { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, deleteDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import type { CalendarEvent, CalendarEventType } from '../../types';

export function useCalendarEvents() {
  const currentUser = auth.currentUser;
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
    const unsubscribe = onSnapshot(q, snap => {
      setAllEvents(snap.docs.map(d => {
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
        } as CalendarEvent;
      }));
    }, () => {});

    return unsubscribe;
  }, []);

  const saveEvent = async (event: {
    title: string;
    description: string;
    startDate: Timestamp;
    allDay: boolean;
    time: string | null;
    category: CalendarEventType;
    departmentId?: string | null;
  }, editingId: string | null = null) => {
    if (!currentUser) return;
    const data = { ...event, updatedAt: serverTimestamp() };
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

  const deleteEvent = async (eventId: string) => {
    if (window.confirm('¿Seguro que quieres borrar este evento?')) {
      await deleteDoc(doc(db, 'events', eventId));
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
    } catch {
      return null;
    }
  };

  return { allEvents, saveEvent, deleteEvent, createLinkedEvent };
}
