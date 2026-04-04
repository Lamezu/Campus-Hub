import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { eventsService } from '@/services/shared';
import type { CalendarEvent } from '@/types';

export type RsvpStatus = 'going' | 'not_going' | null;

function tsToISO(val: unknown): string {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function useEvents(myDepartment: string | null) {
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [rsvpMap, setRsvpMap] = useState<Record<string, RsvpStatus>>({});
  const [loading, setLoading] = useState(true);
  const [mySubjectKeys, setMySubjectKeys] = useState<Set<string>>(new Set());

  const meId = auth.currentUser?.uid;

  useEffect(() => {
    if (!meId) return;
    const studyGroupsQuery = query(
      collection(db, 'studyGroups'),
      where('memberIds', 'array-contains', meId)
    );
    const unsub = onSnapshot(studyGroupsQuery, snap => {
      const keys = new Set<string>();
      snap.docs.forEach(d => {
        const data = d.data();
        if (Array.isArray(data.subjects)) {
          data.subjects.forEach((s: string) => keys.add(s));
        } else if (typeof data.subject === 'string' && data.subject) {
          keys.add(data.subject);
        }
      });
      setMySubjectKeys(keys);
    });
    return unsub;
  }, [meId]);

  useEffect(() => {
    const unsub = (eventsService as any).subscribeToEvents((raw: any[]) => {
      const mapped: CalendarEvent[] = raw.map(data => ({
        id: data.id,
        title: data.title ?? '',
        description: data.description ?? '',
        date: tsToISO(data.startDate),
        endDate: data.endDate ? tsToISO(data.endDate) : null,
        allDay: data.allDay ?? true,
        time: data.time ?? null,
        type: (data.category ?? data.type ?? 'event') as CalendarEvent['type'],
        authorId: data.creatorId ?? data.authorId ?? '',
        authorName: data.authorName ?? '',
        createdAt: tsToISO(data.createdAt),
        linkedAnnouncementId: data.linkedAnnouncementId ?? null,
        departmentId: data.departmentId ?? null,
        publishedInChannel: data.publishedInChannel ?? false,
        attendeesCount: data.attendeesCount ?? 0,
      } as any));
      setAllEvents(mapped);
      setLoading(false);
    });
    return typeof unsub === 'function' ? unsub : () => {};
  }, []);

  const visible = allEvents.filter(e =>
    !e.departmentId || e.departmentId === myDepartment || mySubjectKeys.has(e.departmentId)
  );

  useEffect(() => {
    if (!meId || visible.length === 0) return;
    const eventIds = visible.map(e => e.id);

    const chunks: string[][] = [];
    for (let i = 0; i < eventIds.length; i += 10) chunks.push(eventIds.slice(i, i + 10));

    const unsubs = chunks.map(chunk => {
      const q = query(
        collection(db, 'rsvps'),
        where('userId', '==', meId),
        where('eventId', 'in', chunk)
      );
      return onSnapshot(q, snap => {
        setRsvpMap(prev => {
          const next = { ...prev };
          snap.docs.forEach(d => { next[d.data().eventId] = d.data().status as RsvpStatus; });
          return next;
        });
      });
    });

    return () => unsubs.forEach(u => u());
  }, [meId, visible.map(e => e.id).join(',')]);

  const rsvp = async (eventId: string, status: RsvpStatus) => {
    if (!meId) return;
    const rsvpId = `${eventId}_${meId}`;
    const prev = rsvpMap[eventId] ?? null;
    const next = prev === status ? null : status;
    setRsvpMap(r => ({ ...r, [eventId]: next }));
    if (next === null) {
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'rsvps', rsvpId));
    } else {
      await setDoc(doc(db, 'rsvps', rsvpId), {
        userId: meId,
        eventId,
        status: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  };

  return { events: visible, rsvpMap, rsvp, loading };
}
