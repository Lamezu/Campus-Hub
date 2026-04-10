import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, MonitorUp, PhoneOff, Camera, AlertTriangle } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { useAlert } from '@/contexts/AlertContext';
import { db, auth } from '@/config/firebase';
import type { CallStatus, CallType, ActiveCall } from '@/types';
import * as callService from '@/services/callService';

const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function ControlBtn({ icon, label, onClick, active }: { icon: React.ReactNode; label: string; onClick: () => void; active?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 80 }}>
      <button
        onClick={onClick}
        style={{
          width: 60, height: 60, borderRadius: 30,
          backgroundColor: active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.15)',
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background-color 0.2s',
        }}
      >
        {icon}
      </button>
      <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

export default function CallScreen() {
  const { showAlert } = useAlert();
  const { userId } = useParams<{ userId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callType = (searchParams.get('type') === 'video' ? 'video' : 'audio') as CallType;
  const initialCallId = searchParams.get('callId');
  const isReceiverParam = searchParams.get('isReceiver') === 'true';

  const currentUser = auth.currentUser;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const [currentCallId, setCurrentCallId] = useState<string | null>(initialCallId || null);
  const [participantName, setParticipantName] = useState('Usuario');
  const [participantPhoto, setParticipantPhoto] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Pulse animation state
  const [pulseScale, setPulseScale] = useState(1);
  useEffect(() => {
    const id = setInterval(() => {
      setPulseScale(s => s === 1 ? 1.25 : 1);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const stopTracks = () => {
    localStream?.getTracks().forEach(t => t.stop());
  };

  const handleHangUp = (notify = true) => {
    if (notify && currentCallId && currentUser) {
      const convId = [currentUser.uid, userId!].sort().join('_');
      if (callStatus === 'ringing') {
        if (isReceiverParam) callService.rechazarLlamada(currentCallId);
        else callService.registrarLlamadaPerdida(currentCallId, convId, currentUser.uid, currentUser.displayName || 'Usuario', currentUser.photoURL);
      } else {
        callService.terminarLlamada(currentCallId, duration, convId, currentUser.uid, currentUser.displayName ?? undefined, currentUser.photoURL);
      }
    }
    stopTracks();
    if (pc.current) pc.current.close();
    if (timerRef.current) clearInterval(timerRef.current);
    navigate(-1);
  };

  useEffect(() => {
    if (!userId) return;
    getDoc(doc(db, 'users', userId)).then(snap => {
      if (snap.exists()) {
        const u = snap.data();
        setParticipantName(u.displayName ?? 'Usuario');
        setParticipantPhoto(u.photoURL ?? null);
      }
    });
  }, [userId]);

  useEffect(() => {
    const init = async () => {
      let stream: MediaStream | null = null;

      // Permission-safe media acquisition
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { width: 640, height: 480, frameRate: 30 } : false
        });
        setLocalStream(stream);
      } catch (err: any) {
        const msg = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? `Sin acceso al ${callType === 'video' ? 'micrófono/cámara' : 'micrófono'}. Actívalo en Configuración del sistema.`
          : 'No se pudo acceder a los dispositivos de audio/vídeo.';
        setPermissionError(msg);
        // Continue call without local stream
      }

      try {
        const peer = new RTCPeerConnection(ICE_CONFIG);
        pc.current = peer;

        if (stream) {
          stream.getTracks().forEach(track => peer.addTrack(track, stream!));
        }

        peer.onicecandidate = (event) => {
          if (event.candidate && currentCallId) {
            callService.agregarCandidatoICE(currentCallId, event.candidate.toJSON(), currentUser!.uid);
          }
        };

        peer.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setRemoteStream(event.streams[0]);
          }
        };

        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') {
            handleHangUp();
          }
        };

        if (isReceiverParam && initialCallId) {
          const callSnap = await getDoc(doc(db, 'calls', initialCallId));
          if (callSnap.exists()) {
            const callData = callSnap.data() as ActiveCall;
            await peer.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await callService.aceptarLlamada(initialCallId, answer);
          }
        } else {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          const convId = [currentUser!.uid, userId!].sort().join('_');
          const newCallId = await callService.iniciarLlamada(
            convId, currentUser!.uid, currentUser!.displayName || 'Usuario',
            currentUser!.photoURL, userId!, callType, offer
          );
          setCurrentCallId(newCallId);
        }
      } catch (err) {
        console.error('Failed to initialize call connection:', err);
      }
    };

    init();
    return () => {
      stopTracks();
      if (pc.current) pc.current.close();
    };
  }, []);

  useEffect(() => {
    if (!currentCallId) return;
    const unsubStatus = callService.suscribirEstadoLlamada(currentCallId, (call) => {
      setCallStatus(call.status);
      if (call.status === 'active' && !isReceiverParam && call.answer && pc.current && !pc.current.remoteDescription) {
        pc.current.setRemoteDescription(new RTCSessionDescription(call.answer));
      }
      if (call.status === 'ended' || call.status === 'rejected' || call.status === 'missed') {
        handleHangUp(false);
      }
    });

    const unsubIce = callService.suscribirCandidatosICE(currentCallId, (candidates) => {
      candidates.forEach(async (c) => {
        if (c.senderId !== currentUser!.uid && pc.current) {
          try {
            await pc.current.addIceCandidate(new RTCIceCandidate(c));
          } catch { }
        }
      });
    });

    return () => { unsubStatus(); unsubIce(); };
  }, [currentCallId]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  // 45s timeout for unanswered outgoing calls
  useEffect(() => {
    if (callStatus === 'ringing' && !isReceiverParam && currentCallId) {
      const timeout = setTimeout(() => {
        const convId = [currentUser!.uid, userId!].sort().join('_');
        callService.registrarLlamadaPerdida(currentCallId, convId, currentUser!.uid, currentUser!.displayName || 'Usuario', currentUser!.photoURL);
        handleHangUp();
      }, 45000);
      return () => clearTimeout(timeout);
    }
  }, [callStatus, currentCallId]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = isMuted; });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(t => { t.enabled = isVideoOff; });
      setIsVideoOff(!isVideoOff);
    }
  };

  const initials = participantName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0a0a1a', display: 'flex', flexDirection: 'column' }}>
      {/* Permission error banner */}
      {permissionError && (
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
          backgroundColor: 'rgba(255, 149, 0, 0.9)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
        }}>
          <AlertTriangle size={18} color="#fff" />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 }}>{permissionError}</span>
        </div>
      )}

      {/* Video area (video calls) */}
      {callType === 'video' && (
        <div style={{ position: 'absolute', inset: 0 }}>
          {remoteStream ? (
            <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.4 }}>
              <Camera size={56} color="rgba(255,255,255,0.5)" />
              <span style={{ color: '#fff', fontSize: 14 }}>Esperando video remoto...</span>
            </div>
          )}

          {localStream && !isVideoOff && (
            <div style={{ position: 'absolute', top: 56, right: 20, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.3)' }}>
              <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>
      )}

      {/* Main UI */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '80px 24px 48px', zIndex: 1 }}>
        {/* Top: avatar + name + status */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{ position: 'relative', width: 140, height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', width: 140, height: 140, borderRadius: 70,
              backgroundColor: 'rgba(255,255,255,0.15)',
              transform: `scale(${pulseScale})`,
              transition: 'transform 1s ease-in-out',
            }} />
            {participantPhoto
              ? <img src={participantPhoto} alt="" style={{ width: 110, height: 110, borderRadius: 55, objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }} />
              : <div style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: '#0A84FF', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '3px solid rgba(255,255,255,0.5)', position: 'relative', zIndex: 1 }}>
                  <span style={{ fontSize: 40, fontWeight: 'bold', color: '#fff' }}>{initials}</span>
                </div>
            }
          </div>
          <span style={{ color: '#fff', fontSize: 28, fontWeight: '700', textAlign: 'center' }}>{participantName}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 16, fontVariant: 'tabular-nums' }}>
            {callStatus === 'ringing'
              ? (isReceiverParam ? 'Llamada entrante...' : 'Llamando...')
              : formatDuration(duration)}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
            {callType === 'video' ? '📹 Videollamada' : '📞 Llamada de voz'}
          </span>
        </div>

        {/* Bottom: controls + hang up */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40 }}>
          {callStatus === 'active' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, width: '100%' }}>
              <ControlBtn
                icon={isMuted ? <MicOff size={24} color="#fff" /> : <Mic size={24} color="#fff" />}
                label={isMuted ? 'Activar mic' : 'Silenciar'}
                onClick={toggleMute}
                active={isMuted}
              />
              <ControlBtn
                icon={isDeaf ? <VolumeX size={24} color="#fff" /> : <Volume2 size={24} color="#fff" />}
                label={isDeaf ? 'Escuchar' : 'Silencio'}
                onClick={() => setIsDeaf(v => !v)}
                active={isDeaf}
              />
              {callType === 'video' && (
                <ControlBtn
                  icon={isVideoOff ? <VideoOff size={24} color="#fff" /> : <Video size={24} color="#fff" />}
                  label={isVideoOff ? 'Activar cám.' : 'Cámara'}
                  onClick={toggleVideo}
                  active={isVideoOff}
                />
              )}
              <ControlBtn
                icon={<MonitorUp size={24} color="#fff" />}
                label="Pantalla"
                onClick={() => showAlert({ title: 'Próximamente', message: 'Compartir pantalla próximamente', type: 'info' })}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => handleHangUp()}
              style={{
                width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF3B30',
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(255,59,48,0.5)',
              }}
            >
              <PhoneOff size={28} color="#fff" />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' }}>
              {callStatus === 'ringing' ? 'Cancelar' : 'Colgar'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
