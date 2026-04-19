import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, limit, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import type { NotificationItem, NotificationCategory } from '../types';

type Listener = () => void;

const listeners = new Set<Listener>();
let notifications: NotificationItem[] = [];
let firestoreUnsub: (() => void) | null = null;
let isInitialLoad = true;

function emit() {
  listeners.forEach(l => l());
}

export const notificationService = {
  init(userId: string) {
    if (firestoreUnsub) firestoreUnsub();
    isInitialLoad = true;
    notifications = [];

    const q = query(
      collection(db, 'notifications', userId, 'items'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    firestoreUnsub = onSnapshot(q, snapshot => {
      const incoming: NotificationItem[] = [];

      for (const d of snapshot.docs) {
        const data = d.data();
        const createdAt = data.createdAt;
        let ts = 0;
        if (createdAt && typeof createdAt.toDate === 'function') {
          ts = createdAt.toDate().getTime();
        } else if (typeof createdAt === 'string') {
          ts = new Date(createdAt).getTime();
        }

        if (ts > 0 && ts < sevenDaysAgo) {
          deleteDoc(doc(db, 'notifications', userId, 'items', d.id)).catch(() => {});
          continue;
        }

        incoming.push({ id: d.id, ...(data as Omit<NotificationItem, 'id'>) });
      }

      notifications = incoming;
      isInitialLoad = false;
      emit();
    });
  },

  destroy() {
    if (firestoreUnsub) {
      firestoreUnsub();
      firestoreUnsub = null;
    }
    notifications = [];
    isInitialLoad = true;
    emit();
  },

  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getAll(): NotificationItem[] {
    return notifications;
  },

  getByCategory(category: NotificationCategory): NotificationItem[] {
    return notifications.filter(n => n.category === category);
  },

  getUnreadCount(category?: NotificationCategory): number {
    return notifications.filter(n => (!category || n.category === category) && !n.read).length;
  },

  async markRead(id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const ref = doc(db, 'notifications', userId, 'items', id);
    await updateDoc(ref, { read: true });
  },

  async write(
    userId: string,
    data: { category: NotificationCategory; title: string; body: string; meta?: Record<string, string> }
  ): Promise<void> {
    await addDoc(collection(db, 'notifications', userId, 'items'), {
      ...data,
      read: false,
      createdAt: serverTimestamp(),
    });
  },

  async markAllRead(category?: NotificationCategory): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    const toMark = notifications.filter(n => (!category || n.category === category) && !n.read);
    await Promise.all(
      toMark.map(n => updateDoc(doc(db, 'notifications', userId, 'items', n.id), { read: true }))
    );
  },
};
