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
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

export class FriendsService {
  constructor(db) {
    this.db = db;
  }

  async sendFriendRequest(fromUserId, toUserId, fromUserName, fromUserPhoto = null) {
    const existingRequest = await this.getFriendRequest(fromUserId, toUserId);
    if (existingRequest) {
      throw new Error('Friend request already exists');
    }

    const areFriends = await this.areFriends(fromUserId, toUserId);
    if (areFriends) {
      throw new Error('Users are already friends');
    }

    const requestRef = doc(collection(this.db, 'friendRequests'));
    await setDoc(requestRef, {
      fromUserId,
      toUserId,
      fromUserName,
      fromUserPhoto,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    return requestRef.id;
  }

  async getFriendRequest(userId1, userId2) {
    const q1 = query(
      collection(this.db, 'friendRequests'),
      where('fromUserId', '==', userId1),
      where('toUserId', '==', userId2),
      where('status', '==', 'pending')
    );

    const q2 = query(
      collection(this.db, 'friendRequests'),
      where('fromUserId', '==', userId2),
      where('toUserId', '==', userId1),
      where('status', '==', 'pending')
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    if (!snap1.empty) {
      return { id: snap1.docs[0].id, ...snap1.docs[0].data() };
    }
    if (!snap2.empty) {
      return { id: snap2.docs[0].id, ...snap2.docs[0].data() };
    }

    return null;
  }

  async getReceivedRequests(userId) {
    const q = query(
      collection(this.db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async getSentRequests(userId) {
    const q = query(
      collection(this.db, 'friendRequests'),
      where('fromUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async acceptFriendRequest(requestId) {
    const batch = writeBatch(this.db);

    const requestRef = doc(this.db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('Friend request not found');
    }

    const requestData = requestSnap.data();

    batch.update(requestRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    const friendship1Ref = doc(collection(this.db, 'friendships'));
    batch.set(friendship1Ref, {
      userId: requestData.fromUserId,
      friendId: requestData.toUserId,
      createdAt: serverTimestamp()
    });

    const friendship2Ref = doc(collection(this.db, 'friendships'));
    batch.set(friendship2Ref, {
      userId: requestData.toUserId,
      friendId: requestData.fromUserId,
      createdAt: serverTimestamp()
    });

    await batch.commit();
  }

  async rejectFriendRequest(requestId) {
    const requestRef = doc(this.db, 'friendRequests', requestId);
    await updateDoc(requestRef, {
      status: 'rejected',
      rejectedAt: serverTimestamp()
    });
  }

  async cancelFriendRequest(requestId) {
    const requestRef = doc(this.db, 'friendRequests', requestId);
    await deleteDoc(requestRef);
  }

  async areFriends(userId1, userId2) {
    const q = query(
      collection(this.db, 'friendships'),
      where('userId', '==', userId1),
      where('friendId', '==', userId2)
    );

    const snapshot = await getDocs(q);
    return !snapshot.empty;
  }

  async getFriends(userId) {
    const q = query(
      collection(this.db, 'friendships'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const snapshot = await getDocs(q);
    const friendships = snapshot.docs.map(doc => doc.data());

    const friendsData = await Promise.all(
      friendships.map(async (friendship) => {
        const userRef = doc(this.db, 'users', friendship.friendId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          return {
            id: friendship.friendId,
            ...userSnap.data(),
            friendsSince: friendship.createdAt
          };
        }
        return null;
      })
    );

    return friendsData.filter(friend => friend !== null);
  }

  async removeFriend(userId, friendId) {
    const batch = writeBatch(this.db);

    const q1 = query(
      collection(this.db, 'friendships'),
      where('userId', '==', userId),
      where('friendId', '==', friendId)
    );

    const q2 = query(
      collection(this.db, 'friendships'),
      where('userId', '==', friendId),
      where('friendId', '==', userId)
    );

    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);

    snap1.docs.forEach(doc => batch.delete(doc.ref));
    snap2.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();
  }

  subscribeToReceivedRequests(userId, callback) {
    const q = query(
      collection(this.db, 'friendRequests'),
      where('toUserId', '==', userId),
      where('status', '==', 'pending'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(requests);
    });
  }

  subscribeToFriends(userId, callback) {
    const q = query(
      collection(this.db, 'friendships'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, async (snapshot) => {
      const friendships = snapshot.docs.map(doc => doc.data());

      const friendsData = await Promise.all(
        friendships.map(async (friendship) => {
          const userRef = doc(this.db, 'users', friendship.friendId);
          const userSnap = await getDoc(userRef);

          if (userSnap.exists()) {
            return {
              id: friendship.friendId,
              ...userSnap.data(),
              friendsSince: friendship.createdAt
            };
          }
          return null;
        })
      );

      callback(friendsData.filter(friend => friend !== null));
    });
  }
}

export default FriendsService;