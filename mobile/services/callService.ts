import { getCallService as sharedGetCallService } from './shared';
import { sendMessage } from './dmService';
import { ActiveCall, CallType } from '@/types';

export const iniciarLlamada = async (
    conversationId: string,
    callerId: string,
    callerName: string,
    callerPhoto: string | null,
    receiverId: string,
    type: CallType,
    offer: any
): Promise<string> => {
    const callId = await (sharedGetCallService() as any).initiateCall(callerId, receiverId, type, callerName, callerPhoto);
    await (sharedGetCallService() as any).setCallOffer(callId, offer);
    return callId;
};

export const aceptarLlamada = async (callId: string, answer: any) => {
    await (sharedGetCallService() as any).answerCall(callId, answer);
};

export const rechazarLlamada = async (callId: string) => {
    await (sharedGetCallService() as any).rejectCall(callId);
};

export const terminarLlamada = async (
    callId: string,
    duration: number,
    conversationId?: string,
    callerId?: string,
    callerName?: string,
    callerPhoto?: string | null
) => {
    await (sharedGetCallService() as any).endCall(callId);
    if (conversationId && callerId) {
        const min = Math.floor(duration / 60);
        const sec = duration % 60;
        const durationStr = `${min}:${sec.toString().padStart(2, '0')}`;
        await sendMessage(
            conversationId,
            callerId,
            callerName || 'Sistema',
            callerPhoto || null,
            `📞 Llamada finalizada (${durationStr})`
        );
    }
};

export const registrarLlamadaPerdida = async (
    callId: string,
    conversationId: string,
    callerId: string,
    callerName: string,
    callerPhoto: string | null
) => {
    await (sharedGetCallService() as any).rejectCall(callId);
    await sendMessage(
        conversationId,
        callerId,
        callerName,
        callerPhoto,
        '🚫 Llamada perdida'
    );
};

export const agregarCandidatoICE = async (callId: string, candidate: any, senderId: string) => {
    const call = await sharedGetCallService().getCall(callId) as any;
    if (call && call.callerId === senderId) {
        await sharedGetCallService().addCallerCandidate(callId, candidate);
    } else if (call) {
        await sharedGetCallService().addReceiverCandidate(callId, candidate);
    }
};

export const suscribirEstadoLlamada = (callId: string, callback: (call: ActiveCall) => void) => {
    return (sharedGetCallService() as any).onCallSnapshot(callId, (data: any) => {
        if (data) callback({ id: data.id, ...data } as ActiveCall);
    });
};

export const suscribirCandidatosICE = (callId: string, callback: (candidates: any[]) => void) => {
    let callerCands: any[] = [];
    let receiverCands: any[] = [];

    const unsub1 = (sharedGetCallService() as any).onCallerCandidates(callId, (cand: any) => {
        callerCands.push(cand);
        callback([...callerCands, ...receiverCands]);
    });

    const unsub2 = (sharedGetCallService() as any).onReceiverCandidates(callId, (cand: any) => {
        receiverCands.push(cand);
        callback([...callerCands, ...receiverCands]);
    });

    return () => {
        unsub1();
        unsub2();
    };
};

export const escucharLlamadasEntrantes = (userId: string, callback: (call: ActiveCall) => void) => {
    return (sharedGetCallService() as any).subscribeToIncomingCalls(userId, (calls: any[]) => {
        if (calls.length > 0) {
            callback({ id: calls[0].id, ...calls[0] } as ActiveCall);
        }
    });
};
