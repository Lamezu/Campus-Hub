import {
  collection, doc, setDoc, deleteDoc, getDocs, query, where, getDoc,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Message } from '@/types';

export interface StarredMessage extends Message {
  starredAt: string;
  chatType: 'dm' | 'channel' | 'group';
  conversationId?: string;
  channelId?: string;
  groupId?: string;
}

export async function starMessage(
  userId: string,
  message: Message,
  chatType: 'dm' | 'channel',
  conversationId?: string,
  channelId?: string,
): Promise<void> {
  const ref = doc(db, 'users', userId, 'starredMessages', message.id);
  
  const cleanMessage = Object.fromEntries(
    Object.entries(message).filter(([_, v]) => v !== undefined)
  );
  
  await setDoc(ref, {
    ...cleanMessage,
    starredAt: new Date().toISOString(),
    chatType,
    ...(conversationId ? { conversationId } : {}),
    ...(channelId ? { channelId } : {}),
  });
}

export async function unstarMessage(userId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'starredMessages', messageId));
}

export async function isMessageStarred(userId: string, messageId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId, 'starredMessages', messageId));
  return snap.exists();
}

export async function getStarredIdsForConversation(
  userId: string,
  conversationId: string,
): Promise<Set<string>> {
  const q = query(
    collection(db, 'users', userId, 'starredMessages'),
    where('conversationId', '==', conversationId),
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map(d => d.id));
}

export async function getStarredIdsForChannel(
  userId: string,
  channelId: string,
): Promise<Set<string>> {
  const q = query(
    collection(db, 'users', userId, 'starredMessages'),
    where('channelId', '==', channelId),
  );
  const snap = await getDocs(q);
  return new Set(snap.docs.map(d => d.id));
}

export async function getStarredMessagesForDM(
  userId: string,
  conversationId: string,
): Promise<StarredMessage[]> {
  const q = query(
    collection(db, 'users', userId, 'starredMessages'),
    where('conversationId', '==', conversationId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as StarredMessage))
    .sort((a, b) => new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime());
}

export async function getStarredMessagesForChannel(
  userId: string,
  channelId: string,
): Promise<StarredMessage[]> {
  const q = query(
    collection(db, 'users', userId, 'starredMessages'),
    where('channelId', '==', channelId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as StarredMessage))
    .sort((a, b) => new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime());
}
export async function getStarredMessagesForGroup(
  userId: string,
  groupId: string,
): Promise<StarredMessage[]> {
  const q = query(
    collection(db, 'users', userId, 'starredMessages'),
    where('groupId', '==', groupId),
  );
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as StarredMessage))
    .sort((a, b) => new Date(b.starredAt).getTime() - new Date(a.starredAt).getTime());
}
