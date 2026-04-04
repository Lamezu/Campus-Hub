export class MessageService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async sendMessage(channelId, text, senderId, senderName, senderPhoto = null, attachments = null, replyTo = null, forwarded = false) {
    const messagesRef = this.fs.collection(this.db, 'channels', channelId, 'messages');
    const messageRef = this.fs.doc(messagesRef);

    await this.fs.setDoc(messageRef, {
      text,
      senderId,
      senderName,
      senderPhoto,
      createdAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp(),
      reactions: {},
      replyTo,
      forwarded,
      attachments: attachments ?? null,
      type: arguments[8] || (attachments?.length ? attachments[0].type : 'text') || 'text',
      metadata: arguments[9] || null
    });

    const channelRef = this.fs.doc(this.db, 'channels', channelId);
    await this.fs.updateDoc(channelRef, {
      lastMessage: text ? text.substring(0, 100) : (attachments ? '[Archivo]' : ''),
      lastMessageAt: this.fs.serverTimestamp(),
      lastMessageSenderId: senderId
    });

    return messageRef.id;
  }

  async editMessage(channelId, messageId, newText) {
    const messageRef = this.fs.doc(this.db, 'channels', channelId, 'messages', messageId);
    await this.fs.updateDoc(messageRef, {
      text: newText,
      edited: true,
      editedAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async deleteMessage(channelId, messageId) {
    const messageRef = this.fs.doc(this.db, 'channels', channelId, 'messages', messageId);
    const messageSnap = await this.fs.getDoc(messageRef);

    if (messageSnap.exists()) {
      const data = messageSnap.data();
      // Si el mensaje es un aviso de evento, limpiar el flag en el evento
      if (data.type === 'event' && data.metadata?.eventId) {
        const eventRef = this.fs.doc(this.db, 'events', data.metadata.eventId);
        const eventSnap = await this.fs.getDoc(eventRef);
        if (eventSnap.exists()) {
          await this.fs.updateDoc(eventRef, { publishedInChannel: false });
        }
      }
    }

    await this.fs.deleteDoc(messageRef);
  }

  async addReaction(channelId, messageId, emoji, userId) {
    const messageRef = this.fs.doc(this.db, 'channels', channelId, 'messages', messageId);
    const messageSnap = await this.fs.getDoc(messageRef);

    if (messageSnap.exists()) {
      const reactions = messageSnap.data().reactions || {};
      if (!reactions[emoji]) reactions[emoji] = [];
      if (!reactions[emoji].includes(userId)) {
        reactions[emoji].push(userId);
        await this.fs.updateDoc(messageRef, { reactions });
      }
    }
  }

  async removeReaction(channelId, messageId, emoji, userId) {
    const messageRef = this.fs.doc(this.db, 'channels', channelId, 'messages', messageId);
    const messageSnap = await this.fs.getDoc(messageRef);

    if (messageSnap.exists()) {
      const reactions = messageSnap.data().reactions || {};
      if (reactions[emoji]) {
        reactions[emoji] = reactions[emoji].filter(id => id !== userId);
        if (reactions[emoji].length === 0) delete reactions[emoji];
        await this.fs.updateDoc(messageRef, { reactions });
      }
    }
  }

  onMessagesSnapshot(channelId, callback) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'channels', channelId, 'messages'),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(50)
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse());
    });
  }

  async updateLastRead(channelId, userId) {
    const userReadRef = this.fs.doc(this.db, 'channels', channelId, 'lastRead', userId);
    await this.fs.setDoc(userReadRef, {
      lastReadAt: this.fs.serverTimestamp()
    });
  }
}
export default MessageService;