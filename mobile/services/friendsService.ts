import type { FriendRequest } from '@/types';
import { getFriendsService as sharedGetFriendsService } from './shared';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

function tsToISO(val: unknown): string {
  if (val && typeof (val as any).toDate === 'function') return (val as any).toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  fromUserPhoto: string | null = null
): Promise<string> {
  return (sharedGetFriendsService() as any).sendFriendRequest(fromUserId, toUserId, fromUserName, fromUserPhoto);
}

export async function getFriendRequest(
  userId1: string,
  userId2: string
): Promise<(FriendRequest & { id: string }) | null> {
  const req = await sharedGetFriendsService().getFriendRequest(userId1, userId2) as any;
  if (!req) return null;
  return {
    ...req,
    createdAt: tsToISO(req.createdAt),
  } as (FriendRequest & { id: string });
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await (sharedGetFriendsService() as any).acceptFriendRequest(requestId);
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await (sharedGetFriendsService() as any).rejectFriendRequest(requestId);
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await (sharedGetFriendsService() as any).cancelFriendRequest(requestId);
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  return (sharedGetFriendsService() as any).areFriends(userId1, userId2);
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  await (sharedGetFriendsService() as any).removeFriend(userId, friendId);
}

export function subscribeToReceivedRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  return (sharedGetFriendsService() as any).subscribeToReceivedRequests(userId, (snap: any) => {
    callback(snap.map((data: any) => ({
      ...data,
      createdAt: tsToISO(data.createdAt),
    })));
  });
}

export function subscribeToFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  return (sharedGetFriendsService() as any).subscribeToFriends(userId, callback);
}

export function subscribeToBestFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  return (sharedGetFriendsService() as any).subscribeToBestFriends(userId, callback);
}

export async function toggleBestFriend(userId: string, friendId: string): Promise<boolean> {
  return (sharedGetFriendsService() as any).toggleBestFriend(userId, friendId);
}

export async function areFriendsBestFriends(userId: string, friendId: string): Promise<boolean> {
  const snap = await getDoc(doc(db, 'users', userId, 'friends', friendId));
  return snap.exists() ? (snap.data().isBestFriend === true) : false;
}
