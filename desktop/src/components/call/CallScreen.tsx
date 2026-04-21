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
  const [streamVersion, setStreamVersion] = useState(0);
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
  const [shareMuted, setShareMuted] = useState<boolean>(false);
  const [shareVolume, setShareVolume] = useState<number>(1);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; peerUid: string } | null>(null);
  const [isViewingPeerShare, setIsViewingPeerShare] = useState(true);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [hideNonVideo, setHideNonVideo] = useState(() => {
    return localStorage.getItem('campushub_call_hide_non_video') === 'true';
  });
  const [showParticipants, setShowParticipants] = useState(true);
  const { chatSettings, colors } = useTheme();
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const makingOfferRef = useRef(false);
  const localStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteShareStreamRef = useRef<MediaStream>(new MediaStream());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteShareAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement | null>(null);
  const remoteGainNodeRef = useRef<GainNode | null>(null);
  const remoteShareGainNodeRef = useRef<GainNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const candQueueRef = useRef<RTCIceCandidateInit[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const signalingLockRef = useRef(false);
  const lastProcessedOfferRef = useRef<string | null>(null);
  const lastProcessedAnswerRef = useRef<string | null>(null);
  const receiverTracksFilledRef = useRef(false);
  const combinedRemoteStreamRef = useRef<MediaStream>(new MediaStream());
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
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => { }); audioCtxRef.current = null; }
    if (ringtoneRef.current) { ringtoneRef.current.pause(); ringtoneRef.current = null; }
  }, []);
  const handleLeave = useCallback(() => {
    endCall(callId).catch(() => { }); cleanup(); onClose();
  }, [callId, cleanup, onClose]);
  useEffect(() => {
    const audioEl = remoteAudioElRef.current;
    if (audioEl) {
      if (deafened) {
        audioEl.muted = true;
        audioEl.volume = 0;
      } else {
        const isRunning = audioCtxRef.current?.state === 'running';
        audioEl.muted = isRunning;
        audioEl.volume = 1;
      }
    }
    if (remoteGainNodeRef.current) {
      remoteGainNodeRef.current.gain.value = (peerMuted || deafened) ? 0 : peerVolume;
    }
    if (remoteShareGainNodeRef.current) {
      remoteShareGainNodeRef.current.gain.value = (shareMuted || deafened) ? 0 : shareVolume;
    }
  }, [peerVolume, peerMuted, shareVolume, shareMuted, deafened, isAudioBlocked]);
  useEffect(() => {
    localStorage.setItem('campushub_call_hide_non_video', hideNonVideo.toString());
  }, [hideNonVideo]);
  const resumeAudio = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => { });
    }
  }, []);
  const remoteAudioSetupDoneRef = useRef<string | null>(null);
  const setupRemoteAudio = async (track: MediaStreamTrack, isScreen: boolean) => {
    if (remoteAudioSetupDoneRef.current === track.id) return;
    remoteAudioSetupDoneRef.current = track.id;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          latencyHint: 'interactive'
        });
      }
      const ctx = audioCtxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        try {
          await ctx.resume();
          setIsAudioBlocked(ctx.state === 'suspended');
        } catch (e) {
          setIsAudioBlocked(true);
        }
      }
      const audioEl = remoteAudioElRef.current;
      if (!audioEl) return;
      const combined = combinedRemoteStreamRef.current;
      if (!combined.getTrackById(track.id)) {
        combined.addTrack(track);
      }
      const currentSrc = audioEl.srcObject as MediaStream | null;
      audioEl.srcObject = null;
      audioEl.srcObject = combined;
      audioEl.play().then(() => {
        setIsAudioBlocked(false);
        audioEl.muted = deafened || (ctx.state === 'running');
        audioEl.volume = deafened ? 0 : 1;
      }).catch((err) => {
        audioEl.muted = deafened;
        audioEl.play().catch(() => setIsAudioBlocked(true));
      });
      const stream = new MediaStream([track]);
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 32;
      const gn = ctx.createGain();
      if (isScreen) {
        if (remoteShareGainNodeRef.current) remoteShareGainNodeRef.current.disconnect();
        gn.gain.value = (shareMuted || deafened) ? 0 : shareVolume;
        remoteShareGainNodeRef.current = gn;
        remoteShareAnalyserRef.current = an;
      } else {
        if (remoteGainNodeRef.current) remoteGainNodeRef.current.disconnect();
        gn.gain.value = (peerMuted || deafened) ? 0 : peerVolume;
        remoteGainNodeRef.current = gn;
        remoteAnalyserRef.current = an;
      }
      src.connect(an);
      an.connect(gn);
      gn.connect(ctx.destination);
    } catch (err) { }
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
      const initAudio = stream.getAudioTracks()[0];
      const initVideo = stream.getVideoTracks()[0];
      if (initAudio) pc.addTransceiver(initAudio, { streams: [stream], direction: 'sendrecv' });
      else pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (initVideo) pc.addTransceiver(initVideo, { streams: [stream], direction: 'sendrecv' });
      else pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.ontrack = ({ track, transceiver }) => {
        track.enabled = true;
        const update = () => setStreamVersion(v => v + 1);
        track.onunmute = update;
        track.onmute = update;
        if (track.kind === 'audio') {
          const primaryAudio = remoteStreamRef.current.getAudioTracks()[0];
          const isScreenAudio = primaryAudio && primaryAudio.id !== track.id;
          const targetRef = isScreenAudio ? remoteShareStreamRef : remoteStreamRef;
          targetRef.current.getAudioTracks().forEach(t => targetRef.current.removeTrack(t));
          targetRef.current.addTrack(track);
          if (isScreenAudio) setRemoteShareStream(targetRef.current);
          else setRemoteStream(targetRef.current);
          update();
          setupRemoteAudio(track, isScreenAudio);
        } else {
          const primaryVideo = remoteStreamRef.current.getVideoTracks()[0];
          const isScreenVideo = primaryVideo && primaryVideo.id !== track.id;
          const targetRef = isScreenVideo ? remoteShareStreamRef : remoteStreamRef;
          if (!targetRef.current.getTrackById(track.id)) {
            targetRef.current.getVideoTracks().forEach(t => targetRef.current.removeTrack(t));
            targetRef.current.addTrack(track);
          }
          if (isScreenVideo) {
            setRemoteShareStream(targetRef.current);
            setRemoteShareActive(true);
          } else {
            setRemoteStream(targetRef.current);
          }
          update();
          track.onended = () => {
            targetRef.current.removeTrack(track);
            if (isScreenVideo && targetRef.current.getVideoTracks().length === 0) {
              setRemoteShareActive(false);
              setPeerSharing(false);
              setRemoteShareStream(null);
            }
            update();
          };
        }
      };
      const txs = pc.getTransceivers();
      screenSenderRef.current = txs[2].sender;
      if (isCaller) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        if (pc.localDescription) {
          await updateCallOffer(callId, pc.localDescription.toJSON() as any);
        }
      }
      pc.onicecandidate = (e) => {
        if (!e.candidate) return;
        const add = isCaller ? addCallerCandidate : addReceiverCandidate;
        add(callId, e.candidate.toJSON()).catch(() => { });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          startTimer();
          if (isCaller) {
            setTimeout(() => {
              if (pc.signalingState === 'stable') {
                pc.dispatchEvent(new Event('negotiationneeded'));
              }
            }, 2000);
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
          makingOfferRef.current = false;
        } finally {
          makingOfferRef.current = false;
        }
      };
      if (initAudio) {
        try {
          if (!audioCtxRef.current) {
            audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          const ctx = audioCtxRef.current;
          if (ctx.state === 'suspended') ctx.resume().catch(() => { });
          localAnalyserRef.current = ctx.createAnalyser();
          const src = ctx.createMediaStreamSource(new MediaStream([initAudio]));
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
                txs.forEach((tx) => {
                  if (tx.direction !== 'stopped') tx.direction = 'sendrecv';
                });
                const localAudio = stream.getAudioTracks()[0];
                const localVideo = stream.getVideoTracks()[0];
                if (localAudio) await txs[0].sender.replaceTrack(localAudio).catch(() => { });
                if (localVideo && camOn) await txs[1].sender.replaceTrack(localVideo).catch(() => { });
                await pc.setLocalDescription();
                const finalSync = isCaller ? updateCallerReanswer : answerCall;
                await finalSync(callId, pc.localDescription!.toJSON());
              }
            } catch (err) {
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
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            const txs = pc.getTransceivers();
            txs.forEach((tx) => {
              if (tx.direction === 'recvonly' || tx.direction === 'inactive') {
                tx.direction = 'sendrecv';
              }
            });
            while (candQueueRef.current.length > 0) {
              const c = candQueueRef.current.shift();
              if (c) await pc.addIceCandidate(c).catch(() => { });
            }
          } catch (err) {
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
        const isSharing = isCaller ? !!call.receiverSharing : !!call.callerSharing;
        setPeerSharing(isSharing);
        if (isSharing && pcRef.current) {
          const txs = pcRef.current.getTransceivers();
          const shareTx = txs.find((t, i) => i >= 2 && t.receiver.track && t.receiver.track.kind === 'video');
          if (shareTx && shareTx.direction !== 'sendrecv') {
            shareTx.direction = 'sendrecv';
            if (pcRef.current.signalingState === 'stable') {
              pcRef.current.dispatchEvent(new Event('negotiationneeded'));
            }
          }
        }
        if (!isSharing && remoteShareActive) {
          setRemoteShareActive(false);
          const stream = remoteShareStreamRef.current;
          stream.getTracks().forEach(t => {
            t.onended = null;
            t.stop();
            stream.removeTrack(t);
          });
          setRemoteShareStream(null);
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
      if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => { }); audioCtxRef.current = null; }
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
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = next;
      });
    }
    if (next && deafened) {
      setDeafened(false);
    }
    const callDoc = doc(db, 'calls', callId);
    updateDoc(callDoc, isCaller ? { callerMuted: !next } : { receiverMuted: !next }).catch(() => { });
  };
  const toggleCam = () => {
    resumeAudio();
    const next = !camOn;
    setCamOn(next);
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = next;
      });
    }
    const callDoc = doc(db, 'calls', callId);
    updateDoc(callDoc, isCaller ? { callerCamOff: !next } : { receiverCamOff: !next }).catch(() => { });
  };
  const toggleDeafen = () => {
    resumeAudio();
    const next = !deafened;
    setDeafened(next);
    if (next) {
      setMicOn(false);
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
      }
      const callDoc = doc(db, 'calls', callId);
      updateDoc(callDoc, isCaller ? { callerMuted: true } : { receiverMuted: true }).catch(() => { });
    }
  };
  const onHandleSourceSelect = async (sid: string) => {
    resumeAudio();
    try {
      let s: MediaStream;
      const constraints = {
        video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sid, maxWidth: 1920, maxHeight: 1080, maxFrameRate: 30 } },
        audio: { mandatory: { chromeMediaSource: 'desktop' } }
      };
      try {
        try {
          s = await navigator.mediaDevices.getDisplayMedia({ video: { deviceId: sid }, audio: true });
        } catch {
          s = await (navigator.mediaDevices as any).getUserMedia(constraints);
        }
      } catch (e) {
        s = await (navigator.mediaDevices as any).getUserMedia({ ...constraints, audio: false });
      }
      const t = s.getVideoTracks()[0];
      if (!t) return;
      t.enabled = true;
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
          existingTx = pc.addTransceiver('video', { direction: 'sendrecv' });
        }
        if (existingTx) {
          existingTx.direction = 'sendrecv';
          screenSenderRef.current = existingTx.sender;
          await existingTx.sender.replaceTrack(t);
        } else {
          screenSenderRef.current = pc.addTrack(t, s);
        }
        const at = s.getAudioTracks()[0];
        if (at) {
          at.enabled = true;
          pc.addTrack(at, s);
        }
        setTimeout(() => {
          if (pcRef.current && pcRef.current.signalingState === 'stable') {
            pcRef.current.dispatchEvent(new Event('negotiationneeded'));
          }
        }, 150);
      }
      await updateCallSharingState(callId, isCaller, true);
      t.onended = () => stopSharing();
    } catch (err) {
      stopSharing();
    }
  };
  const stopSharing = () => {
    resumeAudio();
    if (localSharingStream) {
      localSharingStream.getTracks().forEach(t => t.stop());
      setLocalSharingStream(null);
    }
    if (screenTrackRef.current) {
      screenTrackRef.current.stop();
      screenTrackRef.current = null;
    }
    const pc = pcRef.current;
    if (pc) {
      pc.getSenders().forEach(s => {
        if (s.track && (s.track.label.toLowerCase().includes('screen') || s.track.label.toLowerCase().includes('monitor'))) {
          s.replaceTrack(null).catch(() => { });
        }
      });
      const txs = pc.getTransceivers();
      if (txs[2]) {
        txs[2].direction = 'recvonly';
        if (pc.signalingState === 'stable') {
          pc.dispatchEvent(new Event('negotiationneeded'));
        }
      }
    }
    screenSenderRef.current = null;
    updateCallSharingState(callId, isCaller, false);
    setSharing(false);
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
          const txs = pc.getTransceivers();
          let existing = txs[2];
          if (!existing && txs.length < 3) {
            existing = pc.addTransceiver('video', { direction: 'sendrecv' });
          }
          if (existing) {
            existing.direction = 'sendrecv';
            screenSenderRef.current = existing.sender;
            await existing.sender.replaceTrack(t);
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
      }
    }
  };
  const togglePiP = async () => {
    try {
      const videos = document.querySelectorAll('video');
      let videoToPip: HTMLVideoElement | null = null;
      videos.forEach(v => {
        if (v.srcObject && (v.srcObject as MediaStream).getVideoTracks().length > 0 && !v.muted) {
          videoToPip = v;
        }
      });
      if (!videoToPip) videoToPip = videos[0] as HTMLVideoElement;
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoToPip) {
        await videoToPip.requestPictureInPicture();
      }
    } catch (err) {
    }
  };
  useEffect(() => {
    if (status === 'ringing' || status === 'calling') {
      const tone = chatSettings.callRingtone || 'default';
      if (chatSettings.customRingtoneUrl) {
        if (!ringtoneRef.current) {
          const audio = new Audio(chatSettings.customRingtoneUrl);
          audio.loop = true;
          audio.play().catch(() => { });
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
          <span style={{ fontWeight: 600 }}>{t('call.audio_blocked')}</span>
          <button
            onClick={() => { resumeAudio(); setIsAudioBlocked(false); }}
            style={{
              backgroundColor: '#fff', color: '#ed4245', border: 'none',
              padding: '6px 12px', borderRadius: '6px', fontWeight: 700,
              cursor: 'pointer', fontSize: '12px'
            }}
          >
            {t('call.enable_audio')}
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
                <div style={{ width: (hasRemoteShare || sharing) ? '380px' : '45%', aspectRatio: '16/9' }}>
                  <VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} speaking={peerSpeaking} camOff={peerCamOff} muted={peerMuted} volume={peerVolume} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile('remote')} />
                </div>
              )}
              {(!hideNonVideo || camOn || sharing) && (
                <div style={{ width: (hasRemoteShare || sharing) ? '380px' : '45%', aspectRatio: '16/9' }}>
                  <VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} muted={!micOn} isLocal onClick={() => setFocusedTile('local')} />
                </div>
              )}
              <div style={{ width: '100%', display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                {hasRemoteShare && (
                  <div style={{ width: '640px', maxWidth: '100%', position: 'relative', borderRadius: '12px', overflow: 'hidden', aspectRatio: '16/9' }}>
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
                        muted={shareMuted}
                        volume={shareVolume}
                        onMuteToggle={setShareMuted}
                        onVolumeChange={(v) => setShareVolume(v / 100)}
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
                {sharing && <div style={{ width: '640px', maxWidth: '100%' }}><VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onStopSharing={stopSharing} onChangeSource={() => (window as any).electronAPI ? setShowShareModal(true) : handleStartSharing()} onClick={() => setFocusedTile('localShare')} /></div>}
              </div>
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: showParticipants ? '110px' : '32px' }}>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <div style={{
                  width: '100%',
                  maxWidth: showParticipants ? '1200px' : '900px',
                  height: '100%',
                  maxHeight: showParticipants ? 'calc(100% - 20px)' : '70vh',
                  transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {focusedTile === 'remote' && <VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} speaking={peerSpeaking} camOff={peerCamOff} muted={peerMuted} volume={peerVolume} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile(null)} />}
                  {focusedTile === 'remoteShare' && hasRemoteShare && (
                    <VideoTile
                      key={`focused-remote-share-${streamVersion}`}
                      uid="remoteShare"
                      name={otherUserName}
                      stream={remoteShareStream}
                      sharing
                      muted={shareMuted}
                      volume={shareVolume}
                      onMuteToggle={setShareMuted}
                      onVolumeChange={(v) => setShareVolume(v / 100)}
                      isViewing={isViewingPeerShare}
                      onStopViewing={() => setIsViewingPeerShare(!isViewingPeerShare)}
                      onClick={() => setFocusedTile(null)}
                      style={{ filter: isViewingPeerShare ? 'none' : 'blur(50px)', transition: 'filter 0.3s ease' }}
                    />
                  )}
                  {focusedTile === 'local' && <VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} muted={!micOn} isLocal onClick={() => setFocusedTile(null)} />}
                  {focusedTile === 'localShare' && <VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onStopSharing={stopSharing} onChangeSource={() => (window as any).electronAPI ? setShowShareModal(true) : handleStartSharing()} onClick={() => setFocusedTile(null)} />}
                </div>
                <div style={{
                  position: 'absolute',
                  bottom: showParticipants ? 12 : -40,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  zIndex: 1000,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}>
                  <button
                    onClick={() => setShowParticipants(!showParticipants)}
                    style={{
                      backgroundColor: showParticipants ? 'rgba(30,31,34,0.95)' : colors.primary,
                      backdropFilter: 'blur(12px)',
                      border: `1px solid ${showParticipants ? 'rgba(255,255,255,0.1)' : 'transparent'}`,
                      borderRadius: '24px',
                      padding: '8px 18px',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'all 0.2s ease',
                      boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {showParticipants ? <EyeOff size={16} /> : <Users size={16} />}
                    {showParticipants ? t('call.hide_members') : t('call.show_members')}
                  </button>
                </div>
              </div>
              {showParticipants && (
                <div style={{ height: '90px', display: 'flex', gap: '12px', overflowX: 'auto', padding: '0 10px', justifyContent: 'center' }}>
                  {(!hideNonVideo || !peerCamOff || peerSharing) && (
                    <div style={{ width: '140px', flexShrink: 0 }}><VideoTile uid="remote" name={otherUserName} photo={otherUserPhoto} stream={remoteStream} muted={peerMuted} volume={peerVolume} onMuteToggle={setPeerMuted} onVolumeChange={(v) => setPeerVolume(v / 100)} onClick={() => setFocusedTile('remote')} /></div>
                  )}
                  {hasRemoteShare && (
                    <div style={{ width: '140px', flexShrink: 0 }}>
                      <VideoTile
                        key={`mini-remote-share-${streamVersion}`}
                        uid="remoteShare"
                        name={otherUserName}
                        stream={remoteShareStream}
                        sharing
                        muted={shareMuted}
                        volume={shareVolume}
                        onMuteToggle={setShareMuted}
                        onVolumeChange={(v) => setShareVolume(v / 100)}
                        isViewing={isViewingPeerShare}
                        onStopViewing={() => setIsViewingPeerShare(!isViewingPeerShare)}
                        onClick={() => setFocusedTile('remoteShare')}
                      />
                    </div>
                  )}
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
            const videos = document.querySelectorAll('video');
            let target: HTMLVideoElement | null = null;
            videos.forEach(v => {
              if (v.srcObject === remoteShareStream && remoteShareActive) target = v;
            });
            if (!target) {
              videos.forEach(v => {
                if (v.srcObject === remoteStream) target = v;
              });
            }
            if (target) (target as any).requestPictureInPicture().catch(() => { });
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
            {t('call.incoming_call_desc')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onReject} style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'rgba(237,66,69,0.15)', color: '#ed4245', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>{t('call.reject')}</button>
        <button onClick={onAccept} style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#23a55a', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px' }}>{t('call.admit')}</button>
      </div>
    </div>,
    document.body
  );
}