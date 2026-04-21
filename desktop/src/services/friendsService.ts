import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, writeBatch, Timestamp,
  limit, arrayUnion, arrayRemove
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { notificationService } from './notificationService';
import type { FriendRequest, FriendUser, UserSearchResult, User } from '@/types';

function tsToISO(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

function getRequestId(id1: string, id2: string): string {
  return [id1, id2].sort().join('_');
}

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  fromUserPhoto: string | null = null
): Promise<string> {
  const requestId = getRequestId(fromUserId, toUserId);
  const requestRef = doc(db, 'friendRequests', requestId);
  try {
    const isFriend = await areFriends(fromUserId, toUserId);
    if (isFriend) throw new Error('Ya sois amigos');
  } catch (e: any) {
    if (e.code !== 'permission-denied' && !e.message.includes('Ya sois amigos')) throw e;
    if (e.message.includes('Ya sois amigos')) throw e;
  }
  await setDoc(requestRef, {
    fromUserId,
    toUserId,
    fromUserName,
    fromUserPhoto,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return requestId;
}

export async function getFriendRequest(
  userId1: string,
  userId2: string
): Promise<(FriendRequest & { id: string }) | null> {
  const requestId = getRequestId(userId1, userId2);
  const requestRef = doc(db, 'friendRequests', requestId);
  try {
    const snap = await getDoc(requestRef);
    if (snap.exists() && snap.data().status === 'pending') {
      const data = snap.data();
      return {
        id: snap.id,
        fromUserId: data.fromUserId as string,
        fromUserName: data.fromUserName as string,
        fromUserPhoto: (data.fromUserPhoto as string | null) ?? null,
        toUserId: data.toUserId as string,
        status: data.status as 'pending' | 'accepted' | 'rejected',
        createdAt: tsToISO(data.createdAt),
      };
    }
  } catch (e: any) {
    if (e.code !== 'permission-denied') console.error(e);
  }
  return null;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'friendRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('Solicitud no encontrada');
  const data = requestSnap.data();
  const batch = writeBatch(db);
  batch.update(requestRef, { status: 'accepted', acceptedAt: serverTimestamp() });
  
  // Each user's local syncFriendships listener will handle creating the friendship docs 
  // in their own subcollections, avoiding permission errors.
  
  await batch.commit();
  const accepterName = auth.currentUser?.displayName ?? 'Alguien';
  notificationService.addNotification(data.fromUserId, {
    category: 'friend',
    title: 'Solicitud de amistad aceptada',
    body: `${accepterName} aceptó tu solicitud de amistad`,
    meta: { fromUserId: data.toUserId, fromUserName: accepterName, type: 'accepted' },
  }).catch(() => { });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  try {
    const docRef = doc(db, 'users', userId1, 'friends', userId2);
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (e) {
    try {
      const fId = `${userId1}_${userId2}`;
      const rootSnap = await getDoc(doc(db, 'friendships', fId));
      return rootSnap.exists();
    } catch {
      return false;
    }
  }
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const paths = [
    doc(db, 'friendships', `${userId}_${friendId}`),
    doc(db, 'friendships', `${friendId}_${userId}`),
    doc(db, 'users', userId, 'friends', friendId),
    doc(db, 'users', friendId, 'friends', userId),
    doc(db, 'friendRequests', [userId, friendId].sort().join('_'))
  ];
  await Promise.allSettled(paths.map(ref => deleteDoc(ref)));
}

export function subscribeToReceivedRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );
  return onSnapshot(q, snap => {
    const sorted = snap.docs
      .map(d => {
        const data = d.data();
        return {
          id: d.id,
          fromUserId: data.fromUserId as string,
          fromUserName: data.fromUserName as string,
          fromUserPhoto: (data.fromUserPhoto as string | null) ?? null,
          toUserId: data.toUserId as string,
          status: data.status as any,
          createdAt: tsToISO(data.createdAt),
        } as FriendRequest;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    callback(sorted);
  });
}

export function subscribeToFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  const q = query(collection(db, 'users', userId, 'friends'));
  return onSnapshot(q, async (snapshot) => {
    const friendsData = await Promise.all(
      snapshot.docs.map(async (fDoc) => {
        try {
          const friendId = fDoc.id;
          const userSnap = await getDoc(doc(db, 'users', friendId));
          if (!userSnap.exists()) return null;
          return {
            uid: userSnap.id,
            ...userSnap.data(),
            ...fDoc.data(),
            friendsSince: fDoc.data().createdAt
          };
        } catch (e) {
          return null;
        }
      })
    );
    const sorted = friendsData.filter(Boolean).sort((a: any, b: any) => {
      const t1 = a.friendsSince?.toMillis ? a.friendsSince.toMillis() : 0;
      const t2 = b.friendsSince?.toMillis ? b.friendsSince.toMillis() : 0;
      return t2 - t1;
    });
    callback(sorted);
  });
}

export function subscribeToBestFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  const q = query(
    collection(db, 'users', userId, 'friends'),
    where('isBestFriend', '==', true)
  );
  return onSnapshot(q, async (snapshot) => {
    const friendsData = await Promise.all(
      snapshot.docs.map(async (fDoc) => {
        try {
          const friendId = fDoc.id;
          const userSnap = await getDoc(doc(db, 'users', friendId));
          if (!userSnap.exists()) return null;
          return {
            uid: userSnap.id,
            ...userSnap.data(),
            ...fDoc.data(),
            friendsSince: fDoc.data().createdAt
          };
        } catch (e) {
          return null;
        }
      })
    );
    const sorted = friendsData.filter(Boolean).sort((a: any, b: any) => {
      const t1 = a.friendsSince?.toMillis ? a.friendsSince.toMillis() : 0;
      const t2 = b.friendsSince?.toMillis ? b.friendsSince.toMillis() : 0;
      return t2 - t1;
    });
    callback(sorted);
  });
}

export async function toggleBestFriend(userId: string, friendId: string, markAs?: boolean): Promise<boolean> {
  const docRef = doc(db, 'users', userId, 'friends', friendId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;
  const newValue = markAs !== undefined ? markAs : !(snap.data().isBestFriend ?? false);
  await updateDoc(docRef, { isBestFriend: newValue });
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    bestFriends: newValue ? arrayUnion(friendId) : arrayRemove(friendId)
  });
  return newValue;
}

