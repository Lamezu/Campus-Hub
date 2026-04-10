import {
    collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
    query, where, orderBy, serverTimestamp, onSnapshot, Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Message, Post } from '@/types';

export interface SavedMessage extends Message {
    savedAt: string;
    originalChannelId: string;
    isDM?: boolean;
    participantId?: string;
    channelName?: string;
}

export async function toggleSaveMessage(
    userId: string, 
    message: Message, 
    channelId: string, 
    options?: { isDM?: boolean; participantId?: string; channelName?: string }
): Promise<boolean> {
    const saveRef = doc(db, 'users', userId, 'savedMessages', message.id);
    const snap = await getDoc(saveRef);

    if (snap.exists()) {
        await deleteDoc(saveRef);
        return false;
    } else {
        await setDoc(saveRef, {
            ...message,
            savedAt: new Date().toISOString(),
            originalChannelId: channelId,
            isDM: options?.isDM ?? false,
            participantId: options?.participantId ?? null,
            channelName: options?.channelName ?? null,
        });
        return true;
    }
}

export async function isMessageSaved(userId: string, messageId: string): Promise<boolean> {
    const saveRef = doc(db, 'users', userId, 'savedMessages', messageId);
    const snap = await getDoc(saveRef);
    return snap.exists();
}

export async function saveMessage(userId: string, message: Message, channelId: string, options?: { isDM?: boolean; participantId?: string; channelName?: string }): Promise<void> {
    const saveRef = doc(db, 'users', userId, 'savedMessages', message.id);
    await setDoc(saveRef, {
        ...message,
        savedAt: new Date().toISOString(),
        originalChannelId: channelId,
        isDM: options?.isDM ?? false,
        participantId: options?.participantId ?? null,
        channelName: options?.channelName ?? null,
    });
}

export async function unsaveMessage(userId: string, messageId: string): Promise<void> {
    const saveRef = doc(db, 'users', userId, 'savedMessages', messageId);
    await deleteDoc(saveRef);
}

export function subscribeToSavedMessages(
    userId: string,
    callback: (messages: SavedMessage[]) => void
): () => void {
    const q = query(
        collection(db, 'users', userId, 'savedMessages')
    );
    return onSnapshot(q, snap => {
        const msgs = snap.docs.map(d => d.data() as SavedMessage);
        msgs.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        callback(msgs);
    });
}

export function subscribeToSavedPosts(
    userId: string,
    callback: (posts: Post[]) => void
): () => void {
    const q = query(
        collection(db, 'posts'),
        where('savedBy', 'array-contains', userId)
    );
    return onSnapshot(q, snap => {
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Post));
        posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callback(posts);
    });
}

export async function toggleSavePost(userId: string, postId: string): Promise<boolean> {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) return false;

    const data = postSnap.data() as Post;
    const savedBy = data.savedBy ?? [];
    const isSaved = savedBy.includes(userId);

    if (isSaved) {
        await updateDoc(postRef, {
            savedBy: savedBy.filter(id => id !== userId)
        });
        return false;
    } else {
        await updateDoc(postRef, {
            savedBy: [...savedBy, userId]
        });
        return true;
    }
}
