import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db, auth } from '@/config/firebase';
import { playTone } from '@/utils/toneGenerator';
import type { NotificationItem, NotificationCategory } from '@/types';

type Listener = () => void;
const listeners = new Set<Listener>();
let notifications: NotificationItem[] = [];

function emit() {
  listeners.forEach(l => l());
}

let unsubscribe: (() => void) | null = null;

export type ChatView = { type: 'channel' | 'dm' | 'group'; id: string } | null;

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
        const addedDocs = snap.docChanges()
          .filter(c => c.type === 'added')
          .map(c => ({ id: c.doc.id, ...c.doc.data() } as NotificationItem));

        for (const n of addedDocs) {
          if (!n.read) {
            let suppressed = false;
            
            const channelId = n.meta?.channelId || (n as any).channelId;
            const participantId = n.meta?.participantId || (n as any).participantId;
            const groupId = n.meta?.groupId || (n as any).groupId;
            
            if (this.currentView) {
              if (this.currentView.type === 'channel' && channelId === this.currentView.id) suppressed = true;
              if (this.currentView.type === 'dm' && participantId === this.currentView.id) suppressed = true;
              if (this.currentView.type === 'group' && groupId === this.currentView.id) suppressed = true;
            }

            const savedChatSettings = localStorage.getItem('chatSettings');
            let muteUntil = 0;
            if (savedChatSettings) {
              const parsed = JSON.parse(savedChatSettings);
              muteUntil = parsed.muteUntil || 0;
            }

            if (!suppressed && Date.now() >= muteUntil) {
              if (onNewNotificationCallback) onNewNotificationCallback(n);
              this.playNotificationSound(n);
            }
          }
        }
      }

      isInitialLoad = false;
      const allItems = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NotificationItem[];
      
      const now = new Date();
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const toDeleteNotifs: string[] = [];
      const toDeleteRequests: string[] = [];
      const validNotifications: NotificationItem[] = [];

      for (const n of allItems) {
        if (n.createdAt) {
          const createdAt = new Date(n.createdAt).getTime();
          if (now.getTime() - createdAt > SEVEN_DAYS_MS) {
            toDeleteNotifs.push(n.id);
            if (n.category === 'friend' && n.meta?.isRequest === 'true') {
              toDeleteRequests.push(n.id);
            }
            continue;
          }
        }
        validNotifications.push(n);
      }

      if (toDeleteNotifs.length > 0) {
        import('firebase/firestore').then(({ writeBatch, doc: fDoc }) => {
          const batch = writeBatch(db);
          toDeleteNotifs.forEach(id => batch.delete(fDoc(db, 'notifications', userId, 'items', id)));
          toDeleteRequests.forEach(id => batch.delete(fDoc(db, 'friendRequests', id)));
          batch.commit().catch(console.error);
        });
      }

      notifications = validNotifications;
      emit();
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Notification Service Snapshot error:', error);
      }
    });
  },

  async playNotificationSound(n?: NotificationItem) {
    try {
      let sound = 'default';
      
      if (n && n.category === 'dm') {
        const meId = auth.currentUser?.uid;
        if (meId) {
          if (n.meta?.participantId) {
            const { getContactSettings } = await import('@/services/contactSettingsService');
            const settings = await getContactSettings(meId, n.meta.participantId);
            if (settings.mute !== 'off') return;
            if (settings.alertTone && settings.alertTone !== 'default') {
              const tone = settings.alertTone === 'none' ? 'silent' : settings.alertTone;
              const { playTone } = await import('@/utils/toneGenerator');
              playTone(tone);
              return;
            }
          } else if (n.meta?.groupId) {
            const { getGroupSettings } = await import('@/services/groupDMService');
            const settings = await getGroupSettings(meId, n.meta.groupId);
            if (settings.mute !== 'off') return;
            if (settings.alertTone && settings.alertTone !== 'default') {
              const tone = settings.alertTone === 'none' ? 'silent' : settings.alertTone;
              const { playTone } = await import('@/utils/toneGenerator');
              playTone(tone);
              return;
            }
          }
        }
      }

      const savedChatSettings = localStorage.getItem('chatSettings');
      if (savedChatSettings) {
        const { notificationSound } = JSON.parse(savedChatSettings);
        if (notificationSound) sound = notificationSound;
      }
      
      const { playTone } = await import('@/utils/toneGenerator');
      playTone(sound);
    } catch (error) {
      console.error('Error playing notification sound:', error);
    }
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
      await updateDoc(doc(db, 'notifications', userId, 'items', id), { read: true });
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

  async addNotification(userId: string, notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>, id?: string): Promise<void> {
    try {
      const data = {
        ...notification,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      if (id) {
        await setDoc(doc(db, 'notifications', userId, 'items', id), data);
      } else {
        await addDoc(collection(db, 'notifications', userId, 'items'), data);
      }
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  },

  async addNotificationsBatch(userIds: string[], notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): Promise<void> {
    try {
      const data = {
        ...notification,
        read: false,
        createdAt: new Date().toISOString()
      };
      
      for (let i = 0; i < userIds.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = userIds.slice(i, i + 500);
        
        chunk.forEach(uid => {
          const newDocRef = doc(collection(db, 'notifications', uid, 'items'));
          batch.set(newDocRef, data);
        });
        
        await batch.commit();
      }
    } catch (error) {
      console.error('Error adding notifications batch:', error);
    }
  }
};