export async function getBestFriendIds(userId: string): Promise<string[]> {
  const userSnap = await getDoc(doc(db, 'users', userId));
  if (!userSnap.exists()) return [];
  return userSnap.data().bestFriends ?? [];
}

export function subscribeToFriendshipStatus(
  userId1: string,
  userId2: string,
  callback: (status: 'none' | 'sent' | 'received' | 'friends') => void
): () => void {
  const friendRef = doc(db, 'users', userId1, 'friends', userId2);
  let isFriend = false;
  let isSent = false;
  let isReceived = false;
  const unsubFriend = onSnapshot(friendRef, (snap) => {
    isFriend = snap.exists();
    reportStatus();
  });
  const requestId = getRequestId(userId1, userId2);
  const requestRef = doc(db, 'friendRequests', requestId);
  const unsubRequest = onSnapshot(requestRef, (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data.status === 'pending') {
        if (data.fromUserId === userId1) {
          isSent = true;
          isReceived = false;
        } else {
          isSent = false;
          isReceived = true;
        }
      } else {
        isSent = false;
        isReceived = false;
      }
    } else {
      isSent = false;
      isReceived = false;
    }
    reportStatus();
  });
  function reportStatus() {
    if (isFriend) callback('friends');
    else if (isReceived) callback('received');
    else if (isSent) callback('sent');
    else callback('none');
  }
  return () => { unsubFriend(); unsubRequest(); };
}

export async function searchUsers(
  searchQuery: string,
  currentUserId: string,
  roleFilter?: string
): Promise<UserSearchResult[]> {
  const usersRef = collection(db, 'users');
  const q = query(
    usersRef,
    where('displayName', '>=', searchQuery),
    where('displayName', '<=', searchQuery + '\uf8ff'),
    limit(30)
  );
  const snap = await getDocs(q);
  const results = await Promise.all(
    snap.docs
      .filter(d => d.id !== currentUserId && !d.data().deleted)
      .map(async (d) => {
        const userData = d.data();
        if (roleFilter && userData.role !== roleFilter) return null;
        const [isFriend, request] = await Promise.all([
          areFriends(currentUserId, d.id),
          getFriendRequest(currentUserId, d.id)
        ]);
        let status: 'friend' | 'sent' | 'received' | 'none' = 'none';
        if (isFriend) status = 'friend';
        else if (request) {
          status = request.fromUserId === currentUserId ? 'sent' : 'received';
        }
        return {
          user: { id: d.id, displayName: userData.displayName, photoURL: userData.photoURL, role: userData.role },
          status,
          requestId: request?.id
        } as UserSearchResult;
      })
  );
  return results.filter((r: UserSearchResult | null): r is UserSearchResult => r !== null);
}

export async function cleanupAllFriendRequests(userId: string): Promise<void> {
  const q1 = query(collection(db, 'friendRequests'), where('fromUserId', '==', userId));
  const q2 = query(collection(db, 'friendRequests'), where('toUserId', '==', userId));
  const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const batch = writeBatch(db);
  s1.docs.forEach(d => batch.delete(d.ref));
  s2.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export async function toggleBlockUser(currentUserId: string, targetUserId: string, isBlocked: boolean): Promise<void> {
  const userRef = doc(db, 'users', currentUserId);
  await updateDoc(userRef, {
    blockedUsers: isBlocked ? arrayUnion(targetUserId) : arrayRemove(targetUserId)
  });
}

export async function checkIfBlocked(currentUserId: string, targetUserId: string): Promise<boolean> {
  const userSnap = await getDoc(doc(db, 'users', currentUserId));
  if (!userSnap.exists()) return false;
  const blockedUsers = userSnap.data().blockedUsers ?? [];
  return blockedUsers.includes(targetUserId);
}

export function syncFriendships(userId: string): () => void {
  const qSent = query(
    collection(db, 'friendRequests'),
    where('fromUserId', '==', userId),
    where('status', '==', 'accepted')
  );

  const qReceived = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'accepted')
  );

  const processRequests = async (snap: any) => {
    const batch = writeBatch(db);
    let needsCommit = false;

    for (const d of snap.docs) {
      const data = d.data();
      const friendId = data.fromUserId === userId ? data.toUserId : data.fromUserId;
      
      const friendRef = doc(db, 'users', userId, 'friends', friendId);
      const friendSnap = await getDoc(friendRef);
      
      if (!friendSnap.exists()) {
        batch.set(friendRef, { 
          createdAt: data.acceptedAt || serverTimestamp(), 
          status: 'accepted',
          friendId: friendId // Aseguramos que el ID esté en el documento
        });
        needsCommit = true;
      }
    }

    if (needsCommit) {
      await batch.commit().catch(err => console.error('Error syncing friendship:', err));
    }
  };

  const unsubSent = onSnapshot(qSent, processRequests);
  const unsubReceived = onSnapshot(qReceived, processRequests);

  return () => {
    unsubSent();
    unsubReceived();
  };
}