import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, serverTimestamp, onSnapshot, writeBatch, Timestamp,
} from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { notificationService } from './notificationService';
import type { FriendRequest } from '@/types';

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

  // Use the exact check as mobile to prevent any rule friction
  try {
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists()) {
      const data = requestSnap.data();
      if (data.status === 'pending') {
        if (data.fromUserId === fromUserId) throw new Error('Ya has enviado una solicitud a este usuario');
        else throw new Error('Ya tienes una solicitud pendiente de este usuario');
      }
      if (data.status === 'accepted') throw new Error('Ya sois amigos');
      // If rejected, we will overwrite it
    }
  } catch (e: any) {
    // If we hit permission denied on reading non-existent (sometimes happens if Rules evaluates strictly before existence check), just proceed to setDoc
    if (e.code !== 'permission-denied') throw e;
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

  // 1. Root collection friendships (New architecture)
  const fRoot1 = doc(db, 'friendships', `${data.fromUserId}_${data.toUserId}`);
  batch.set(fRoot1, { userId: data.fromUserId, friendId: data.toUserId, createdAt: serverTimestamp() });

  const fRoot2 = doc(db, 'friendships', `${data.toUserId}_${data.fromUserId}`);
  batch.set(fRoot2, { userId: data.toUserId, friendId: data.fromUserId, createdAt: serverTimestamp() });

  // 2. Subcollections (Legacy/Mobile Counter compatible architecture)
  const fSub1 = doc(db, 'users', data.fromUserId, 'friends', data.toUserId);
  batch.set(fSub1, { createdAt: serverTimestamp(), status: 'accepted' });

  const fSub2 = doc(db, 'users', data.toUserId, 'friends', data.fromUserId);
  batch.set(fSub2, { createdAt: serverTimestamp(), status: 'accepted' });

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
  await updateDoc(doc(db, 'friendRequests', requestId), {
    status: 'rejected',
    rejectedAt: serverTimestamp(),
  });
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
    // Fallback to legacy root check if needed, but subcollection is now source of truth
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

  // Using individual deletes to be resilient to partial permission/existence issues
  // especially with legacy data that might not match current rules perfectly.
  const results = await Promise.allSettled(paths.map(ref => deleteDoc(ref)));
  
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length === paths.length) {
    throw new Error('No se pudo eliminar ninguna referencia de amistad.');
  }
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
  // Reading from subcollection (most reliable per rules and mobile parity)
  const q = query(
    collection(db, 'users', userId, 'friends')
  );

  return onSnapshot(q, async (snapshot) => {
    const friendDocs = snapshot.docs;
    
    const friendsData = await Promise.all(
      friendDocs.map(async (fDoc) => {
        try {
          const friendId = fDoc.id;
          const userSnap = await getDoc(doc(db, 'users', friendId));
          if (!userSnap.exists()) return null;
          return {
            uid: userSnap.id,
            ...userSnap.data(),
            ...fDoc.data(),
            friendshipCreatedAt: fDoc.data().createdAt
          };
        } catch (e) {
          console.error('Error fetching friend profile:', e);
          return null;
        }
      })
    );

    // Sync in-memory sort
    const sorted = friendsData.filter(Boolean).sort((a: any, b: any) => {
      const t1 = a.friendshipCreatedAt?.toMillis ? a.friendshipCreatedAt.toMillis() : 0;
      const t2 = b.friendshipCreatedAt?.toMillis ? b.friendshipCreatedAt.toMillis() : 0;
      return t2 - t1;
    });

    callback(sorted);
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
    collection(db, 'users', userId, 'friends'),
    where('isBestFriend', '==', true)
  );

  return onSnapshot(q, async (snapshot) => {
    const friendDocs = snapshot.docs;
    
    const friendsData = await Promise.all(
      friendDocs.map(async (fDoc) => {
        try {
          const friendId = fDoc.id;
          const userSnap = await getDoc(doc(db, 'users', friendId));
          if (!userSnap.exists()) return null;
          return {
            uid: userSnap.id,
            ...userSnap.data(),
            ...fDoc.data(),
            friendshipCreatedAt: fDoc.data().createdAt
          };
        } catch (e) {
          console.error('Error fetching best friend profile:', e);
          return null;
        }
      })
    );

    const sorted = friendsData.filter(Boolean).sort((a: any, b: any) => {
      const t1 = a.friendshipCreatedAt?.toMillis ? a.friendshipCreatedAt.toMillis() : 0;
      const t2 = b.friendshipCreatedAt?.toMillis ? b.friendshipCreatedAt.toMillis() : 0;
      return t2 - t1;
    });

    callback(sorted);
  }, (error) => {
    if (error.code !== 'permission-denied') {
      console.error('BestFriends Snapshot error:', error);
    }
  });
}

export async function toggleBestFriend(userId: string, friendId: string): Promise<boolean> {
  const docRef = doc(db, 'users', userId, 'friends', friendId);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return false;

  const isBest = snap.data().isBestFriend ?? false;
  await updateDoc(docRef, { isBestFriend: !isBest });
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

export function subscribeToFriendshipStatus(
  userId1: string,
  userId2: string,
  callback: (status: 'none' | 'sent' | 'received' | 'friends') => void
): () => void {
  // 1. Listen to the subcollection (Primary source of truth for "friends")
  const friendRef = doc(db, 'users', userId1, 'friends', userId2);
  let isFriend = false;
  let isSent = false;
  let isReceived = false;

  const unsubFriend = onSnapshot(friendRef, (snap) => {
    isFriend = snap.exists();
    reportStatus();
  }, () => {});

  // 2. Listen to requests
  const requestId = [userId1, userId2].sort().join('_');
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
  }, () => {});

  function reportStatus() {
    if (isFriend) callback('friends');
    else if (isReceived) callback('received');
    else if (isSent) callback('sent');
    else callback('none');
  }

  return () => {
    unsubFriend();
    unsubRequest();
  };
}
