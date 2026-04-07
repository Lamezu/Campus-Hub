import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp,
  Unsubscribe,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { notificationService } from '../notificationService';

export interface DMMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: string;
  edited: boolean;
  editedAt: string | null;
  attachments: DMAttachment[] | null;
  reactions: Record<string, string[]>;
  replyTo?: DMReplyTo | null;
  read: boolean;
  readAt: string | null;
  deletedForUsers?: string[];
  poll?: any;
}

export interface DMAttachment {
  url: string;
  type: 'image' | 'file' | 'audio';
  name: string;
  size: number;
  duration?: number;
}

export interface DMReplyTo {
  id: string;
  senderName: string;
  text: string;
  isAudio?: boolean;
  audioDuration?: number;
}

export interface Conversation {
  id: string;
  participants: string[];
  createdAt: Timestamp;
  lastMessageAt: Timestamp;
  lastMessage: string | null;
  unreadCount: Record<string, number>;
  otherUser?: ConversationUser;
}

export interface ConversationUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  role?: string;
}

export function getConversationId(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('_');
}

export async function getOrCreateConversation(
  userId1: string,
  userId2: string
): Promise<string> {
  const conversationId = getConversationId(userId1, userId2);
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);

  if (!convSnap.exists()) {
    await setDoc(convRef, {
      participants: [userId1, userId2],
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: null,
      unreadCount: {
        [userId1]: 0,
        [userId2]: 0
      }
    });
  }

  return conversationId;
}

export async function getUserConversations(userId: string): Promise<Conversation[]> {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation));
}

function mapDoc(d: QueryDocumentSnapshot): DMMessage {
  const data = d.data();
  return {
    id: d.id,
    text: data.text || '',
    senderId: data.senderId || '',
    senderName: data.senderName || 'Unknown',
    senderPhoto: data.senderPhoto || null,
    createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    edited: data.edited || false,
    editedAt: data.editedAt?.toDate?.()?.toISOString() || null,
    attachments: data.attachments || null,
    reactions: data.reactions || {},
    replyTo: data.replyTo || null,
    read: data.read || false,
    readAt: data.readAt?.toDate?.()?.toISOString() || null,
    deletedForUsers: data.deletedForUsers || [],
    poll: (data.poll && typeof data.poll === 'object' && !Array.isArray(data.poll) && typeof data.poll.question === 'string' && Array.isArray(data.poll.options))
      ? { ...data.poll, options: (data.poll.options as any[]).map((o: any) => typeof o === 'string' ? o : (o?.text ?? o?.label ?? o?.value ?? String(o))), votes: data.poll.votes || {} }
      : null,
  };
}

export function subscribeToMessages(
  conversationId: string,
  callback: (messages: DMMessage[], lastDoc: QueryDocumentSnapshot | null) => void,
  limitCount = 50
): Unsubscribe {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(mapDoc).reverse();
    const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
    callback(messages, lastDoc);
  });
}

export async function loadMoreMessages(
  conversationId: string,
  afterDoc: QueryDocumentSnapshot,
  limitCount = 50
): Promise<{ messages: DMMessage[]; lastDoc: QueryDocumentSnapshot | null }> {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(afterDoc),
    limit(limitCount)
  );

  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map(mapDoc).reverse();
  const lastDoc = snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;
  return { messages, lastDoc };
}

export async function sendMessage(
  conversationId: string,
  text: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  attachments: DMAttachment[] | null = null,
  replyTo: DMReplyTo | null = null,
  poll: any = null
): Promise<string> {
  const batch = writeBatch(db);

  const messagesRef = collection(db, 'conversations', conversationId, 'messages');
  const messageRef = doc(messagesRef);

  const messageData: any = {
    text,
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    attachments,
    reactions: {},
    read: false,
    readAt: null,
    deletedForUsers: []
  };

  if (replyTo) messageData.replyTo = replyTo;
  if (poll) messageData.poll = poll;

  batch.set(messageRef, messageData);

  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  const convData = convSnap.data();

  let otherUserId: string | undefined;
  if (convData) {
    otherUserId = convData.participants.find((id: string) => id !== senderId);
    batch.update(convRef, {
      lastMessageAt: serverTimestamp(),
      lastMessage: text ? text.substring(0, 100) : '🎵 Audio',
      lastMessageSenderName: senderName,
      lastMessageSenderId: senderId,
      [`unreadCount.${otherUserId}`]: (convData.unreadCount?.[otherUserId] || 0) + 1
    });
  }

  await batch.commit();

  if (otherUserId) {
    notificationService.write(otherUserId, {
      category: 'dm',
      title: senderName,
      body: text || (attachments?.length ? 'Archivo adjunto' : ''),
      meta: { participantId: senderId, conversationId },
    }).catch(() => {});
  }

  return messageRef.id;
}

export async function markAsRead(conversationId: string, userId: string): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId);
  await updateDoc(convRef, { [`unreadCount.${userId}`]: 0 });
}

export async function deleteMessage(conversationId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
}

export async function deleteMessageForMe(
  conversationId: string,
  messageId: string,
  userId: string
): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId, 'messages', messageId), {
    deletedForUsers: [userId]
  });
}

export async function addReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;

  const reactions = snap.data().reactions || {};
  if (!reactions[emoji]) reactions[emoji] = [];
  if (!reactions[emoji].includes(userId)) {
    reactions[emoji].push(userId);
    await updateDoc(messageRef, { reactions });
  }
}

export async function removeReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;

  const reactions = snap.data().reactions || {};
  if (reactions[emoji]) {
    reactions[emoji] = reactions[emoji].filter((id: string) => id !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
    await updateDoc(messageRef, { reactions });
  }
}

export function subscribeToUserConversations(
  userId: string,
  callback: (conversations: Conversation[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Conversation)));
  });
}

export async function setConversationArchived(
  userId: string,
  participantId: string,
  archived: boolean
): Promise<void> {
  const ref = doc(db, 'users', userId, 'contactSettings', participantId);
  await setDoc(ref, { archived }, { merge: true });
}

export function subscribeToContactSettings(
  userId: string,
  callback: (settings: Record<string, { archived: boolean }>) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'users', userId, 'contactSettings'), (snap) => {
    const result: Record<string, { archived: boolean }> = {};
    snap.docs.forEach(d => { result[d.id] = d.data() as { archived: boolean }; });
    callback(result);
  });
}
