import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  doc, writeBatch, Timestamp, increment,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import type { CalendarEvent, CalendarEventType } from '../types';
import { useMySubjectKeys } from './campus/useMySubjectKeys';

type RsvpStatus = 'going' | 'not_going';

export interface EventWithMeta extends CalendarEvent {
  attendeesCount: number;
}

function parseEvent(d: any): EventWithMeta {
  const data = d.data();
  return {
    id: d.id,
    title: data.title ?? '',
    description: data.description ?? '',
    date: data.startDate instanceof Timestamp
      ? data.startDate.toDate().toISOString()
      : (data.startDate ? new Date(data.startDate).toISOString() : new Date().toISOString()),
    endDate: data.endDate instanceof Timestamp ? data.endDate.toDate().toISOString() : null,
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
  };
}

export function useEvents(role: string | null) {
  const currentUser = auth.currentUser;
  const mySubjectKeys = useMySubjectKeys(currentUser?.uid ?? null);
  const [allEvents, setAllEvents] = useState<EventWithMeta[]>([]);
  const [rsvpMap, setRsvpMap] = useState<Record<string, RsvpStatus | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'events'), orderBy('startDate', 'asc'));
    return onSnapshot(q, snap => {
      setAllEvents(snap.docs.map(parseEvent));
      setLoading(false);
    }, () => setLoading(false));
  }, []);

  // Teachers and admins see all events.
  // Students only see events with no departmentId (global) or ones
  // whose departmentId matches a study group they belong to.
  const canSeeAll = role === 'teacher' || role === 'admin';
  const events = allEvents.filter(ev =>
    canSeeAll || !ev.departmentId || mySubjectKeys.has(ev.departmentId)
  );

  useEffect(() => {
    if (!currentUser) return;
    const q = query(
      collection(db, 'rsvps'),
      where('userId', '==', currentUser.uid)
    );
    return onSnapshot(q, snap => {
      const map: Record<string, RsvpStatus | null> = {};
      snap.docs.forEach(d => {
        const data = d.data();
        map[data.eventId] = data.status as RsvpStatus;
      });
      setRsvpMap(map);
    });
  }, [currentUser?.uid]);

  const rsvp = async (eventId: string, status: RsvpStatus) => {
    if (!currentUser) return;
    const rsvpId = `${eventId}_${currentUser.uid}`;
    const rsvpRef = doc(db, 'rsvps', rsvpId);
    const eventRef = doc(db, 'events', eventId);
    const currentStatus = rsvpMap[eventId] ?? null;
    const batch = writeBatch(db);

    if (currentStatus === status) {
      batch.delete(rsvpRef);
      if (status === 'going') batch.update(eventRef, { attendeesCount: increment(-1) });
    } else {
      batch.set(rsvpRef, { userId: currentUser.uid, eventId, status, updatedAt: Timestamp.now() });
      if (status === 'going') batch.update(eventRef, { attendeesCount: increment(1) });
      if (status === 'not_going' && currentStatus === 'going') batch.update(eventRef, { attendeesCount: increment(-1) });
    }

    await batch.commit();
  };

  return { events, rsvpMap, rsvp, loading };
}
