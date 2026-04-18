import {
  collection, doc, getDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp,
  onSnapshot, writeBatch, setDoc, Timestamp,
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { DirectMessage, DMConversation, ReplyPreview } from '@/types';

function tsToISO(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export async function getOrCreateConversation(meId: string, participantId: string): Promise<string> {
  const conversationId = getConversationId(meId, participantId);
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (!convSnap.exists()) {
    await setDoc(convRef, {
      participants: [meId, participantId],
      createdAt: serverTimestamp(),
      lastMessageAt: serverTimestamp(),
      lastMessage: null,
      unreadCount: { [meId]: 0, [participantId]: 0 },
    });
  }
  return conversationId;
}

export async function markConversationAsRead(convId: string, userId: string): Promise<void> {
  const convRef = doc(db, 'conversations', convId);
  await updateDoc(convRef, {
    [`unreadCount.${userId}`]: 0
  });
}

export function subscribeToMessages(
  conversationId: string,
  meId: string,
  callback: (messages: DirectMessage[]) => void,
  onError?: (error: any) => void
): () => void {
  const q = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(100)
  );
  return onSnapshot(q, snapshot => {
    const messages = snapshot.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text ?? '',
          senderId: data.senderId ?? '',
          senderName: data.senderName ?? '',
          senderPhoto: data.senderPhoto ?? null,
          createdAt: tsToISO(data.createdAt),
          edited: data.edited ?? false,
          editedAt: data.editedAt ? tsToISO(data.editedAt) : null,
          attachments: data.attachments ?? null,
          poll: data.poll ?? null,
          reactions: data.reactions ?? {},
          replyTo: data.replyTo ?? null,
          deletedForUsers: data.deletedForUsers ?? [],
          forwarded: data.forwarded ?? false,
          status: data.status ?? 'sent',
        } as DirectMessage;
      })
      .filter(m => !(m.deletedForUsers ?? []).includes(meId));
    callback(messages);
  }, (error) => {
    if (onError) onError(error);
    if (error.code !== 'permission-denied') {
      console.error('DMMessages Snapshot error:', error);
    }
  });
}

export async function sendMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
  replyTo?: ReplyPreview | null,
  forwarded = false,
  attachments: any[] | null = null
): Promise<string> {
  const batch = writeBatch(db);
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  batch.set(messageRef, {
    text,
    senderId: meId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    attachments,
    reactions: {},
    replyTo: replyTo ?? null,
    deletedForUsers: [],
    forwarded,
    status: 'sent',
  });
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (convSnap.exists()) {
    const convData = convSnap.data();
    const otherUserId = (convData.participants as string[])?.find(id => id !== meId);
    if (otherUserId) {
      batch.update(convRef, {
        lastMessageAt: serverTimestamp(),
        lastMessage: text.substring(0, 100),
        [`unreadCount.${otherUserId}`]: (convData.unreadCount?.[otherUserId] ?? 0) + 1,
        deletedBy: [],
      });
    }
  }
  await batch.commit();
  return messageRef.id;
}

export async function sendAudioMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  audioUrl: string,
  duration: number,
  forwarded = false,
  replyTo?: ReplyPreview | null
): Promise<string> {
  const batch = writeBatch(db);
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  batch.set(messageRef, {
    text: '',
    senderId: meId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    attachments: [{ url: audioUrl, type: 'audio', name: 'audio.webm', size: 0, duration }],
    reactions: {},
    replyTo: replyTo ?? null,
    deletedForUsers: [],
    forwarded,
    status: 'sent',
  });
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (convSnap.exists()) {
    const convData = convSnap.data();
    const otherUserId = (convData.participants as string[])?.find(id => id !== meId);
    if (otherUserId) {
      batch.update(convRef, {
        lastMessageAt: serverTimestamp(),
        lastMessage: '🎤 Mensaje de voz',
        [`unreadCount.${otherUserId}`]: (convData.unreadCount?.[otherUserId] ?? 0) + 1,
        deletedBy: [],
      });
    }
  }
  await batch.commit();
  return messageRef.id;
}

export async function sendPoll(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  poll: { question: string; options: string[]; multipleAnswers: boolean }
): Promise<string> {
  const batch = writeBatch(db);
  const messageRef = doc(collection(db, 'conversations', conversationId, 'messages'));
  const pollData = {
    question: poll.question,
    options: poll.options.map((opt, i) => ({ id: i.toString(), text: opt, votes: [] })),
    multipleAnswers: poll.multipleAnswers,
    closed: false,
    totalVotes: 0,
  };
  batch.set(messageRef, {
    text: '',
    senderId: meId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    edited: false,
    editedAt: null,
    attachments: null,
    poll: pollData,
    reactions: {},
    replyTo: null,
    deletedForUsers: [],
    forwarded: false,
    status: 'sent',
  });
  const convRef = doc(db, 'conversations', conversationId);
  const convSnap = await getDoc(convRef);
  if (convSnap.exists()) {
    const convData = convSnap.data();
    const otherUserId = (convData.participants as string[])?.find(id => id !== meId);
    if (otherUserId) {
      batch.update(convRef, {
        lastMessageAt: serverTimestamp(),
        lastMessage: '📊 Encuesta: ' + poll.question,
        [`unreadCount.${otherUserId}`]: (convData.unreadCount?.[otherUserId] ?? 0) + 1,
      });
    }
  }
  await batch.commit();
  return messageRef.id;
}

