export class DirectMessageService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  getConversationId(userId1, userId2) {
    return [userId1, userId2].sort().join('_');
  }

  async getOrCreateConversation(userId1, userId2) {
    const conversationId = this.getConversationId(userId1, userId2);
    const convRef = this.fs.doc(this.db, 'conversations', conversationId);
    const convSnap = await this.fs.getDoc(convRef);

    if (!convSnap.exists()) {
      await this.fs.setDoc(convRef, {
        participants: [userId1, userId2],
        createdAt: this.fs.serverTimestamp(),
        lastMessageAt: this.fs.serverTimestamp(),
        lastMessage: null,
        unreadCount: {
          [userId1]: 0,
          [userId2]: 0
        }
      });
    }

    return conversationId;
  }

  async getConversation(conversationId) {
    const convRef = this.fs.doc(this.db, 'conversations', conversationId);
    const snap = await this.fs.getDoc(convRef);
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  }

  async getUserConversations(userId) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'conversations'),
      this.fs.where('participants', 'array-contains', userId),
      this.fs.orderBy('lastMessageAt', 'desc')
    );

    const snapshot = await this.fs.getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  }

  async sendMessage(conversationId, text, senderId, senderName, senderPhoto = null, attachments = null, replyTo = null, forwarded = false) {
    const batch = this.fs.writeBatch(this.db);

    const messagesRef = this.fs.collection(this.db, 'conversations', conversationId, 'messages');
    const messageRef = this.fs.doc(messagesRef);

    let msgType = 'text';
    if (attachments && attachments.length > 0) {
      msgType = attachments[0].type || 'file';
    }

    batch.set(messageRef, {
      text,
      senderId,
      senderName,
      senderPhoto,
      createdAt: this.fs.serverTimestamp(),
      read: false,
      readAt: null,
      attachments,
      replyTo,
      forwarded,
      reactions: {},
      type: msgType
    });

    const convRef = this.fs.doc(this.db, 'conversations', conversationId);
    const convSnap = await this.fs.getDoc(convRef);
    const convData = convSnap.data() || { participants: [], unreadCount: {} };

    const otherUserId = (convData.participants || []).find(id => id !== senderId);

    batch.update(convRef, {
      lastMessageAt: this.fs.serverTimestamp(),
      lastMessage: text ? text.substring(0, 100) : (attachments ? '[Archivo]' : ''),
      lastMessageSenderId: senderId,
      [`unreadCount.${otherUserId}`]: ((convData.unreadCount || {})[otherUserId] || 0) + 1
    });

    await batch.commit();
    return messageRef.id;
  }

  async editMessage(conversationId, messageId, newText) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    await this.fs.updateDoc(messageRef, {
      text: newText,
      edited: true,
      editedAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async getMessages(conversationId, limitCount = 50) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'conversations', conversationId, 'messages'),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(limitCount)
    );

    const snapshot = await this.fs.getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })).reverse();
  }

  async markAsRead(conversationId, userId) {
    const batch = this.fs.writeBatch(this.db);

    const q = this.fs.query(
      this.fs.collection(this.db, 'conversations', conversationId, 'messages'),
      this.fs.where('read', '==', false)
    );

    const snapshot = await this.fs.getDocs(q);

    snapshot.docs.forEach(doc => {
      const msg = doc.data();
      if (msg.senderId !== userId) {
        batch.update(doc.ref, {
          read: true,
          readAt: this.fs.serverTimestamp(),
          status: 'read',
        });
      }
    });

    const convRef = this.fs.doc(this.db, 'conversations', conversationId);
    batch.update(convRef, {
      [`unreadCount.${userId}`]: 0
    });

    await batch.commit();
  }

  async deleteMessage(conversationId, messageId) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    await this.fs.deleteDoc(messageRef);
  }

  async deleteMessageForAll(conversationId, messageId) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    await this.fs.deleteDoc(messageRef);
  }

  async deleteMessageForMe(conversationId, messageId, userId) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    await this.fs.updateDoc(messageRef, {
      deletedForUsers: this.fs.arrayUnion(userId)
    });
  }

  async toggleReaction(conversationId, messageId, emoji, userId) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await this.fs.getDoc(messageRef);

    if (messageSnap.exists()) {
      const message = messageSnap.data();
      const reactions = message.reactions || {};

      if (!reactions[emoji]) {
        reactions[emoji] = [];
      }

      if (reactions[emoji].includes(userId)) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
      } else {
        reactions[emoji].push(userId);
      }

      await this.fs.updateDoc(messageRef, { reactions });
    }
  }

  async sendPollMessage(conversationId, senderId, senderName, senderPhoto = null, poll) {
    const batch = this.fs.writeBatch(this.db);
    const messagesRef = this.fs.collection(this.db, 'conversations', conversationId, 'messages');
    const messageRef = this.fs.doc(messagesRef);

    const pollData = {
      ...poll,
      options: poll.options.map((opt, i) => ({
        id: `opt_${i}`,
        text: opt,
        votes: []
      }))
    };

    batch.set(messageRef, {
      type: 'poll',
      poll: pollData,
      senderId,
      senderName,
      senderPhoto,
      createdAt: this.fs.serverTimestamp(),
      read: false,
      readAt: null,
      reactions: {}
    });

    const convRef = this.fs.doc(this.db, 'conversations', conversationId);
    batch.update(convRef, {
      lastMessageAt: this.fs.serverTimestamp(),
      lastMessage: `📊 Encuesta: ${poll.question}`,
      lastMessageSenderId: senderId
    });

    await batch.commit();
    return messageRef.id;
  }

  async votePoll(conversationId, messageId, optionId, userId) {
    const messageRef = this.fs.doc(this.db, 'conversations', conversationId, 'messages', messageId);
    const messageSnap = await this.fs.getDoc(messageRef);

    if (messageSnap.exists()) {
      const data = messageSnap.data();
      if (data.type !== 'poll' || !data.poll) return;

      const poll = data.poll;
      const options = poll.options.map(opt => {
        if (opt.id === optionId) {
          const votes = opt.votes || [];
          if (votes.includes(userId)) {
            return { ...opt, votes: votes.filter(id => id !== userId) };
          } else {
            return { ...opt, votes: [...votes, userId] };
          }
        } else if (!poll.multipleAnswers) {
          return { ...opt, votes: (opt.votes || []).filter(id => id !== userId) };
        }
        return opt;
      });

      await this.fs.updateDoc(messageRef, { 'poll.options': options });
    }
  }

  onMessagesSnapshot(conversationId, callback, onError) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'conversations', conversationId, 'messages'),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(50)
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(messages);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        if (typeof onError === 'function') onError(error);
        else console.error("Messages snapshot error:", error);
      }
    });
  }

  subscribeToConversations(userId, callback, onError) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'conversations'),
      this.fs.where('participants', 'array-contains', userId),
      this.fs.orderBy('lastMessageAt', 'desc')
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      const conversations = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      callback(conversations);
    }, (error) => {
      if (error.code !== 'permission-denied') {
        if (typeof onError === 'function') onError(error);
        else console.error("Conversations snapshot error:", error);
      }
    });
  }
}
export default DirectMessageService;