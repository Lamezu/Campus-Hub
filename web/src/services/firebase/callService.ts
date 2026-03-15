import {
  collection,
  doc,
  setDoc,
  updateDoc,
  addDoc,
  onSnapshot,
  serverTimestamp,
  query,
  where,
  Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';

export type CallType = 'audio' | 'video';
export type CallStatus = 'ringing' | 'active' | 'ended' | 'rejected' | 'missed';

export interface Call {
  id: string;
  callerId: string;
  receiverId: string;
  callerName: string;
  callerPhoto: string | null;
  receiverName?: string;
  receiverPhoto?: string | null;
  type: CallType;
  status: CallStatus;
  createdAt: any;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
}

export async function createCall(
  callerId: string,
  receiverId: string,
  callerName: string,
  callerPhoto: string | null,
  receiverName: string,
  receiverPhoto: string | null,
  type: CallType
): Promise<string> {
  const callRef = doc(collection(db, 'calls'));
  await setDoc(callRef, {
    callerId,
    receiverId,
    callerName,
    callerPhoto,
    receiverName,
    receiverPhoto,
    type,
    status: 'ringing',
    offer: null,
    answer: null,
    createdAt: serverTimestamp()
  });
  return callRef.id;
}

export async function updateCallOffer(
  callId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { offer });
}

export async function answerCall(
  callId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { answer, status: 'active' });
}

export async function rejectCall(callId: string): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { status: 'rejected' });
}

export async function endCall(callId: string): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { status: 'ended' });
}

export async function missCall(callId: string): Promise<void> {
  await updateDoc(doc(db, 'calls', callId), { status: 'missed' });
}

export async function addCallerCandidate(
  callId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(collection(db, 'calls', callId, 'callerCandidates'), candidate);
}

export async function addReceiverCandidate(
  callId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(collection(db, 'calls', callId, 'receiverCandidates'), candidate);
}

export function subscribeToCall(
  callId: string,
  callback: (call: Call | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'calls', callId), snap => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Call) : null);
  });
}

export function subscribeToCallerCandidates(
  callId: string,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'calls', callId, 'callerCandidates'), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') callback(change.doc.data() as RTCIceCandidateInit);
    });
  });
}

export function subscribeToReceiverCandidates(
  callId: string,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  return onSnapshot(collection(db, 'calls', callId, 'receiverCandidates'), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') callback(change.doc.data() as RTCIceCandidateInit);
    });
  });
}

export function subscribeToIncomingCalls(
  userId: string,
  callback: (call: Call | null) => void
): Unsubscribe {
  const q = query(
    collection(db, 'calls'),
    where('receiverId', '==', userId),
    where('status', '==', 'ringing')
  );
  return onSnapshot(q, snap => {
    if (!snap.empty) {
      const d = snap.docs[0];
      callback({ id: d.id, ...d.data() } as Call);
    } else {
      callback(null);
    }
  });
}

export const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};
