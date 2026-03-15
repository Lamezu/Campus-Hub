import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, writeBatch, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { notificationService } from '@/services/notificationService';
import type { FriendRequest } from '@/types';

function tsToISO(val: unknown): string {
  if (val instanceof Timestamp) return val.toDate().toISOString();
  if (typeof val === 'string') return val;
  return new Date().toISOString();
}

export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  fromUserName: string,
  fromUserPhoto: string | null = null
): Promise<string> {
  const existing = await getFriendRequest(fromUserId, toUserId);
  if (existing) throw new Error('La solicitud ya existe');

  const alreadyFriends = await areFriends(fromUserId, toUserId);
  if (alreadyFriends) throw new Error('Ya sois amigos');

  const requestRef = doc(collection(db, 'friendRequests'));
  await setDoc(requestRef, {
    fromUserId,
    toUserId,
    fromUserName,
    fromUserPhoto,
    status: 'pending',
    createdAt: serverTimestamp(),
  });
  return requestRef.id;
}

export async function getFriendRequest(
  userId1: string,
  userId2: string
): Promise<(FriendRequest & { id: string }) | null> {
  const [snap1, snap2] = await Promise.all([
    getDocs(query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', userId1),
      where('toUserId', '==', userId2),
      where('status', '==', 'pending')
    )),
    getDocs(query(
      collection(db, 'friendRequests'),
      where('fromUserId', '==', userId2),
      where('toUserId', '==', userId1),
      where('status', '==', 'pending')
    )),
  ]);

  const toRequest = (data: Record<string, unknown>, id: string): FriendRequest & { id: string } => ({
    id,
    fromUserId: data.fromUserId as string,
    fromUserName: data.fromUserName as string,
    fromUserPhoto: (data.fromUserPhoto as string | null) ?? null,
    toUserId: data.toUserId as string,
    status: data.status as 'pending' | 'accepted' | 'rejected',
    createdAt: tsToISO(data.createdAt),
  });

  if (!snap1.empty) return toRequest(snap1.docs[0].data(), snap1.docs[0].id);
  if (!snap2.empty) return toRequest(snap2.docs[0].data(), snap2.docs[0].id);
  return null;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const requestRef = doc(db, 'friendRequests', requestId);
  const requestSnap = await getDoc(requestRef);
  if (!requestSnap.exists()) throw new Error('Solicitud no encontrada');

  const data = requestSnap.data();
  const batch = writeBatch(db);
  batch.update(requestRef, { status: 'accepted', acceptedAt: serverTimestamp() });

  const f1 = doc(collection(db, 'friendships'));
  batch.set(f1, { userId: data.fromUserId, friendId: data.toUserId, createdAt: serverTimestamp() });

  const f2 = doc(collection(db, 'friendships'));
  batch.set(f2, { userId: data.toUserId, friendId: data.fromUserId, createdAt: serverTimestamp() });

  await batch.commit();

  // Notify the requester that their request was accepted
  const accepterName = auth.currentUser?.displayName ?? 'Alguien';
  notificationService.addNotification(data.fromUserId, {
    category: 'friend',
    title: 'Solicitud de amistad aceptada',
    body: `${accepterName} aceptó tu solicitud de amistad`,
    meta: { fromUserId: data.toUserId },
  }).catch(() => {});
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));
}

export async function areFriends(userId1: string, userId2: string): Promise<boolean> {
  const snap = await getDocs(query(
    collection(db, 'friendships'),
    where('userId', '==', userId1),
    where('friendId', '==', userId2)
  ));
  return !snap.empty;
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const [snap1, snap2] = await Promise.all([
    getDocs(query(collection(db, 'friendships'), where('userId', '==', userId), where('friendId', '==', friendId))),
    getDocs(query(collection(db, 'friendships'), where('userId', '==', friendId), where('friendId', '==', userId))),
  ]);
  const batch = writeBatch(db);
  snap1.docs.forEach(d => batch.delete(d.ref));
  snap2.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
}

export function subscribeToReceivedRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void
): () => void {
  const q = query(
    collection(db, 'friendRequests'),
    where('toUserId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    callback(snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        fromUserId: data.fromUserId as string,
        fromUserName: data.fromUserName as string,
        fromUserPhoto: (data.fromUserPhoto as string | null) ?? null,
        toUserId: data.toUserId as string,
        status: data.status as 'pending' | 'accepted' | 'rejected',
        createdAt: tsToISO(data.createdAt),
      } as FriendRequest;
    }));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('ReceivedRequests Snapshot error:', error);
    }
  });
}
export function subscribeToFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId)
  );

  return onSnapshot(q, async (snap) => {
    const docs = snap.docs.map(d => ({ friendId: d.data().friendId, createdAt: d.data().createdAt }));

    docs.sort((a, b) => {
      const t1 = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const t2 = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return t2 - t1;
    });

    const friendIds = docs.map(d => d.friendId);
    if (friendIds.length === 0) {
      callback([]);
      return;
    }

    const friendProfiles = await Promise.all(
      friendIds.map(async (id) => {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (userSnap.exists()) {
          return { uid: userSnap.id, ...userSnap.data() };
        }
        return null;
      })
    );

    callback(friendProfiles.filter(p => p !== null));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('FriendsList Snapshot error:', error);
    }
  });
}

export function subscribeToBestFriends(
  userId: string,
  callback: (friends: any[]) => void
): () => void {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId),
    where('isBestFriend', '==', true)
  );

  return onSnapshot(q, async (snap) => {
    const docs = snap.docs.map(d => ({ friendId: d.data().friendId, createdAt: d.data().createdAt }));

    docs.sort((a, b) => {
      const t1 = a.createdAt instanceof Timestamp ? a.createdAt.toMillis() : 0;
      const t2 = b.createdAt instanceof Timestamp ? b.createdAt.toMillis() : 0;
      return t2 - t1;
    });

    const friendIds = docs.map(d => d.friendId);
    if (friendIds.length === 0) {
      callback([]);
      return;
    }

    const friendProfiles = await Promise.all(
      friendIds.map(async (id) => {
        const userSnap = await getDoc(doc(db, 'users', id));
        if (userSnap.exists()) {
          return { uid: userSnap.id, ...userSnap.data() };
        }
        return null;
      })
    );

    callback(friendProfiles.filter(p => p !== null));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('BestFriends Snapshot error:', error);
    }
  });
}

export async function toggleBestFriend(userId: string, friendId: string): Promise<boolean> {
  const q = query(
    collection(db, 'friendships'),
    where('userId', '==', userId),
    where('friendId', '==', friendId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;

  const docRef = snap.docs[0].ref;
  const isBest = snap.docs[0].data().isBestFriend ?? false;
  await updateDoc(docRef, { isBestFriend: !isBest });
  return !isBest;
}
