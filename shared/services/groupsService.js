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

    async getAllUsers() {
        const snap = await this.fs.getDocs(this.fs.collection(this.db, 'users'));
        return snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    }
}
export default GroupsService;
