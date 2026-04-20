import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, arrayUnion, arrayRemove, writeBatch, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ContactSettings, MutualGroup, SaveToPhotosPreference, MuteDuration, SharedMedia } from '@/types';
import { sendFriendRequest as fsSendRequest, acceptFriendRequest as fsAcceptRequest, areFriends, getFriendRequest } from './friendsService';

type ExtendedSettings = ContactSettings & { isBestFriend: boolean; archived: boolean; deleted: boolean };

const defaultSettings = (): ExtendedSettings => ({
  mute: 'off',
  mutedUntil: null,
  saveToPhotos: 'default',
  alertTone: 'default',
  isBestFriend: false,
  archived: false,
  deleted: false,
});

export const getContactSettings = async (
  meId: string,
  otherId: string
): Promise<ExtendedSettings> => {
  if (!meId || !otherId) return defaultSettings();
  const snap = await getDoc(doc(db, 'users', meId, 'contactSettings', otherId));
  if (!snap.exists()) return defaultSettings();
  const data = snap.data();
  return {
    mute: data.mute ?? 'off',
    mutedUntil: data.mutedUntil ?? null,
    saveToPhotos: data.saveToPhotos ?? 'default',
    alertTone: data.alertTone ?? 'default',
    isBestFriend: data.isBestFriend ?? false,
    archived: data.archived ?? false,
    deleted: data.deleted ?? false,
  };
};

export const updateContactSettings = async (
  meId: string,
  otherId: string,
  partial: Partial<ExtendedSettings>
): Promise<void> => {
  if (!meId || !otherId) return;
  const ref = doc(db, 'users', meId, 'contactSettings', otherId);
  await setDoc(ref, { ...partial, updatedAt: serverTimestamp() }, { merge: true });
};

export const toggleBestFriend = async (meId: string, otherId: string): Promise<boolean> => {
  const settings = await getContactSettings(meId, otherId);
  const next = !settings.isBestFriend;
  await updateContactSettings(meId, otherId, { isBestFriend: next });
  return next;
};

export const blockUser = async (meId: string, targetUserId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', meId), {
    blockedUsers: arrayUnion(targetUserId),
    friends: arrayRemove(targetUserId),
    bestFriends: arrayRemove(targetUserId),
  });
};

export const unblockUser = async (meId: string, targetUserId: string): Promise<void> => {
  await updateDoc(doc(db, 'users', meId), {
    blockedUsers: arrayRemove(targetUserId),
  });
};

export const reportUser = async (meId: string, targetUserId: string): Promise<void> => {
  await addDoc(collection(db, 'reports'), {
    reporterId: meId,
    reportedId: targetUserId,
    createdAt: serverTimestamp(),
    status: 'pending',
  });
};

export const clearChat = async (conversationId: string, userId: string): Promise<void> => {
  if (!conversationId) return;
  const convSnap = await getDoc(doc(db, 'conversations', conversationId));
  if (!convSnap.exists()) return;
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const snap = await getDocs(messagesRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { deletedForUsers: arrayUnion(userId) }));
  await batch.commit();
};

export const clearChatForAll = async (conversationId: string): Promise<void> => {
  if (!conversationId) return;
  const convSnap = await getDoc(doc(db, 'conversations', conversationId));
  if (!convSnap.exists()) return;
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const snap = await getDocs(messagesRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
};

export const getFriendStatus = async (
  meId: string,
  otherId: string
): Promise<{ isFriend: boolean; friendRequestStatus: 'none' | 'sent' | 'received' }> => {
  const isFriend = await areFriends(meId, otherId);
  if (isFriend) return { isFriend: true, friendRequestStatus: 'none' };

  const req = await getFriendRequest(meId, otherId);
  if (!req) return { isFriend: false, friendRequestStatus: 'none' };
  if (req.fromUserId === meId) return { isFriend: false, friendRequestStatus: 'sent' };
  return { isFriend: false, friendRequestStatus: 'received' };
};

export const sendFriendRequest = async (
  meId: string,
  otherId: string,
  senderName: string,
  senderPhoto: string | null
): Promise<void> => {
  await fsSendRequest(meId, otherId, senderName, senderPhoto);
};

export const acceptFriendRequest = async (meId: string, senderId: string): Promise<void> => {
  const req = await getFriendRequest(senderId, meId);
  if (req) await fsAcceptRequest(req.id);
};

export const getSharedMedia = async (conversationId: string, maxItems = 100): Promise<SharedMedia[]> => {
  if (!conversationId) return [];
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(maxItems)
  );
  const snap = await getDocs(q);
  const media: SharedMedia[] = [];

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  snap.docs.forEach(d => {
    const data = d.data();
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();

    if (Array.isArray(data.attachments)) {
      data.attachments.forEach((a: any) => {
        media.push({
          id: d.id,
          type: a.type === 'image' ? 'image' : a.type === 'video' ? 'video' : a.type === 'audio' ? 'audio' : 'file',
          url: a.url,
          name: a.name || 'Archivo',
          size: a.size || 0,
          thumbnail: a.url,
          createdAt
        });
      });
    }

    if (data.text) {
      const matches = data.text.match(urlRegex);
      if (matches) {
        matches.forEach((url: string) => {
          media.push({
            id: d.id,
            type: 'link',
            url: url,
            name: url,
            createdAt
          });
        });
      }
    }
  });

  return media;
};

export const getMutualGroups = async (meId: string, otherId: string): Promise<MutualGroup[]> => {
  const [channelSnap, sgSnap] = await Promise.all([
    getDocs(query(collection(db, 'channels'), where('memberIds', 'array-contains', meId))),
    getDocs(query(collection(db, 'studyGroups'), where('memberIds', 'array-contains', meId))),
  ]);

  const mutual: MutualGroup[] = [];

  for (const d of [...channelSnap.docs, ...sgSnap.docs]) {
    const data = d.data();
    if (Array.isArray(data.memberIds) && data.memberIds.includes(otherId)) {
      const memberIds = data.memberIds as string[];
      const otherMemberIds = memberIds.filter(id => id !== meId && id !== otherId).slice(0, 2);

      let memberPreview = '';
      if (otherMemberIds.length > 0) {
        const profiles = await Promise.all(otherMemberIds.map(id => getDoc(doc(db, 'users', id))));
        const names = profiles
          .filter(p => p.exists())
          .map(p => p.data()?.displayName?.split(' ')[0] || 'Usuario');
        memberPreview = names.join(', ');
      }

      mutual.push({
        id: d.id,
        name: data.name ?? 'Grupo',
        photo: data.photoURL ?? null,
        memberCount: memberIds.length,
        memberPreview,
        type: d.ref.parent.id === 'studyGroups' ? 'studyGroup' : 'channel',
      });
    }
  }

  return mutual;
};
