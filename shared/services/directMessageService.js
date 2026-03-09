import { 
  collection, 
  doc, 
  addDoc, 
  getDoc,
  getDocs,
  setDoc,
  updateDoc, 
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

export class DirectMessageService {
  constructor(db) {
    this.db = db;
  }

  getConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  async getOrCreateConversation(userId1, userId2) {
    const conversationId = this.getConversationId(userId1, userId2);
    const convRef = doc(this.db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);

    if (!convSnap.exists()) {
      await setDoc(convRef, {
        participants: [userId1, userId2],
        createdAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        lastMessage: null,
        unreadCount: {
          [userId1]: 0,
          [userId2]: 0
        }
      });
    }

    return conversationId;
  }

  async getUserConversations(userId) {
    const q = query(
      collection(this.db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async sendMessage(conversationId, text, senderId, senderName, senderPhoto = null, attachments = null) {
    const batch = writeBatch(this.db);

    const messagesRef = collection(this.db, 'conversations', conversationId, 'messages');
    const messageRef = doc(messagesRef);

    batch.set(messageRef, {
      text,
      senderId,
      senderName,
      senderPhoto,
      createdAt: serverTimestamp(),
      read: false,
      readAt: null,
      attachments,
      reactions: {}
    });

    const convRef = doc(this.db, 'conversations', conversationId);
    const convSnap = await getDoc(convRef);
    const convData = convSnap.data();

    const otherUserId = convData.participants.find(id => id !== senderId);

    batch.update(convRef, {
      lastMessageAt: serverTimestamp(),
      lastMessage: text.substring(0, 100),
      [`unreadCount.${otherUserId}`]: (convData.unreadCount?.[otherUserId] || 0) + 1
    });

    await batch.commit();
    return messageRef.id;
  }

  async getMessages(conversationId, limitCount = 50) {
    const q = query(
      collection(this.db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();
  }

  async markAsRead(conversationId, userId) {
    const batch = writeBatch(this.db);

    const q = query(
      collection(this.db, 'conversations', conversationId, 'messages'),
      where('read', '==', false),
      where('senderId', '!=', userId)
    );

    const snapshot = await getDocs(q);

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        read: true,
        readAt: serverTimestamp()
      });
    });

    const convRef = doc(this.db, 'conversations', conversationId);
    batch.update(convRef, {
      [`unreadCount.${userId}`]: 0
    });

    await batch.commit();
  }

  async deleteMessage(conversationId, messageId) {
    const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
    await deleteDoc(messageRef);
  }

  async addReaction(conversationId, messageId, emoji, userId) {
    const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (messageSnap.exists()) {
      const message = messageSnap.data();
      const reactions = message.reactions || {};

      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
        await updateDoc(messageRef, { reactions });
      }
    }
  }

  async removeReaction(conversationId, messageId, emoji, userId) {
    const messageRef = doc(this.db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await getDoc(messageRef);

    if (messageSnap.exists()) {
      const message = messageSnap.data();
      const reactions = message.reactions || {};

      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);

        if (reactions[emoji].length === 0) {
          delete reactions[emoji];
        }

        await updateDoc(messageRef, { reactions });
      }
    }
  }

  onMessagesSnapshot(conversationId, callback) {
    const q = query(
      collection(this.db, 'conversations', conversationId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();

      callback(messages);
    });
  }

  subscribeToUserConversations(userId, callback) {
    const q = query(
      collection(this.db, 'conversations'),
      where('participants', 'array-contains', userId),
      orderBy('lastMessageAt', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(conversations);
    });
  }

  async getTotalUnreadCount(userId) {
    const conversations = await this.getUserConversations(userId);
    return conversations.reduce((total, conv) => {
      return total + (conv.unreadCount?.[userId] || 0);
    }, 0);
  }
}

export default DirectMessageService;