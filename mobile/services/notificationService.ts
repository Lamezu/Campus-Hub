import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import type { NotificationItem, NotificationCategory } from '@/types';

type Listener = () => void;
const listeners = new Set<Listener>();
let notifications: NotificationItem[] = [];

function emit() {
  listeners.forEach(l => l());
}

let unsubscribe: (() => void) | null = null;

export type ChatView = { type: 'channel' | 'dm'; id: string } | null;

let onNewNotificationCallback: ((n: NotificationItem) => void) | null = null;
let isInitialLoad = true;

export const notificationService = {
  currentView: null as ChatView,

  setCurrentView(view: ChatView) {
    this.currentView = view;
  },

  onNewNotification(cb: (n: NotificationItem) => void) {
    onNewNotificationCallback = cb;
  },

  init(userId: string) {
    if (unsubscribe) unsubscribe();
    isInitialLoad = true;

    const q = query(
      collection(db, 'notifications', userId, 'items'),
      orderBy('createdAt', 'desc')
    );

    unsubscribe = onSnapshot(q, (snap) => {
      if (!isInitialLoad) {
        // Use docChanges to reliably detect genuinely new notifications
        const addedDocs = snap.docChanges()
          .filter(c => c.type === 'added')
          .map(c => ({ id: c.doc.id, ...c.doc.data() } as NotificationItem));

        for (const n of addedDocs) {
          if (!n.read) {
            let suppressed = false;
            if (this.currentView) {
              if (this.currentView.type === 'channel' && n.meta?.channelId === this.currentView.id) suppressed = true;
              if (this.currentView.type === 'dm' && n.meta?.participantId === this.currentView.id) suppressed = true;
            }
            if (!suppressed && onNewNotificationCallback) {
              onNewNotificationCallback(n);
              break; // play sound once per batch
            }
          }
        }
      }

      isInitialLoad = false;
      notifications = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationItem[];
      emit();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Notification Service Snapshot error:', error);
      }
    });
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
    try {
      await updateDoc(doc(db, 'notifications', userId, 'items', id), {
        read: true
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  },

  async markAllRead(category?: NotificationCategory): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const toMark = notifications.filter(n => (!category || n.category === category) && !n.read);

      toMark.forEach(n => {
        batch.update(doc(db, 'notifications', userId, 'items', n.id), { read: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async markChatRead(type: 'channel' | 'dm', id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const batch = writeBatch(db);
      const toMark = notifications.filter(n => {
        if (n.read) return false;
        if (type === 'channel') return n.meta?.channelId === id;
        if (type === 'dm') return n.meta?.participantId === id;
        return false;
      });

      if (toMark.length === 0) return;

      toMark.forEach(n => {
        batch.update(doc(db, 'notifications', userId, 'items', n.id), { read: true });
      });

      await batch.commit();
    } catch (error) {
      console.error('Error marking chat notifications as read:', error);
    }
  },

  async addNotification(userId: string, notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): Promise<void> {
    try {
      await addDoc(collection(db, 'notifications', userId, 'items'), {
        ...notification,
        read: false,
        createdAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  }
};
