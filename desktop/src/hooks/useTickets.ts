import { useState, useEffect } from 'react';
import { 
  collection, query, orderBy, onSnapshot, 
  addDoc, updateDoc, doc, serverTimestamp, 
  where, Timestamp
} from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { useCurrentUser } from '@/contexts/UserContext';

export type TicketStatus = 'open' | 'in_progress' | 'resolved';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  userId: string;
  userName: string;
  userPhoto: string | null;
  status: TicketStatus;
  createdAt: any;
  updatedAt: any;
  repliesCount?: number;
}

export interface TicketReply {
  id: string;
  ticketId?: string;
  authorId: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  isStaff: boolean;
  createdAt: any;
}

export function useTickets() {
  const { firebaseUser, userData, isAdmin } = useCurrentUser();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!firebaseUser) return;

    const col = collection(db, 'tickets');
    const q = isAdmin 
      ? query(col, orderBy('createdAt', 'desc'))
      : query(col, where('userId', '==', firebaseUser.uid));

    const unsubscribe = onSnapshot(q, snap => {
      let list = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : data.updatedAt || null,
        } as Ticket;
      });

      if (!isAdmin) {
        list.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }

      setTickets(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching tickets:', err);
      setLoading(false);
    });

    return unsubscribe;
  }, [firebaseUser?.uid, isAdmin]);

  const createTicket = async (title: string, description: string) => {
    if (!firebaseUser || !userData) return;
    return await addDoc(collection(db, 'tickets'), {
      title,
      description,
      userId: firebaseUser.uid,
      userName: userData.displayName || firebaseUser.displayName || 'Usuario',
      userPhoto: userData.photoURL || firebaseUser.photoURL || null,
      status: 'open' as TicketStatus,
      repliesCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const updateTicketStatus = async (ticketId: string, status: TicketStatus) => {
    await updateDoc(doc(db, 'tickets', ticketId), {
      status,
      updatedAt: serverTimestamp(),
    });
  };

  const sendTicketMessage = async (ticketId: string, text: string) => {
    if (!firebaseUser || !userData) return;
    const msgRef = collection(db, 'tickets', ticketId, 'replies');
    await addDoc(msgRef, {
      text,
      authorId: firebaseUser.uid,
      authorName: userData.displayName || firebaseUser.displayName || 'Usuario',
      authorPhoto: userData.photoURL || firebaseUser.photoURL || null,
      isStaff: isAdmin,
      createdAt: serverTimestamp(),
    });
    
    await updateDoc(doc(db, 'tickets', ticketId), {
      updatedAt: serverTimestamp(),
    });
  };

  const useTicketChat = (ticketId: string) => {
    const [replies, setReplies] = useState<TicketReply[]>([]);
    
    useEffect(() => {
      if (!ticketId) return;
      const q = query(
        collection(db, 'tickets', ticketId, 'replies'), 
        orderBy('createdAt', 'asc')
      );
      const unsubscribe = onSnapshot(q, snap => {
        setReplies(snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString()
          } as TicketReply;
        }));
      });
      return unsubscribe;
    }, [ticketId]);

    return replies;
  };

  return {
    tickets,
    loading,
    createTicket,
    updateTicketStatus,
    sendTicketMessage,
    useTicketChat
  };
}
