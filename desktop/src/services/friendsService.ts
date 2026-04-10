import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, writeBatch, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { notificationService } from './notificationService';
import type { FriendRequest, User } from '@/types';

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
  
  const requestSnap = await getDoc(requestRef);
  if (requestSnap.exists()) {
    const data = requestSnap.data();
    if (data.status === 'pending') {
      if (data.fromUserId === fromUserId) throw new Error('Ya has enviado una solicitud a este usuario');
      else throw new Error('Ya tienes una solicitud pendiente de este usuario');
    }
    if (data.status === 'accepted') throw new Error('Ya sois amigos');
  }

  const alreadyFriends = await areFriends(fromUserId, toUserId);
  if (alreadyFriends) throw new Error('Ya sois amigos');

  await setDoc(requestRef, {
    fromUserId,
    toUserId,
    fromUserName,
    fromUserPhoto,
    status: 'pending',
    createdAt: serverTimestamp(),
  });

  notificationService.addNotification(toUserId, {
    category: 'friend',
    title: 'Nueva solicitud de amistad',
    body: `${fromUserName} quiere ser tu amigo`,
    meta: { fromUserId, fromUserName, isRequest: 'true', requestId },
  }).catch(() => { });

  return requestId;
}

export async function getFriendRequest(
  userId1: string,
  userId2: string
): Promise<(FriendRequest & { id: string }) | null> {
  const requestId = getRequestId(userId1, userId2);
  const snap = await getDoc(doc(db, 'friendRequests', requestId));
  
  if (snap.exists() && snap.data().status === 'pending') {
    const data = snap.data();
    return {
      id: snap.id,
      fromUserId: data.fromUserId,
      fromUserName: data.fromUserName,
      fromUserPhoto: data.fromUserPhoto || null,
      toUserId: data.toUserId,
      status: data.status as any,
      createdAt: tsToISO(data.createdAt),
    };
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

  // Bidirectional in root friendships
  const f1 = doc(db, 'friendships', `${data.fromUserId}_${data.toUserId}`);
  batch.set(f1, {
    userId: data.fromUserId,
    friendId: data.toUserId,
    createdAt: serverTimestamp()
  });

  const f2 = doc(db, 'friendships', `${data.toUserId}_${data.fromUserId}`);
  batch.set(f2, {
    userId: data.toUserId,
    friendId: data.fromUserId,
    createdAt: serverTimestamp()
  });

  await batch.commit();

  const requesterId = data.fromUserId;
  const accepterName = auth.currentUser?.displayName ?? 'Alguien';
  
  notificationService.addNotification(requesterId, {
    category: 'friend',
    title: 'Solicitud de amistad aceptada',
    body: `${accepterName} ha aceptado tu solicitud de amistad`,
    meta: { fromUserId: data.toUserId, fromUserName: accepterName, type: 'accepted' },
  }).catch(() => { });
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
  const fId = `${userId1}_${userId2}`;
  const snap = await getDoc(doc(db, 'friendships', fId));
  return snap.exists();
}

/**
 * Listens to friendship status in real-time between two users.
 * Returns 'friends', 'sent' (from current to other), 'received' (from other to me), or 'none'.
 */
export function subscribeToFriendshipStatus(
  meId: string,
  otherId: string,
  callback: (status: 'friends' | 'sent' | 'received' | 'none') => void
): () => void {
  const fId = `${meId}_${otherId}`;
  const requestId = getRequestId(meId, otherId);

  // We need to listen to both the friendship doc and the request doc
  const unsubFriend = onSnapshot(doc(db, 'friendships', fId), (fSnap) => {
    if (fSnap.exists()) {
      callback('friends');
      return;
    }
    
    // If not friends, check request status
    onSnapshot(doc(db, 'friendRequests', requestId), (rSnap) => {
      if (rSnap.exists() && rSnap.data().status === 'pending') {
        if (rSnap.data().fromUserId === meId) callback('sent');
        else callback('received');
      } else {
        // Double check friends in case it changed while reading request
        getDoc(doc(db, 'friendships', fId)).then(s => {
          if (s.exists()) callback('friends');
          else callback('none');
        });
      }
    });
  });

  return unsubFriend;
}

export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const batch = writeBatch(db);
  
  batch.delete(doc(db, 'friendships', `${userId}_${friendId}`));
  batch.delete(doc(db, 'friendships', `${friendId}_${userId}`));

  // Cleanup request
  const rId = getRequestId(userId, friendId);
  batch.delete(doc(db, 'friendRequests', rId));

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
        status: data.status as any,
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
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, async (snap) => {
    const friendships = snap.docs.map(d => d.data());

    const friendsData = await Promise.all(
      friendships.map(async (f) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', f.friendId));
          if (userSnap.exists()) {
            return { uid: userSnap.id, ...userSnap.data(), friendsSince: f.createdAt };
          }
        } catch (e) {
          console.error('Error fetching friend profile:', e);
        }
        return null;
      })
    );

    callback(friendsData.filter(p => p !== null));
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
    where('isBestFriend', '==', true),
    orderBy('createdAt', 'desc')
  );

  return onSnapshot(q, async (snap) => {
    const friendships = snap.docs.map(d => d.data());

    const friendsData = await Promise.all(
      friendships.map(async (f) => {
        try {
          const userSnap = await getDoc(doc(db, 'users', f.friendId));
          if (userSnap.exists()) {
            return { uid: userSnap.id, ...userSnap.data(), friendsSince: f.createdAt };
          }
        } catch (e) {
          console.error('Error fetching friend profile:', e);
        }
        return null;
      })
    );

    callback(friendsData.filter(p => p !== null));
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('BestFriends Snapshot error:', error);
    }
  });
}

export async function toggleBestFriend(userId: string, friendId: string): Promise<boolean> {
  const fId = `${userId}_${friendId}`;
  const fRef = doc(db, 'friendships', fId);
  const snap = await getDoc(fRef);
  if (!snap.exists()) return false;

  const isBest = snap.data().isBestFriend ?? false;
  await updateDoc(fRef, { isBestFriend: !isBest });
  return !isBest;
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
