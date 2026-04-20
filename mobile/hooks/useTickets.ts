import { useState, useEffect } from 'react';
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, updateDoc, doc, serverTimestamp, getDocs,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Ticket, TicketReply, TicketStatus } from '@/types';

export function useTickets(userId: string, isStaff: boolean) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    const col = collection(db, 'tickets');
    const q = isStaff
      ? query(col, orderBy('createdAt', 'desc'))
      : query(col, where('userId', '==', userId));

    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
      if (!isStaff) {
        list.sort((a, b) => {
          const ta = (a.createdAt as any)?.toMillis?.() ?? new Date(a.createdAt).getTime();
          const tb = (b.createdAt as any)?.toMillis?.() ?? new Date(b.createdAt).getTime();
          return tb - ta;
        });
      }
      setTickets(list);
      setLoading(false);
    }, (err) => { console.warn('useTickets error:', err); setLoading(false); });

    return unsub;
  }, [userId, isStaff]);

  return { tickets, loading };
}

export async function createTicket(params: {
  userId: string;
  userName: string;
  userPhoto: string | null;
  title: string;
  description: string;
}): Promise<string> {
  const ref = await addDoc(collection(db, 'tickets'), {
    ...params,
    status: 'open' as TicketStatus,
    repliesCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateTicketStatus(ticketId: string, status: TicketStatus) {
  await updateDoc(doc(db, 'tickets', ticketId), { status, updatedAt: serverTimestamp() });
}

export async function addTicketReply(params: {
  ticketId: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  isStaff: boolean;
}) {
  await addDoc(collection(db, 'tickets', params.ticketId, 'replies'), {
    authorId: params.authorId,
    authorName: params.authorName,
    authorPhoto: params.authorPhoto,
    text: params.text,
    isStaff: params.isStaff,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'tickets', params.ticketId), {
    updatedAt: serverTimestamp(),
  });
}

export function useTicketReplies(ticketId: string | null) {
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ticketId) { setReplies([]); return; }
    setLoading(true);
    const q = query(
      collection(db, 'tickets', ticketId, 'replies'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, snap => {
      setReplies(snap.docs.map(d => ({ id: d.id, ...d.data() } as TicketReply)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [ticketId]);

  return { replies, loading };
}
