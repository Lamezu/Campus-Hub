import { db } from '@/config/firebase';
import {
  collection, doc, addDoc, serverTimestamp, onSnapshot, query,
  where, orderBy, limit, updateDoc, increment, getDoc, writeBatch,
  arrayRemove, arrayUnion, deleteDoc, deleteField, setDoc, getDocs
} from 'firebase/firestore';
import type { GroupConversation, Message, MuteDuration } from '@/types';

export interface GroupSettings {
  isMuted: boolean;
  mute: MuteDuration;
  mutedUntil: number | null;
  alertTone?: string;
}

function lastMessagePreview(text: string, attachments: any[] | null | undefined): string {
  if (text?.trim()) return text.trim();
  const type = attachments?.[0]?.type;
  if (type === 'image') return '📷 Foto';
  if (type === 'audio') return '🎵 Audio';
  if (type === 'file') return '📎 Archivo';
  return '';
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
  const unreadCount = Object.fromEntries(members.map(m => [m.id, 0]));
  const trimmedName = groupName.trim();

  const ref = await addDoc(collection(db, 'groupConversations'), {
    name: trimmedName,
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
    unreadCount,
  });

  const creator = members.find(m => m.id === creatorId);
  const creatorFirstName = (creator?.name ?? 'Alguien').split(' ')[0];
  const displayName = trimmedName || members.filter(m => m.id !== creatorId).map(m => m.name.split(' ')[0]).slice(0, 3).join(', ');

  await Promise.all(
    memberIds
      .filter(uid => uid !== creatorId)
      .map(uid =>
        addDoc(collection(db, 'notifications', uid, 'items'), {
          category: 'dm',
          title: displayName || 'Nuevo grupo',
          body: `${creatorFirstName} te añadió al grupo`,
          createdAt: serverTimestamp(),
          read: false,
          meta: { groupId: ref.id, type: 'added_to_group', adderName: creatorFirstName },
        }).catch(() => {})
      )
  );

  return ref.id;
}

export function subscribeToGroupConversations(
  userId: string,
  callback: (groups: GroupConversation[]) => void,
  onError?: (err: any) => void
): () => void {
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
        unreadCount: data.unreadCount?.[userId] ?? 0,
        isGroup: true,
      };
    });
    callback(groups);
  }, onError);
}

async function updateGroupAfterMessage(
  batch: any,
  groupRef: any,
  senderId: string,
  senderName: string,
  preview: string,
  members: string[]
) {
  const unreadUpdate: Record<string, any> = {};
  for (const uid of members) {
    if (uid !== senderId) {
      unreadUpdate[`unreadCount.${uid}`] = increment(1);
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

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
  attachments?: any[] | null,
  replyTo?: any | null
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
    deletedForUsers: [],
    type: 'text',
  });

  await updateGroupAfterMessage(batch, groupRef, senderId, senderName, lastMessagePreview(text, attachments), members);
  await batch.commit();
  return msgRef.id;
}

export async function sendGroupAudio(
  groupId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  audioUrl: string,
  duration: number
): Promise<string> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const groupSnap = await getDoc(groupRef);
  const members: string[] = groupSnap.data()?.members ?? [];

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'groupConversations', groupId, 'messages'));
  batch.set(msgRef, {
    text: '',
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    attachments: [{ type: 'audio', url: audioUrl, duration }],
    reactions: {},
    type: 'audio',
    deletedForUsers: [],
  });

  await updateGroupAfterMessage(batch, groupRef, senderId, senderName, '🎵 Audio', members);
  await batch.commit();
  return msgRef.id;
}

export async function sendGroupMedia(
  groupId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  url: string,
  type: 'image' | 'video'
): Promise<string> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const groupSnap = await getDoc(groupRef);
  const members: string[] = groupSnap.data()?.members ?? [];

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'groupConversations', groupId, 'messages'));
  batch.set(msgRef, {
    text: '',
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    attachments: [{ type, url }],
    reactions: {},
    type: type,
    deletedForUsers: [],
  });

  await updateGroupAfterMessage(batch, groupRef, senderId, senderName, type === 'image' ? '📷 Foto' : '🎥 Vídeo', members);
  await batch.commit();
  return msgRef.id;
}

export async function sendGroupPoll(
  groupId: string,
  senderId: string,
  senderName: string,
  senderPhoto: string | null,
  pollData: { question: string; options: string[]; multipleAnswers: boolean }
): Promise<string> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const groupSnap = await getDoc(groupRef);
  const members: string[] = groupSnap.data()?.members ?? [];

  const batch = writeBatch(db);
  const msgRef = doc(collection(db, 'groupConversations', groupId, 'messages'));
  batch.set(msgRef, {
    text: pollData.question,
    senderId,
    senderName,
    senderPhoto,
    createdAt: serverTimestamp(),
    poll: {
      question: pollData.question,
      options: pollData.options.map((text, idx) => ({ id: idx.toString(), text, votes: [] })),
      multipleAnswers: pollData.multipleAnswers,
      closed: false,
      totalVotes: 0,
    },
    reactions: {},
    type: 'poll',
    deletedForUsers: [],
  });

  await updateGroupAfterMessage(batch, groupRef, senderId, senderName, `📊 Encuesta: ${pollData.question}`, members);
  await batch.commit();
  return msgRef.id;
}

