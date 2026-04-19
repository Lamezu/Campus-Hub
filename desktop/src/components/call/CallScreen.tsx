import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../config/firebase';
import { useTranslation } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import {
  Mic, MicOff, Headphones, HeadphoneOff, Video, VideoOff, PhoneOff, Settings, ChevronUp, MonitorUp, MoreHorizontal, Eye, EyeOff, X,
  Volume2, VolumeX, Maximize2, Minimize2, ScreenShare, User, Phone, Monitor, MonitorOff, Check, ExternalLink, Users
} from 'lucide-react';
import { ScreenShareModal } from './ScreenShareModal';
import { playCallTone, stopCallTone } from '../../utils/toneGenerator';
import {
  ICE_SERVERS,
  answerCall,
  updateCallOffer,
  updateCallCamState,
  signalCallVideo,
  updateReceiverOffer,
  updateCallerReanswer,
  addCallerCandidate,
  addReceiverCandidate,
  subscribeToCall,
  subscribeToCallerCandidates,
  subscribeToReceiverCandidates,
  endCall,
  acceptCall,
  updateCallSharingState
} from '../../services/callService';
import type { CallType } from '../../services/callService';
import VideoTile from './VideoTile';

interface CtrlBtnProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
  green?: boolean;
  danger?: boolean;
  active?: boolean;
  mobile?: boolean;
}

