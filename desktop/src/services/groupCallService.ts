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
  getDoc,
  type Unsubscribe
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ICE_SERVERS, type CallType } from './callService';

export { ICE_SERVERS };

const GROUP_COL = 'groupCalls';
const CONF_COL = 'studyGroupConferences';

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
  participantData: Record<string, { name?: string; displayName?: string; photo?: string | null; photoURL?: string | null }>;
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
  callerSharing?: boolean;
  receiverSharing?: boolean;
  callerMuted?: boolean;
  receiverMuted?: boolean;
  callerDeafened?: boolean;
  receiverDeafened?: boolean;
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
  participantData: Record<string, any>,
  isConference: boolean = false
): Promise<string> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const callRef = doc(collection(db, col));
  await setDoc(callRef, {
    groupId,
    groupName,
    groupPhoto,
    initiatorId,
    initiatorName,
    initiatorPhoto,
    type,
    status: isConference ? 'active' : 'ringing',
    memberIds,
    activeParticipants: [initiatorId],
    pendingParticipants: [],
    rejectedParticipants: [],
    participantData,
    createdAt: serverTimestamp()
  });
  return callRef.id;
}

export const createConference = (
  groupId: string, groupName: string, groupPhoto: string | null,
  initiatorId: string, initiatorName: string, initiatorPhoto: string | null,
  type: CallType, memberIds: string[], participantData: any
) => createGroupCall(groupId, groupName, groupPhoto, initiatorId, initiatorName, initiatorPhoto, type, memberIds, participantData, true);

export async function joinGroupCall(callId: string, uid: string, isConference: boolean = false): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const callRef = doc(db, col, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data();
    const current: string[] = data.activeParticipants ?? [];
    if (current.includes(uid)) return;

    let updateData: any = {
      activeParticipants: [...current, uid],
      status: 'active'
    };

    // Ensure our participant data is in the call document or update if it's generic
    const currentPData = data.participantData?.[uid];
    const isGeneric = !currentPData || currentPData.displayName === 'Usuario' || currentPData.displayName === 'Member' || currentPData.displayName === 'Anonymous';

    if (isGeneric) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const bestName = [u.displayName, u.username, u.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous');
        updateData[`participantData.${uid}`] = {
          displayName: bestName || u.displayName || u.username || u.name || 'Usuario',
          photoURL: u.photoURL || u.photo || null
        };
      }
    }

    tx.update(callRef, updateData);
  }).catch(() => {});
}

export async function leaveGroupCall(callId: string, uid: string, isConference: boolean = false): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const callRef = doc(db, col, callId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(callRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const current: string[] = data.activeParticipants ?? [];
      const next = current.filter(u => u !== uid);
      if (next.length === 0 || data.initiatorId === uid) {
        tx.update(callRef, { activeParticipants: [], status: 'ended' });
      } else {
        tx.update(callRef, { activeParticipants: next });
      }
    });
  } catch (err: any) {
    if (err.code !== 'permission-denied') {
      console.warn("Silent error leaving group call:", err.message);
    }
  }
}

export async function createConnection(
  callId: string,
  connId: string,
  callerId: string,
  receiverId: string,
  isConference: boolean = false,
  sharing: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await setDoc(doc(db, col, callId, 'connections', connId), {
    callerId,
    receiverId,
    offer: null,
    answer: null,
    callerCamOff: false,
    receiverCamOff: false,
    callerVideoSignal: 0,
    receiverVideoSignal: 0,
    receiverOffer: null,
    callerReanswer: null,
    callerSharing: sharing,
    receiverSharing: false,
  });
}

