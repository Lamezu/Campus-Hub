export class NotificationService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async registerForPushNotifications(userId, token) {
    const userRef = this.fs.doc(this.db, 'users', userId);
    await this.fs.updateDoc(userRef, {
      fcmToken: token,
      notificationsEnabled: true,
      lastTokenUpdate: this.fs.serverTimestamp()
    });
  }

  async sendPushNotification(userId, title, body, data = {}) {
    const userRef = this.fs.doc(this.db, 'users', userId);
    const userSnap = await this.fs.getDoc(userRef);

    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnap.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new Error('User does not have FCM token registered');
    }

    const notificationRef = this.fs.doc(this.fs.collection(this.db, 'notifications', userId, 'items'));

    await this.fs.setDoc(notificationRef, {
      userId,
      title,
      body,
      data,
      token: fcmToken,
      status: 'pending',
      createdAt: this.fs.serverTimestamp()
    });

    return notificationRef.id;
  }

  async getChannelMembers(channelId) {
    const membersSnapshot = await this.fs.getDocs(
      this.fs.collection(this.db, 'channels', channelId, 'members')
    );

    const members = [];

    for (const memberDoc of membersSnapshot.docs) {
      const userId = memberDoc.data().userId;
      const userDoc = await this.fs.getDoc(this.fs.doc(this.db, 'users', userId));

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.fcmToken && userData.notificationsEnabled !== false) {
          members.push({
            userId,
            token: userData.fcmToken,
            displayName: userData.displayName
          });
        }
      }
    }

    return members;
  }

  async sendChannelNotification(channelId, senderId, title, body) {
    const members = await this.getChannelMembers(channelId);

    const notifications = members
      .filter(member => member.userId !== senderId)
      .map(member =>
        this.sendPushNotification(member.userId, title, body, {
          channelId,
          type: 'new_message'
        })
      );

    return Promise.all(notifications);
  }

  async disableNotifications(userId) {
    const userRef = this.fs.doc(this.db, 'users', userId);
    await this.fs.updateDoc(userRef, {
      notificationsEnabled: false
    });
  }

  async markAsRead(userId, notificationId) {
    const notificationRef = this.fs.doc(this.db, 'notifications', userId, 'items', notificationId);
    await this.fs.updateDoc(notificationRef, { read: true });
  }

  subscribeToNotifications(userId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'notifications', userId, 'items'),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(50)
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(notifications);
    });
  }

  async addNotification(userId, notification) {
    const notificationRef = this.fs.collection(this.db, 'notifications', userId, 'items');
    await this.fs.addDoc(notificationRef, {
      ...notification,
      userId,
      read: false,
      createdAt: this.fs.serverTimestamp()
    });
  }
}

export default NotificationService;