export function subscribeToGroupMessages(
  groupId: string,
  currentUserId: string,
  callback: (messages: Message[]) => void,
  onError?: (err: any) => void
): () => void {
  const q = query(
    collection(db, 'groupConversations', groupId, 'messages'),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, snap => {
    const messages: Message[] = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          text: data.text ?? '',
          senderId: data.senderId ?? '',
          senderName: data.senderName ?? '',
          senderPhoto: data.senderPhoto ?? null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() ?? new Date().toISOString(),
          edited: false,
          editedAt: null,
          attachments: data.attachments ?? null,
          poll: data.poll ?? null,
          reactions: data.reactions ?? {},
          replyTo: data.replyTo ?? null,
          deletedForUsers: data.deletedForUsers ?? [],
          type: data.type ?? 'text',
        } as Message;
      })
      .filter(m => !m.deletedForUsers?.includes(currentUserId));
    callback(messages);
  }, onError);
}

export async function markGroupAsRead(groupId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId), {
    [`unreadCount.${userId}`]: 0,
  });
}

export async function getGroupInfo(groupId: string): Promise<GroupConversation | null> {
  const snap = await getDoc(doc(db, 'groupConversations', groupId));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
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
  };
}

export function subscribeToGroupInfo(
  groupId: string,
  callback: (group: GroupConversation | null) => void
): () => void {
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
    [`unreadCount.${userId}`]: deleteField(),
  };

  if (data.createdBy === userId) {
    const nextAdmin = (data.members as string[]).find((id: string) => id !== userId);
    if (nextAdmin) updates.createdBy = nextAdmin;
  }

  await updateDoc(groupRef, updates);
}

export async function addMembersToGroup(
  groupId: string,
  newMembers: { id: string; name: string; photo: string | null }[],
  addedByName: string
): Promise<void> {
  const groupRef = doc(db, 'groupConversations', groupId);
  const updates: Record<string, any> = {
    members: arrayUnion(...newMembers.map(m => m.id)),
  };
  for (const m of newMembers) {
    updates[`memberNames.${m.id}`] = m.name;
    updates[`memberPhotos.${m.id}`] = m.photo ?? null;
    updates[`unreadCount.${m.id}`] = 0;
  }
  await updateDoc(groupRef, updates);

  const groupSnap = await getDoc(groupRef);
  const groupName = groupSnap.data()?.name ?? 'el grupo';
  const adderFirst = addedByName.split(' ')[0];

  await Promise.all(
    newMembers.map(m =>
      addDoc(collection(db, 'notifications', m.id, 'items'), {
        category: 'dm',
        title: groupName || 'Grupo',
        body: `${adderFirst} te añadió al grupo`,
        createdAt: serverTimestamp(),
        read: false,
        meta: { groupId, type: 'added_to_group', adderName: adderFirst },
      }).catch(() => {})
    )
  );
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

export async function voteGroupPoll(
  groupId: string,
  messageId: string,
  optionId: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, 'groupConversations', groupId, 'messages', messageId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const poll = snap.data().poll;
  if (!poll) return;

  const newOptions = poll.options.map((opt: any, idx: number) => {
    const isThisOption = opt.id === optionId || idx.toString() === optionId;
    let votes: string[] = opt.votes ?? [];
    if (poll.multipleAnswers) {
      if (isThisOption) {
        votes = votes.includes(userId) ? votes.filter((v: string) => v !== userId) : [...votes, userId];
      }
    } else {
      if (isThisOption) {
        votes = votes.includes(userId) ? votes.filter((v: string) => v !== userId) : [...votes, userId];
      } else {
        votes = votes.filter((v: string) => v !== userId);
      }
    }
    return { ...opt, votes };
  });

  const totalVotes = newOptions.reduce((sum: number, o: any) => sum + (o.votes?.length ?? 0), 0);
  await updateDoc(msgRef, { 'poll.options': newOptions, 'poll.totalVotes': totalVotes });
}

export async function updateGroupInfo(
  groupId: string,
  name: string,
  photoURL: string | null
): Promise<void> {
  await updateDoc(doc(db, 'groupConversations', groupId), { name: name.trim(), photoURL });
}

export async function clearGroupMessagesForUser(groupId: string, userId: string): Promise<void> {
  const messagesRef = collection(db, 'groupConversations', groupId, 'messages');
  const snap = await getDocs(query(messagesRef, limit(300))); // Razonable batch
  if (snap.empty) return;
  const batch = writeBatch(db);
  snap.docs.forEach(d => batch.update(d.ref, { deletedForUsers: arrayUnion(userId) }));
  await batch.commit();
}

export async function getGroupSettings(userId: string, groupId: string): Promise<GroupSettings> {
  try {
    const snap = await getDoc(doc(db, 'users', userId, 'groupSettings', groupId));
    if (!snap.exists()) return { isMuted: false, mute: 'off', mutedUntil: null, alertTone: 'Predeterminado' };
    const data = snap.data();
    return { 
      isMuted: !!data.isMuted,
      mute: data.mute || 'off',
      mutedUntil: data.mutedUntil || null,
      alertTone: data.alertTone || 'Predeterminado'
    };
  } catch {
    return { isMuted: false, mute: 'off', mutedUntil: null, alertTone: 'Predeterminado' };
  }
}

export async function updateGroupSettings(userId: string, groupId: string, settings: Partial<GroupSettings>): Promise<void> {
  await setDoc(doc(db, 'users', userId, 'groupSettings', groupId), {
    ...settings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
