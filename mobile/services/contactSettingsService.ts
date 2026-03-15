import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, arrayUnion, arrayRemove, writeBatch, orderBy, limit,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ContactSettings, MutualGroup, SaveToPhotosPreference, MuteDuration } from '@/types';
import { sendFriendRequest as fsSendRequest, acceptFriendRequest as fsAcceptRequest, areFriends, getFriendRequest } from './friendsService';

const defaultSettings = (): ContactSettings & { isBestFriend: boolean } => ({
  mute: 'off',
  mutedUntil: null,
  saveToPhotos: 'default',
  alertTone: 'Predeterminado',
  isBestFriend: false,
});

export const getContactSettings = async (
  meId: string,
  otherId: string
): Promise<ContactSettings & { isBestFriend: boolean }> => {
  const snap = await getDoc(doc(db, 'users', meId, 'contactSettings', otherId));
  if (!snap.exists()) return defaultSettings();
  const data = snap.data();
  return {
    mute: data.mute ?? 'off',
    mutedUntil: data.mutedUntil ?? null,
    saveToPhotos: data.saveToPhotos ?? 'default',
    alertTone: data.alertTone ?? 'Predeterminado',
    isBestFriend: data.isBestFriend ?? false,
  };
};

export const updateContactSettings = async (
  meId: string,
  otherId: string,
  partial: Partial<ContactSettings & { isBestFriend: boolean }>
): Promise<void> => {
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

export const getSharedMedia = async (conversationId: string, maxItems = 50): Promise<any[]> => {
  if (!conversationId) return [];
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    where('type', 'in', ['image', 'video']),
    orderBy('createdAt', 'desc'),
    limit(maxItems)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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

      let preview = '';
      if (otherMemberIds.length > 0) {
        const profiles = await Promise.all(otherMemberIds.map(id => getDoc(doc(db, 'users', id))));
        preview = profiles
          .filter(p => p.exists())
          .map(p => p.data()?.displayName?.split(' ')[0] || 'Usuario')
          .join(', ');
        if (memberIds.length > otherMemberIds.length + 2) {
          preview += ' y más';
        }
      } else {
        preview = 'Tú y este contacto';
      }

      mutual.push({
        id: d.id,
        name: data.name ?? 'Grupo',
        photo: data.photoURL ?? null,
        memberCount: memberIds.length,
        memberPreview: preview,
      });
    }
  }

  return mutual;
};
