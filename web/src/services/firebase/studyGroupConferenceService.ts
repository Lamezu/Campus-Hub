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
  arrayRemove,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { ICE_SERVERS, type CallType } from './callService';
export { ICE_SERVERS };
export type { GroupCallStatus, GroupCallConnection } from './groupCallService';
export type { GroupCall } from './groupCallService';
import type { GroupCall } from './groupCallService';

const COL = 'studyGroupConferences';

export function getConnectionId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`;
}

export async function createConference(
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
  const callRef = doc(collection(db, COL));
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
    pendingParticipants: [],
    rejectedParticipants: [],
    participantData,
    createdAt: serverTimestamp()
  });
  return callRef.id;
}

export async function joinGroupCall(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const current: string[] = data.activeParticipants ?? [];
    if (current.includes(uid)) return;
    tx.update(callRef, { activeParticipants: [...current, uid], status: 'active' });
  }).catch(() => {});
}

export async function leaveGroupCall(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, COL, callId);
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
  await setDoc(doc(db, COL, callId, 'connections', connId), {
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

export async function updateConnectionOffer(
  callId: string,
  connId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, COL, callId, 'connections', connId), { offer });
}

export async function answerConnection(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, COL, callId, 'connections', connId), { answer });
}

export async function updateConnectionCamState(
  callId: string,
  connId: string,
  isCaller: boolean,
  camOff: boolean
): Promise<void> {
  const field = isCaller ? 'callerCamOff' : 'receiverCamOff';
  await updateDoc(doc(db, COL, callId, 'connections', connId), { [field]: camOff });
}

export async function signalConnectionVideo(
  callId: string,
  connId: string,
  isCaller: boolean
): Promise<void> {
  const field = isCaller ? 'callerVideoSignal' : 'receiverVideoSignal';
  await updateDoc(doc(db, COL, callId, 'connections', connId), { [field]: Date.now() });
}

export async function updateConnectionReceiverOffer(
  callId: string,
  connId: string,
  offer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, COL, callId, 'connections', connId), { receiverOffer: offer });
}

export async function updateConnectionCallerReanswer(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit
): Promise<void> {
  await updateDoc(doc(db, COL, callId, 'connections', connId), { callerReanswer: answer });
}

export async function addConnectionCallerCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(collection(db, COL, callId, 'connections', connId, 'callerCandidates'), candidate);
}

export async function addConnectionReceiverCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit
): Promise<void> {
  await addDoc(collection(db, COL, callId, 'connections', connId, 'receiverCandidates'), candidate);
}

export function subscribeToGroupCall(
  callId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COL, callId), snap => {
    callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupCall) : null);
  });
}

export function subscribeToConnection(
  callId: string,
  connId: string,
  callback: (conn: any | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COL, callId, 'connections', connId), snap => {
    callback(snap.exists() ? snap.data() : null);
  });
}

export function subscribeToConnectionCallerCandidates(
  callId: string,
  connId: string,
  callback: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, COL, callId, 'connections', connId, 'callerCandidates'),
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
    collection(db, COL, callId, 'connections', connId, 'receiverCandidates'),
    snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added') callback(change.doc.data() as RTCIceCandidateInit);
      });
    }
  );
}

export async function requestToJoinConference(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const pending: string[] = data.pendingParticipants ?? [];
    const active: string[] = data.activeParticipants ?? [];
    if (pending.includes(uid) || active.includes(uid)) return;
    const rejected: string[] = data.rejectedParticipants ?? [];
    tx.update(callRef, {
      pendingParticipants: [...pending, uid],
      rejectedParticipants: rejected.filter(u => u !== uid),
    });
  });
}

export async function approveConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const active: string[] = data.activeParticipants ?? [];
    if (active.includes(uid)) return;
    tx.update(callRef, {
      pendingParticipants: (data.pendingParticipants ?? []).filter((u: string) => u !== uid),
      activeParticipants: [...active, uid],
      status: 'active',
    });
  });
}

export async function denyConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    tx.update(callRef, {
      pendingParticipants: (data.pendingParticipants ?? []).filter((u: string) => u !== uid),
      rejectedParticipants: [...(data.rejectedParticipants ?? []), uid],
    });
  });
}

export function subscribeToActiveConferenceForGroup(
  groupId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('groupId', '==', groupId));
  return onSnapshot(q, snap => {
    const active = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as GroupCall))
      .find(c => c.status === 'ringing' || c.status === 'active') ?? null;
    callback(active);
  });
}

export function subscribeToIncomingConferences(
  userId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  const q = query(collection(db, COL), where('memberIds', 'array-contains', userId));
  return onSnapshot(q, snap => {
    const relevant = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as GroupCall))
      .find(c =>
        (c.status === 'ringing' || c.status === 'active') &&
        c.initiatorId !== userId
      ) ?? null;
    callback(relevant);
  });
}
