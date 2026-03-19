import { useEffect, useRef, useState, useCallback } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming } from 'lucide-react';
import {
  answerCall,
  endCall,
  addCallerCandidate,
  addReceiverCandidate,
  updateCallOffer,
  subscribeToCall,
  subscribeToCallerCandidates,
  subscribeToReceiverCandidates,
  ICE_SERVERS,
  type Call,
  type CallType
} from '../../services/firebase/callService';

interface CallScreenProps {
  callId: string;
  isCaller: boolean;
  callType: CallType;
  otherUserName: string;
  otherUserPhoto: string | null;
  onClose: () => void;
}

export default function CallScreen({ callId, isCaller, callType, otherUserName, otherUserPhoto, onClose }: CallScreenProps) {
  const [status, setStatus] = useState<'connecting' | 'ringing' | 'active' | 'ended'>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [duration, setDuration] = useState(0);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubsRef = useRef<(() => void)[]>([]);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);

  const startTimer = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, []);

  const cleanup = useCallback(() => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
  }, []);

  const handleHangUp = useCallback(async () => {
    cleanup();
    try { await endCall(callId); } catch {}
    onClose();
  }, [callId, cleanup, onClose]);

  const refreshRemoteMedia = useCallback(() => {
    const rs = remoteStreamRef.current;
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = rs;
      remoteAudioRef.current.play().catch(() => {});
    }
    if (callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = rs;
      remoteVideoRef.current.play().catch(() => {});
      if (rs.getVideoTracks().some(t => !t.muted)) {
        setRemoteVideoReady(true);
      }
    }
  }, [callType]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: callType === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false
      };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          stream = new MediaStream();
          setMediaError('No se detectó micrófono ni cámara. Comprueba los permisos del navegador y en Windows: Configuración → Privacidad → Micrófono/Cámara.');
        }
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;
      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => {});
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        const rs = remoteStreamRef.current;
        if (!rs.getTracks().find(t => t.id === event.track.id)) {
          rs.addTrack(event.track);
        }
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = rs;
          remoteAudioRef.current.play().catch(() => {});
        }
        if (callType === 'video' && remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = rs;
          remoteVideoRef.current.play().catch(() => {});
        }
        if (event.track.kind === 'video') {
          if (!event.track.muted) {
            setRemoteVideoReady(true);
          }
          event.track.onunmute = () => {
            setRemoteVideoReady(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
          };
        }
      };

      if (isCaller) {
        pc.onicecandidate = (e) => {
          if (e.candidate) addCallerCandidate(callId, e.candidate.toJSON()).catch(() => {});
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateCallOffer(callId, offer);
        if (cancelled) return;
        setStatus('ringing');

        const unsubCall = subscribeToCall(callId, async (call) => {
          if (!call) { handleHangUp(); return; }
          if (call.status === 'rejected' || call.status === 'ended' || call.status === 'missed') {
            cleanup(); onClose(); return;
          }
          if (call.answer && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(call.answer)).catch(() => {});
            for (const c of pendingCandidates.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
            }
            pendingCandidates.current = [];
            setStatus('active');
            startTimer();
          }
        });

        const unsubCandidates = subscribeToReceiverCandidates(callId, async (candidate) => {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            pendingCandidates.current.push(candidate);
          }
        });

        unsubsRef.current = [unsubCall, unsubCandidates];

      } else {
        pc.onicecandidate = (e) => {
          if (e.candidate) addReceiverCandidate(callId, e.candidate.toJSON()).catch(() => {});
        };

        const unsubCallStatus = subscribeToCall(callId, (call) => {
          if (!call) { handleHangUp(); return; }
          if (call.status === 'ended' || call.status === 'missed') { cleanup(); onClose(); }
        });

        const unsubCandidates = subscribeToCallerCandidates(callId, async (candidate) => {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => {});
          } else {
            pendingCandidates.current.push(candidate);
          }
        });

        unsubsRef.current = [unsubCallStatus, unsubCandidates];

        const waitForOffer = () => new Promise<RTCSessionDescriptionInit>((resolve, reject) => {
          const timer = setTimeout(() => { unsub(); reject(new Error('timeout')); }, 20000);
          const unsub = subscribeToCall(callId, (call) => {
            if (!call || call.status === 'ended' || call.status === 'missed' || call.status === 'rejected') {
              clearTimeout(timer); unsub(); reject(new Error('cancelled'));
            } else if (call.offer) {
              clearTimeout(timer); unsub(); resolve(call.offer);
            }
          });
          unsubsRef.current.push(unsub);
        });

        let offer: RTCSessionDescriptionInit;
        try {
          offer = await waitForOffer();
        } catch {
          cleanup(); onClose(); return;
        }
        if (cancelled) return;

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        for (const c of pendingCandidates.current) {
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
        }
        pendingCandidates.current = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await answerCall(callId, answer);
        setStatus('active');
        startTimer();
      }
    }

    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status !== 'active') return;
    refreshRemoteMedia();
  }, [status, refreshRemoteMedia]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const toggleMic = () => {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !micOn; });
    setMicOn(m => !m);
  };

  const toggleCam = () => {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !camOn; });
    setCamOn(c => !c);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const statusLabel =
    status === 'ringing' ? 'Llamando...' :
    status === 'connecting' ? 'Conectando...' :
    status === 'active' ? formatDuration(duration) : 'Llamada finalizada';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#1a1a2e',
      zIndex: 2000,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '48px 24px 40px'
    }}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      {callType === 'video' && (
        <>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              zIndex: 1,
              opacity: remoteVideoReady ? 1 : 0,
              transition: 'opacity 0.3s'
            }}
          />
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              position: 'absolute',
              bottom: '120px',
              right: '20px',
              width: '120px',
              height: '160px',
              objectFit: 'cover',
              borderRadius: '12px',
              border: '2px solid rgba(255,255,255,0.3)',
              zIndex: 10
            }}
          />
        </>
      )}

      <div style={{ textAlign: 'center', zIndex: 10, position: 'relative' }}>
        <div style={{
          width: '88px',
          height: '88px',
          borderRadius: '50%',
          backgroundColor: '#444',
          margin: '0 auto 16px',
          overflow: 'hidden',
          border: '3px solid rgba(255,255,255,0.2)'
        }}>
          {otherUserPhoto ? (
            <img src={otherUserPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px', color: '#fff', fontWeight: '700' }}>
              {otherUserName[0]?.toUpperCase() || '?'}
            </div>
          )}
        </div>
        <p style={{ color: '#fff', fontSize: '24px', fontWeight: '700', margin: '0 0 8px' }}>
          {otherUserName}
        </p>
        <p style={{ color: mediaError ? '#FF3B30' : 'rgba(255,255,255,0.6)', fontSize: '15px', margin: 0 }}>
          {mediaError ?? statusLabel}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', alignItems: 'center', zIndex: 10, position: 'relative' }}>
        <button
          onClick={toggleMic}
          style={{
            width: '56px', height: '56px', borderRadius: '50%',
            backgroundColor: micOn ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
          }}
        >
          {micOn ? <Mic size={24} /> : <MicOff size={24} />}
        </button>

        {callType === 'video' && (
          <button
            onClick={toggleCam}
            style={{
              width: '56px', height: '56px', borderRadius: '50%',
              backgroundColor: camOn ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)',
              border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff'
            }}
          >
            {camOn ? <Video size={24} /> : <VideoOff size={24} />}
          </button>
        )}

        <button
          onClick={handleHangUp}
          style={{
            width: '68px', height: '68px', borderRadius: '50%',
            backgroundColor: '#FF3B30', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
            boxShadow: '0 4px 20px rgba(255,59,48,0.5)'
          }}
        >
          <PhoneOff size={28} />
        </button>
      </div>
    </div>
  );
}

interface IncomingCallModalProps {
  call: Call;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ call, onAccept, onReject }: IncomingCallModalProps) {
  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      left: '50%',
      transform: 'translateX(-50%)',
      backgroundColor: '#1C1C1E',
      borderRadius: '20px',
      padding: '20px 24px',
      zIndex: 3000,
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      width: 'calc(100% - 40px)',
      maxWidth: '380px'
    }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#444', overflow: 'hidden', flexShrink: 0 }}>
        {call.callerPhoto ? (
          <img src={call.callerPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: '700', fontSize: '20px' }}>
            {call.callerName[0]?.toUpperCase() || '?'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontWeight: '700', fontSize: '15px', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {call.callerName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <PhoneIncoming size={12} />
          {call.type === 'video' ? 'Videollamada entrante' : 'Llamada entrante'}
        </p>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
        <button onClick={onReject} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#FF3B30', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <PhoneOff size={20} />
        </button>
        <button onClick={onAccept} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#34C759', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Phone size={20} />
        </button>
      </div>
    </div>
  );
}
