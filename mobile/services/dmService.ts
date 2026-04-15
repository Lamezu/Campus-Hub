import { incrementUserMessageCount } from './userService';
import type { DirectMessage, DMConversation, ReplyPreview, MuteDuration } from '@/types';
import { notificationService } from './notificationService';
import { getDirectMessageService as sharedGetDirectMessageService } from './shared';
import { getUser } from './userService';
import { getContactSettings, updateContactSettings } from './contactSettingsService';

function tsToISO(val: unknown): string {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export function getConversationId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}

export async function getOrCreateConversation(meId: string, participantId: string): Promise<string> {
  return sharedGetDirectMessageService().getOrCreateConversation(meId, participantId);
}

export function subscribeToMessages(
  conversationId: string,
  meId: string,
  callback: (messages: DirectMessage[]) => void,
  onError?: (error: any) => void
): () => void {
  return sharedGetDirectMessageService().onMessagesSnapshot(conversationId, (newMessages: any[]) => {
    const messages = newMessages
      .map(data => ({
        id: data.id,
        text: data.text ?? '',
        senderId: data.senderId ?? '',
        senderName: data.senderName ?? '',
        senderPhoto: data.senderPhoto ?? null,
        createdAt: tsToISO(data.createdAt),
        edited: data.edited ?? false,
        editedAt: data.editedAt ? tsToISO(data.editedAt) : null,
        attachments: data.attachments ?? null,
        reactions: data.reactions ?? {},
        replyTo: data.replyTo ?? null,
        deletedForUsers: data.deletedForUsers ?? [],
        forwarded: data.forwarded ?? false,
        status: data.read === true ? 'read' : (data.status ?? 'sent'),
        type: data.type ?? 'text',
        poll: data.poll ?? null,
      } as DirectMessage))
      .filter(m => !(m.deletedForUsers ?? []).includes(meId));
    callback(messages);
  }, onError);
}

export async function sendMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  text: string,
  replyTo?: ReplyPreview | null,
  forwarded = false,
  attachments: any[] | null = null,
  recipientId?: string
): Promise<string> {
  const messageId = await (sharedGetDirectMessageService() as any).sendMessage(conversationId, text, meId, senderName, senderPhoto, attachments, replyTo, forwarded);

  incrementUserMessageCount(meId);

  try {
    let otherUserId = recipientId;
    if (!otherUserId) {
      const conv = await (sharedGetDirectMessageService() as any).getConversation(conversationId);
      otherUserId = (conv?.participants as string[])?.find((id: string) => id !== meId);
    }
    if (otherUserId) {
      let isMuted = false;
      try {
        const recipientSettings = await getContactSettings(otherUserId, meId);
        const now = new Date();
        const mutedUntil = recipientSettings.mutedUntil ? new Date(recipientSettings.mutedUntil) : null;
        isMuted = recipientSettings.mute === 'always' ||
          (recipientSettings.mute !== 'off' && !!mutedUntil && mutedUntil > now);
      } catch {
        isMuted = false;
      }
      if (!isMuted) {
        let body = text;
        if (!body) {
          const type = attachments?.[0]?.type;
          if (type === 'image') body = '📷 Imagen';
          else if (type === 'audio') body = '🎵 Nota de voz';
          else if (type === 'video') body = '🎥 Vídeo';
          else if (type === 'file') body = `📄 Archivo: ${attachments?.[0]?.name || ''}`;
          else body = '📎 Adjunto';
        }
        await notificationService.addNotification(otherUserId, {
          category: 'dm',
          title: senderName,
          body,
          meta: { participantId: meId, conversationId }
        });
      }
    }
  } catch (error) {
    console.error('Error sending DM notification:', error);
  }

  return messageId;
}

export async function sendAudioMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  audioUrl: string,
  duration: number,
  forwarded = false,
  replyTo?: ReplyPreview | null,
  recipientId?: string
): Promise<void> {
  const attachments = [{ url: audioUrl, type: 'audio', name: 'audio.m4a', size: 0, duration }];
  await sendMessage(conversationId, meId, senderName, senderPhoto, '', replyTo, forwarded, attachments, recipientId);
}

export async function sendImageMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  url: string,
  width: number,
  height: number,
  replyTo?: ReplyPreview | null,
  recipientId?: string
): Promise<void> {
  const attachments = [{ url, type: 'image', name: 'image.jpg', size: 0, imageWidth: width, imageHeight: height }];
  await sendMessage(conversationId, meId, senderName, senderPhoto, '', replyTo, false, attachments, recipientId);
}

export async function sendFileMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  url: string,
  name: string,
  size: number,
  replyTo?: ReplyPreview | null,
  recipientId?: string
): Promise<void> {
  const attachments = [{ url, type: 'file', name, size }];
  await sendMessage(conversationId, meId, senderName, senderPhoto, '', replyTo, false, attachments, recipientId);
}

