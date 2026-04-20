import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { router } from 'expo-router';
import { useCurrentUser } from '@/contexts/UserContext';
import { escucharLlamadasEntrantes as ListeningCalls, aceptarLlamada as acceptingCall, rechazarLlamada as rejectingCall } from '@/services/callService';
import type { ActiveCall } from '@/types';
import { IncomingCallModal } from '@/components/dm/IncomingCallModal';

interface CallContextType {
    currentCall: ActiveCall | null;
}

const CallContext = createContext<CallContextType>({ currentCall: null });

export const useCall = () => useContext(CallContext);

export function CallProvider({ children }: { children: React.ReactNode }) {
    const { firebaseUser } = useCurrentUser();
    const [incomingCall, setIncomingCall] = useState<ActiveCall | null>(null);

    useEffect(() => {
        if (!firebaseUser?.uid) return;

        const unsubscribe = ListeningCalls(firebaseUser.uid, (call: ActiveCall) => {
            setIncomingCall(call);
        });

        return () => unsubscribe();
    }, [firebaseUser?.uid]);

    const handleAccept = async () => {
        if (!incomingCall) return;
        const callId = incomingCall.id;
        const userId = incomingCall.callerId;
        const type = incomingCall.type;

        setIncomingCall(null);
        router.push(`/dm/${userId}/call?callId=${callId}&type=${type}&isReceiver=true` as any);
    };

    const handleReject = async () => {
        if (!incomingCall) return;
        await rejectingCall(incomingCall.id);
        setIncomingCall(null);
    };

    return (
        <CallContext.Provider value={{ currentCall: incomingCall }}>
            {children}
            <IncomingCallModal
                visible={!!incomingCall}
                call={incomingCall}
                onAccept={handleAccept}
                onReject={handleReject}
            />
        </CallContext.Provider>
    );
}

