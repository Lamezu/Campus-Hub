import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  increment,
  arrayUnion,
  arrayRemove,
  Unsubscribe,
  setDoc,
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface GroupConversation {
  id: string;
  name: string;
  photoURL: string | null;
  createdBy: string;
  createdAt: string;
  members: string[];
  memberNames: Record<string, string>;
  memberPhotos: Record<string, string | null>;
  lastMessage: string | null;
  lastMessageAt: string | null;
  lastMessageSenderId: string | null;
  lastMessageSenderName: string | null;
  unreadCount: number;
  isGroup: true;
}

export interface GroupMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: string;
  attachments: any[] | null;
  reactions: Record<string, string[]>;
  replyTo: any | null;
  deletedForUsers: string[];
  poll: any | null;
  type: string;
}

function lastMessagePreview(text: string, attachments?: any[] | null): string {
  if (text?.trim()) return text.trim();
  const type = attachments?.[0]?.type;
  if (type === 'image') return '📷 Imagen';
  if (type === 'audio') return '🎵 Audio';
  if (type === 'file') return '📎 Archivo';
  return '';
}

async function updateGroupAfterMessage(
  batch: ReturnType<typeof writeBatch>,
  groupRef: ReturnType<typeof doc>,
  senderId: string,
  senderName: string,
  preview: string,
  members: string[]
) {
  const unreadUpdate: Record<string, any> = {};
  for (const uid of members) {
    if (uid !== senderId) {
      unreadUpdate[`unreadCounts.${uid}`] = increment(1);
    }
  }
  batch.update(groupRef, {
    lastMessage: preview,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: senderId,
    lastMessageSenderName: senderName,
    ...unreadUpdate,
  });
}

export async function muteGroupConversation(
  userId: string,
  groupId: string,
  muted: boolean
): Promise<void> {
  const ref = doc(db, 'users', userId, 'groupSettings', groupId);
  await setDoc(ref, { muted, mute: muted ? 'always' : 'off' }, { merge: true });
}

export async function unmuteGroupConversation(
  userId: string,
  groupId: string
): Promise<void> {
  const ref = doc(db, 'users', userId, 'groupSettings', groupId);
  await setDoc(ref, { muted: false, mute: 'off' }, { merge: true });
}

export async function createGroupConversation(
  members: { id: string; name: string; photo: string | null }[],
  groupName: string,
  groupPhotoURL: string | null,
  creatorId: string
): Promise<string> {
  const memberIds = members.map(m => m.id);
  const memberNames = Object.fromEntries(members.map(m => [m.id, m.name]));
  const memberPhotos = Object.fromEntries(members.map(m => [m.id, m.photo]));
  const unreadCounts = Object.fromEntries(members.map(m => [m.id, 0]));

  const ref = await addDoc(collection(db, 'groupConversations'), {
    name: groupName.trim(),
    photoURL: groupPhotoURL,
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    members: memberIds,
    memberNames,
    memberPhotos,
    lastMessage: null,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: null,
    lastMessageSenderName: null,
    unreadCounts,
  });

  return ref.id;
}

export function subscribeToGroupConversations(
  userId: string,
  callback: (groups: GroupConversation[]) => void,
  onError?: (err: any) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groupConversations'),
    where('members', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(q, snap => {
    const groups: GroupConversation[] = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name ?? '',
        photoURL: data.photoURL ?? null,
        createdBy: data.createdBy ?? '',
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
        members: data.members ?? [],
        memberNames: data.memberNames ?? {},
        memberPhotos: data.memberPhotos ?? {},
        lastMessage: data.lastMessage ?? null,
        lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() ?? null,
        lastMessageSenderId: data.lastMessageSenderId ?? null,
        lastMessageSenderName: data.lastMessageSenderName ?? null,
        unreadCount: data.unreadCounts?.[userId] ?? 0,
        isGroup: true,
      };
    });
    callback(groups);
  }, onError);
}

export function subscribeToGroupMessages(
  groupId: string,
  currentUserId: string,
  callback: (messages: GroupMessage[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groupConversations', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, snap => {
    const messages: GroupMessage[] = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text ?? '',
          senderId: data.senderId ?? '',
          senderName: data.senderName ?? '',
          senderPhoto: data.senderPhoto ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          attachments: data.attachments ?? null,
          reactions: data.reactions ?? {},
          replyTo: data.replyTo ?? null,
          deletedForUsers: data.deletedForUsers ?? [],
          poll: data.poll ?? null,
          type: data.type ?? 'text',
        };
      })
      .filter(m => !m.deletedForUsers.includes(currentUserId))
      .reverse();
    callback(messages);
  });
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
  attachments?: any[] | null,
  replyTo?: any | null,
  poll?: any | null
): Promise<string> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const groupSnap = await getDoc(groupRef);
  const members: string[] = groupSnap.data()?.members ?? [];

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'groupConversations', groupId, 'messages'));
  batch.set(msgRef, {
    text: text ?? '',
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    attachments: attachments ?? null,
    reactions: {},
    replyTo: replyTo ?? null,
    poll: poll ?? null,
    deletedForUsers: [],
    type: 'text',
  });

  await updateGroupAfterMessage(batch, groupRef, senderId, senderName, lastMessagePreview(text, attachments), members);
  await batch.commit();
  return msgRef.id;
}

