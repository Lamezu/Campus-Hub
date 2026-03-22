export class CallService {
  constructor(db, firestore) {
    this.db = db;
    this.fs = firestore;
  }

  async initiateCall(callerId, receiverId, type, callerName, callerPhoto) {
    const callRef = this.fs.doc(this.fs.collection(this.db, 'calls'));
    const callId = callRef.id;

    await this.fs.setDoc(callRef, {
      status: 'incoming',
      callerId,
      receiverId,
      type,
      callerName,
      callerPhoto,
      createdAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp()
    });

    return callId;
  }

  async setCallOffer(callId, offer) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    await this.fs.updateDoc(callRef, { offer, updatedAt: this.fs.serverTimestamp() });
  }

  async answerCall(callId, answer) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    await this.fs.updateDoc(callRef, {
      status: 'ongoing',
      answer,
      answeredAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async rejectCall(callId) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    await this.fs.updateDoc(callRef, {
      status: 'rejected',
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async endCall(callId) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    await this.fs.updateDoc(callRef, {
      status: 'ended',
      endedAt: this.fs.serverTimestamp(),
      updatedAt: this.fs.serverTimestamp()
    });
  }

  async getCall(callId) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    const callSnap = await this.fs.getDoc(callRef);
    return callSnap.exists() ? { id: callSnap.id, ...callSnap.data() } : null;
  }

  async addCallerCandidate(callId, candidate) {
    const candRef = this.fs.doc(this.fs.collection(this.db, 'calls', callId, 'callerCandidates'));
    await this.fs.setDoc(candRef, candidate);
  }

  async addReceiverCandidate(callId, candidate) {
    const candRef = this.fs.doc(this.fs.collection(this.db, 'calls', callId, 'receiverCandidates'));
    await this.fs.setDoc(candRef, candidate);
  }

  onCallSnapshot(callId, callback) {
    const callRef = this.fs.doc(this.db, 'calls', callId);
    return this.fs.onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() });
      } else {
        callback(null);
      }
    });
  }

  onCallerCandidates(callId, callback) {
    const q = this.fs.collection(this.db, 'calls', callId, 'callerCandidates');
    return this.fs.onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') callback(change.doc.data());
      });
    });
  }

  onReceiverCandidates(callId, callback) {
    const q = this.fs.collection(this.db, 'calls', callId, 'receiverCandidates');
    return this.fs.onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') callback(change.doc.data());
      });
    });
  }

  subscribeToIncomingCalls(userId, callback, onError) {
    const q = this.fs.query(
      this.fs.collection(this.db, 'calls'),
      this.fs.where('receiverId', '==', userId),
      this.fs.where('status', '==', 'incoming'),
      this.fs.orderBy('createdAt', 'desc'),
      this.fs.limit(1)
    );

    return this.fs.onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, onError);
  }
}
export default CallService;