export async function resetConnection(
  callId: string,
  connId: string,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await updateDoc(doc(db, col, callId, 'connections', connId), {
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
  offer: RTCSessionDescriptionInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await updateDoc(doc(db, col, callId, 'connections', connId), { offer });
}

export async function answerConnection(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await updateDoc(doc(db, col, callId, 'connections', connId), { answer });
}

export async function updateConnectionCamState(
  callId: string,
  connId: string,
  isCaller: boolean,
  camOff: boolean,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const field = isCaller ? 'callerCamOff' : 'receiverCamOff';
  await updateDoc(doc(db, col, callId, 'connections', connId), { [field]: camOff });
}

export async function updateConnectionSharingState(
  callId: string,
  connId: string,
  isCaller: boolean,
  sharing: boolean,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const field = isCaller ? 'callerSharing' : 'receiverSharing';
  await updateDoc(doc(db, col, callId, 'connections', connId), { [field]: sharing });
}

export async function updateConnectionMuteState(
  callId: string,
  connId: string,
  isCaller: boolean,
  muted: boolean,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const field = isCaller ? 'callerMuted' : 'receiverMuted';
  await updateDoc(doc(db, col, callId, 'connections', connId), { [field]: muted });
}

export async function updateConnectionDeafenState(
  callId: string,
  connId: string,
  isCaller: boolean,
  deafened: boolean,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const field = isCaller ? 'callerDeafened' : 'receiverDeafened';
  await updateDoc(doc(db, col, callId, 'connections', connId), { [field]: deafened });
}

export async function signalConnectionVideo(
  callId: string,
  connId: string,
  isCaller: boolean,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  const field = isCaller ? 'callerVideoSignal' : 'receiverVideoSignal';
  await updateDoc(doc(db, col, callId, 'connections', connId), { [field]: Date.now() });
}

export async function updateConnectionReceiverOffer(
  callId: string,
  connId: string,
  offer: RTCSessionDescriptionInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await updateDoc(doc(db, col, callId, 'connections', connId), { receiverOffer: offer });
}

export async function updateConnectionCallerReanswer(
  callId: string,
  connId: string,
  answer: RTCSessionDescriptionInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await updateDoc(doc(db, col, callId, 'connections', connId), { callerReanswer: answer });
}

export async function addConnectionCallerCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await addDoc(
    collection(db, col, callId, 'connections', connId, 'callerCandidates'),
    candidate
  );
}

export async function addConnectionReceiverCandidate(
  callId: string,
  connId: string,
  candidate: RTCIceCandidateInit,
  isConference: boolean = false
): Promise<void> {
  const col = isConference ? CONF_COL : GROUP_COL;
  await addDoc(
    collection(db, col, callId, 'connections', connId, 'receiverCandidates'),
    candidate
  );
}

export function subscribeToGroupCall(
  callId: string,
  callback: (call: GroupCall | null) => void,
  isConference: boolean = false
): Unsubscribe {
  const col = isConference ? CONF_COL : GROUP_COL;
  return onSnapshot(doc(db, col, callId), {
    next: snap => {
      const callData = snap.exists() ? ({ id: snap.id, ...snap.data() } as GroupCall) : null;
      callback(callData);
    },
    error: err => {
      console.error("Group call subscription error:", err);
      if (err.code === 'permission-denied') {
        callback(null);
      }
    }
  });
}

export function subscribeToConnection(
  callId: string,
  connId: string,
  callback: (conn: GroupCallConnection | null) => void,
  isConference: boolean = false
): Unsubscribe {
  const col = isConference ? CONF_COL : GROUP_COL;
  return onSnapshot(doc(db, col, callId, 'connections', connId), snap => {
    callback(snap.exists() ? (snap.data() as GroupCallConnection) : null);
  });
}

export function subscribeToConnectionCallerCandidates(
  callId: string,
  connId: string,
  callback: (candidate: RTCIceCandidateInit) => void,
  isConference: boolean = false
): Unsubscribe {
  const col = isConference ? CONF_COL : GROUP_COL;
  return onSnapshot(
    collection(db, col, callId, 'connections', connId, 'callerCandidates'),
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
  callback: (candidate: RTCIceCandidateInit) => void,
  isConference: boolean = false
): Unsubscribe {
  const col = isConference ? CONF_COL : GROUP_COL;
  return onSnapshot(
    collection(db, col, callId, 'connections', connId, 'receiverCandidates'),
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
    collection(db, GROUP_COL),
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

export async function requestToJoinConference(callId: string, uid: string, userData?: any): Promise<void> {
  const callRef = doc(db, CONF_COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const active = data.activeParticipants ?? [];
    const rejected = data.rejectedParticipants ?? [];
    if (active.includes(uid) || pending.includes(uid)) return;

    let finalUserData = userData || {};
    const isGeneric = !finalUserData.displayName || finalUserData.displayName === 'Member' || finalUserData.displayName === 'Usuario' || finalUserData.displayName === 'Anonymous';

    if (isGeneric) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const bestName = [u.displayName, u.username, u.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous');
        finalUserData.displayName = bestName || u.displayName || u.username || u.name || finalUserData.displayName || 'Usuario';
        finalUserData.photoURL = u.photoURL || u.photo || finalUserData.photoURL || null;
      }
    }

    tx.update(callRef, {
      pendingParticipants: [...pending, uid],
      rejectedParticipants: rejected.filter(u => u !== uid),
      [`participantData.${uid}`]: finalUserData
    });
  });
}

export async function approveConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, CONF_COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const active = data.activeParticipants ?? [];
    if (active.includes(uid)) return;
    let updateData: any = {
      pendingParticipants: pending.filter(u => u !== uid),
      activeParticipants: [...active, uid],
      status: 'active'
    };

    const currentPData = data.participantData?.[uid];
    const isGeneric = !currentPData || currentPData.displayName === 'Usuario' || currentPData.displayName === 'Member' || currentPData.displayName === 'Anonymous';

    if (isGeneric) {
      const userSnap = await getDoc(doc(db, 'users', uid));
      if (userSnap.exists()) {
        const u = userSnap.data();
        const bestName = [u.displayName, u.username, u.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous');
        updateData[`participantData.${uid}`] = {
          displayName: bestName || u.displayName || u.username || u.name || 'Usuario',
          photoURL: u.photoURL || u.photo || null
        };
      }
    }

    tx.update(callRef, updateData);
  });
}

export async function denyConferenceParticipant(callId: string, uid: string): Promise<void> {
  const callRef = doc(db, CONF_COL, callId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(callRef);
    if (!snap.exists()) return;
    const data = snap.data() as GroupCall;
    const pending = data.pendingParticipants ?? [];
    const rejected = data.rejectedParticipants ?? [];
    tx.update(callRef, {
      pendingParticipants: pending.filter(u => u !== uid),
      rejectedParticipants: [...rejected, uid]
    });
  });
}

export function subscribeToActiveConferenceForGroup(
  groupId: string,
  userId: string,
  callback: (call: GroupCall | null) => void
): Unsubscribe {
  const q = query(
    collection(db, CONF_COL),
    where('groupId', '==', groupId),
    where('memberIds', 'array-contains', userId)
  );
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
  const q = query(collection(db, CONF_COL), where('memberIds', 'array-contains', userId));
  return onSnapshot(q, snap => {
    const relevant = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as GroupCall))
      .find(c =>
        (c.status === 'ringing' || c.status === 'active') &&
        c.initiatorId !== userId &&
        !c.activeParticipants.includes(userId) &&
        !c.rejectedParticipants?.includes(userId)
      ) ?? null;
    callback(relevant);
  });
}