import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { Mic, MicOff, Volume2, VolumeX, Video, VideoOff, MonitorUp, PhoneOff, Camera, AlertTriangle } from 'lucide-react';
import { ThemedText } from '@/components/themed-text';
import { useAlert } from '@/contexts/AlertContext';
import { useTranslation } from '@/contexts/LanguageContext';
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
  const { t } = useTranslation();
  const { userId, groupId } = useParams<{ userId?: string; groupId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const callType = (searchParams.get('type') === 'video' ? 'video' : 'audio') as CallType;
  const initialCallId = searchParams.get('callId');
  const isReceiverParam = searchParams.get('isReceiver') === 'true';

  const currentUser = auth.currentUser;
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [transmissions, setTransmissions] = useState<{ [uid: string]: { stream: MediaStream; name: string; photo?: string | null } }>({});
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  const pcs = useRef<{ [uid: string]: RTCPeerConnection }>({});
  const [currentCallId, setCurrentCallId] = useState<string | null>(initialCallId || null);
  const [participantName, setParticipantName] = useState(t('chat.call_type', { defaultValue: 'Llamada' }));
  const [participantPhoto, setParticipantPhoto] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<CallStatus>('ringing');
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isDeaf, setIsDeaf] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Pulse animation state
  const [pulseScale, setPulseScale] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setPulseScale((s: number) => s === 1 ? 1.25 : 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (localVideoRef.current && localStream) localVideoRef.current.srcObject = localStream;
  }, [localStream]);

  const stopTracks = () => {
    localStream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    Object.values(transmissions).forEach((t: { stream: MediaStream }) => t.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop()));
  };

  const closeConnections = () => {
    Object.values(pcs.current).forEach((pc: RTCPeerConnection) => pc.close());
    pcs.current = {};
  };

  const handleHangUp = (notify = true) => {
    if (notify && currentCallId && currentUser && !groupId) {
      const convId = [currentUser.uid, userId!].sort().join('_');
      if (callStatus === 'ringing') {
        if (isReceiverParam) callService.endCall(currentCallId);
        else callService.endCall(currentCallId);
      } else {
        callService.endCall(currentCallId);
      }
    }
    stopTracks();
    closeConnections();
    if (timerRef.current) clearInterval(timerRef.current);
    navigate(-1);
  };

  useEffect(() => {
    if (userId) {
      getDoc(doc(db, 'users', userId)).then((snap: any) => {
        if (snap.exists()) {
          const u = snap.data();
          setParticipantName(u.displayName ?? t('chat.unknown_user'));
          setParticipantPhoto(u.photoURL ?? null);
        }
      });
    } else if (groupId) {
       getDoc(doc(db, 'studyGroups', groupId)).then((snap: any) => {
         if (snap.exists()) setParticipantName(snap.data().name || t('chat.group_type'));
       });
    }
  }, [userId, groupId]);

  useEffect(() => {
    const init = async () => {
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: callType === 'video' ? { width: 640, height: 480, frameRate: 30 } : false
        });
        setLocalStream(stream);
      } catch (err: any) {
        setPermissionError(t('chat.error_no_media', { defaultValue: 'No se pudo acceder a los dispositivos de audio/vídeo.' }));
      }

      if (groupId) {
        setCallStatus('active');
        // Logic for group calls would go here (joining a session and creating multiple PCs)
        // For now, let's stabilize the architecture
      } else if (userId) {
        const peer = new RTCPeerConnection(ICE_CONFIG);
        pcs.current[userId] = peer;
        if (stream) stream.getTracks().forEach(track => peer.addTrack(track, stream!));

        peer.onicecandidate = (event) => {
          if (event.candidate && currentCallId) callService.addCallerCandidate(currentCallId, event.candidate.toJSON());
        };
        peer.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setTransmissions((prev: any) => ({
              ...prev,
              [userId]: { stream: event.streams[0], name: participantName, photo: participantPhoto }
            }));
          }
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'disconnected' || peer.connectionState === 'failed') handleHangUp();
        };

        if (isReceiverParam && initialCallId) {
          const callSnap = await getDoc(doc(db, 'calls', initialCallId));
          if (callSnap.exists()) {
            const callData = callSnap.data() as ActiveCall;
            await peer.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answer = await peer.createAnswer();
            await peer.setLocalDescription(answer);
            await callService.answerCall(initialCallId, answer);
          }
        } else {
          // Si quisiéramos iniciar llamada desde aquí, usaríamos la lógica de CallScreen principal
          // pero como estamos usando el overlay global, esto suele ser redundante
        }
      }
    };

    init();
    return () => {
      stopTracks();
      closeConnections();
    };
  }, []);

  useEffect(() => {
    if (!currentCallId || groupId) return;
    const unsubStatus = callService.subscribeToCall(currentCallId, async (call) => {
      if (!call) return;
      setCallStatus(call.status as CallStatus);
      const pc = pcs.current[userId!];
      if (call.status === 'active' && !isReceiverParam && call.answer && pc && !pc.remoteDescription) {
        pc.setRemoteDescription(new RTCSessionDescription(call.answer));
      }
      if (['ended', 'rejected', 'missed'].includes(call.status)) handleHangUp(false);
    });

    const unsubIce = callService.subscribeToCallerCandidates(currentCallId, (c) => {
      const pc = pcs.current[userId!];
      if (pc && pc.remoteDescription) pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
    });

    return () => { unsubStatus(); unsubIce(); };
  }, [currentCallId]);

  useEffect(() => {
    if (callStatus !== 'active') return;
    timerRef.current = setInterval(() => setDuration((d: number) => d + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callStatus]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(t => t.enabled = isVideoOff);
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#0a0a1a', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {permissionError && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, backgroundColor: 'rgba(255, 149, 0, 0.9)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px' }}>
          <AlertTriangle size={18} color="#fff" />
          <span style={{ color: '#fff', fontSize: 13, fontWeight: '500', flex: 1 }}>{permissionError}</span>
        </div>
      )}

      {/* Video Grid */}
      <div style={{ flex: 1, position: 'relative', display: 'grid', gridTemplateColumns: Object.keys(transmissions).length > 1 ? 'repeat(2, 1fr)' : '1fr', gap: 2, padding: 2 }}>
        {Object.entries(transmissions).map(([uid, t]) => (
          <div key={uid} style={{ position: 'relative', backgroundColor: '#1a1a2e', borderRadius: 8, overflow: 'hidden' }}>
            <ParticipantVideo stream={t.stream} />
            <div style={{ position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4 }}>
              <span style={{ color: '#fff', fontSize: 12 }}>{t.name}</span>
            </div>
          </div>
        ))}
        {Object.keys(transmissions).length === 0 && callType === 'video' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, opacity: 0.4, color: '#fff' }}>
            <Camera size={56} />
            <span>{t('chat.waiting_participants', { defaultValue: 'Esperando participantes...' })}</span>
          </div>
        )}
      </div>

      {/* Local Preview */}
      {localStream && !isVideoOff && (
        <div style={{ position: 'absolute', top: 56, right: 20, width: 120, height: 160, borderRadius: 12, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.3)', zIndex: 10 }}>
          <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>
      )}

      {/* Controls Overlay */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 40, background: 'linear-gradient(transparent, rgba(0,0,0,0.8))', zIndex: 11 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#fff', fontSize: 24, fontWeight: '700' }}>{participantName}</span>
          <span style={{ color: 'rgba(255,255,255,0.6)', fontVariant: 'tabular-nums' }}>{callStatus === 'ringing' ? t('chat.connecting', { defaultValue: 'Conectando...' }) : formatDuration(duration)}</span>
        </div>

        <div style={{ display: 'flex', gap: 24 }}>
          <ControlBtn icon={isMuted ? <MicOff size={24} color="#fff" /> : <Mic size={24} color="#fff" />} label={isMuted ? t('chat.unmute', { defaultValue: 'Activar' }) : t('chat.mute', { defaultValue: 'Silencio' })} onClick={toggleMute} active={isMuted} />
          <ControlBtn icon={isDeaf ? <VolumeX size={24} color="#fff" /> : <Volume2 size={24} color="#fff" />} label={t('chat.audio', { defaultValue: 'Audio' })} onClick={() => setIsDeaf(!isDeaf)} active={isDeaf} />
          {callType === 'video' && <ControlBtn icon={isVideoOff ? <VideoOff size={24} color="#fff" /> : <Video size={24} color="#fff" />} label={t('chat.camera', { defaultValue: 'Cámara' })} onClick={toggleVideo} active={isVideoOff} />}
          <button onClick={() => handleHangUp()} style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF3B30', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(255,59,48,0.3)' }}>
            <PhoneOff size={24} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ParticipantVideo({ stream }: { stream: MediaStream }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);
  return <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
}
