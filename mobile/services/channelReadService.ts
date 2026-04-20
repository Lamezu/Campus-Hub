import {
  doc, setDoc, onSnapshot, serverTimestamp, collection, query,
  where, orderBy, limit, Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';

function readKey(userId: string, channelId: string) {
  return `${userId}_${channelId}`;
}

export async function markChannelRead(channelId: string, userId: string): Promise<void> {
  await setDoc(
    doc(db, 'channelReads', readKey(userId, channelId)),
    { userId, channelId, lastReadAt: serverTimestamp() },
    { merge: true },
  );
}

export async function markAllChannelsRead(userId: string, channelIds: string[]): Promise<void> {
  await Promise.all(channelIds.map(id => markChannelRead(id, userId)));
}

export function subscribeToChannelUnread(
  channelId: string,
  userId: string,
  onChange: (count: number) => void,
): () => void {
  let innerUnsub: (() => void) | null = null;

  const readRef = doc(db, 'channelReads', readKey(userId, channelId));
  const messagesRef = collection(db, 'channels', channelId, 'messages');

  const outerUnsub = onSnapshot(readRef, (readSnap) => {
    innerUnsub?.();

    const lastReadAt: Timestamp | null = readSnap.data()?.lastReadAt ?? null;

    const msgQuery = lastReadAt
      ? query(messagesRef, where('createdAt', '>', lastReadAt))
      : query(messagesRef, orderBy('createdAt', 'desc'), limit(100));

    innerUnsub = onSnapshot(msgQuery, (snap) => {
      const count = snap.docs.filter(d => d.data().senderId !== userId).length;
      onChange(count);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        console.error('Inner Snapshot error:', error);
      }
      onChange(0);
    });
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('Outer Snapshot error:', error);
    }
    onChange(0);
  });

  return () => {
    outerUnsub();
    innerUnsub?.();
  };
}
