import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import {
  subscribeToIncomingCalls,
  missCall,
  endCall,
  type Call,
  type CallType
} from '../services/firebase/callService';
import {
  subscribeToIncomingGroupCalls,
  leaveGroupCall as leaveGroupCallDM,
  type GroupCall
} from '../services/firebase/groupCallService';
import {
  subscribeToIncomingConferences,
  requestToJoinConference,
  subscribeToGroupCall as subscribeToConference,
  leaveGroupCall as leaveConferenceCall,
} from '../services/firebase/studyGroupConferenceService';
import { playCallTone, stopCallTone } from '../utils/toneGenerator';

export interface ActiveCall {
  callId: string;
  isCaller: boolean;
  type: CallType;
  otherUserName: string;
  otherUserPhoto: string | null;
}

export interface ActiveGroupCall {
  callId: string;
  isInitiator: boolean;
  type: CallType;
  groupName: string;
  groupPhoto: string | null;
  myUid: string;
  myName: string;
  myPhoto: string | null;
  myRole?: string;
}

export interface AwaitingConference {
  callId: string;
  groupName: string;
  groupPhoto: string | null;
  myUid: string;
  myName: string;
  myPhoto: string | null;
}

interface CallContextValue {
  incomingCall: Call | null;
  activeCall: ActiveCall | null;
  setActiveCall: (call: ActiveCall | null) => void;
  activeCallId: string | null;
  setActiveCallId: (id: string | null) => void;
  dismissIncoming: () => void;
  acceptIncoming: () => void;
  rejectIncoming: () => void;
  incomingGroupCall: GroupCall | null;
  activeGroupCall: ActiveGroupCall | null;
  setActiveGroupCall: (call: ActiveGroupCall | null) => void;
  activeGroupCallId: string | null;
  setActiveGroupCallId: (id: string | null) => void;
  dismissGroupIncoming: () => void;
  joinGroupIncoming: () => void;
  incomingConference: GroupCall | null;
  activeConference: ActiveGroupCall | null;
  setActiveConference: (call: ActiveGroupCall | null) => void;
  activeConferenceId: string | null;
  setActiveConferenceId: (id: string | null) => void;
  dismissConferenceIncoming: () => void;
  joinConferenceIncoming: () => void;
  awaitingConference: AwaitingConference | null;
  setAwaitingConference: (c: AwaitingConference | null) => void;
  requestConferenceJoin: (call: GroupCall) => void;
}

const CallContext = createContext<CallContextValue>({
  incomingCall: null,
  activeCall: null,
  setActiveCall: () => {},
  activeCallId: null,
  setActiveCallId: () => {},
  dismissIncoming: () => {},
  acceptIncoming: () => {},
  rejectIncoming: () => {},
  incomingGroupCall: null,
  activeGroupCall: null,
  setActiveGroupCall: () => {},
  activeGroupCallId: null,
  setActiveGroupCallId: () => {},
  dismissGroupIncoming: () => {},
  joinGroupIncoming: () => {},
  incomingConference: null,
  activeConference: null,
  setActiveConference: () => {},
  activeConferenceId: null,
  setActiveConferenceId: () => {},
  dismissConferenceIncoming: () => {},
  joinConferenceIncoming: () => {},
  awaitingConference: null,
  setAwaitingConference: () => {},
  requestConferenceJoin: () => {},
});

export function useCall() {
  return useContext(CallContext);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [incomingGroupCall, setIncomingGroupCall] = useState<GroupCall | null>(null);
  const [activeGroupCall, setActiveGroupCall] = useState<ActiveGroupCall | null>(null);
  const [activeGroupCallId, setActiveGroupCallId] = useState<string | null>(null);
  const [incomingConference, setIncomingConference] = useState<GroupCall | null>(null);
  const [activeConference, setActiveConference] = useState<ActiveGroupCall | null>(null);
  const [activeConferenceId, setActiveConferenceId] = useState<string | null>(null);
  const [awaitingConference, setAwaitingConference] = useState<AwaitingConference | null>(null);

  const activeCallIdRef = useRef<string | null>(null);
  const activeGroupCallIdRef = useRef<string | null>(null);
  const activeConferenceIdRef = useRef<string | null>(null);
  const incomingCallRef = useRef<Call | null>(null);
  const userIdRef = useRef<string | null>(null);

  const dismissedGroupCallIdsRef = useRef<Set<string>>(new Set());
  const dismissedConferenceIdsRef = useRef<Set<string>>(new Set());

  const callToneRef = useRef<string>('Zen');
  const callToneUrlRef = useRef<string | null>(null);
  const userNameRef = useRef<string>('Usuario');
  const userPhotoRef = useRef<string | null>(null);
  const userRoleRef = useRef<string>('student');
  const customAudioRef = useRef<HTMLAudioElement | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const groupDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conferenceDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { activeCallIdRef.current = activeCallId; }, [activeCallId]);
  useEffect(() => { activeGroupCallIdRef.current = activeGroupCallId; }, [activeGroupCallId]);
  useEffect(() => { activeConferenceIdRef.current = activeConferenceId; }, [activeConferenceId]);
  useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);
  useEffect(() => { userIdRef.current = userId; }, [userId]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUserId(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.settings?.callTone) callToneRef.current = data.settings.callTone;
        callToneUrlRef.current = data.settings?.callToneUrl ?? null;
        if (data.displayName) userNameRef.current = data.displayName;
        if (data.photoURL !== undefined) userPhotoRef.current = data.photoURL ?? null;
        if (data.role) userRoleRef.current = data.role;
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    function handleUnload() {
      const uid = userIdRef.current;
      if (!uid) return;
      const callId = activeCallIdRef.current;
      const groupCallId = activeGroupCallIdRef.current;
      const conferenceId = activeConferenceIdRef.current;
      if (callId) endCall(callId).catch(() => {});
      if (groupCallId) leaveGroupCallDM(groupCallId, uid).catch(() => {});
      if (conferenceId) leaveConferenceCall(conferenceId, uid).catch(() => {});
    }
    window.addEventListener('beforeunload', handleUnload);
    window.addEventListener('pagehide', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      window.removeEventListener('pagehide', handleUnload);
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToIncomingCalls(userId, (call) => {
      if (call && !activeCallIdRef.current && !activeGroupCallIdRef.current) {
        if (call.callerId === userId) return;
        setIncomingCall(call);
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.currentTime = 0;
          customAudioRef.current = null;
        }
        if (callToneRef.current === 'Personalizado' && callToneUrlRef.current) {
          const audio = new Audio(callToneUrlRef.current);
          audio.loop = true;
          audio.play().catch(() => {});
          customAudioRef.current = audio;
        } else {
          const preset = callToneRef.current === 'Personalizado' ? 'Zen' : callToneRef.current;
          playCallTone(preset);
        }
        if (missTimerRef.current) clearTimeout(missTimerRef.current);
        missTimerRef.current = setTimeout(() => {
          missCall(call.id).catch(() => {});
          setIncomingCall(null);
          stopRinging();
        }, 45000);
      } else if (!call) {
        setIncomingCall(null);
        stopRinging();
        if (missTimerRef.current) clearTimeout(missTimerRef.current);
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToIncomingGroupCalls(userId, (call) => {
      if (
        call &&
        !activeCallIdRef.current &&
        !activeGroupCallIdRef.current &&
        !incomingCallRef.current &&
        !dismissedGroupCallIdsRef.current.has(call.id)
      ) {
        setIncomingGroupCall(call);
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.currentTime = 0;
          customAudioRef.current = null;
        }
        if (callToneRef.current === 'Personalizado' && callToneUrlRef.current) {
          const audio = new Audio(callToneUrlRef.current);
          audio.loop = true;
          audio.play().catch(() => {});
          customAudioRef.current = audio;
        } else {
          const preset = callToneRef.current === 'Personalizado' ? 'Zen' : callToneRef.current;
          playCallTone(preset);
        }
        if (groupDismissTimerRef.current) clearTimeout(groupDismissTimerRef.current);
        groupDismissTimerRef.current = setTimeout(() => {
          setIncomingGroupCall(null);
          stopRinging();
        }, 45000);
      } else if (!call) {
        setIncomingGroupCall(null);
        stopRinging();
        if (groupDismissTimerRef.current) clearTimeout(groupDismissTimerRef.current);
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const unsub = subscribeToIncomingConferences(userId, (call) => {
      if (
        call &&
        !activeCallIdRef.current &&
        !activeGroupCallIdRef.current &&
        !activeConferenceIdRef.current &&
        !incomingCallRef.current &&
        !dismissedConferenceIdsRef.current.has(call.id)
      ) {
        setIncomingConference(call);
        if (customAudioRef.current) {
          customAudioRef.current.pause();
          customAudioRef.current.currentTime = 0;
          customAudioRef.current = null;
        }
        if (callToneRef.current === 'Personalizado' && callToneUrlRef.current) {
          const audio = new Audio(callToneUrlRef.current);
          audio.loop = true;
          audio.play().catch(() => {});
          customAudioRef.current = audio;
        } else {
          const preset = callToneRef.current === 'Personalizado' ? 'Zen' : callToneRef.current;
          playCallTone(preset);
        }
        if (conferenceDismissTimerRef.current) clearTimeout(conferenceDismissTimerRef.current);
        conferenceDismissTimerRef.current = setTimeout(() => {
          setIncomingConference(null);
          stopRinging();
        }, 45000);
      } else if (!call) {
        setIncomingConference(null);
        stopRinging();
        if (conferenceDismissTimerRef.current) clearTimeout(conferenceDismissTimerRef.current);
      }
    });
    return unsub;
  }, [userId]);

  function stopRinging() {
    if (customAudioRef.current) {
      customAudioRef.current.pause();
      customAudioRef.current.currentTime = 0;
      customAudioRef.current = null;
    }
    stopCallTone();
  }

  function dismissIncoming() {
    setIncomingCall(null);
    stopRinging();
    if (missTimerRef.current) clearTimeout(missTimerRef.current);
  }

  function acceptIncoming() {
    if (!incomingCall) return;
    setActiveCall({
      callId: incomingCall.id,
      isCaller: false,
      type: incomingCall.type,
      otherUserName: incomingCall.callerName,
      otherUserPhoto: incomingCall.callerPhoto ?? null
    });
    setActiveCallId(incomingCall.id);
    dismissIncoming();
  }

  function rejectIncoming() {
    if (incomingCall) endCall(incomingCall.id).catch(() => {});
    dismissIncoming();
  }

  function dismissGroupIncoming() {
    if (incomingGroupCall) dismissedGroupCallIdsRef.current.add(incomingGroupCall.id);
    setIncomingGroupCall(null);
    stopRinging();
    if (groupDismissTimerRef.current) clearTimeout(groupDismissTimerRef.current);
  }

  function joinGroupIncoming() {
    if (!incomingGroupCall || !userId) return;
    setActiveGroupCall({
      callId: incomingGroupCall.id,
      isInitiator: false,
      type: incomingGroupCall.type,
      groupName: incomingGroupCall.groupName,
      groupPhoto: incomingGroupCall.groupPhoto ?? null,
      myUid: userId,
      myName: userNameRef.current,
      myPhoto: userPhotoRef.current,
      myRole: userRoleRef.current,
    });
    setActiveGroupCallId(incomingGroupCall.id);
    dismissedGroupCallIdsRef.current.add(incomingGroupCall.id);
    setIncomingGroupCall(null);
    stopRinging();
    if (groupDismissTimerRef.current) clearTimeout(groupDismissTimerRef.current);
  }

  function dismissConferenceIncoming() {
    if (incomingConference) dismissedConferenceIdsRef.current.add(incomingConference.id);
    setIncomingConference(null);
    stopRinging();
    if (conferenceDismissTimerRef.current) clearTimeout(conferenceDismissTimerRef.current);
  }

  function joinConferenceIncoming() {
    if (!incomingConference || !userId) return;
    dismissedConferenceIdsRef.current.add(incomingConference.id);
    requestConferenceJoin(incomingConference);
    setIncomingConference(null);
    stopRinging();
    if (conferenceDismissTimerRef.current) clearTimeout(conferenceDismissTimerRef.current);
  }

  function requestConferenceJoin(call: GroupCall) {
    if (!userId) return;
    setAwaitingConference({
      callId: call.id,
      groupName: call.groupName,
      groupPhoto: call.groupPhoto ?? null,
      myUid: userId,
      myName: userNameRef.current,
      myPhoto: userPhotoRef.current
    });
    requestToJoinConference(call.id, userId).catch(() => {});
  }

  useEffect(() => {
    if (!awaitingConference || !userId) return;
    const unsub = subscribeToConference(awaitingConference.callId, (call) => {
      if (!call || call.status === 'ended') {
        setAwaitingConference(null);
        return;
      }
      if (call.activeParticipants.includes(userId)) {
        setActiveConference({
          callId: call.id,
          isInitiator: false,
          type: call.type,
          groupName: call.groupName,
          groupPhoto: call.groupPhoto ?? null,
          myUid: userId,
          myName: userNameRef.current,
          myPhoto: userPhotoRef.current,
          myRole: userRoleRef.current,
        });
        setActiveConferenceId(call.id);
        setAwaitingConference(null);
      } else if (call.rejectedParticipants?.includes(userId)) {
        setAwaitingConference(null);
      }
    });
    return unsub;
  }, [awaitingConference?.callId, userId]);

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      setActiveCall,
      activeCallId,
      setActiveCallId,
      dismissIncoming,
      acceptIncoming,
      rejectIncoming,
      incomingGroupCall,
      activeGroupCall,
      setActiveGroupCall,
      activeGroupCallId,
      setActiveGroupCallId,
      dismissGroupIncoming,
      joinGroupIncoming,
      incomingConference,
      activeConference,
      setActiveConference,
      activeConferenceId,
      setActiveConferenceId,
      dismissConferenceIncoming,
      joinConferenceIncoming,
      awaitingConference,
      setAwaitingConference,
      requestConferenceJoin,
    }}>
      {children}
    </CallContext.Provider>
  );
}
