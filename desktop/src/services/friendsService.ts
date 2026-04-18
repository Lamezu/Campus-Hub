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

  try {
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists()) {
      const data = requestSnap.data();
      if (data.status === 'pending') {
        if (data.fromUserId === fromUserId) throw new Error('Ya has enviado una solicitud a este usuario');
        else throw new Error('Ya tienes una solicitud pendiente de este usuario');
      }
      if (data.status === 'accepted') throw new Error('Ya sois amigos');
    }
  } catch (e: any) {
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

  notificationService.addNotification(toUserId, {
    category: 'friend',
    title: 'Nueva solicitud de amistad',
    titleKey: 'notifications.friend_request_title',
    body: `${fromUserName} quiere ser tu amigo/a`,
    bodyKey: 'notifications.friend_request_body',
    meta: { name: fromUserName, fromUserId, fromUserName, fromUserPhoto: fromUserPhoto ?? '', isRequest: 'true' },
  }, requestId).catch(() => { });

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

  const fRoot1 = doc(db, 'friendships', `${data.fromUserId}_${data.toUserId}`);
  batch.set(fRoot1, { userId: data.fromUserId, friendId: data.toUserId, createdAt: serverTimestamp() });

  const fRoot2 = doc(db, 'friendships', `${data.toUserId}_${data.fromUserId}`);
  batch.set(fRoot2, { userId: data.toUserId, friendId: data.fromUserId, createdAt: serverTimestamp() });

  const fSub1 = doc(db, 'users', data.fromUserId, 'friends', data.toUserId);
  batch.set(fSub1, { createdAt: serverTimestamp(), status: 'accepted' });

  const fSub2 = doc(db, 'users', data.toUserId, 'friends', data.fromUserId);
  batch.set(fSub2, { createdAt: serverTimestamp(), status: 'accepted' });

  await batch.commit();

  const accepterName = auth.currentUser?.displayName ?? 'Alguien';
  const accepterId = auth.currentUser?.uid;

  notificationService.addNotification(data.fromUserId, {
    category: 'friend',
    title: 'Solicitud de amistad aceptada',
    titleKey: 'notifications.friend_request_accepted_title',
    body: `${accepterName} aceptó tu solicitud de amistad`,
    bodyKey: 'notifications.friend_request_accepted_body',
    meta: { name: accepterName, fromUserId: data.toUserId, fromUserName: accepterName, type: 'accepted' },
  }).catch(() => { });

  if (accepterId) {
    try {
      await deleteDoc(doc(db, 'notifications', accepterId, 'items', requestId));
    } catch (_) { }
  }
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
  await deleteDoc(doc(db, 'friendRequests', requestId));

  const meId = auth.currentUser?.uid;
  if (meId) {
    try {
      await deleteDoc(doc(db, 'notifications', meId, 'items', requestId));
    } catch (_) { }
  }
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
  const batch = writeBatch(db);
  const paths = [
    doc(db, 'friendships', `${userId}_${friendId}`),
    doc(db, 'friendships', `${friendId}_${userId}`),
    doc(db, 'users', userId, 'friends', friendId),
    doc(db, 'users', friendId, 'friends', userId),
    doc(db, 'friendRequests', [userId, friendId].sort().join('_'))
  ];

  paths.forEach(ref => batch.delete(ref));
  await batch.commit();
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
  const friendRef = doc(db, 'users', userId1, 'friends', userId2);
  let isFriend = false;
  let isSent = false;
  let isReceived = false;

  const unsubFriend = onSnapshot(friendRef, (snap) => {
    isFriend = snap.exists();
    reportStatus();
  }, () => {});

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
