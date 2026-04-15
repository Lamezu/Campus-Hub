import { auth } from '@/config/firebase';
import type { NotificationItem, NotificationCategory } from '@/types';

type Listener = () => void;
const listeners = new Set<Listener>();
let notifications: NotificationItem[] = [];

function emit() {
  listeners.forEach(l => l());
}

let unsubscribe: (() => void) | null = null;

export type ChatView = { type: 'channel' | 'dm' | 'support'; id: string } | null;

let onNewNotificationCallback: ((n: NotificationItem) => void) | null = null;
let isInitialLoad = true;

// IDs optimistically marked as read — survives Firestore snapshot overwrites
// until Firestore confirms read:true (then we remove from this set)
const locallyReadIds = new Set<string>();

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
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      if (isInitialLoad) {
        const svc = sharedGetNotificationService() as any;

        // Batch-delete stale (>7d) and orphaned social notifications in one go
        const toDelete = items.filter((item: any) =>
          new Date(item.createdAt) < sevenDaysAgo ||
          (item.category === 'social' && !item.meta?.fromUserId)
        );
        if (toDelete.length > 0) {
          svc.batchDeleteNotifications(userId, toDelete.map((n: any) => n.id)).catch(() => {});
        }

        // Migrate old channel notifications: update Firestore with English title + senderName
        const oldChannelNotifs = items.filter((item: any) =>
          item.category === 'channel' &&
          item.meta?.channelId &&
          !item.meta?.senderName &&
          item.title
        );
        for (const n of oldChannelNotifs) {
          const storedCh = n.meta.channelName ?? '';
          let senderName = n.title;
          const enIdx = n.title.lastIndexOf(` en ${storedCh}`);
          const inIdx = n.title.lastIndexOf(` in ${storedCh}`);
          if (enIdx > -1) senderName = n.title.slice(0, enIdx).trim();
          else if (inIdx > -1) senderName = n.title.slice(0, inIdx).trim();

          if (senderName && senderName !== n.title && storedCh) {
            svc.updateNotification(userId, n.id, {
              title: `${senderName} in ${storedCh}`,
              'meta.senderName': senderName,
            }).catch(() => {});
          }
        }
      }

      const fresh = (items as NotificationItem[]).filter(
        item => new Date(item.createdAt) >= sevenDaysAgo &&
          !(item.category === 'social' && !item.meta?.fromUserId)
      );

      // Clean up confirmed reads from locallyReadIds
      for (const item of fresh) {
        if (item.read && locallyReadIds.has(item.id)) {
          locallyReadIds.delete(item.id);
        }
      }

      const autoReadIds = new Set<string>();

      if (this.currentView) {
        const v = this.currentView;
        for (const item of fresh) {
          if (item.read || locallyReadIds.has(item.id)) continue;
          const matches =
            (v.type === 'channel' && item.meta?.channelId === v.id) ||
            (v.type === 'dm' && item.meta?.participantId === v.id) ||
            (v.type === 'support' && item.meta?.ticketId === v.id);
          if (matches) {
            autoReadIds.add(item.id);
            locallyReadIds.add(item.id);
          }
        }
      }

      if (!isInitialLoad) {
        const newUnread = fresh.filter(item => {
          const isKnown = notifications.some(existing => existing.id === item.id);
          return !isKnown && !item.read && !locallyReadIds.has(item.id) && !autoReadIds.has(item.id);
        });

        for (const n of newUnread) {
          if (onNewNotificationCallback) {
            onNewNotificationCallback(n as NotificationItem);
            break;
          }
        }
      }

      isInitialLoad = false;
      // Apply both auto-read and optimistic local reads — never downgrade from read to unread
      notifications = fresh.map(n =>
        (autoReadIds.has(n.id) || locallyReadIds.has(n.id)) ? { ...n, read: true } : n
      );
      emit();

      if (autoReadIds.size > 0) {
        const uid = auth.currentUser?.uid;
        if (uid) {
          autoReadIds.forEach(id => {
            (sharedGetNotificationService() as any).markAsRead(uid, id).catch(() => {});
          });
        }
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
    locallyReadIds.add(id);
    notifications = notifications.map(n => n.id === id ? { ...n, read: true } : n);
    emit();
    await (sharedGetNotificationService() as any).markAsRead(userId, id).catch(() => {});
  },

  async markAllRead(category?: NotificationCategory): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const toMark = notifications.filter(n => (!category || n.category === category) && !n.read);
      if (toMark.length === 0) return;
      toMark.forEach(n => locallyReadIds.add(n.id));
      const ids = new Set(toMark.map(n => n.id));
      notifications = notifications.map(n => ids.has(n.id) ? { ...n, read: true } : n);
      emit();
      await Promise.all(
        toMark.map(n => (sharedGetNotificationService() as any).markAsRead(userId, n.id).catch(() => {}))
      );
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  },

  async markChatRead(type: 'channel' | 'dm' | 'social' | 'support', id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    try {
      const toMark = notifications.filter(n => {
        if (n.read) return false;
        if (type === 'channel') return n.meta?.channelId === id;
        if (type === 'dm') return n.meta?.participantId === id;
        if (type === 'social') return n.meta?.postId === id;
        return false;
      });
      if (toMark.length === 0) return;
      toMark.forEach(n => locallyReadIds.add(n.id));
      const ids = new Set(toMark.map(n => n.id));
      notifications = notifications.map(n => ids.has(n.id) ? { ...n, read: true } : n);
      emit();
      await Promise.all(
        toMark.map(n => (sharedGetNotificationService() as any).markAsRead(userId, n.id).catch(() => {}))
      );
    } catch (error) {
      console.error('Error marking chat notifications as read:', error);
    }
  },

  async addNotification(userId: string, notification: Omit<NotificationItem, 'id' | 'createdAt' | 'read'>): Promise<void> {
    await (sharedGetNotificationService() as any).addNotification(userId, notification);
  },

  async deleteNotification(id: string): Promise<void> {
    const userId = auth.currentUser?.uid;
    if (!userId) return;
    locallyReadIds.delete(id);
    notifications = notifications.filter(n => n.id !== id);
    emit();
    await (sharedGetNotificationService() as any).deleteNotification(userId, id);
  },

  stop() {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    notifications = [];
    locallyReadIds.clear();
    isInitialLoad = true;
    emit();
  }
};
