import { 
  collection, 
  doc, 
  getDoc,
  getDocs,
  updateDoc, 
  deleteDoc,
  query,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';

export class MessageService {
  constructor(db) {
    this.db = db;
  }

  async sendMessage(channelId, text, senderId, senderName, senderPhoto = null, attachments = null) {
    const batch = writeBatch(this.db);
    
    const messagesRef = collection(this.db, 'channels', channelId, 'messages');
    const messageRef = doc(messagesRef);
    
    batch.set(messageRef, {
      text,
      senderId,
      senderName,
      senderPhoto,
      createdAt: serverTimestamp(),
      edited: false,
      editedAt: null,
      attachments,
      reactions: {}
    });
    
    const channelRef = doc(this.db, 'channels', channelId);
    batch.update(channelRef, {
      lastMessageAt: serverTimestamp()
    });
    
    await batch.commit();
    return messageRef.id;
  }

  async getMessages(channelId, limitCount = 50) {
    const q = query(
      collection(this.db, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();
  }

  async editMessage(channelId, messageId, newText) {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await updateDoc(messageRef, {
      text: newText,
      edited: true,
      editedAt: serverTimestamp()
    });
  }

  async deleteMessage(channelId, messageId) {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
    await deleteDoc(messageRef);
  }

  async addReaction(channelId, messageId, emoji, userId) {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
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

  async removeReaction(channelId, messageId, emoji, userId) {
    const messageRef = doc(this.db, 'channels', channelId, 'messages', messageId);
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

  subscribeToMessages(channelId, limitCount = 50, callback) {
    const q = query(
      collection(this.db, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).reverse();
      
      callback(messages);
    });
  }

  async updateLastRead(channelId, userId) {
    const memberRef = doc(this.db, 'channels', channelId, 'members', userId);
    await updateDoc(memberRef, {
      lastRead: serverTimestamp()
    });
  }

  async getUnreadCount(channelId, userId) {
    const memberRef = doc(this.db, 'channels', channelId, 'members', userId);
    const memberSnap = await getDoc(memberRef);
    
    if (!memberSnap.exists()) return 0;
    
    const memberData = memberSnap.data();
    const lastRead = memberData.lastRead;
    
    const messagesQuery = query(
      collection(this.db, 'channels', channelId, 'messages'),
      orderBy('createdAt', 'desc')
    );
    
    const messagesSnap = await getDocs(messagesQuery);
    
    let unreadCount = 0;
    for (const msgDoc of messagesSnap.docs) {
      const msgData = msgDoc.data();
      if (msgData.createdAt && lastRead && msgData.createdAt.toMillis() > lastRead.toMillis()) {
        unreadCount++;
      }
    }
    
    return unreadCount;
  }
}