export async function sendPollMessage(
  conversationId: string,
  meId: string,
  senderName: string,
  senderPhoto: string | null,
  poll: { question: string; options: string[]; multipleAnswers: boolean },
  recipientId?: string
): Promise<void> {
  await (sharedGetDirectMessageService() as any).sendPollMessage(conversationId, meId, senderName, senderPhoto, poll);
  incrementUserMessageCount(meId);

  try {
    let otherUserId = recipientId;
    if (!otherUserId) {
      const conv = await (sharedGetDirectMessageService() as any).getConversation(conversationId);
      otherUserId = (conv?.participants as string[])?.find((id: string) => id !== meId);
    }
    if (otherUserId) {
      const recipientSettings = await getContactSettings(otherUserId, meId);
      const isMuted = recipientSettings.mute === 'always' || (recipientSettings.mute !== 'off' && recipientSettings.mutedUntil && new Date(recipientSettings.mutedUntil) > new Date());
      if (!isMuted) {
        await notificationService.addNotification(otherUserId, {
          category: 'dm',
          title: senderName,
          body: `🗳️ Encuesta: ${poll.question}`,
          meta: { participantId: meId, conversationId }
        });
      }
    }
  } catch (err) {
    console.error('Error notifying poll:', err);
  }
}

export async function markAsRead(conversationId: string, meId: string): Promise<void> {
  await (sharedGetDirectMessageService() as any).markAsRead(conversationId, meId);
}

export async function markAllDMsRead(meId: string): Promise<void> {
  const svc = sharedGetDirectMessageService() as any;
  const convs: any[] = await svc.getUserConversations(meId).catch(() => []);
  const unread = convs.filter(c => (c.unreadCount?.[meId] ?? 0) > 0);
  await Promise.all(unread.map(c => svc.markAsRead(c.id, meId).catch(() => {})));
}

export async function deleteMessageForMe(
  conversationId: string,
  messageId: string,
  meId: string
): Promise<void> {
  await (sharedGetDirectMessageService() as any).deleteMessageForMe(conversationId, messageId, meId);
}

export async function deleteMessageForAll(conversationId: string, messageId: string): Promise<void> {
  await (sharedGetDirectMessageService() as any).deleteMessageForAll(conversationId, messageId);
}

export async function toggleReaction(
  conversationId: string,
  messageId: string,
  emoji: string,
  meId: string
): Promise<void> {
  await (sharedGetDirectMessageService() as any).toggleReaction(conversationId, messageId, emoji, meId);
}

export async function votePoll(
  conversationId: string,
  messageId: string,
  optionId: string,
  meId: string
): Promise<void> {
  await (sharedGetDirectMessageService() as any).votePoll(conversationId, messageId, optionId, meId);
}

export async function fetchConversationsOnce(meId: string): Promise<DMConversation[]> {
  const rawConvs: any[] = await (sharedGetDirectMessageService() as any).getUserConversations(meId);
  const results = await Promise.all(
    rawConvs.map(async (conv: any) => {
      try {
        const participantId = (conv.participants as string[])?.find(id => id !== meId) || '';
        if (!participantId) return null;
        const user = await getUser(participantId);
        return {
          id: conv.id,
          participantId,
          participantName: user?.displayName || conv.participantName || 'Usuario',
          participantPhoto: user?.photoURL || conv.participantPhoto || null,
          participantRole: user?.role || conv.participantRole || 'student',
          lastMessage: conv.lastMessage || '',
          lastMessageAt: tsToISO(conv.lastMessageAt),
          lastMessageSenderId: conv.lastMessageSenderId || '',
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
      } catch {
        return null;
      }
    })
  );
  return results.filter(Boolean) as DMConversation[];
}

export function subscribeToConversations(
  meId: string,
  callback: (conversations: DMConversation[]) => void,
  onError?: (error: any) => void
): () => void {
  let latestSeq = 0;
  let cancelled = false;

  const firestoreUnsub = (sharedGetDirectMessageService() as any).subscribeToConversations(meId, async (rawConvs: any[]) => {
    if (cancelled) return;
    const seq = ++latestSeq;

    const results = await Promise.all(
      rawConvs.map(async (conv: any) => {
        try {
          const participantId = (conv.participants as string[])?.find(id => id !== meId) || '';
          if (!participantId) return null;
          const user = await getUser(participantId);
          return {
            id: conv.id,
            participantId,
            participantName: user?.displayName || conv.participantName || 'Usuario',
            participantPhoto: user?.photoURL || conv.participantPhoto || null,
            participantRole: user?.role || conv.participantRole || 'student',
            lastMessage: conv.lastMessage || '',
            lastMessageAt: tsToISO(conv.lastMessageAt),
            lastMessageSenderId: conv.lastMessageSenderId || '',
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
        } catch {
          return null;
        }
      })
    );

    if (cancelled || seq !== latestSeq) return;

    callback(results.filter(Boolean) as DMConversation[]);
  }, onError);

  return () => {
    cancelled = true;
    firestoreUnsub();
  };
}

export async function archiveConversation(meId: string, otherId: string, archived: boolean): Promise<void> {
  await updateContactSettings(meId, otherId, { archived });
}

export async function deleteConversation(meId: string, otherId: string): Promise<void> {
  await updateContactSettings(meId, otherId, { deleted: true } as any);
}

export async function muteConversation(meId: string, otherId: string, duration: MuteDuration): Promise<void> {
  const mutedUntil = duration === '8h'
    ? new Date(Date.now() + 8 * 3600 * 1000).toISOString()
    : duration === '1w'
    ? new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
    : null;
  await updateContactSettings(meId, otherId, { mute: duration, mutedUntil });
}
