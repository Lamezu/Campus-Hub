import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';
import {
  subscribeToIncomingCalls,
  missCall,
  type Call
} from '../services/firebase/callService';

interface CallContextValue {
  incomingCall: Call | null;
  activeCallId: string | null;
  setActiveCallId: (id: string | null) => void;
  dismissIncoming: () => void;
}

const CallContext = createContext<CallContextValue>({
  incomingCall: null,
  activeCallId: null,
  setActiveCallId: () => {},
  dismissIncoming: () => {}
});

export function useCall() {
  return useContext(CallContext);
}

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const ringingRef = useRef<HTMLAudioElement | null>(null);
  const missTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, user => setUserId(user?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!userId) return;

    const unsub = subscribeToIncomingCalls(userId, (call) => {
      if (call && !activeCallId) {
        setIncomingCall(call);

        if (!ringingRef.current) {
          ringingRef.current = new Audio('/sounds/ringtone.mp3');
          ringingRef.current.loop = true;
        }
        ringingRef.current.play().catch(() => {});

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
    if (ringingRef.current) {
      ringingRef.current.pause();
      ringingRef.current.currentTime = 0;
    }
  }

  function dismissIncoming() {
    setIncomingCall(null);
    stopRinging();
    if (missTimerRef.current) clearTimeout(missTimerRef.current);
  }

  return (
    <CallContext.Provider value={{ incomingCall, activeCallId, setActiveCallId, dismissIncoming }}>
      {children}
    </CallContext.Provider>
  );
}
