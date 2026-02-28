import { 
  doc, 
  getDoc,
  collection,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

export class NotificationService {
  constructor(db) {
    this.db = db;
  }

  async registerForPushNotifications(userId, token) {
    const userRef = doc(this.db, 'users', userId);
    await updateDoc(userRef, {
      fcmToken: token,
      notificationsEnabled: true,
      lastTokenUpdate: serverTimestamp()
    });
  }

  async sendPushNotification(userId, title, body, data = {}) {
    const userRef = doc(this.db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      throw new Error('User not found');
    }

    const userData = userSnap.data();
    const fcmToken = userData.fcmToken;

    if (!fcmToken) {
      throw new Error('User does not have FCM token registered');
    }

    const notificationRef = doc(collection(this.db, 'notifications'));
    
    await setDoc(notificationRef, {
      userId,
      title,
      body,
      data,
      token: fcmToken,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    return notificationRef.id;
  }

  async getChannelMembers(channelId) {
    const membersSnapshot = await getDocs(
      collection(this.db, 'channels', channelId, 'members')
    );
    
    const members = [];
    
    for (const memberDoc of membersSnapshot.docs) {
      const userId = memberDoc.data().userId;
      const userDoc = await getDoc(doc(this.db, 'users', userId));
      
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
    const userRef = doc(this.db, 'users', userId);
    await updateDoc(userRef, {
      notificationsEnabled: false
    });
  }

  async enableNotifications(userId) {
    const userRef = doc(this.db, 'users', userId);
    await updateDoc(userRef, {
      notificationsEnabled: true
    });
  }
}

export default NotificationService;