import { 
  collection, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  addDoc
} from 'firebase/firestore';

export class CallService {
  constructor(db) {
    this.db = db;
  }

  async initiateCall(callerId, receiverId, type = 'audio', callerName, callerPhoto = null) {
    const callRef = doc(collection(this.db, 'calls'));

    await setDoc(callRef, {
      callerId,
      receiverId,
      type,
      status: 'ringing',
      offer: null,
      answer: null,
      callerName,
      callerPhoto,
      createdAt: serverTimestamp(),
      endedAt: null
    });

    return callRef.id;
  }

  async setCallOffer(callId, offer) {
    const callRef = doc(this.db, 'calls', callId);
    await updateDoc(callRef, {
      offer,
      status: 'ringing'
    });
  }

  async answerCall(callId, answer) {
    const callRef = doc(this.db, 'calls', callId);
    await updateDoc(callRef, {
      answer,
      status: 'active',
      answeredAt: serverTimestamp()
    });
  }

  async rejectCall(callId) {
    const callRef = doc(this.db, 'calls', callId);
    await updateDoc(callRef, {
      status: 'rejected',
      endedAt: serverTimestamp()
    });
  }

  async endCall(callId) {
    const callRef = doc(this.db, 'calls', callId);
    await updateDoc(callRef, {
      status: 'ended',
      endedAt: serverTimestamp()
    });

    setTimeout(async () => {
      try {
        await deleteDoc(callRef);
      } catch (error) {
        console.error('Error cleaning up call:', error);
      }
    }, 30000);
  }

  async addCallerCandidate(callId, candidate) {
    const candidatesRef = collection(this.db, 'calls', callId, 'callerCandidates');
    await addDoc(candidatesRef, candidate);
  }

  async addReceiverCandidate(callId, candidate) {
    const candidatesRef = collection(this.db, 'calls', callId, 'receiverCandidates');
    await addDoc(candidatesRef, candidate);
  }

  async getCall(callId) {
    const callRef = doc(this.db, 'calls', callId);
    const callSnap = await getDoc(callRef);

    if (callSnap.exists()) {
      return {
        id: callSnap.id,
        ...callSnap.data()
      };
    }

    return null;
  }

  onCallSnapshot(callId, callback) {
    const callRef = doc(this.db, 'calls', callId);

    return onSnapshot(callRef, (snapshot) => {
      if (snapshot.exists()) {
        callback({
          id: snapshot.id,
          ...snapshot.data()
        });
      } else {
        callback(null);
      }
    });
  }

  onCallerCandidates(callId, callback) {
    const candidatesRef = collection(this.db, 'calls', callId, 'callerCandidates');

    return onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    });
  }

  onReceiverCandidates(callId, callback) {
    const candidatesRef = collection(this.db, 'calls', callId, 'receiverCandidates');

    return onSnapshot(candidatesRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          callback(change.doc.data());
        }
      });
    });
  }

  subscribeToIncomingCalls(userId, callback) {
    const callsRef = collection(this.db, 'calls');

    return onSnapshot(callsRef, (snapshot) => {
      const incomingCalls = [];

      snapshot.docs.forEach((doc) => {
        const call = doc.data();
        if (call.receiverId === userId && call.status === 'ringing') {
          incomingCalls.push({
            id: doc.id,
            ...call
          });
        }
      });

      callback(incomingCalls);
    });
  }

  async upgradeToVideo(callId) {
    const callRef = doc(this.db, 'calls', callId);
    await updateDoc(callRef, {
      type: 'video'
    });
  }
}

export default CallService;