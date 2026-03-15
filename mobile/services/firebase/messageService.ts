import {
  collection,
  doc,
  addDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface MessageAttachment {
  url: string;
  type: 'image' | 'file';
  name: string;
  size: number;
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string | null;
  createdAt: Timestamp;
  edited: boolean;
  editedAt: Timestamp | null;
  attachments: MessageAttachment[] | null;
  reactions: { [emoji: string]: string[] };
}

export const sendMessage = async (
  channelId: string,
  text: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null = null,
  attachments: MessageAttachment[] | null = null
): Promise<string> => {
  const batch = writeBatch(db);

  const messagesRef = collection(db, 'channels', channelId, 'messages');
  const messageRef = doc(messagesRef);

  batch.set(messageRef, {
    text,
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    attachments,
    reactions: {}
  });

  const channelRef = doc(db, 'channels', channelId);
  batch.update(channelRef, {
    lastMessageAt: serverTimestamp()
  });

  await batch.commit();
  return messageRef.id;
};

export const editMessage = async (
  channelId: string,
  messageId: string,
  newText: string
): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  await updateDoc(messageRef, {
    text: newText,
    edited: true,
    editedAt: serverTimestamp()
  });
};

export const deleteMessage = async (
  channelId: string,
  messageId: string
): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  await deleteDoc(messageRef);
};

export const addReaction = async (
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);

  if (messageSnap.exists()) {
    const message = messageSnap.data() as Message;
    const reactions = message.reactions || {};

    if (!reactions[emoji]) {
      reactions[emoji] = [];
    }

    if (!reactions[emoji].includes(userId)) {
      reactions[emoji].push(userId);
      await updateDoc(messageRef, { reactions });
    }
  }
};

export const removeReaction = async (
  channelId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> => {
  const messageRef = doc(db, 'channels', channelId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);

  if (messageSnap.exists()) {
    const message = messageSnap.data() as Message;
    const reactions = message.reactions || {};

    if (reactions[emoji]) {
      reactions[emoji] = reactions[emoji].filter(id => id !== userId);

      if (reactions[emoji].length === 0) {
        delete reactions[emoji];
      }

      await updateDoc(messageRef, { reactions });
    }
  }
};

export const subscribeToMessages = (
  channelId: string,
  limitCount: number = 50,
  callback: (messages: Message[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'channels', channelId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );

  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as Message)).reverse();

    callback(messages);
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('Messages Snapshot error:', error);
    }
  });
};

export const updateLastRead = async (
  channelId: string,
  userId: string
): Promise<void> => {
  const memberRef = doc(db, 'channels', channelId, 'members', userId);
  await updateDoc(memberRef, {
    lastRead: serverTimestamp()
  });
};