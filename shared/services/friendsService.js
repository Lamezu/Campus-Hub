export class FriendsService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async sendFriendRequest(fromUserId, toUserId, fromUserName, fromUserPhoto = null) {
    const requestId = [fromUserId, toUserId].sort().join('_');
    const requestRef = this.fs.doc(this.db, 'friendRequests', requestId);

    await this.fs.setDoc(requestRef, {
      fromUserId,
      toUserId,
      fromUserName,
      fromUserPhoto,
      status: 'pending',
      createdAt: this.fs.serverTimestamp()
    });

    return requestId;
  }

  async getFriendRequest(userId1, userId2) {
    const requestId = [userId1, userId2].sort().join('_');
    const requestRef = this.fs.doc(this.db, 'friendRequests', requestId);
    const requestSnap = await this.fs.getDoc(requestRef);

    return requestSnap.exists() ? { id: requestSnap.id, ...requestSnap.data() } : null;
  }

  async acceptFriendRequest(requestId) {
    const requestRef = this.fs.doc(this.db, 'friendRequests', requestId);
    const requestSnap = await this.fs.getDoc(requestRef);

    if (requestSnap.exists()) {
      const { fromUserId, toUserId } = requestSnap.data();
      const batch = this.fs.writeBatch(this.db);

      batch.delete(requestRef);

      const friend1Ref = this.fs.doc(this.db, 'users', fromUserId, 'friends', toUserId);
      batch.set(friend1Ref, { createdAt: this.fs.serverTimestamp() });

      const friend2Ref = this.fs.doc(this.db, 'users', toUserId, 'friends', fromUserId);
      batch.set(friend2Ref, { createdAt: this.fs.serverTimestamp() });

      await batch.commit();
    }
  }

  async rejectFriendRequest(requestId) {
    const requestRef = this.fs.doc(this.db, 'friendRequests', requestId);
    await this.fs.deleteDoc(requestRef);
  }

  async cancelFriendRequest(requestId) {
    const requestRef = this.fs.doc(this.db, 'friendRequests', requestId);
    await this.fs.deleteDoc(requestRef);
  }

  async areFriends(userId1, userId2) {
    const friendRef = this.fs.doc(this.db, 'users', userId1, 'friends', userId2);
    const friendSnap = await this.fs.getDoc(friendRef);
    return friendSnap.exists();
  }

  async removeFriend(userId, friendId) {
    const batch = this.fs.writeBatch(this.db);
    batch.delete(this.fs.doc(this.db, 'users', userId, 'friends', friendId));
    batch.delete(this.fs.doc(this.db, 'users', friendId, 'friends', userId));
    await batch.commit();
  }

  subscribeToReceivedRequests(userId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'friendRequests'),
      this.fs.where('toUserId', '==', userId),
      this.fs.where('status', '==', 'pending')
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }

  subscribeToFriends(userId, callback) {
    const q = this.fs.collection(this.db, 'users', userId, 'friends');

    return this.fs.onSnapshot(q, async (snapshot) => {
      const friends = await Promise.all(snapshot.docs.map(async (friendDoc) => {
        const userDoc = await this.fs.getDoc(this.fs.doc(this.db, 'users', friendDoc.id));
        return { id: friendDoc.id, ...userDoc.data(), ...friendDoc.data() };
      }));
      callback(friends);
    });
  }

  async toggleBestFriend(userId, friendId) {
    const friendRef = this.fs.doc(this.db, 'users', userId, 'friends', friendId);
    const friendSnap = await this.fs.getDoc(friendRef);

    if (friendSnap.exists()) {
      const isBest = friendSnap.data().isBestFriend || false;
      await this.fs.updateDoc(friendRef, { isBestFriend: !isBest });
      return !isBest;
    }
    return false;
  }

  subscribeToBestFriends(userId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'users', userId, 'friends'),
      this.fs.where('isBestFriend', '==', true)
    );

    return this.fs.onSnapshot(q, async (snapshot) => {
      const friends = await Promise.all(snapshot.docs.map(async (friendDoc) => {
        const userDoc = await this.fs.getDoc(this.fs.doc(this.db, 'users', friendDoc.id));
        return { id: friendDoc.id, ...userDoc.data(), ...friendDoc.data() };
      }));
      callback(friends);
    });
  }
}
export default FriendsService;