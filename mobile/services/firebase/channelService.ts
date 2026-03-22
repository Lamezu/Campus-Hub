import { getChannelService as sharedGetChannelService } from '../shared';

export async function createChannel(channelData: any, creatorId: string): Promise<string> {
  return sharedGetChannelService().createChannel(channelData, creatorId);
}

export async function getChannel(channelId: string): Promise<any> {
  return sharedGetChannelService().getChannel(channelId);
}

export async function getChannels(category: string | null = null, limitCount = 20): Promise<any[]> {
  return sharedGetChannelService().getChannels(category, limitCount);
}

export async function updateChannel(channelId: string, updates: any): Promise<void> {
  await sharedGetChannelService().updateChannel(channelId, updates);
}

export async function deleteChannel(channelId: string): Promise<void> {
  await sharedGetChannelService().deleteChannel(channelId);
}

export async function addChannelMember(channelId: string, userId: string, role = 'member'): Promise<void> {
  await sharedGetChannelService().addChannelMember(channelId, userId, role);
}

export async function removeChannelMember(channelId: string, userId: string): Promise<void> {
  await sharedGetChannelService().removeChannelMember(channelId, userId);
}

export async function getChannelMembers(channelId: string): Promise<any[]> {
  return sharedGetChannelService().getChannelMembers(channelId);
}

export function subscribeToChannels(category: string | null, callback: (channels: any[]) => void): () => void {
  return (sharedGetChannelService() as any).subscribeToChannels(category, callback);
}

export function subscribeToChannel(channelId: string, callback: (channel: any) => void): () => void {
  return sharedGetChannelService().subscribeToChannel(channelId, callback);
}

export function subscribeToChannelMembers(channelId: string, callback: (members: any[]) => void): () => void {
  return sharedGetChannelService().subscribeToChannelMembers(channelId, callback);
}