export async function votePoll(
  conversationId: string,
  messageId: string,
  optionId: string,
  meId: string
): Promise<void> {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;

  const data = snap.data();
  if (!data.poll) return;

  const poll = data.poll;
  const newOptions = poll.options.map((opt: any, idx: number) => {
    const isThisOption = opt.id === optionId || idx.toString() === optionId;
    let votes = opt.votes || [];

    if (poll.multipleAnswers) {
      if (isThisOption) {
        if (votes.includes(meId)) {
          votes = votes.filter((v: string) => v !== meId);
        } else {
          votes = [...votes, meId];
        }
      }
    } else {
      if (isThisOption) {
        if (votes.includes(meId)) {
          votes = votes.filter((v: string) => v !== meId);
        } else {
          votes = [...votes, meId];
        }
      } else {
        votes = votes.filter((v: string) => v !== meId);
      }
    }
    return { ...opt, votes };
  });

  const totalVotes = newOptions.reduce((sum: number, o: any) => sum + (o.votes?.length ?? 0), 0);

  await updateDoc(messageRef, {
    'poll.options': newOptions,
    'poll.totalVotes': totalVotes,
  });
}

export async function markAsRead(conversationId: string, meId: string): Promise<void> {
  await updateDoc(doc(db, 'conversations', conversationId), { [`unreadCount.${meId}`]: 0 });
}

export async function deleteConversation(conversationId: string, meId: string): Promise<void> {
  const convRef = doc(db, 'conversations', conversationId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;
  const current: string[] = snap.data().deletedBy || [];
  if (!current.includes(meId)) {
    await updateDoc(convRef, { deletedBy: [...current, meId] });
  }
}

export async function deleteMessageForMe(
  conversationId: string,
  messageId: string,
  meId: string
): Promise<void> {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;
  const current: string[] = snap.data().deletedForUsers ?? [];
  if (!current.includes(meId)) {
    await updateDoc(messageRef, { deletedForUsers: [...current, meId] });
  }
}

export async function deleteMessageForAll(conversationId: string, messageId: string): Promise<void> {
  await deleteDoc(doc(db, 'conversations', conversationId, 'messages', messageId));
}

export async function toggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  meId: string
): Promise<void> {
  const messageRef = doc(db, 'conversations', conversationId, 'messages', messageId);
  const snap = await getDoc(messageRef);
  if (!snap.exists()) return;
  const reactions: Record<string, string[]> = { ...(snap.data().reactions ?? {}) };
  const users = reactions[emoji] ?? [];
  if (users.includes(meId)) {
    const updated = users.filter(id => id !== meId);
    if (updated.length === 0) delete reactions[emoji];
    else reactions[emoji] = updated;
  } else {
    reactions[emoji] = [...users, meId];
  }
  await updateDoc(messageRef, { reactions });
}

export function subscribeToConversations(
  meId: string,
  callback: (conversations: DMConversation[]) => void
): () => void {
  const q = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', meId),
    orderBy('lastMessageAt', 'desc')
  );

  return onSnapshot(q, async snapshot => {
    const rawConvs = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter((c: any) => !(c.deletedBy || []).includes(meId));

    const convs: DMConversation[] = await Promise.all(
      rawConvs.map(async (conv: any) => {
        const participants = conv.participants as string[];
        const participantId = participants?.find(id => id !== meId) || '';

        let name = 'Usuario';
        let photo: string | null = null;
        let role: any = 'student';

        if (participantId) {
          try {
            const uSnap = await getDoc(doc(db, 'users', participantId));
            if (uSnap.exists()) {
              const u = uSnap.data();
              name = u.displayName || 'Usuario';
              photo = u.photoURL || null;
              role = u.role || 'student';
            } else {
              name = 'Usuario eliminado';
            }
          } catch { }
        }

        return {
          id: conv.id,
          participantId,
          participantName: name,
          participantPhoto: photo,
          participantRole: role,
          lastMessage: conv.lastMessage || '',
          lastMessageAt: tsToISO(conv.lastMessageAt),
          lastMessageSenderId: '',
          unreadCount: conv.unreadCount?.[meId] ?? 0,
          isOnline: false,
          isFriend: false,
          isBestFriend: false,
          friendRequestStatus: 'none',
          contactSettings: {
            mute: 'off',
            mutedUntil: null,
            saveToPhotos: 'default',
            alertTone: 'default',
          },
        } as DMConversation;
      })
    );

    callback(convs);
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('DMList Snapshot error:', error);
    }
  });
}