export async function markGroupAsRead(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId), {
    [`unreadCounts.${userId}`]: 0,
  });
}

export function subscribeToGroupInfo(
  groupId: string,
  callback: (group: GroupConversation | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'groupConversations', groupId), snap => {
    if (!snap.exists()) { callback(null); return; }
    const data = snap.data();
    callback({
      id: snap.id,
      name: data.name ?? '',
      photoURL: data.photoURL ?? null,
      createdBy: data.createdBy ?? '',
      createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
      members: data.members ?? [],
      memberNames: data.memberNames ?? {},
      memberPhotos: data.memberPhotos ?? {},
      lastMessage: data.lastMessage ?? null,
      lastMessageAt: data.lastMessageAt?.toDate?.()?.toISOString() ?? null,
      lastMessageSenderId: data.lastMessageSenderId ?? null,
      lastMessageSenderName: data.lastMessageSenderName ?? null,
      unreadCount: 0,
      isGroup: true,
    });
  });
}

export async function toggleGroupReaction(
  groupId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, 'groupConversations', groupId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const reactions = snap.data().reactions ?? {};
  const current: string[] = reactions[emoji] ?? [];
  const updated = current.includes(userId)
    ? current.filter(id => id !== userId)
    : [...current, userId];
  await updateDoc(msgRef, { [`reactions.${emoji}`]: updated });
}

export async function deleteGroupMessageForMe(
  groupId: string,
  messageId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId, 'messages', messageId), {
    deletedForUsers: arrayUnion(userId),
  });
}

export async function deleteGroupMessageForAll(groupId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'groupConversations', groupId, 'messages', messageId));
}

export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const snap = await getDoc(groupRef);
  if (!snap.exists()) return;
  const data = snap.data();

  const remainingMembers: string[] = (data.members ?? []).filter((id: string) => id !== userId);
  if (remainingMembers.length === 0) {
    await deleteDoc(groupRef);
    return;
  }

  const updates: Record<string, any> = {
    members: arrayRemove(userId),
    [`memberNames.${userId}`]: deleteField(),
    [`memberPhotos.${userId}`]: deleteField(),
    [`unreadCounts.${userId}`]: deleteField(),
  };
  if (data.createdBy === userId) {
    updates.createdBy = remainingMembers[0];
  }
  await updateDoc(groupRef, updates);
}

export async function addMembersToGroup(
  groupId: string,
  newMembers: { id: string; name: string; photo: string | null }[]
): Promise<void> {
  const updates: Record<string, any> = {
    members: arrayUnion(...newMembers.map(m => m.id)),
  };
  for (const m of newMembers) {
    updates[`memberNames.${m.id}`] = m.name;
    updates[`memberPhotos.${m.id}`] = m.photo ?? null;
    updates[`unreadCounts.${m.id}`] = 0;
  }
  await updateDoc(doc(db, 'groupConversations', groupId), updates);
}

export async function updateGroupInfo(
  groupId: string,
  name: string,
  photoURL: string | null
): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId), { name: name.trim(), photoURL });
}

export async function clearGroupChatForUser(groupId: string, userId: string): Promise<void> {
  const messagesRef = collection(db, 'groupConversations', groupId, 'messages');
  const snap = await getDocs(messagesRef);
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => {
    const deletedFor: string[] = d.data().deletedForUsers || [];
    if (!deletedFor.includes(userId)) {
      batch.update(d.ref, { deletedForUsers: [...deletedFor, userId] });
    }
  });
  await batch.commit();
}

export async function reportGroup(
  groupId: string,
  reporterId: string,
  reason: string
): Promise<void> {
  await addDoc(collection(db, 'reports'), {
    type: 'group',
    targetId: groupId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function deleteGroupConversation(groupId: string): Promise<void> {
  const messagesRef = collection(db, 'groupConversations', groupId, 'messages');
  const snap = await getDocs(messagesRef);
  if (!snap.empty) {
    for (let i = 0; i < snap.docs.length; i += 500) {
      const batch = writeBatch(db);
      snap.docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }
  await deleteDoc(doc(db, 'groupConversations', groupId));
}

export async function kickMemberFromGroup(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId), {
    members: arrayRemove(userId),
    [`memberNames.${userId}`]: deleteField(),
    [`memberPhotos.${userId}`]: deleteField(),
    [`unreadCounts.${userId}`]: deleteField(),
  });
}