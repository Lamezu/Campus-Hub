import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch,
  arrayUnion,
  arrayRemove,
  Timestamp,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  fromUserName: string;
  fromUserPhoto: string | null;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  rejectedAt?: Timestamp;
}

export interface Friendship {
  userId: string;
  friendId: string;
  createdAt: Timestamp;
}

export interface FriendUser {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: string;
  department: string | null;
  friendsSince: Timestamp;
}

export const sendFriendRequest = async (
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  fromUserPhoto: string | null = null
): Promise<string> => {
  const existing = await getFriendRequest(fromUserId, toUserId);
  if (existing) throw new Error('Friend request already exists');

  const friends = await areFriends(fromUserId, toUserId);
  if (friends) throw new Error('Users are already friends');

  const requestRef = doc(collection(db, 'friendRequests'));
  await setDoc(requestRef, {
    fromUserId,
    toUserId,
    fromUserName,
    fromUserPhoto,
    status: 'pending',
    createdAt: serverTimestamp()
  });

  return requestRef.id;
};

export const getFriendRequest = async (
  userId1: string,
  userId2: string
): Promise<FriendRequest | null> => {
  const q1 = query(
    collection(db, 'friendRequests'),
    where('fromUserId', '==', userId1),
    where('toUserId', '==', userId2),
    where('status', '==', 'pending')
  );

  const q2 = query(
    collection(db, 'friendRequests'),
    where('fromUserId', '==', userId2),
    where('toUserId', '==', userId1),
    where('status', '==', 'pending')
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  if (!snap1.empty) return { id: snap1.docs[0].id, ...snap1.docs[0].data() } as FriendRequest;
  if (!snap2.empty) return { id: snap2.docs[0].id, ...snap2.docs[0].data() } as FriendRequest;

  return null;
};

export const getReceivedRequests = async (userId: string): Promise<FriendRequest[]> => {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
};

export const getSentRequests = async (userId: string): Promise<FriendRequest[]> => {
  const q = query(
    collection(db, 'friendRequests'),
    where('fromUserId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
};

export const acceptFriendRequest = async (requestId: string): Promise<void> => {
  const batch = writeBatch(db);

  const requestRef = doc(db, 'friendRequests', requestId);
  const requestSnap = await getDoc(requestRef);

  if (!requestSnap.exists()) throw new Error('Friend request not found');

  const data = requestSnap.data();

  batch.update(requestRef, {
    status: 'accepted',
    acceptedAt: serverTimestamp()
  });

  const friendship1Ref = doc(collection(db, 'friendships'));
  batch.set(friendship1Ref, {
    userId: data.fromUserId,
    friendId: data.toUserId,
    createdAt: serverTimestamp()
  });

  const friendship2Ref = doc(collection(db, 'friendships'));
  batch.set(friendship2Ref, {
    userId: data.toUserId,
    friendId: data.fromUserId,
    createdAt: serverTimestamp()
  });

  await batch.commit();
};

export const rejectFriendRequest = async (requestId: string): Promise<void> => {
  const requestRef = doc(db, 'friendRequests', requestId);
  await updateDoc(requestRef, {
    status: 'rejected',
    rejectedAt: serverTimestamp()
  });
};

export const cancelFriendRequest = async (requestId: string): Promise<void> => {
  const requestRef = doc(db, 'friendRequests', requestId);
  await deleteDoc(requestRef);
};

export const areFriends = async (userId1: string, userId2: string): Promise<boolean> => {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId1),
    where('friendId', '==', userId2)
  );

  const snapshot = await getDocs(q);
  return !snapshot.empty;
};

export const getFriends = async (userId: string): Promise<FriendUser[]> => {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId)
  );

  const snapshot = await getDocs(q);
  const friendships = snapshot.docs.map(d => d.data() as Friendship);

  const friendsData = await Promise.all(
    friendships.map(async (friendship) => {
      const userRef = doc(db, 'users', friendship.friendId);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists() && !userSnap.data()?.deleted) {
        return {
          id: friendship.friendId,
          ...userSnap.data(),
          friendsSince: friendship.createdAt
        } as FriendUser;
      }
      return null;
    })
  );

  return friendsData.filter((f): f is FriendUser => f !== null);
};

