import { getMessageService as sharedGetMessageService } from '../shared';

export async function sendMessage(channelId: string, text: string, senderId: string, senderName: string, senderPhoto: string | null = null, attachments: any[] | null = null): Promise<string> {
  return (sharedGetMessageService() as any).sendMessage(channelId, text, senderId, senderName, senderPhoto, attachments);
}

export async function editMessage(channelId: string, messageId: string, newText: string): Promise<void> {
  await sharedGetMessageService().editMessage(channelId, messageId, newText);
}

export async function deleteMessage(channelId: string, messageId: string): Promise<void> {
  await sharedGetMessageService().deleteMessage(channelId, messageId);
}

export async function addReaction(channelId: string, messageId: string, emoji: string, userId: string): Promise<void> {
  await sharedGetMessageService().addReaction(channelId, messageId, emoji, userId);
}

export async function removeReaction(channelId: string, messageId: string, emoji: string, userId: string): Promise<void> {
  await sharedGetMessageService().removeReaction(channelId, messageId, emoji, userId);
}

export function subscribeToMessages(channelId: string, callback: (messages: any[]) => void): () => void {
  return (sharedGetMessageService() as any).onMessagesSnapshot(channelId, (messages: any[]) => {
    callback(messages);
  });
}

export async function updateLastRead(channelId: string, userId: string): Promise<void> {
  await (sharedGetMessageService() as any).updateLastRead(channelId, userId);
}
