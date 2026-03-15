import {
    collection, doc, getDoc, setDoc, updateDoc,
    serverTimestamp, onSnapshot, addDoc, query,
    orderBy, Timestamp, where, limit
} from 'firebase/firestore';
import { db } from '@/config/firebase';
import type { ActiveCall, CallType } from '@/types';
import { sendMessage } from './dmService';

export const iniciarLlamada = async (
    conversationId: string,
    callerId: string,
    callerName: string,
    callerPhoto: string | null,
    receiverId: string,
    type: CallType,
    offer: any
): Promise<string> => {
    try {
        const callRef = doc(collection(db, 'calls'));
        const callId = callRef.id;

        const newCall: Partial<ActiveCall> = {
            id: callId,
            conversationId,
            callerId,
            callerName,
            callerPhoto,
            receiverId,
            type,
            status: 'ringing',
            startedAt: null,
            endedAt: null,
            duration: 0,
            offer
        };

        await setDoc(callRef, {
            ...newCall,
            createdAt: serverTimestamp()
        });

        return callId;
    } catch (error) {
        throw error;
    }
};

export const aceptarLlamada = async (callId: string, answer: any) => {
    try {
        const callRef = doc(db, 'calls', callId);
        await updateDoc(callRef, {
            status: 'active',
            startedAt: serverTimestamp(),
            answer
        });
    } catch (error) {
        throw error;
    }
};

export const rechazarLlamada = async (callId: string) => {
    try {
        const callRef = doc(db, 'calls', callId);
        await updateDoc(callRef, {
            status: 'rejected',
            endedAt: serverTimestamp()
        });
    } catch (error) {
        throw error;
    }
};

export const terminarLlamada = async (
    callId: string,
    duration: number,
    conversationId?: string,
    callerId?: string,
    callerName?: string,
    callerPhoto?: string | null
) => {
    try {
        const callRef = doc(db, 'calls', callId);
        await updateDoc(callRef, {
            status: 'ended',
            endedAt: serverTimestamp(),
            duration
        });

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
    } catch (error) {
    }
};

export const registrarLlamadaPerdida = async (
    callId: string,
    conversationId: string,
    callerId: string,
    callerName: string,
    callerPhoto: string | null
) => {
    try {
        const callRef = doc(db, 'calls', callId);
        await updateDoc(callRef, {
            status: 'missed',
            endedAt: serverTimestamp()
        });

        await sendMessage(
            conversationId,
            callerId,
            callerName,
            callerPhoto,
            '🚫 Llamada perdida'
        );
    } catch (error) {
    }
};

export const agregarCandidatoICE = async (callId: string, candidate: any, senderId: string) => {
    try {
        const candidatesRef = collection(db, 'calls', callId, 'candidates');
        await addDoc(candidatesRef, {
            ...candidate,
            senderId,
            createdAt: serverTimestamp()
        });
    } catch (error) {
    }
};

export const suscribirEstadoLlamada = (callId: string, callback: (call: ActiveCall) => void) => {
    return onSnapshot(doc(db, 'calls', callId), (snapshot) => {
        if (snapshot.exists()) {
            callback({ id: snapshot.id, ...snapshot.data() } as ActiveCall);
        }
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error('CallState Snapshot error:', error);
        }
    });
};

export const suscribirCandidatosICE = (callId: string, callback: (candidates: any[]) => void) => {
    const q = query(collection(db, 'calls', callId, 'candidates'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
        const candidates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        callback(candidates);
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error('IceCandidates Snapshot error:', error);
        }
    });
};

export const escucharLlamadasEntrantes = (userId: string, callback: (call: ActiveCall) => void) => {
    const q = query(
        collection(db, 'calls'),
        where('receiverId', '==', userId),
        where('status', '==', 'ringing'),
        limit(1)
    );

    return onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            callback({ id: doc.id, ...doc.data() } as ActiveCall);
        }
    }, (error) => {
        if (error.code !== 'permission-denied') {
            console.error('IncomingCalls Snapshot error:', error);
        }
    });
};
