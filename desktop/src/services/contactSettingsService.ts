import {
  doc, getDoc, setDoc, updateDoc, deleteDoc,
  collection, query, where, getDocs, addDoc,
  serverTimestamp, arrayUnion, arrayRemove, writeBatch, orderBy, limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ContactSettings, MutualGroup, SaveToPhotosPreference, MuteDuration, SharedMedia } from '@/types';
import { sendFriendRequest as fsSendRequest, acceptFriendRequest as fsAcceptRequest, areFriends, getFriendRequest } from './friendsService';

const defaultSettings = (): ContactSettings => ({
  mute: 'off',
  mutedUntil: null,
  saveToPhotos: 'default',
  alertTone: 'Predeterminado',
});

export const getContactSettings = async (
  meId: string,
  otherId: string
): Promise<ContactSettings & { isBestFriend: boolean }> => {
  const [settingsSnap] = await Promise.all([
    getDoc(doc(db, 'users', meId, 'contactSettings', otherId)),
  ]);

  const fq = query(collection(db, 'friendships'), where('userId', '==', meId), where('friendId', '==', otherId));
  const fSnap = await getDocs(fq);

  const settings = settingsSnap.exists() ? settingsSnap.data() : defaultSettings();
  const isBestFriend = !fSnap.empty ? (fSnap.docs[0].data().isBestFriend ?? false) : false;

  return {
    mute: settings.mute ?? 'off',
    mutedUntil: settings.mutedUntil ?? null,
    saveToPhotos: settings.saveToPhotos ?? 'default',
    alertTone: settings.alertTone ?? 'Predeterminado',
    isBestFriend,
  };
};

export const updateContactSettings = async (
  meId: string,
  otherId: string,
  partial: Partial<ContactSettings & { isBestFriend: boolean }>
): Promise<void> => {
  const batch = writeBatch(db);
  
  if ('isBestFriend' in partial) {
    const fq = query(collection(db, 'friendships'), where('userId', '==', meId), where('friendId', '==', otherId));
    const fSnap = await getDocs(fq);
    if (!fSnap.empty) {
      batch.update(fSnap.docs[0].ref, { isBestFriend: partial.isBestFriend });
    }
  }

  const settingsRef = doc(db, 'users', meId, 'contactSettings', otherId);
  const { isBestFriend, ...settings } = partial;
  if (Object.keys(settings).length > 0) {
    batch.set(settingsRef, { ...settings, updatedAt: serverTimestamp() }, { merge: true });
  }

  await batch.commit();
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
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const snap = await getDocs(query(messagesRef, limit(200)));
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { deletedForUsers: arrayUnion(userId) }));
  await batch.commit();
};

export const clearChatForAll = async (conversationId: string): Promise<void> => {
  if (!conversationId) return;
  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const snap = await getDocs(query(messagesRef, limit(200)));
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
    const createdAt = data.createdAt instanceof Timestamp 
      ? data.createdAt.toDate().toISOString() 
      : new Date().toISOString();

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
            size: 0,
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
          .map(p => (p.data() as any)?.displayName?.split(' ')[0] || 'Usuario');
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
