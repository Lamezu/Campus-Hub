import { collection, doc, getDoc, setDoc, deleteDoc, query, where, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface SavedMessage {
  id: string;
  text?: string;
  senderName: string;
  senderId: string;
  savedAt: string;
  originalChannelId: string;
  attachments?: Array<{ type: string; url: string }>;
}

export interface SavedPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  mediaUrl?: string | null;
  createdAt: any;
  savedBy?: string[];
}

export function subscribeToSavedMessages(userId: string, callback: (msgs: SavedMessage[]) => void): () => void {
  const q = query(collection(db, 'users', userId, 'savedMessages'));
  return onSnapshot(q, snap => {
    const msgs = snap.docs.map(d => d.data() as SavedMessage);
    msgs.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    callback(msgs);
  });
}

export function subscribeToSavedPosts(userId: string, callback: (posts: SavedPost[]) => void): () => void {
  const q = query(collection(db, 'posts'), where('savedBy', 'array-contains', userId));
  return onSnapshot(q, snap => {
    const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedPost));
    posts.sort((a, b) => {
      const ta = a.createdAt?.toDate?.() ?? new Date(a.createdAt);
      const tb = b.createdAt?.toDate?.() ?? new Date(b.createdAt);
      return tb.getTime() - ta.getTime();
    });
    callback(posts);
  });
}

export async function unsaveMessage(userId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'savedMessages', messageId));
}

export async function unsavePost(userId: string, postId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;
  const savedBy: string[] = snap.data().savedBy ?? [];
  await updateDoc(postRef, { savedBy: savedBy.filter(id => id !== userId) });
}

export async function savePost(userId: string, postId: string): Promise<void> {
  const postRef = doc(db, 'posts', postId);
  const snap = await getDoc(postRef);
  if (!snap.exists()) return;
  const savedBy: string[] = snap.data().savedBy ?? [];
  if (savedBy.includes(userId)) return;
  await updateDoc(postRef, { savedBy: [...savedBy, userId] });
}

export async function saveMessage(userId: string, message: Omit<SavedMessage, 'savedAt'>, channelId: string): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'savedMessages', message.id), {
    ...message,
    savedAt: new Date().toISOString(),
    originalChannelId: channelId,
  });
}
