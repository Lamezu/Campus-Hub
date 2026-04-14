import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  subscribeToReceivedRequests,
  acceptFriendRequest,
  rejectFriendRequest,
  type FriendRequest
} from '../services/firebase/friendsService';
import { notificationService } from '../services/notificationService';
import { playMessageTone } from '../utils/toneGenerator';
import type { NotificationItem, NotificationCategory } from '../types';

interface NotificationsContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  pendingRequests: FriendRequest[];
  requestSenders: Record<string, any>;
  acceptRequest: (req: FriendRequest) => Promise<void>;
  rejectRequest: (req: FriendRequest) => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: (category?: NotificationCategory) => Promise<void>;
}

const NotificationsContext = createContext<NotificationsContextType>({
  notifications: [],
  unreadCount: 0,
  pendingRequests: [],
  requestSenders: {},
  acceptRequest: async () => {},
  rejectRequest: async () => {},
  markRead: async () => {},
  markAllRead: async () => {},
});

export function NotificationsProvider({ children, t }: { children: React.ReactNode; t: (key: string, options?: any) => string }) {
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [requestSenders, setRequestSenders] = useState<Record<string, any>>({});
  const [firestoreNotifs, setFirestoreNotifs] = useState<NotificationItem[]>([]);
  const [convNotifs, setConvNotifs] = useState<NotificationItem[]>([]);
  const [groupConvNotifs, setGroupConvNotifs] = useState<NotificationItem[]>([]);
  const [socialNotifs, setSocialNotifs] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);
  const readSocialIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => {
      const uid = user?.uid ?? null;
      userIdRef.current = uid;
      setUserId(uid);
      knownNotifIdsRef.current = new Set();
      isInitialLoadRef.current = true;
      readSocialIdsRef.current = new Set();
      setSocialNotifs([]);
      if (uid) {
        notificationService.init(uid);
      } else {
        notificationService.destroy();
        setFirestoreNotifs([]);
        setConvNotifs([]);
        setGroupConvNotifs([]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = notificationService.subscribe(() => {
      const all = notificationService.getAll();

      if (!isInitialLoadRef.current) {
        for (const n of all) {
          if (!knownNotifIdsRef.current.has(n.id) && !n.read && n.category === 'friend') {
            playMessageTone('Melodía');
            break;
          }
        }
      }

      knownNotifIdsRef.current = new Set(all.map(n => n.id));
      isInitialLoadRef.current = false;
      setFirestoreNotifs([...all]);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', userId)
    );

    const unsub = onSnapshot(q, snap => {
      const synth: NotificationItem[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const unread = data.unreadCount?.[userId] ?? 0;
        if (unread === 0) continue;
        if (data.lastMessageSenderId === userId) continue;

        const otherUserId = (data.participants as string[])?.find((id: string) => id !== userId) ?? '';
        const at = data.lastMessageAt?.toDate?.()?.toISOString() ?? new Date().toISOString();

        const notif = {
          id: `conv_${d.id}`,
          category: 'dm' as NotificationCategory,
          title: data.lastMessageSenderName ?? t('notifications.new_message'),
          body: data.lastMessage ?? '',
          read: false,
          createdAt: at,
          meta: { conversationId: d.id, participantId: otherUserId },
        };
        synth.push(notif);

        if (!isInitialLoadRef.current && !knownNotifIdsRef.current.has(notif.id)) {
          playMessageTone('Melodía');
        }
      }
      setConvNotifs(synth);
    });

    return unsub;
  }, [userId, t]);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'groupConversations'),
      where('members', 'array-contains', userId)
    );

    const unsub = onSnapshot(q, snap => {
      const synth: NotificationItem[] = [];
      for (const d of snap.docs) {
        const data = d.data();
        const unreadCounts = data.unreadCounts || {};
        const unread = unreadCounts[userId] ?? 0;
        if (unread === 0) continue;
        if (data.lastMessageSenderId === userId) continue;

        const at = data.lastMessageAt?.toDate?.()?.toISOString() ?? new Date().toISOString();

        const notif = {
          id: `group_conv_${d.id}`,
          category: 'dm' as NotificationCategory,
          title: `${data.lastMessageSenderName} en ${data.name || t('common.group')}`,
          body: data.lastMessage ?? '',
          read: false,
          createdAt: at,
          meta: { conversationId: d.id, participantId: '', groupName: data.name, isGroup: 'true' },
        };
        synth.push(notif);

        const checkGroupSettings = async () => {
          try {
            const settingsRef = doc(db, 'users', userId, 'groupSettings', d.id);
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
              const settings = settingsSnap.data();
              if (settings.muted === true || settings.mute === 'always' || settings.mute === '8h' || settings.mute === '1w') {
                return;
              }
              if (settings.alertTone && settings.alertTone !== t('settings.alert_tones.default')) {
                playMessageTone(settings.alertTone);
                return;
              }
            }
          } catch (err) {
            console.error('Error al verificar settings del grupo:', err);
          }
          
          playMessageTone('Melodía');
        };

        if (!isInitialLoadRef.current && !knownNotifIdsRef.current.has(notif.id)) {
          checkGroupSettings();
        }
      }
      setGroupConvNotifs(synth);
    });

    return unsub;
  }, [userId, t]);

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    setSocialNotifs([]);
    readSocialIdsRef.current = new Set();

    const postStates = new Map<string, { likes: Set<string>; title: string }>();
    const commentUnsubs = new Map<string, () => void>();
    let postsSeeded = false;
    let destroyed = false;

    const addSocialNotif = (id: string, title: string, body: string, postId: string) => {
      if (destroyed) return;
      const createdAt = new Date().toISOString();
      setSocialNotifs(prev => {
        if (prev.some(n => n.id === id)) return prev;
        return [{
          id,
          category: 'social' as NotificationCategory,
          title,
          body,
          read: readSocialIdsRef.current.has(id),
          createdAt,
          meta: { postId },
        }, ...prev];
      });
    };

    const attachCommentWatcher = (postId: string, postTitle: string) => {
      if (commentUnsubs.has(postId)) return;
      let firstSnap = true;
      const unsub = onSnapshot(collection(db, 'posts', postId, 'comments'), snap => {
        if (firstSnap) { firstSnap = false; return; }
        snap.docChanges().forEach(cc => {
          if (cc.type !== 'added') return;
          const cData = cc.doc.data();
          if (cData.authorId === uid) return;
          const title = cData.authorName ?? t('common.someone');
          addSocialNotif(
            `comment_${cc.doc.id}`,
            title,
            t('notifications.commented_on_post', { title: postStates.get(postId)?.title ?? postTitle }),
            postId
          );
        });
      });
      commentUnsubs.set(postId, unsub);
    };

    const postsUnsub = onSnapshot(
      query(collection(db, 'posts'), where('authorId', '==', uid)),
      postsSnap => {
        postsSnap.docChanges().forEach(change => {
          const postId = change.doc.id;
          const data = change.doc.data();
          const currLikes = new Set<string>(data.likes ?? []);
          const postTitle: string = data.title ?? '';

          if (change.type === 'removed') {
            commentUnsubs.get(postId)?.();
            commentUnsubs.delete(postId);
            postStates.delete(postId);
            return;
          }

          if (!postsSeeded || change.type === 'added') {
            postStates.set(postId, { likes: currLikes, title: postTitle });
            attachCommentWatcher(postId, postTitle);
            return;
          }

          if (change.type === 'modified') {
            const prev = postStates.get(postId);
            const prevLikes = prev?.likes ?? new Set<string>();
            for (const likerUid of currLikes) {
              if (!prevLikes.has(likerUid) && likerUid !== uid) {
                const notifId = `like_${postId}_${likerUid}`;
                addSocialNotif(notifId, t('common.someone'), t('notifications.liked_your_post', { title: postTitle }), postId);
                getDoc(doc(db, 'users', likerUid))
                  .then(() => t('common.someone'))
                  .catch(() => t('common.someone'))
                  .then(name => {
                    if (destroyed) return;
                    setSocialNotifs(prev => prev.map(n =>
                      n.id === notifId ? { ...n, title: name } : n
                    ));
                  });
              }
            }
            postStates.set(postId, { likes: currLikes, title: postTitle });
          }
        });
        postsSeeded = true;
      }
    );

    return () => {
      destroyed = true;
      postsUnsub();
      commentUnsubs.forEach(u => u());
    };
  }, [userId, t]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToReceivedRequests(userId, async (reqs) => {
      setPendingRequests(reqs);
      const senders: Record<string, any> = {};
      await Promise.all(reqs.map(async r => {
        const snap = await getDoc(doc(db, 'users', r.fromUserId));
        if (snap.exists()) senders[r.fromUserId] = snap.data();
      }));
      setRequestSenders(senders);
    });
    return unsub;
  }, [userId]);

  const notifications = useMemo(() => {
    const fsConvIds = new Set(
      firestoreNotifs
        .filter(n => n.category === 'dm' && n.meta?.conversationId && !n.id?.startsWith?.('group_conv_'))
        .map(n => n.meta!.conversationId)
    );
    const filteredConv = convNotifs.filter(
      n => !fsConvIds.has(n.meta?.conversationId ?? '')
    );

    const fsGroupConvIds = new Set(
      firestoreNotifs
        .filter(n => n.category === 'dm' && n.meta?.conversationId && n.id?.startsWith?.('group_conv_'))
        .map(n => n.meta!.conversationId)
    );
    const filteredGroupConv = groupConvNotifs.filter(
      n => !fsGroupConvIds.has(n.meta?.conversationId ?? '')
    );

    const fsSocialPostIds = new Set(
      firestoreNotifs
        .filter(n => n.category === 'social' && n.meta?.postId)
        .map(n => n.meta!.postId)
    );
    const filteredSocial = socialNotifs.filter(
      n => !fsSocialPostIds.has(n.meta?.postId ?? '')
    );

    return [...firestoreNotifs, ...filteredConv, ...filteredGroupConv, ...filteredSocial].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [firestoreNotifs, convNotifs, groupConvNotifs, socialNotifs]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markRead = async (id: string) => {
    if (id.startsWith('conv_') && !id.startsWith('group_conv_')) {
      const uid = userIdRef.current;
      if (!uid) return;
      const conversationId = id.slice(5);
      await updateDoc(doc(db, 'conversations', conversationId), {
        [`unreadCount.${uid}`]: 0,
      });
    } else if (id.startsWith('group_conv_')) {
      const uid = userIdRef.current;
      if (!uid) return;
      const conversationId = id.slice(11);
      await updateDoc(doc(db, 'groupConversations', conversationId), {
        [`unreadCounts.${uid}`]: 0,
      });
    } else if (id.startsWith('like_') || id.startsWith('comment_')) {
      readSocialIdsRef.current.add(id);
      setSocialNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } else {
      await notificationService.markRead(id);
    }
  };

  const markAllRead = async (category?: NotificationCategory) => {
    const uid = userIdRef.current;
    if (!category || category === 'dm') {
      await Promise.all([
        ...convNotifs.map(n =>
          uid
            ? updateDoc(doc(db, 'conversations', n.meta!.conversationId), {
                [`unreadCount.${uid}`]: 0,
              })
            : Promise.resolve()
        ),
        ...groupConvNotifs.map(n =>
          uid
            ? updateDoc(doc(db, 'groupConversations', n.meta!.conversationId), {
                [`unreadCounts.${uid}`]: 0,
              })
            : Promise.resolve()
        )
      ]);
    }
    if (!category || category === 'social') {
      const unreadSocial = socialNotifs.filter(n => !n.read);
      unreadSocial.forEach(n => readSocialIdsRef.current.add(n.id));
      if (unreadSocial.length > 0) {
        setSocialNotifs(prev => prev.map(n => ({ ...n, read: true })));
      }
    }
    await notificationService.markAllRead(category);
  };

  const acceptRequest = async (req: FriendRequest) => {
    await acceptFriendRequest(req.id);
  };

  const rejectRequest = async (req: FriendRequest) => {
    await rejectFriendRequest(req.id);
  };

  return (
    <NotificationsContext.Provider value={{
      notifications,
      unreadCount,
      pendingRequests,
      requestSenders,
      acceptRequest,
      rejectRequest,
      markRead,
      markAllRead,
    }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationsContext);