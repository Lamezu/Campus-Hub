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
import { playCallTone, stopCallTone } from '../utils/toneGenerator';

export interface ActiveCall {
  callId: string;
  isCaller: boolean;
  type: CallType;
  otherUserName: string;
  otherUserPhoto: string | null;
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
}

const CallContext = createContext<CallContextValue>({
  incomingCall: null,
  activeCall: null,
  setActiveCall: () => {},
  activeCallId: null,
  setActiveCallId: () => {},
  dismissIncoming: () => {},
  acceptIncoming: () => {},
  rejectIncoming: () => {}
});

export function useCall() {
  return useContext(CallContext);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const callToneRef = useRef<string>('Trompeta');
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUserId(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;
    const unsub = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        const tone = snap.data().settings?.callTone;
        if (tone) callToneRef.current = tone;
      }
    });
    return unsub;
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const unsub = subscribeToIncomingCalls(userId, (call) => {
      if (call && !activeCallId) {
        setIncomingCall(call);
        playCallTone(callToneRef.current);
        if (missTimerRef.current) clearTimeout(missTimerRef.current);
        missTimerRef.current = setTimeout(() => {
          missCall(call.id).catch(() => {});
          setIncomingCall(null);
          stopRinging();
        }, 30000);
      } else if (!call) {
        setIncomingCall(null);
        stopRinging();
        if (missTimerRef.current) clearTimeout(missTimerRef.current);
      }
    });

    return unsub;
  }, [userId, activeCallId]);

  function stopRinging() {
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

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      setActiveCall,
      activeCallId,
      setActiveCallId,
      dismissIncoming,
      acceptIncoming,
      rejectIncoming
    }}>
      {children}
    </CallContext.Provider>
  );
}
