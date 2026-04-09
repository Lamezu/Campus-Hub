import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc, deleteDoc as _deleteDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { eventsService } from '@/services/shared';
import type { CalendarEvent } from '@/types';

export type RsvpStatus = 'going' | 'not_going' | null;

// Maps cycle-level dept keys → their family key
const CYCLE_TO_FAMILY: Record<string, string> = {
  smr: 'it_comms', asir: 'it_comms', dam: 'it_comms', daw: 'it_comms',
  cooking: 'hospitality', restaurant_services: 'hospitality', kitchen_management: 'hospitality',
  restaurant_management: 'hospitality', hotel_management: 'hospitality', tourist_guide: 'hospitality',
  tcae: 'health', pharmacy: 'health', dietetics: 'health', hygiene: 'health', emergencies: 'health',
  fitness: 'sports',
  tseas: 'energy_water', energy_efficiency: 'energy_water', water_management: 'energy_water',
  admin_mgmt_cycle: 'admin_mgmt', finance_insurance: 'admin_mgmt', management_assistance: 'admin_mgmt',
};

// Maps family key → all cycle keys it contains
const FAMILY_TO_CYCLES: Record<string, string[]> = {
  it_comms: ['smr', 'asir', 'dam', 'daw'],
  hospitality: ['cooking', 'restaurant_services', 'kitchen_management', 'restaurant_management', 'hotel_management', 'tourist_guide'],
  health: ['tcae', 'pharmacy', 'dietetics', 'hygiene', 'emergencies'],
  sports: ['fitness', 'tseas'],
  admin_mgmt: ['admin_mgmt_cycle', 'finance_insurance', 'management_assistance'],
  energy_water: ['energy_efficiency', 'water_management', 'tseas'],
};

function deptVisible(eventDeptId: string, userDept: string): boolean {
  if (eventDeptId === userDept) return true;
  // User is in a cycle, event targets the family → show it
  if (CYCLE_TO_FAMILY[userDept] === eventDeptId) return true;
  // User is at family level, event targets a cycle in their family → show it
  if (FAMILY_TO_CYCLES[userDept]?.includes(eventDeptId)) return true;
  return false;
}

function tsToISO(val: unknown): string {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

// Normalize: lowercase + treat empty string as null
function normDept(d: string | null | undefined): string | null {
  if (!d) return null;
  return d.toLowerCase();
}

export function useEvents(myDepartment: string | null) {
  myDepartment = normDept(myDepartment);
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
    if (!meId) return;
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
        departmentId: normDept(data.departmentId),
        publishedInChannel: data.publishedInChannel ?? false,
        attendeesCount: data.attendeesCount ?? 0,
      } as any));
      // Newest first
      mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setAllEvents(mapped);
      setLoading(false);
    });
    return typeof unsub === 'function' ? unsub : () => {};
  }, [meId]);

  const visible = allEvents.filter(e =>
    !e.departmentId || !myDepartment || deptVisible(e.departmentId, myDepartment) || mySubjectKeys.has(e.departmentId)
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

    const eventRef = doc(db, 'events', eventId);
    const prevGoing = prev === 'going';
    const nextGoing = next === 'going';

    if (next === null) {
      await _deleteDoc(doc(db, 'rsvps', rsvpId));
      if (prevGoing) await updateDoc(eventRef, { attendeesCount: increment(-1) });
    } else {
      await setDoc(doc(db, 'rsvps', rsvpId), {
        userId: meId,
        eventId,
        status: next,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      if (nextGoing && !prevGoing) await updateDoc(eventRef, { attendeesCount: increment(1) });
      else if (!nextGoing && prevGoing) await updateDoc(eventRef, { attendeesCount: increment(-1) });
    }
  };

  return { events: visible, rsvpMap, rsvp, loading };
}
