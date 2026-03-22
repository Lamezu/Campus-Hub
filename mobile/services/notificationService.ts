import { auth } from '@/config/firebase';
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

import { getNotificationService as sharedGetNotificationService } from './shared';

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

    unsubscribe = (sharedGetNotificationService() as any).subscribeToNotifications(userId, (items: any[]) => {
      if (!isInitialLoad) {
        const newUnread = items.filter(item => {
          const isKnown = notifications.some(existing => existing.id === item.id);
          return !isKnown && !item.read;
        });

        for (const n of newUnread) {
          let suppressed = false;
          if (this.currentView) {
            if (this.currentView.type === 'channel' && n.meta?.channelId === this.currentView.id) suppressed = true;
            if (this.currentView.type === 'dm' && n.meta?.participantId === this.currentView.id) suppressed = true;
          }
          if (!suppressed && onNewNotificationCallback) {
            onNewNotificationCallback(n as NotificationItem);
            break;
          }
        }
      }

      isInitialLoad = false;
      notifications = items as NotificationItem[];
      emit();
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
    await (sharedGetNotificationService() as any).markAsRead(userId, id);
  },

  async markAllRead(category?: NotificationCategory): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const toMark = notifications.filter(n => (!category || n.category === category) && !n.read);
      for (const n of toMark) {
        await (sharedGetNotificationService() as any).markAsRead(userId, n.id);
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async markChatRead(type: 'channel' | 'dm', id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const toMark = notifications.filter(n => {
        if (n.read) return false;
        if (type === 'channel') return n.meta?.channelId === id;
        if (type === 'dm') return n.meta?.participantId === id;
        return false;
      });

      for (const n of toMark) {
        await (sharedGetNotificationService() as any).markAsRead(userId, n.id);
      }
    } catch (error) {
      console.error('Error marking chat notifications as read:', error);
    }
  },

  async addNotification(userId: string, notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): Promise<void> {
    await (sharedGetNotificationService() as any).addNotification(userId, notification);
  }
};
