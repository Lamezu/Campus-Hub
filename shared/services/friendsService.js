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
  constructor(db, notificationService = null) {
    this.db = db;
    this.notificationService = notificationService;
  }

  // Generate deterministic ID for friend requests to prevent duplicates
  _getRequestId(id1, id2) {
    return [id1, id2].sort().join('_');
  }

  async sendFriendRequest(fromUserId, toUserId, fromUserName, fromUserPhoto = null) {
    const requestId = this._getRequestId(fromUserId, toUserId);
    const requestRef = doc(this.db, 'friendRequests', requestId);
    
    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists()) {
      const data = requestSnap.data();
      if (data.status === 'pending') {
        if (data.fromUserId === fromUserId) throw new Error('Ya has enviado una solicitud a este usuario');
        else throw new Error('Ya tienes una solicitud pendiente de este usuario');
      }
      if (data.status === 'accepted') throw new Error('Ya sois amigos');
    }

    await setDoc(requestRef, {
      fromUserId,
      toUserId,
      fromUserName,
      fromUserPhoto,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // Notify recipient
    if (this.notificationService) {
      this.notificationService.sendPushNotification(toUserId, 'Nueva solicitud de amistad', `${fromUserName} quiere ser tu amigo`, {
        type: 'friend_request',
        requestId,
        fromUserId,
        fromUserName,
        isRequest: 'true'
      }).catch(err => console.error('Notification error:', err));
    }

    return requestId;
  }

  async getFriendRequest(userId1, userId2) {
    const requestId = this._getRequestId(userId1, userId2);
    const requestRef = doc(this.db, 'friendRequests', requestId);
    const snap = await getDoc(requestRef);
    
    if (snap.exists() && snap.data().status === 'pending') {
      return { id: snap.id, ...snap.data() };
    }
    return null;
  }

  async acceptFriendRequest(requestId) {
    const batch = writeBatch(this.db);
    const requestRef = doc(this.db, 'friendRequests', requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      throw new Error('Solicitud no encontrada');
    }

    const requestData = requestSnap.data();
    
    // Update request status
    batch.update(requestRef, {
      status: 'accepted',
      acceptedAt: serverTimestamp()
    });

    // Create bidirectional friendship in root collection with deterministic IDs
    const f1 = doc(this.db, 'friendships', `${requestData.fromUserId}_${requestData.toUserId}`);
    batch.set(f1, {
      userId: requestData.fromUserId,
      friendId: requestData.toUserId,
      createdAt: serverTimestamp()
    });

    const f2 = doc(this.db, 'friendships', `${requestData.toUserId}_${requestData.fromUserId}`);
    batch.set(f2, {
      userId: requestData.toUserId,
      friendId: requestData.fromUserId,
      createdAt: serverTimestamp()
    });

    await batch.commit();

    // Notify sender that it was accepted
    if (this.notificationService) {
      const accepterId = requestData.toUserId;
      // We'd ideally fetch the name here, but let's assume the notification service handles basic info if needed
      this.notificationService.sendPushNotification(requestData.fromUserId, 'Solicitud aceptada', 'Tu solicitud de amistad ha sido aceptada', {
        type: 'friend_accepted',
        fromUserId: accepterId
      }).catch(err => console.error('Notification error:', err));
    }
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
    const fId = `${userId1}_${userId2}`;
    const snap = await getDoc(doc(this.db, 'friendships', fId));
    return snap.exists();
  }

  async removeFriend(userId, friendId) {
    const batch = writeBatch(this.db);
    
    // Delete friendship docs
    batch.delete(doc(this.db, 'friendships', `${userId}_${friendId}`));
    batch.delete(doc(this.db, 'friendships', `${friendId}_${userId}`));
    
    // Also delete any existing request between them to allow a fresh start later
    const requestId = this._getRequestId(userId, friendId);
    batch.delete(doc(this.db, 'friendRequests', requestId));

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
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
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
          try {
            const userSnap = await getDoc(doc(this.db, 'users', friendship.friendId));
            if (userSnap.exists()) {
              return {
                uid: friendship.friendId,
                ...userSnap.data(),
                friendsSince: friendship.createdAt
              };
            }
          } catch (e) {
            console.error('Error fetching friend profile:', e);
          }
          return null;
        })
      );

      callback(friendsData.filter(friend => friend !== null));
    });
  }
}

export default FriendsService;