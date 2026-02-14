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
  increment,
  writeBatch
} from 'firebase/firestore';

export class ChannelService {
  constructor(db) {
    this.db = db;
  }

  async createChannel(channelData, creatorId) {
    const channelRef = doc(collection(this.db, 'channels'));
    const channelId = channelRef.id;
    
    const batch = writeBatch(this.db);
    
    batch.set(channelRef, {
      ...channelData,
      createdBy: creatorId,
      createdAt: serverTimestamp(),
      memberCount: 1,
      lastMessageAt: null
    });
    
    const memberRef = doc(this.db, 'channels', channelId, 'members', creatorId);
    batch.set(memberRef, {
      userId: creatorId,
      role: 'admin',
      joinedAt: serverTimestamp(),
      lastRead: serverTimestamp(),
      notifications: true
    });
    
    await batch.commit();
    return channelId;
  }

  async getChannel(channelId) {
    const channelRef = doc(this.db, 'channels', channelId);
    const channelSnap = await getDoc(channelRef);
    
    if (channelSnap.exists()) {
      return { 
        id: channelSnap.id, 
        ...channelSnap.data() 
      };
    }
    
    return null;
  }

  async getUserChannels(userId) {
    const channelsSnapshot = await getDocs(collection(this.db, 'channels'));
    const userChannels = [];
    
    for (const channelDoc of channelsSnapshot.docs) {
      const memberRef = doc(this.db, 'channels', channelDoc.id, 'members', userId);
      const memberSnap = await getDoc(memberRef);
      
      if (memberSnap.exists()) {
        userChannels.push({
          id: channelDoc.id,
          ...channelDoc.data(),
          memberInfo: memberSnap.data()
        });
      }
    }
    
    return userChannels.sort((a, b) => {
      if (!a.lastMessageAt) return 1;
      if (!b.lastMessageAt) return -1;
      return b.lastMessageAt.toMillis() - a.lastMessageAt.toMillis();
    });
  }

  async getPublicChannels() {
    const q = query(
      collection(this.db, 'channels'),
      where('type', '==', 'public'),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async updateChannel(channelId, updates) {
    const channelRef = doc(this.db, 'channels', channelId);
    await updateDoc(channelRef, updates);
  }

  async deleteChannel(channelId) {
    const channelRef = doc(this.db, 'channels', channelId);
    await deleteDoc(channelRef);
  }

  async joinChannel(channelId, userId) {
    const batch = writeBatch(this.db);
    
    const memberRef = doc(this.db, 'channels', channelId, 'members', userId);
    batch.set(memberRef, {
      userId,
      role: 'member',
      joinedAt: serverTimestamp(),
      lastRead: serverTimestamp(),
      notifications: true
    });
    
    const channelRef = doc(this.db, 'channels', channelId);
    batch.update(channelRef, {
      memberCount: increment(1)
    });
    
    await batch.commit();
  }

  async leaveChannel(channelId, userId) {
    const batch = writeBatch(this.db);
    
    const memberRef = doc(this.db, 'channels', channelId, 'members', userId);
    batch.delete(memberRef);
    
    const channelRef = doc(this.db, 'channels', channelId);
    batch.update(channelRef, {
      memberCount: increment(-1)
    });
    
    await batch.commit();
  }

  async getChannelMembers(channelId) {
    const membersSnapshot = await getDocs(
      collection(this.db, 'channels', channelId, 'members')
    );
    
    return membersSnapshot.docs.map(doc => doc.data());
  }

  async updateMemberRole(channelId, userId, newRole) {
    const memberRef = doc(this.db, 'channels', channelId, 'members', userId);
    await updateDoc(memberRef, { role: newRole });
  }

  subscribeToUserChannels(userId, callback) {
    const q = query(
      collection(this.db, 'channels'),
      orderBy('lastMessageAt', 'desc')
    );
    
    return onSnapshot(q, async (snapshot) => {
      const channels = [];
      
      for (const channelDoc of snapshot.docs) {
        const memberRef = doc(this.db, 'channels', channelDoc.id, 'members', userId);
        const memberSnap = await getDoc(memberRef);
        
        if (memberSnap.exists()) {
          channels.push({
            id: channelDoc.id,
            ...channelDoc.data(),
            memberInfo: memberSnap.data()
          });
        }
      }
      
      callback(channels);
    });
  }

  subscribeToChannel(channelId, callback) {
    const channelRef = doc(this.db, 'channels', channelId);
    
    return onSnapshot(channelRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  }
}