export const removeFriend = async (userId: string, friendId: string): Promise<void> => {
  const batch = writeBatch(db);

  const q1 = query(
    collection(db, 'friendships'),
    where('userId', '==', userId),
    where('friendId', '==', friendId)
  );

  const q2 = query(
    collection(db, 'friendships'),
    where('userId', '==', friendId),
    where('friendId', '==', userId)
  );

  const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

  snap1.docs.forEach(d => batch.delete(d.ref));
  snap2.docs.forEach(d => batch.delete(d.ref));

  await batch.commit();
};

export const getBestFriendIds = async (userId: string): Promise<string[]> => {
  const snap = await getDoc(doc(db, 'users', userId));
  if (!snap.exists()) return [];
  return (snap.data().bestFriends as string[]) || [];
};

export const toggleBestFriend = async (userId: string, friendId: string, markAs: boolean): Promise<void> => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    bestFriends: markAs ? arrayUnion(friendId) : arrayRemove(friendId)
  });
};

export const subscribeToReceivedRequests = (
  userId: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending')
  );

  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest)));
  });
};

export type UserSearchResult = {
  user: { id: string; displayName: string; photoURL: string | null; role: string };
  status: 'friend' | 'sent' | 'received' | 'none';
  requestId?: string;
};

export const searchUsers = async (
  searchQuery: string,
  currentUserId: string,
  roleFilter?: string
): Promise<UserSearchResult[]> => {
  if (!searchQuery.trim() && !roleFilter) return [];

  const constraints: any[] = [limit(30)];

  if (searchQuery.trim()) {
    constraints.push(where('displayName', '>=', searchQuery));
    constraints.push(where('displayName', '<=', searchQuery + '\uf8ff'));
  }

  if (roleFilter && roleFilter !== 'all') constraints.push(where('role', '==', roleFilter));

  const q = query(collection(db, 'users'), ...constraints);

  const snapshot = await getDocs(q);
  const users = snapshot.docs
    .map(d => ({
      id: d.id,
      displayName: d.data().displayName || '',
      photoURL: d.data().photoURL || null,
      role: d.data().role || '',
      deleted: d.data().deleted || false
    }))
    .filter(u => u.id !== currentUserId && !u.deleted);

  const results = await Promise.all(
    users.map(async (u) => {
      const isFriend = await areFriends(currentUserId, u.id);
      if (isFriend) return { user: u, status: 'friend' as const };

      const req = await getFriendRequest(currentUserId, u.id);
      if (req) {
        return {
          user: u,
          status: (req.fromUserId === currentUserId ? 'sent' : 'received') as 'sent' | 'received',
          requestId: req.id
        };
      }

      return { user: u, status: 'none' as const };
    })
  );

  return results;
};

export const subscribeToFriends = (
  userId: string,
  callback: (friends: FriendUser[]) => void
): Unsubscribe => {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, async (snapshot) => {
    const friendships = snapshot.docs.map(d => d.data() as Friendship);

    const friendsData = await Promise.all(
      friendships.map(async (friendship) => {
        const userRef = doc(db, 'users', friendship.friendId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists() && !userSnap.data()?.deleted) {
          return {
            id: friendship.friendId,
            ...userSnap.data(),
            friendsSince: friendship.createdAt
          } as FriendUser;
        }
        return null;
      })
    );

    callback(friendsData.filter((f): f is FriendUser => f !== null));
  });
};

export const toggleBlockUser = async (currentUserId: string, targetUserId: string, isBlocked: boolean) => {
  const userRef = doc(db, 'users', currentUserId);
  await updateDoc(userRef, {
    blockedUsers: isBlocked ? arrayUnion(targetUserId) : arrayRemove(targetUserId)
  });
};

export const checkIfBlocked = async (currentUserId: string, targetUserId: string) => {
  const userDoc = await getDoc(doc(db, 'users', currentUserId));
  return userDoc.data()?.blockedUsers?.includes(targetUserId) || false;
};
