export class ChannelService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async createChannel(channelData, creatorId) {
    const channelRef = this.fs.doc(this.fs.collection(this.db, 'channels'));
    const channelId = channelRef.id;

    await this.fs.setDoc(channelRef, {
      ...channelData,
      creatorId,
      createdAt: this.fs.serverTimestamp(),
      memberCount: 1
    });

    const memberRef = this.fs.doc(this.db, 'channels', channelId, 'members', creatorId);
    await this.fs.setDoc(memberRef, {
      userId: creatorId,
      role: 'admin',
      joinedAt: this.fs.serverTimestamp()
    });

    return channelId;
  }

  async getChannel(channelId) {
    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    const channelSnap = await this.fs.getDoc(channelRef);
    return channelSnap.exists() ? { id: channelSnap.id, ...channelSnap.data() } : null;
  }

  async getChannels(category = null, limitCount = 20) {
    let q;
    if (category) {
      q = this.fs.query(
        this.fs.collection(this.db, 'channels'),
        this.fs.where('category', '==', category),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(limitCount)
      );
    } else {
      q = this.fs.query(
        this.fs.collection(this.db, 'channels'),
        this.fs.orderBy('createdAt', 'desc'),
        this.fs.limit(limitCount)
      );
    }

    const snapshot = await this.fs.getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updateChannel(channelId, updates) {
    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    await this.fs.updateDoc(channelRef, {
      ...updates,
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async deleteChannel(channelId) {
    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    await this.fs.deleteDoc(channelRef);
  }

  async addChannelMember(channelId, userId, role = 'member') {
    const memberRef = this.fs.doc(this.db, 'channels', channelId, 'members', userId);
    await this.fs.setDoc(memberRef, {
      userId,
      role,
      joinedAt: this.fs.serverTimestamp()
    });

    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    await this.fs.updateDoc(channelRef, {
      memberCount: this.fs.increment(1)
    });
  }

  async removeChannelMember(channelId, userId) {
    const memberRef = this.fs.doc(this.db, 'channels', channelId, 'members', userId);
    await this.fs.deleteDoc(memberRef);

    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    await this.fs.updateDoc(channelRef, {
      memberCount: this.fs.increment(-1)
    });
  }

  async getChannelMembers(channelId) {
    const membersSnapshot = await this.fs.getDocs(
      this.fs.collection(this.db, 'channels', channelId, 'members')
    );
    return membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  subscribeToChannels(category, callback) {
    let q;
    if (category) {
      q = this.fs.query(
        this.fs.collection(this.db, 'channels'),
        this.fs.where('category', '==', category),
        this.fs.orderBy('createdAt', 'desc')
      );
    } else {
      q = this.fs.query(
        this.fs.collection(this.db, 'channels'),
        this.fs.orderBy('createdAt', 'desc')
      );
    }

    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }

  subscribeToChannel(channelId, callback) {
    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    return this.fs.onSnapshot(channelRef, (snapshot) => {
      callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
    });
  }

  subscribeToChannelMembers(channelId, callback) {
    const q = this.fs.collection(this.db, 'channels', channelId, 'members');
    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }
}
export default ChannelService;