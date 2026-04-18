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
  runTransaction,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ICE_SERVERS, type CallType } from './callService';
export { ICE_SERVERS };

export type GroupCallStatus = 'ringing' | 'active' | 'ended';

export interface GroupCall {
  id: string;
  groupId: string;
  groupName: string;
  groupPhoto: string | null;
  initiatorId: string;
  initiatorName: string;
  initiatorPhoto: string | null;
  type: CallType;
  status: GroupCallStatus;
  memberIds: string[];
  activeParticipants: string[];
  pendingParticipants?: string[];
  rejectedParticipants?: string[];
  participantData: Record<string, { name: string; photo: string | null }>;
  createdAt: any;
}

export interface GroupCallConnection {
  callerId: string;
  receiverId: string;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  callerCamOff?: boolean;
  receiverCamOff?: boolean;
  callerVideoSignal?: number;
  receiverVideoSignal?: number;
  receiverOffer?: RTCSessionDescriptionInit;
  callerReanswer?: RTCSessionDescriptionInit;
}

export function getConnectionId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export async function createGroupCall(
  groupId: string,
  groupName: string,
  groupPhoto: string | null,
  initiatorId: string,
  initiatorName: string,
  initiatorPhoto: string | null,
  type: CallType,
  memberIds: string[],
  participantData: Record<string, { name: string; photo: string | null }>
): Promise<string> {
  const callRef = doc(collection(db, 'groupCalls'));
  await setDoc(callRef, {
    groupId,
    groupName,
    groupPhoto,
    initiatorId,
    initiatorName,
    initiatorPhoto,
    type,
    status: 'ringing',
    memberIds,
    activeParticipants: [initiatorId],
    participantData,
    createdAt: serverTimestamp()
  });
  return callRef.id;
}

export async function joinGroupCall(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, 'groupCalls', callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const current: string[] = data.activeParticipants ?? [];
    if (current.includes(uid)) return;
    const newParticipants = [...current, uid];
    tx.update(callRef, {
      activeParticipants: newParticipants,
      status: 'active'
    });
  }).catch(() => {});
}

export async function leaveGroupCall(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, 'groupCalls', callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const current: string[] = data.activeParticipants ?? [];
    const next = current.filter(u => u !== uid);
    if (next.length === 0) {
      tx.update(callRef, { activeParticipants: [], status: 'ended' });
    } else {
      tx.update(callRef, { activeParticipants: next });
    }
  });
}

export async function createConnection(
  callId: string,
  connId: string,
  callerId: string,
  receiverId: string
): Promise<void> {
  await setDoc(doc(db, 'groupCalls', callId, 'connections', connId), {
    callerId,
    receiverId,
    offer: null,
    answer: null,
    callerCamOff: false,
    receiverCamOff: false,
    callerVideoSignal: 0,
    receiverVideoSignal: 0,
    receiverOffer: null,
    callerReanswer: null
  });
}

export async function resetConnection(
  callId: string,
  connId: string
): Promise<void> {
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), {
    offer: null,
    answer: null,
    receiverOffer: null,
    callerReanswer: null,
    callerVideoSignal: 0,
    receiverVideoSignal: 0
  });
}

export async function updateConnectionOffer(
  callId: string,
  connId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { offer });
}

export async function answerConnection(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { answer });
}

export async function updateConnectionCamState(
  callId: string,
  connId: string,
  isCaller: boolean,
  camOff: boolean
): Promise<void> {
  const field = isCaller ? 'callerCamOff' : 'receiverCamOff';
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { [field]: camOff });
}

export async function signalConnectionVideo(
  callId: string,
  connId: string,
  isCaller: boolean
): Promise<void> {
  const field = isCaller ? 'callerVideoSignal' : 'receiverVideoSignal';
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { [field]: Date.now() });
}

export async function updateConnectionReceiverOffer(
  callId: string,
  connId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { receiverOffer: offer });
}

export async function updateConnectionCallerReanswer(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, 'groupCalls', callId, 'connections', connId), { callerReanswer: answer });
}

export async function addConnectionCallerCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(
    collection(db, 'groupCalls', callId, 'connections', connId, 'callerCandidates'),
    candidate
  );
}

export async function addConnectionReceiverCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(
    collection(db, 'groupCalls', callId, 'connections', connId, 'receiverCandidates'),
    candidate
  );
}

export function subscribeToGroupCall(
  callId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'groupCalls', callId), snap => {
    const callData = snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupCall) : null;
    callback(callData);
  });
}

export function subscribeToConnection(
  callId: string,
  connId: string,
  callback: (conn: GroupCallConnection | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, 'groupCalls', callId, 'connections', connId), snap => {
    callback(snap.exists() ? (snap.data() as GroupCallConnection) : null);
  });
}

export function subscribeToConnectionCallerCandidates(
  callId: string,
  connId: string,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'groupCalls', callId, 'connections', connId, 'callerCandidates'),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') callback(change.doc.data() as RTCIceCandidateInit);
      });
    }
  );
}

export function subscribeToConnectionReceiverCandidates(
  callId: string,
  connId: string,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'groupCalls', callId, 'connections', connId, 'receiverCandidates'),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') callback(change.doc.data() as RTCIceCandidateInit);
      });
    }
  );
}

export function subscribeToIncomingGroupCalls(
  userId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  const q = query(
    collection(db, 'groupCalls'),
    where('memberIds', 'array-contains', userId)
  );
  return onSnapshot(q, snap => {
    const relevant = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as GroupCall))
      .find(c =>
        (c.status === 'ringing' || c.status === 'active') &&
        c.initiatorId !== userId &&
        !c.activeParticipants.includes(userId)
      ) ?? null;
    callback(relevant);
  });
}

// Conference Waitroom Functions
export async function requestToJoinConference(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, 'groupCalls', callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const active = data.activeParticipants ?? [];
    const rejected = data.rejectedParticipants ?? [];
    
    if (active.includes(uid) || pending.includes(uid)) return;
    
    const newPending = [...pending, uid];
    const newRejected = rejected.filter(u => u !== uid);
    
    tx.update(callRef, { 
      pendingParticipants: newPending,
      rejectedParticipants: newRejected
    });
  });
}

export async function approveConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, 'groupCalls', callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const active = data.activeParticipants ?? [];
    
    const newPending = pending.filter(u => u !== uid);
    const newActive = [...active, uid];
    
    tx.update(callRef, { 
      pendingParticipants: newPending,
      activeParticipants: newActive,
      status: 'active'
    });
  });
}

export async function denyConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, 'groupCalls', callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const rejected = data.rejectedParticipants ?? [];
    
    const newPending = pending.filter(u => u !== uid);
    const newRejected = [...rejected, uid];
    
    tx.update(callRef, { 
      pendingParticipants: newPending,
      rejectedParticipants: newRejected
    });
  });
}