function CtrlBtn({ icon, label, onClick, muted, green, danger, active, mobile }: CtrlBtnProps) {
  const bg = danger || muted ? '#ed4245' : green ? '#23a55a' : active ? '#5865f2' : 'rgba(79,84,92,0.75)';
  const size = mobile ? 44 : 48;
  return (
    <div style={{ position: 'relative', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ width: size, height: size, borderRadius: '50%', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
        {icon}
      </div>
    </div>
  );
}

function CompoundBtn({ icon, label, onClick, onChevron, muted, chevronActive, mobile }: { icon: ReactNode; label: string; onClick: () => void; onChevron: () => void; muted?: boolean; chevronActive?: boolean; mobile?: boolean }) {
  const bg = muted ? '#ed4245' : 'rgba(79,84,92,0.75)';
  const size = mobile ? 44 : 48;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button onClick={onClick} style={{ width: size, height: size, borderRadius: '50% 0 0 50%', backgroundColor: bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>{icon}</button>
      <button onClick={onChevron} style={{ width: 20, height: size, borderRadius: '0 50% 50% 0', backgroundColor: chevronActive ? '#5865f2' : 'rgba(79,84,92,0.8)', border: 'none', cursor: 'pointer', color: '#fff', marginLeft: '1px' }}><ChevronUp size={12} /></button>
    </div>
  );
}

interface CallScreenProps {
  callId: string;
  isCaller: boolean;
  callType: CallType;
  otherUserName: string;
  otherUserPhoto: string | null;
  onClose: () => void;
}

export default function CallScreen({
  callId, isCaller, callType, otherUserName, otherUserPhoto, onClose
}: CallScreenProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'connecting' | 'ringing' | 'calling' | 'active' | 'ended'>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [peerCamOff, setPeerCamOff] = useState(false);
  const [peerSharing, setPeerSharing] = useState(false);
  const [remoteShareActive, setRemoteShareActive] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localSharingStream, setLocalSharingStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [remoteShareStream, setRemoteShareStream] = useState<MediaStream | null>(null);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [peerSpeaking, setPeerSpeaking] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [focusedTile, setFocusedTile] = useState<'remote' | 'local' | 'remoteShare' | 'localShare' | null>(null);

  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const myPhoto = auth.currentUser?.photoURL || null;
  const [showDevices, setShowDevices] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState('default');
  const [selectedCamId, setSelectedCamId] = useState('default');

  const [peerMuted, setPeerMuted] = useState<boolean>(false);
  const [peerVolume, setPeerVolume] = useState<number>(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; peerUid: string } | null>(null);
  const [isViewingPeerShare, setIsViewingPeerShare] = useState(true);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [hideNonVideo, setHideNonVideo] = useState(() => {
    return localStorage.getItem('campushub_call_hide_non_video') === 'true';
  });
  const [showParticipants, setShowParticipants] = useState(true);
  const { chatSettings } = useTheme();
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const remoteGainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const candQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalingLockRef = useRef(false);
  const lastProcessedOfferRef = useRef<string | null>(null);
  const lastProcessedAnswerRef = useRef<string | null>(null);
  const receiverTracksFilledRef = useRef(false);
  const remoteStreamRef = useRef(new MediaStream());
  const remoteShareStreamRef = useRef(new MediaStream());
  const unsubsRef = useRef<(() => void)[]>([]);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  const formatDuration = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${min}:${sec}`;
  };

  const startTimer = useCallback(() => { 
    if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); 
  }, []);

  const cleanup = useCallback(() => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenTrackRef.current?.stop();
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
  }, []);

  const handleLeave = useCallback(() => { 
    endCall(callId).catch(() => { }); cleanup(); onClose(); 
  }, [callId, cleanup, onClose]);

  useEffect(() => {
    const vol = peerMuted ? 0 : peerVolume;
    if (remoteGainNodeRef.current) {
      remoteGainNodeRef.current.gain.setTargetAtTime(deafened ? 0 : vol, 0, 0.05);
    }
  }, [deafened, peerMuted, peerVolume]);

  useEffect(() => {
    localStorage.setItem('campushub_call_hide_non_video', hideNonVideo.toString());
  }, [hideNonVideo]);

  const resumeAudio = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => {});
    }
  }, []);

  const remoteAudioSetupDoneRef = useRef<string | null>(null);

  const setupRemoteAudio = async (track: MediaStreamTrack) => {
    console.log(`[WebRTC] setupRemoteAudio for track: ${track.id}, kind: ${track.kind}`);
    if (remoteAudioSetupDoneRef.current === track.id) return;
    remoteAudioSetupDoneRef.current = track.id;

    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });
      }
      const ctx = audioCtxRef.current;
      
      if (ctx.state === 'suspended') {
        console.log('[WebRTC] Resuming AudioContext...');
        try {
          await ctx.resume();
          if (ctx.state === 'suspended') {
            setIsAudioBlocked(true);
          } else {
            setIsAudioBlocked(false);
          }
        } catch (e) {
          console.warn("[WebRTC] Resume failed", e);
          setIsAudioBlocked(true);
        }
      }
      console.log(`[WebRTC] AudioContext state: ${ctx.state}`);

      const audioEl = remoteAudioElRef.current;
      if (!audioEl) {
        console.warn("[WebRTC] remoteAudioElRef is null during setupRemoteAudio");
        return;
      }
      
      const stream = new MediaStream([track]);
      audioEl.srcObject = stream;
      
      if (remoteGainNodeRef.current) {
        try { remoteGainNodeRef.current.disconnect(); } catch { }
      }

      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      const gn = ctx.createGain();
      
      gn.gain.value = (peerMuted || deafened) ? 0 : peerVolume;
      
      src.connect(an);
      an.connect(gn);
      gn.connect(ctx.destination);
      remoteGainNodeRef.current = gn;

      audioEl.play().then(() => {
        console.log('[WebRTC] Remote audio element playing');
        setIsAudioBlocked(false);
        if (ctx.state === 'running') {
          audioEl.muted = true;
        } else {
          audioEl.muted = false;
        }
      }).catch((err) => {
        console.warn("[WebRTC] audioEl.play() initial fail, retrying unmuted:", err);
        setIsAudioBlocked(true);
        audioEl.muted = false;
        audioEl.play().catch(e => {
            console.error("[WebRTC] audioEl.play() definitive fail:", e);
            setIsAudioBlocked(true);
        });
      });
    } catch (err) { 
      console.error("[WebRTC] Audio Setup Error:", err);
      const audioEl = remoteAudioElRef.current;
      if (audioEl) {
        audioEl.muted = false;
        audioEl.srcObject = new MediaStream([track]);
        audioEl.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    let cancelled = false;
    async function init() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === 'video' ? { width: 1280, height: 720 } : false
        });
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch {
          stream = new MediaStream();
        }
      }
      if (cancelled) return;
      localStreamRef.current = stream; setLocalStream(stream);

      const pc = new RTCPeerConnection(ICE_SERVERS); pcRef.current = pc;
      
      const rStream = new MediaStream();
      remoteStreamRef.current = rStream;
      setRemoteStream(rStream);
      
      const rsStream = new MediaStream();
      remoteShareStreamRef.current = rsStream;
      setRemoteShareStream(rsStream);

      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const add = isCaller ? addCallerCandidate : addReceiverCandidate;
        add(callId, e.candidate.toJSON()).catch(() => { });
      };
      
      pc.oniceconnectionstatechange = () => {
        console.log(`[WebRTC] ICE Connection State: ${pc.iceConnectionState}`);
      };

      pc.ontrack = (e: RTCTrackEvent) => {
        const track = e.track;
        const transceiver = e.transceiver;
        const transceiverIdx = pc.getTransceivers().indexOf(transceiver);
        console.log(`[WebRTC] Track Received: ${track.kind}, id: ${track.id}, label: ${track.label}, transceiverIdx: ${transceiverIdx}, direction: ${transceiver.direction}, currentDirection: ${transceiver.currentDirection}`);

        if (track.kind === 'audio') {
          console.log('[WebRTC] Processing Audio Track');
          const stream = remoteStreamRef.current;
          if (stream.getAudioTracks().length > 0 && !track.label.includes('Screen')) {
             stream.getAudioTracks().filter(t => !t.label.includes('Screen')).forEach(t => stream.removeTrack(t));
          }
          stream.addTrack(track);
          setRemoteStream(new MediaStream(stream.getTracks()));
          setupRemoteAudio(track);
        } else {
          const txs = pc.getTransceivers();
          const videoTxs = txs.filter(tx => tx.receiver.track?.kind === 'video');
          const videoIdx = videoTxs.findIndex(tx => tx === e.transceiver);
          
          const isActuallyScreen = (videoIdx > 0 || transceiverIdx > 1 || peerSharing); 
          console.log(`[WebRTC] Video Track Received classification. videoIdx: ${videoIdx}, isActuallyScreen: ${isActuallyScreen}`);

          if (!isActuallyScreen) {
            console.log('[WebRTC] Receiving Remote Camera');
            const stream = remoteStreamRef.current;
            stream.getVideoTracks().forEach(t => stream.removeTrack(t));
            stream.addTrack(track);
            setRemoteStream(new MediaStream(stream.getTracks()));
          } else {
            console.log(`[WebRTC] Receiving Remote Screen Share: ${track.id}`);
            const stream = remoteShareStreamRef.current;
            if (stream.getTrackById(track.id)) return;

            stream.getVideoTracks().forEach(t => stream.removeTrack(t));
            stream.addTrack(track);
            
            setRemoteShareStream(new MediaStream(stream.getTracks()));
            setRemoteShareActive(true); 
            track.onended = () => { 
                console.log('[WebRTC] Remote share track ended');
                stream.removeTrack(track);
                if (stream.getVideoTracks().length === 0) {
                  setRemoteShareActive(false); 
                  setPeerSharing(false);
                  setRemoteShareStream(new MediaStream());
                }
            };
          }
        }
      };
 
      pc.onnegotiationneeded = async () => {
        if (makingOfferRef.current || pc.signalingState !== 'stable') return;
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          if (!pc.localDescription) return;
          const sync = isCaller ? updateCallOffer : updateReceiverOffer;
          await sync(callId, pc.localDescription.toJSON());
        } catch (err) {
          console.warn('[WebRTC] onnegotiationneeded error:', err);
          makingOfferRef.current = false; 
        } finally {
          makingOfferRef.current = false;
        }
      };

      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      if (isCaller) {
        pc.addTransceiver('audio', { direction: 'sendrecv' });
        pc.addTransceiver('video', { direction: 'sendrecv' });
        if (audioTrack) pc.getTransceivers()[0].sender.replaceTrack(audioTrack);
        if (videoTrack && camOn) pc.getTransceivers()[1].sender.replaceTrack(videoTrack);
      }

      if (audioTrack) {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          localAnalyserRef.current = ctx.createAnalyser();
          const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
          src.connect(localAnalyserRef.current);
        } catch { }
      }

      const isPolite = !isCaller;

      const unsubCall = subscribeToCall(callId, async (call) => {
        if (!call) return;
        if (pc.signalingState === 'closed') return;

        const description = isCaller ? call.receiverOffer : call.offer;
        if (description && description.sdp !== lastProcessedOfferRef.current && !signalingLockRef.current) {
          const offerCollision = description.type === 'offer' && (makingOfferRef.current || pc.signalingState !== 'stable');
          if (!isPolite && offerCollision) {
            lastProcessedOfferRef.current = description.sdp ?? null;
          } else {
            lastProcessedOfferRef.current = description.sdp ?? null;
            signalingLockRef.current = true;
            try {
              if (isPolite && offerCollision) {
                await pc.setLocalDescription({ type: 'rollback' });
              }
              await pc.setRemoteDescription(new RTCSessionDescription(description));
              if (description.type === 'offer') {
                const txs = pc.getTransceivers();
                txs.forEach((tx, idx) => {
                  console.log(`[WebRTC] Offer Transceiver ${idx}: ${tx.receiver.track?.kind}, current direction: ${tx.direction}`);
                  if (tx.direction !== 'sendrecv') {
                    tx.direction = 'sendrecv';
                  }
                });

                if (!receiverTracksFilledRef.current) {
                  receiverTracksFilledRef.current = true;
                  const audioTx = txs.find(tx => tx.receiver.track?.kind === 'audio');
                  const videoTxs = txs.filter(tx => tx.receiver.track?.kind === 'video');
                  
                  if (audioTrack && audioTx) await audioTx.sender.replaceTrack(audioTrack).catch(e => console.warn("Replace audio failed", e));
                  if (videoTrack && camOn && videoTxs[0]) await videoTxs[0].sender.replaceTrack(videoTrack).catch(e => console.warn("Replace video failed", e));
                }
                await pc.setLocalDescription();
                const sync = isCaller ? updateCallerReanswer : answerCall;
                await sync(callId, pc.localDescription!.toJSON());
              }
            } catch (err) {
              console.warn('[WebRTC] Remote description error:', err);
            } finally {
              signalingLockRef.current = false;
            }
          }
        }

        const answer = isCaller ? call.answer : call.callerReanswer;
        if (answer && answer.sdp !== lastProcessedAnswerRef.current && (pc.signalingState === 'have-local-offer' || pc.signalingState === 'have-remote-offer') && !signalingLockRef.current) {
          lastProcessedAnswerRef.current = answer.sdp ?? null;
          signalingLockRef.current = true;
          try {
            console.log('[WebRTC] Processing Answer...');
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            
            const txs = pc.getTransceivers();
            txs.forEach((tx, idx) => {
              console.log(`[WebRTC] Answer Transceiver ${idx}: ${tx.receiver.track?.kind}, direction: ${tx.direction}, currentDirection: ${tx.currentDirection}`);
              if (tx.direction === 'recvonly' || tx.direction === 'inactive') {
                tx.direction = 'sendrecv';
              }
            });

            while (candQueueRef.current.length > 0) {
              const c = candQueueRef.current.shift();
              if (c) await pc.addIceCandidate(c).catch(() => { });
            }
          } catch (err) {
            console.warn('[WebRTC] Answer error:', err);
          } finally {
            signalingLockRef.current = false;
          }
        }

        if (call.status === 'active') {
          setStatus('active');
          startTimer();
          resumeAudio();
        } else if (call.status === 'ringing') {
          setStatus(prev => prev === 'active' ? 'active' : (isCaller && !call.receiverOffer ? 'calling' : 'ringing'));
        }

        setPeerCamOff(isCaller ? !!call.receiverCamOff : !!call.callerCamOff);
        
        const isPeerSharingNow = isCaller ? !!call.receiverSharing : !!call.callerSharing;
        setPeerSharing(isPeerSharingNow);
        
        if (!isPeerSharingNow && remoteShareActive) {
          console.log('[WebRTC] Firestore signaling stop sharing - cleaning up');
          setRemoteShareActive(false);
          const stream = remoteShareStreamRef.current;
          stream.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
            stream.removeTrack(t);
          });
          setRemoteShareStream(new MediaStream());
        }

        if (isPeerSharingNow && !remoteShareActive) {
          const camStream = remoteStreamRef.current;
          const videoTrack = camStream.getVideoTracks()[0];
          if (videoTrack) {
            console.log('[WebRTC] Promotion: Peer is sharing but tile is inactive. Moving track from camera to share stream.');
            camStream.removeTrack(videoTrack);
            setRemoteStream(new MediaStream(camStream.getTracks()));

            const shareStream = remoteShareStreamRef.current;
            shareStream.addTrack(videoTrack);
            setRemoteShareStream(new MediaStream(shareStream.getTracks()));
            setRemoteShareActive(true);
            
            videoTrack.onended = () => {
              console.log('[WebRTC] Promoted track ended');
              shareStream.removeTrack(videoTrack);
              setRemoteShareActive(false);
              setRemoteShareStream(new MediaStream());
            };
          }
        }

        if (call.status === 'ended' || call.status === 'rejected') { cleanup(); onCloseRef.current(); }
      });

      const candSub = isCaller ? subscribeToReceiverCandidates : subscribeToCallerCandidates;
      const unsubCand = candSub(callId, (c) => {
        if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => { });
        else candQueueRef.current.push(c);
      });
      unsubsRef.current.push(unsubCall, unsubCand);
      
      setTimeout(() => resumeAudio(), 1000);
    }
    init();
    return () => {
      cancelled = true;
      lastProcessedOfferRef.current = null;
      lastProcessedAnswerRef.current = null;
      receiverTracksFilledRef.current = false;
      makingOfferRef.current = false;
      signalingLockRef.current = false;
      candQueueRef.current = [];
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
      remoteAudioSetupDoneRef.current = null;
    };
  }, [callId, isCaller, callType, startTimer, cleanup, resumeAudio]);

  useEffect(() => {
    if (status === 'ended' || status === 'ringing') return;

    const buf = new Uint8Array(128);
    let lspeak = 0; let rspeak = 0;
    const tick = () => {
      const now = performance.now();
      if (micOn && localAnalyserRef.current) {
        localAnalyserRef.current.getByteFrequencyData(buf);
        if (buf.reduce((a, b) => a + b, 0) / 128 > 15) lspeak = now + 500;
      }
      if (!deafened && !peerMuted && remoteAnalyserRef.current) {
        remoteAnalyserRef.current.getByteFrequencyData(buf);
        if (buf.reduce((a, b) => a + b, 0) / 128 > 15) rspeak = now + 500;
      }
      setLocalSpeaking(now < lspeak);
      setPeerSpeaking(now < rspeak);
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [status, micOn, deafened, peerMuted, peerVolume]);

  const onAccept = async () => {
    resumeAudio();
    setStatus('active');
    startTimer();
    try { await acceptCall(callId); } catch { setStatus('ended'); }
  };

  const toggleMic = () => {
    resumeAudio();
    const next = !micOn;
    setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach(t => {
      t.enabled = next;
    });
    if (!next) {
      pcRef.current?.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(null);
    } else {
      const audioTrack = localStreamRef.current?.getAudioTracks()[0];
      if (audioTrack) pcRef.current?.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(audioTrack);
    }

    if (next && deafened) {
      setDeafened(false);
      if (remoteGainNodeRef.current) remoteGainNodeRef.current.gain.value = peerVolume;
    }
    updateDoc(doc(db, 'calls', callId), isCaller ? { callerMuted: !next } : { receiverMuted: !next });
  };

  const toggleCam = () => {
    resumeAudio();
    const next = !camOn;
    if (next) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        const t = s.getVideoTracks()[0]; if (!t) return;
        pcRef.current?.getSenders()[1]?.replaceTrack(t);
        updateCallCamState(callId, isCaller, false); signalCallVideo(callId, isCaller);
        setCamOn(true);
      });
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      pcRef.current?.getSenders()[1]?.replaceTrack(null);
      updateCallCamState(callId, isCaller, true); setCamOn(false);
    }
  };

  const toggleDeafen = () => {
    resumeAudio();
    const next = !deafened;
    setDeafened(next);
    if (next) {
      setMicOn(false);
      localStreamRef.current?.getAudioTracks().forEach(t => {
        t.enabled = false;
      });
      pcRef.current?.getSenders().find(s => s.track?.kind === 'audio')?.replaceTrack(null);
      
      updateDoc(doc(db, 'calls', callId), isCaller ? { callerMuted: true } : { receiverMuted: true });
    } else {
      if (remoteGainNodeRef.current) {
        remoteGainNodeRef.current.gain.value = peerMuted ? 0 : peerVolume;
      }
    }
    if (remoteGainNodeRef.current && next) {
      remoteGainNodeRef.current.gain.value = 0;
    }
  };

  const onHandleSourceSelect = async (sid: string) => {
    resumeAudio();
    try {
      const s = await (navigator.mediaDevices as any).getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sid } } });
      const t = s.getVideoTracks()[0];
      if (!t) return;

      if (screenTrackRef.current) {
        screenTrackRef.current.onended = null;
        screenTrackRef.current.stop();
      }

      screenTrackRef.current = t;
      setLocalSharingStream(s); setSharing(true); setShowShareModal(false);

      const pc = pcRef.current;
      if (pc) {
        const txs = pc.getTransceivers();
        let existingTx = txs[2];
        
        if (!existingTx && txs.length < 3) {
          console.log('[WebRTC] Adding dynamic screen share transceiver');
          existingTx = pc.addTransceiver('video', { direction: 'sendrecv' });
        }

        if (existingTx) {
          screenSenderRef.current = existingTx.sender;
          await existingTx.sender.replaceTrack(t);
        } else {
          screenSenderRef.current = pc.addTrack(t, s);
        }
      }
      await updateCallSharingState(callId, isCaller, true);
      t.onended = () => stopSharing();
    } catch (err) { 
      console.warn("[WebRTC] Screen share error:", err);
      stopSharing();
    }
  };

  const stopSharing = () => {
    resumeAudio();
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    if (screenSenderRef.current) {
      screenSenderRef.current.replaceTrack(null).catch(() => { });
      screenSenderRef.current = null;
    } else {
      pcRef.current?.getSenders()[2]?.replaceTrack(null);
    }
    updateCallSharingState(callId, isCaller, false);
    setSharing(false);
    setLocalSharingStream(null);
  };

  const openDevicePicker = async () => {
    resumeAudio();
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list); setShowDevices(!showDevices); setShowCamPicker(false);
  };
  const openCamPicker = async () => {
    resumeAudio();
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list); setShowCamPicker(!showCamPicker); setShowDevices(false);
  };

  const changeAudioInput = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: deviceId !== 'default' ? { ideal: deviceId } : undefined } });
      const track = s.getAudioTracks()[0];
      if (!track || !pcRef.current) return;
      await pcRef.current.getSenders()[0]?.replaceTrack(track);
    } catch { }
  };

  const changeVideoInput = async (id: string) => {
    setSelectedCamId(id);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } } });
      const t = s.getVideoTracks()[0];
      if (t && pcRef.current) await pcRef.current.getSenders()[1]?.replaceTrack(t);
    } catch { }
  };

  const handleStartSharing = async () => {
    resumeAudio();
    if (sharing) {
      stopSharing();
      return;
    }

    const isElectron = !!(window as any).electronAPI;
    if (isElectron) {
      setShowShareModal(true);
    } else {
      try {
        const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        const t = s.getVideoTracks()[0];
        const at = s.getAudioTracks()[0];
        if (!t) return;

        if (screenTrackRef.current) {
          screenTrackRef.current.onended = null;
          screenTrackRef.current.stop();
        }

        screenTrackRef.current = t;
        setLocalSharingStream(s);
        setSharing(true);

        const pc = pcRef.current;
        if (pc) {
          const existing = pc.getSenders()[2];
          if (existing) {
            screenSenderRef.current = existing;
            await existing.replaceTrack(t);
          } else {
            screenSenderRef.current = pc.addTrack(t, s);
          }
          
          if (at) {
             pc.addTrack(at, s);
          }
        }
        await updateCallSharingState(callId, isCaller, true);
        t.onended = () => stopSharing();
      } catch (err) {
        console.warn("[WebRTC] getDisplayMedia error:", err);
      }
    }
  };

  useEffect(() => {
     if (status === 'ringing' || status === 'calling') {
        const tone = chatSettings.callRingtone || 'default';
        if (chatSettings.customRingtoneUrl) {
           if (!ringtoneRef.current) {
              const audio = new Audio(chatSettings.customRingtoneUrl);
              audio.loop = true;
              audio.play().catch(() => {});
              ringtoneRef.current = audio;
           }
        } else if (tone !== 'silent') {
           playCallTone(tone);
        }
     } else {
        if (ringtoneRef.current) {
           ringtoneRef.current.pause();
           ringtoneRef.current = null;
        }
        stopCallTone();
     }
  }, [status, chatSettings.callRingtone, chatSettings.customRingtoneUrl]);

  const hasRemoteShare = peerSharing && remoteShareActive;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111214', zIndex: 9999, display: 'flex', flexDirection: 'column' }} onClick={resumeAudio}>
      <audio ref={remoteAudioElRef} playsInline autoPlay style={{ display: 'none' }} />
      
      {isAudioBlocked && (
        <div style={{ 
          position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', 
          zIndex: 10002, backgroundColor: '#ed4245', color: '#fff', 
          padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', 
          gap: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)', animation: 'slideDown 0.3s ease' 
        }}>
          <style>{`@keyframes slideDown { from { transform: translate(-50%, -100%); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }`}</style>
          <VolumeX size={20} />
          <span style={{ fontWeight: 600 }}>{t('call.audio_blocked', 'El audio está bloqueado por el navegador')}</span>
          <button 
            onClick={() => { resumeAudio(); setIsAudioBlocked(false); }}
            style={{ 
              backgroundColor: '#fff', color: '#ed4245', border: 'none', 
              padding: '6px 12px', borderRadius: '6px', fontWeight: 700, 
              cursor: 'pointer', fontSize: '12px' 
            }}
          >
            {t('call.enable_audio', 'Activar Audio')}
          </button>
        </div>
      )}
      
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>

        {status === 'ringing' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', animation: 'scaleUp 0.3s ease-out' }}>
            <style>{`@keyframes scaleUp { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>
            <div style={{ position: 'relative' }}>
              <div style={{ width: '120px', height: '120px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 0 0 rgba(88,101,242,0.4)', animation: 'pulseRing 2s infinite' }}>
                <style>{`@keyframes pulseRing { 0% { box-shadow: 0 0 0 0 rgba(88,101,242,0.4); } 70% { box-shadow: 0 0 0 30px rgba(88,101,242,0); } 100% { box-shadow: 0 0 0 0 rgba(88,101,242,0); } }`}</style>
                {otherUserPhoto ? (
                  <img src={otherUserPhoto} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ fontSize: '48px', color: '#fff', fontWeight: 700 }}>{(otherUserName || 'U').charAt(0)}</span>
                )}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{otherUserName}</div>
              <div style={{ color: '#b5bac1', fontSize: '16px' }}>{t('call.incoming_call')}...</div>
            </div>
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
              <button onClick={handleLeave} style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#ed4245', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}><PhoneOff size={28} /></button>
              <button onClick={onAccept} style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: '#23a55a', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.2s' }} onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'} onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}><Phone size={28} /></button>
            </div>
          </div>
        )}

        {(status === 'active' || status === 'connecting' || status === 'calling' || (status === 'ringing' && isCaller)) && (
          !focusedTile ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', width: '100%', maxWidth: '1400px', justifyContent: 'center', alignContent: 'center' }}>
              {(!hideNonVideo || !peerCamOff || peerSharing) && (
                <div style={{ width: (hasRemoteShare || sharing) ? '380px' : '45%' }}>
                  <VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} speaking={peerSpeaking} camOff={peerCamOff} muted={peerMuted} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile('remote')} />
                </div>
              )}
              {(!hideNonVideo || camOn || sharing) && (
                <div style={{ width: (hasRemoteShare || sharing) ? '380px' : '45%' }}>
                  <VideoTile uid="local" name={t('call.you', 'Tú')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} muted={!micOn} isLocal onClick={() => setFocusedTile('local')} />
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {hasRemoteShare && (
                  <div style={{ width: '640px', maxWidth: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                    <div style={{
                      position: 'relative', borderRadius: '12px', overflow: 'hidden',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.4)', backgroundColor: '#1E1F22',
                      border: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <VideoTile
                        uid="remoteShare"
                        name={t('call.user_screen', { name: otherUserName })}
                        nameFallback={t('call.user_screen', { name: otherUserName })}
                        stream={remoteShareStream}
                        sharing
                        onClick={() => setFocusedTile('remoteShare')}
                        onStopViewing={() => setIsViewingPeerShare(!isViewingPeerShare)}
                        style={{ filter: isViewingPeerShare ? 'none' : 'blur(50px)', transition: 'filter 0.3s ease' }} 
                      />

                      {!isViewingPeerShare && (
                        <div style={{
                          position: 'absolute', inset: 0, zIndex: 100,
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          backgroundColor: 'rgba(30,31,34,0.6)', backdropFilter: 'blur(12px)',
                          gap: '16px'
                        }}>
                          <div style={{
                            color: '#fff', fontSize: '16px', fontWeight: 600,
                            textShadow: '0 2px 10px rgba(0,0,0,0.5)',
                            letterSpacing: '0.02em', opacity: 0.9
                          }}>
                            {t('call.user_screen', { name: otherUserName })}
                          </div>
                          <button
                            onClick={() => setIsViewingPeerShare(true)}
                            style={{
                              backgroundColor: '#5865F2', color: '#fff', border: 'none',
                              padding: '12px 32px', borderRadius: '4px', fontWeight: 600,
                              fontSize: '14px', cursor: 'pointer', transition: 'all 0.2s ease',
                              boxShadow: '0 4px 15px rgba(88,101,242,0.3)',
                              display: 'flex', alignItems: 'center', gap: '8px'
                            }}
                          >
                            <Eye size={18} />
                            {t('call.view_stream')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {sharing && <div style={{ width: '640px', maxWidth: '100%' }}><VideoTile uid="localShare" name={t('call.your_screen', 'Tu pantalla')} stream={localSharingStream} sharing isLocal onStopSharing={stopSharing} onChangeSource={() => (window as any).electronAPI ? setShowShareModal(true) : handleStartSharing()} onClick={() => setFocusedTile('localShare')} /></div>}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: showParticipants ? '110px' : '32px' }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{ width: '100%', maxWidth: showParticipants ? '1200px' : '100%', height: '100%', transition: 'max-width 0.3s' }}>
                  {focusedTile === 'remote' && <VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} speaking={peerSpeaking} camOff={peerCamOff} muted={peerMuted} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile(null)} />}
                  {focusedTile === 'remoteShare' && hasRemoteShare && <VideoTile uid="remoteShare" name={otherUserName} stream={remoteShareStream} sharing isViewing={isViewingPeerShare} onStopViewing={() => setIsViewingPeerShare(!isViewingPeerShare)} onClick={() => setFocusedTile(null)} style={{ filter: isViewingPeerShare ? 'none' : 'blur(50px)', transition: 'filter 0.3s ease' }} />}
                  {focusedTile === 'local' && <VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} muted={!micOn} isLocal onClick={() => setFocusedTile(null)} />}
                  {focusedTile === 'localShare' && <VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onStopSharing={stopSharing} onChangeSource={() => (window as any).electronAPI ? setShowShareModal(true) : handleStartSharing()} onClick={() => setFocusedTile(null)} />}
                </div>

                <div style={{ position: 'absolute', bottom: showParticipants ? 104 : 86, left: '50%', transform: 'translateX(-50%)', zIndex: 110, transition: 'bottom 0.3s ease' }}>
                   <button 
                     onClick={() => setShowParticipants(!showParticipants)}
                     style={{
                       backgroundColor: 'rgba(30,31,34,0.85)', backdropFilter: 'blur(8px)', border: 'none', borderRadius: '20px',
                       padding: '6px 14px', color: '#fff', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                       display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8, transition: 'opacity 0.2s',
                       boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                     }}
                     onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                     onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
                   >
                     {showParticipants ? <Users size={14} /> : <ScreenShare size={14} />}
                     {showParticipants ? t('call.hide_members') : t('call.show_members')}
                   </button>
                </div>
              </div>
              {showParticipants && (
                <div style={{ height: '90px', display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 10px', justifyContent: 'center' }}>
                  {(!hideNonVideo || !peerCamOff || peerSharing) && (
                    <div style={{ width: '140px', flexShrink: 0 }}><VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} muted={peerMuted} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile('remote')} /></div>
                  )}
                  {hasRemoteShare && <div style={{ width: '140px', flexShrink: 0 }}><VideoTile uid="remoteShare" name={otherUserName} stream={remoteShareStream} sharing isViewing={isViewingPeerShare} onStopViewing={() => setIsViewingPeerShare(!isViewingPeerShare)} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile('remoteShare')} /></div>}
                  {(!hideNonVideo || camOn || sharing) && (
                    <div style={{ width: '140px', flexShrink: 0 }}><VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} camOff={!camOn} muted={!micOn} isLocal onClick={() => setFocusedTile('local')} /></div>
                  )}
                  {sharing && <div style={{ width: '140px', flexShrink: 0 }}><VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onStopSharing={stopSharing} onChangeSource={() => (window as any).electronAPI ? setShowShareModal(true) : handleStartSharing()} onClick={() => setFocusedTile('localShare')} /></div>}
                </div>
              )}
            </div>
          )
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(30,31,34,0.85)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', padding: '4px 16px', borderRadius: '12px', color: '#dbdee1', fontSize: '13px', fontWeight: 600 }}>
          {(status === 'active' || (status === 'connecting' && duration > 0)) ? formatDuration(duration) : t(`call.${status}`)}
        </div>
        <CompoundBtn icon={micOn ? <Mic size={20} /> : <MicOff size={20} />} label={t('call.mic')} onClick={toggleMic} onChevron={openDevicePicker} muted={!micOn} chevronActive={showDevices} />
        <CtrlBtn icon={deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />} label={t('call.deafen')} onClick={toggleDeafen} active={deafened} />
        {callType === 'video' && <CompoundBtn icon={camOn ? <Video size={20} /> : <VideoOff size={20} />} label={t('call.video')} onClick={toggleCam} onChevron={openCamPicker} muted={!camOn} chevronActive={showCamPicker} />}
        <CtrlBtn icon={sharing ? <MonitorOff size={20} /> : <Monitor size={20} />} label={t('call.share_screen')} onClick={handleStartSharing} active={sharing} />
        <CtrlBtn 
          icon={<Maximize2 size={20} />} 
          label={t('call.pip')} 
          onClick={() => {
            // Pick a video element to PiP. Remote share has priority, then remote camera.
            const videos = document.querySelectorAll('video');
            let target: HTMLVideoElement | null = null;
            // Search for remote share first
            videos.forEach(v => {
               if (v.srcObject === remoteShareStream && remoteShareActive) target = v;
            });
            if (!target) {
               videos.forEach(v => {
                  if (v.srcObject === remoteStream) target = v;
               });
            }
            if (target) (target as any).requestPictureInPicture().catch(() => {});
          }} 
        />
        <CtrlBtn icon={<PhoneOff size={20} />} label={t('call.hang_up')} onClick={handleLeave} danger />
      </div>

      {(showDevices || showCamPicker) && (
        <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '12px', width: '280px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>{showDevices ? t('call.audio_devices') : t('call.video_devices')}</div>
          {devices.filter(d => showDevices ? d.kind.startsWith('audio') : d.kind === 'videoinput').map((d, i) => (
            <div key={i} onClick={() => d.kind === 'videoinput' ? changeVideoInput(d.deviceId) : changeAudioInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: (selectedMicId === d.deviceId || selectedCamId === d.deviceId) ? 'rgba(88,101,242,0.1)' : 'transparent' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Device ${i}`}</span>
              {(selectedMicId === d.deviceId || selectedCamId === d.deviceId) && <Check size={14} color="#5865f2" />}
            </div>
          ))}
        </div>
      )}

      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, backgroundColor: '#111214', borderRadius: 12, padding: '16px', width: 220, zIndex: 10005, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: '#dbdee1', fontSize: '13px', fontWeight: 600 }}>{t('call.mute_user')}</span>
            <input type="checkbox" checked={peerMuted} onChange={() => setPeerMuted(!peerMuted)} style={{ cursor: 'pointer', width: '18px', height: '18px' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>{t('call.user_volume', 'Volumen del usuario')}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="range" min="0" max="1" step="0.01" value={peerVolume} onChange={(e) => setPeerVolume(parseFloat(e.target.value))} style={{ flex: 1, cursor: 'pointer' }} />
              <span style={{ color: '#dbdee1', fontSize: '11px', width: '32px', textAlign: 'right' }}>{Math.round(peerVolume * 100)}%</span>
            </div>
          </div>
        </div>
      )}
      {contextMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 10004 }} onClick={() => setContextMenu(null)} />}
      {showShareModal && <ScreenShareModal onClose={() => setShowShareModal(false)} onSelect={onHandleSourceSelect} />}
    </div>
  );
}

export function IncomingCallModal({ call, onAccept, onReject }: { call: any; onAccept: () => void; onReject: () => void }) {
  const { t } = useTranslation();
  const callerName = call?.callerName || t('common.user', 'Usuario');
  const callerPhoto = call?.callerPhoto || null;

  return createPortal(
    <div style={{ position: 'fixed', top: '24px', right: '24px', width: '340px', backgroundColor: 'rgba(30,31,34,0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '20px', zIndex: 10000, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
      <style>{`@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          {callerPhoto ? (
            <img src={callerPhoto} style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #23a55a' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: 700, border: '2px solid #23a55a' }}>
              {callerName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 0, right: 0, width: '16px', height: '16px', backgroundColor: '#23a55a', borderRadius: '50%', border: '3px solid #1E1F22' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{callerName}</div>
          <div style={{ color: '#b5bac1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#23a55a', animation: 'pulse 1.5s infinite' }} />
            {t('call.incoming_call_desc', 'Llamada entrante...')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onReject} style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'rgba(237,66,69,0.15)', color: '#ed4245', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>{t('call.reject', 'Rechazar')}</button>
        <button onClick={onAccept} style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#23a55a', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>{t('call.admit', 'Aceptar')}</button>
      </div>
    </div>,
    document.body
  );
}
