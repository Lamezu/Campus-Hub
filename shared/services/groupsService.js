export class GroupsService {
    constructor(db, firestore) {
        this.db = db;
        this.fs = firestore;
    }

    async createGroup(groupData, creatorId) {
        const groupRef = this.fs.doc(this.fs.collection(this.db, 'studyGroups'));
        const groupId = groupRef.id;

        await this.fs.setDoc(groupRef, {
            ...groupData,
            createdBy: creatorId,
            createdAt: this.fs.serverTimestamp(),
            memberCount: (groupData.memberIds || []).length
        });

        return groupId;
    }

    async getGroup(groupId) {
        const groupRef = this.fs.doc(this.db, 'studyGroups', groupId);
        const groupSnap = await this.fs.getDoc(groupRef);
        return groupSnap.exists() ? { id: groupSnap.id, ...groupSnap.data() } : null;
    }

    async getGroups(limitCount = 20) {
        const q = this.fs.query(
            this.fs.collection(this.db, 'studyGroups'),
            this.fs.orderBy('createdAt', 'desc'),
            this.fs.limit(limitCount)
        );

        const snapshot = await this.fs.getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    async updateGroup(groupId, updates) {
        const groupRef = this.fs.doc(this.db, 'studyGroups', groupId);
        await this.fs.updateDoc(groupRef, {
            ...updates,
            updatedAt: this.fs.serverTimestamp()
        });
    }

    async deleteGroup(groupId) {
        const groupRef = this.fs.doc(this.db, 'studyGroups', groupId);
        await this.fs.deleteDoc(groupRef);
    }

    async joinGroup(groupId, userId) {
        const groupRef = this.fs.doc(this.db, 'studyGroups', groupId);
        await this.fs.updateDoc(groupRef, {
            memberIds: this.fs.arrayUnion(userId),
            memberCount: this.fs.increment(1)
        });
    }

    async leaveGroup(groupId, userId) {
        const groupRef = this.fs.doc(this.db, 'studyGroups', groupId);
        await this.fs.updateDoc(groupRef, {
            memberIds: this.fs.arrayRemove(userId),
            memberCount: this.fs.increment(-1)
        });
    }

    subscribeToGroups(callback) {
        const q = this.fs.query(
            this.fs.collection(this.db, 'studyGroups'),
            this.fs.orderBy('createdAt', 'desc')
        );

        return this.fs.onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error("Groups subscription error:", error);
            }
        });
    }

    async sendGroupMessage(groupId, messageData) {
        const messagesRef = this.fs.collection(this.db, 'studyGroups', groupId, 'messages');
        const msgRef = this.fs.doc(messagesRef);
        await this.fs.setDoc(msgRef, {
            ...messageData,
            createdAt: this.fs.serverTimestamp(),
            edited: false,
            editedAt: null,
            reactions: {},
        });
        await this.fs.updateDoc(this.fs.doc(this.db, 'studyGroups', groupId), {
            lastMessage: messageData.text || '[Adjunto]',
            lastMessageAt: this.fs.serverTimestamp(),
            lastMessageSenderId: messageData.senderId,
        });
        return msgRef.id;
    }

    async editGroupMessage(groupId, messageId, newText) {
        const msgRef = this.fs.doc(this.db, 'studyGroups', groupId, 'messages', messageId);
        await this.fs.updateDoc(msgRef, {
            text: newText,
            edited: true,
            editedAt: this.fs.serverTimestamp(),
        });
    }

    async deleteGroupMessage(groupId, messageId) {
        const msgRef = this.fs.doc(this.db, 'studyGroups', groupId, 'messages', messageId);
        await this.fs.deleteDoc(msgRef);
    }

    async toggleGroupMessageReaction(groupId, messageId, emoji, userId) {
        const msgRef = this.fs.doc(this.db, 'studyGroups', groupId, 'messages', messageId);
        const snap = await this.fs.getDoc(msgRef);
        if (!snap.exists()) return;
        const reactions = snap.data().reactions || {};
        const users = reactions[emoji] || [];
        if (users.includes(userId)) {
            await this.fs.updateDoc(msgRef, { [`reactions.${emoji}`]: this.fs.arrayRemove(userId) });
        } else {
            await this.fs.updateDoc(msgRef, { [`reactions.${emoji}`]: this.fs.arrayUnion(userId) });
        }
    }

    subscribeToGroupMessages(groupId, limitCount, callback) {
        const q = this.fs.query(
            this.fs.collection(this.db, 'studyGroups', groupId, 'messages'),
            this.fs.orderBy('createdAt', 'desc'),
            this.fs.limit(limitCount)
        );
        return this.fs.onSnapshot(q, (snapshot) => {
            callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (error) => {
            if (error.code !== 'permission-denied') {
                console.error('Group messages subscription error:', error);
            }
        });
    }

    async getAllUsers() {
        const snap = await this.fs.getDocs(this.fs.collection(this.db, 'users'));
        return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    }
}
export default GroupsService;
