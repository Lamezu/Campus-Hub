import {
    collection, doc, getDoc, setDoc, updateDoc, deleteDoc, deleteField,
    query, where, onSnapshot,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { Message, Post } from '@/types';

export interface SavedMessage extends Message {
    savedAt: string;
    chatType: 'channel' | 'dm' | 'group';
    originalChannelId?: string;
    originalConversationId?: string;
    originalGroupId?: string;
    originalParticipantId?: string;
}

export async function saveMessage(
    userId: string,
    message: Message,
    chatType: 'channel' | 'dm' | 'group',
    channelOrConvId?: string,
    participantOrGroupId?: string
): Promise<void> {
    const saveRef = doc(db, 'users', userId, 'savedMessages', message.id);
    let extra: Record<string, string> = {};
    if (chatType === 'channel' && channelOrConvId) {
        extra = { originalChannelId: channelOrConvId };
    } else if (chatType === 'dm' && channelOrConvId) {
        extra = {
            originalConversationId: channelOrConvId,
            ...(participantOrGroupId ? { originalParticipantId: participantOrGroupId } : {}),
        };
    } else if (chatType === 'group' && participantOrGroupId) {
        extra = { originalGroupId: participantOrGroupId };
    }
    const cleanMessage = Object.fromEntries(
        Object.entries(message).filter(([_, v]) => v !== undefined)
    );
    await setDoc(saveRef, {
        ...cleanMessage,
        savedAt: new Date().toISOString(),
        chatType,
        ...extra,
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
    const q = query(collection(db, 'users', userId, 'savedMessages'));
    return onSnapshot(q, (snap) => {
        const saved = snap.docs.map(d => ({ id: d.id, ...d.data() } as SavedMessage));

        (async () => {
            const results = await Promise.all(saved.map(async (msg) => {
                let originalRef;
                const type = msg.chatType ?? 'channel';
                if (type === 'dm' && msg.originalConversationId) {
                    originalRef = doc(db, 'conversations', msg.originalConversationId, 'messages', msg.id);
                } else if (msg.originalChannelId) {
                    originalRef = doc(db, 'channels', msg.originalChannelId, 'messages', msg.id);
                }

                if (!originalRef) return msg;

                try {
                    const originalSnap = await getDoc(originalRef);
                    if (!originalSnap.exists() || (originalSnap.data()?.deletedForUsers ?? []).includes(userId)) {
                        deleteDoc(doc(db, 'users', userId, 'savedMessages', msg.id)).catch(() => {});
                        return null;
                    }
                    return msg;
                } catch {
                    return msg;
                }
            }));

            const valid = results.filter((m): m is SavedMessage => m !== null);
            valid.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
            callback(valid);
        })();
    }, (error) => {
        console.error('savedMessages snapshot error:', error);
        callback([]);
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
        const posts = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                ...data,
                createdAt: data.createdAt?.toDate?.()?.toISOString() ?? data.createdAt ?? new Date().toISOString(),
                updatedAt: data.updatedAt?.toDate?.()?.toISOString() ?? data.updatedAt ?? null,
            } as Post;
        });
        posts.sort((a, b) => {
            const aSavedAt: string | undefined = (a as any).savedByTimestamps?.[userId];
            const bSavedAt: string | undefined = (b as any).savedByTimestamps?.[userId];
            const aTime = aSavedAt ? new Date(aSavedAt).getTime() : new Date(a.createdAt).getTime();
            const bTime = bSavedAt ? new Date(bSavedAt).getTime() : new Date(b.createdAt).getTime();
            return bTime - aTime;
        });
        callback(posts);
    }, (error) => {
        console.error('savedPosts snapshot error:', error);
        callback([]);
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
            savedBy: savedBy.filter(id => id !== userId),
            [`savedByTimestamps.${userId}`]: deleteField(),
        });
        return false;
    } else {
        await updateDoc(postRef, {
            savedBy: [...savedBy, userId],
            [`savedByTimestamps.${userId}`]: new Date().toISOString(),
        });
        return true;
    }
}
