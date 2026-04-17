import './ConferenceScreen.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { playRingback, stopRingback } from '../../utils/toneGenerator';
import {
  PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming,
  Headphones, HeadphoneOff, Monitor, MonitorOff, Settings,
  MoreHorizontal, Check, Maximize2, ExternalLink, Users, Presentation
} from 'lucide-react';
import { CtrlBtn, CompoundBtn } from './shared/CallUIComponents';
import { DevicePanel } from './shared/DevicePanel';
import { useIsMobile, useDrag } from './shared/useCallUI';
import {
  ICE_SERVERS,
  getConnectionId,
  createConnection,
  updateConnectionOffer,
  answerConnection,
  updateConnectionCamState,
  signalConnectionVideo,
  updateConnectionReceiverOffer,
  updateConnectionCallerReanswer,
  addConnectionCallerCandidate,
  addConnectionReceiverCandidate,
  subscribeToGroupCall,
  subscribeToConnection,
  subscribeToConnectionCallerCandidates,
  subscribeToConnectionReceiverCandidates,
  joinGroupCall,
  leaveGroupCall,
  approveConferenceParticipant,
  denyConferenceParticipant,
  type GroupCall
} from '../../services/firebase/studyGroupConferenceService';
import { type CallType } from '../../services/firebase/callService';


interface PeerState {
  uid: string;
  name: string;
  photo: string | null;
  camOff: boolean;
  speaking: boolean;
  sharing: boolean;
}

interface ConferenceScreenProps {
  callId: string;
  isInitiator: boolean;
  canApprove?: boolean;
  callType: CallType;
  groupName: string;
  groupPhoto: string | null;
  myUid: string;
  myName: string;
  myPhoto: string | null;
  onClose: () => void;
}

export default function ConferenceScreen({
  callId, isInitiator, canApprove, callType, groupName, groupPhoto,
  myUid, myName, myPhoto, onClose
}: ConferenceScreenProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [showNoVideoParticipants, setShowNoVideoParticipants] = useState(true);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [subPanel, setSubPanel] = useState<'input' | 'output' | null>(null);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [selectedCamId, setSelectedCamId] = useState('');
  const [duration, setDuration] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [inPip, setInPip] = useState(false);
  const { miniPos, onDragStart } = useDrag();
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [focusedTile, setFocusedTile] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<Array<{ uid: string; name: string; photo: string | null }>>([]);

  const durationRef = useRef(0);
  const cancelledRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const prevParticipantsRef = useRef<string[]>([]);

  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const gainCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const pcAudioTracksRef = useRef<MediaStreamTrack[]>([]);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const connUnsubsRef = useRef<Map<string, (() => void)[]>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteShareStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteVideoElsRef = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const remoteShareVideoElsRef = useRef<Map<string, HTMLVideoElement | null>>(new Map());
  const remoteAudioCtxsRef = useRef<Map<string, AudioContext>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenAudioSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenAudioCtxRef = useRef<AudioContext | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const videoSendersByPeerRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const connectedPeersRef = useRef<Set<string>>(new Set());
  const lastOfferSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const lastVideoSignalsByPeerRef = useRef<Map<string, number>>(new Map());
  const lastReceiverOfferSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const lastCallerReanswerSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const shareMuteTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const preMicOnRef = useRef(true);
  const userGainRef = useRef(1.0);
  const speakingRafRef = useRef<number | null>(null);
  const remoteSpeakingUntilRef = useRef<Map<string, number>>(new Map());
  const remoteSpeakingStateRef = useRef<Map<string, boolean>>(new Map());
  const localSpeakingUntilRef = useRef(0);
  const localSpeakingStateRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubsRef = useRef<(() => void)[]>([]);
  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const docPipWinRef = useRef<Window | null>(null);
  const docPipAreaRef = useRef<Element | null>(null);
  const pipRafRef = useRef<number | null>(null);
  const openDocPipRef = useRef<() => void>(() => { });
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<PeerState[]>([]);
  const sharingRef = useRef(false);
  const focusedTileRef = useRef<string | null>(null);

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { sharingRef.current = sharing; }, [sharing]);
  useEffect(() => { focusedTileRef.current = focusedTile; }, [focusedTile]);

  useEffect(() => {
    if (!focusedTile) return;
    if (focusedTile === 'localShare' && !sharing) { setFocusedTile(null); return; }
    if (focusedTile.endsWith('-share')) {
      const uid = focusedTile.slice(0, -6);
      const peer = peers.find(p => p.uid === uid);
      if (!peer || !peer.sharing) setFocusedTile(null);
    }
  }, [sharing, peers, focusedTile]);

  useEffect(() => {
    if (!sharing) return;
    const video = screenShareVideoRef.current;
    const stream = screenStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => { });
  }, [sharing]);

  useEffect(() => {
    if (minimized || inPip) return;
    if (localVideoRef.current && activeVideoTrackRef.current) {
      const ms = new MediaStream([activeVideoTrackRef.current]);
      localVideoRef.current.srcObject = ms;
      localVideoRef.current.play().catch(() => { });
    }
    for (const [uid, el] of remoteVideoElsRef.current) {
      if (!el) continue;
      const stream = remoteStreamsRef.current.get(uid);
      if (stream) { el.srcObject = stream; el.play().catch(() => { }); }
    }
    for (const [uid, el] of remoteShareVideoElsRef.current) {
      if (!el) continue;
      const stream = remoteShareStreamsRef.current.get(uid);
      if (stream && stream.getTracks().length > 0) { el.srcObject = null; el.srcObject = stream; el.play().catch(() => { }); }
    }
    if (screenShareVideoRef.current && sharingRef.current && screenStreamRef.current) {
      screenShareVideoRef.current.srcObject = screenStreamRef.current;
      screenShareVideoRef.current.play().catch(() => { });
    }
  }, [minimized, inPip, showLocalVideo]);

  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const location = useLocation();
  const initialPathRef = useRef(location.pathname);
  useEffect(() => {
    if (location.pathname === initialPathRef.current) return;
    openDocPipRef.current();
  }, [location.pathname]);

  useEffect(() => {
    if (isInitiator && status === 'waiting') playRingback();
    else stopRingback();
    return () => stopRingback();
  }, [isInitiator, status]);

  const startTimer = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, []);

  const cleanupPeer = useCallback((peerUid: string) => {
    const pc = pcsRef.current.get(peerUid);
    if (pc) { pc.close(); pcsRef.current.delete(peerUid); }

    const unsubs = connUnsubsRef.current.get(peerUid) ?? [];
    unsubs.forEach(u => u());
    connUnsubsRef.current.delete(peerUid);

    pendingCandidatesRef.current.delete(peerUid);
    connectedPeersRef.current.delete(peerUid);

    const ctx = remoteAudioCtxsRef.current.get(peerUid);
    if (ctx) ctx.close().catch(() => { });
    remoteAudioCtxsRef.current.delete(peerUid);
    remoteAnalysersRef.current.delete(peerUid);

    const audioEl = remoteAudioElsRef.current.get(peerUid);
    if (audioEl) { audioEl.srcObject = null; audioEl.remove(); }
    remoteAudioElsRef.current.delete(peerUid);

    remoteStreamsRef.current.delete(peerUid);
    remoteShareStreamsRef.current.delete(peerUid);
    screenSendersRef.current.delete(peerUid);
    videoSendersByPeerRef.current.delete(peerUid);
    lastOfferSdpsByPeerRef.current.delete(peerUid);
    lastVideoSignalsByPeerRef.current.delete(peerUid);
    lastReceiverOfferSdpsByPeerRef.current.delete(peerUid);
    lastCallerReanswerSdpsByPeerRef.current.delete(peerUid);
    remoteSpeakingUntilRef.current.delete(peerUid);
    remoteSpeakingStateRef.current.delete(peerUid);
    const muteTimer = shareMuteTimersRef.current.get(peerUid);
    if (muteTimer) { clearTimeout(muteTimer); shareMuteTimersRef.current.delete(peerUid); }

    setPeers(prev => prev.filter(p => p.uid !== peerUid));
  }, []);

  const cleanup = useCallback(() => {
    if (cancelledRef.current) return;
    cancelledRef.current = true;
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    for (const peerUid of [...pcsRef.current.keys()]) {
      cleanupPeer(peerUid);
    }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    gainSourceRef.current?.disconnect();
    gainNodeRef.current?.disconnect();
    gainCtxRef.current?.close().catch(() => { });
    gainCtxRef.current = null; gainNodeRef.current = null;
    gainSourceRef.current = null; gainDestRef.current = null;
    if (speakingRafRef.current) { cancelAnimationFrame(speakingRafRef.current); speakingRafRef.current = null; }
    if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
    pipVideoRef.current?.remove();
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => { });
  }, []);

  const handleLeave = useCallback(async () => {
    cleanup();
    try { await leaveGroupCall(callId, myUid); } catch { }
    onClose();
  }, [callId, myUid, cleanup, onClose]);

  const setupConnectionWithPeer = useCallback(async (
    peerUid: string,
    peerData: { name: string; photo: string | null },
    callData: GroupCall
  ) => {
    if (cancelledRef.current) return;
    if (pcsRef.current.has(peerUid)) return;

    const connId = getConnectionId(myUid, peerUid);
    const iAmCaller = myUid < peerUid;

    const remoteStream = new MediaStream();
    remoteStreamsRef.current.set(peerUid, remoteStream);
    const remoteShareStream = new MediaStream();
    remoteShareStreamsRef.current.set(peerUid, remoteShareStream);

    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
    remoteAudioElsRef.current.set(peerUid, audioEl);

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerUid, pc);

    pcAudioTracksRef.current.forEach(t => pc.addTrack(t, localStreamRef.current!));
    if (activeVideoTrackRef.current) {
      const sender = pc.addTrack(activeVideoTrackRef.current, localStreamRef.current!);
      videoSendersByPeerRef.current.set(peerUid, sender);
    }
    if (screenTrackRef.current && screenStreamRef.current) {
      const sender = pc.addTrack(screenTrackRef.current, screenStreamRef.current);
      screenSendersRef.current.set(peerUid, sender);
    }

    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        if (!remoteStream.getTracks().find(t => t.id === event.track.id)) remoteStream.addTrack(event.track);
        audioEl.srcObject = remoteStream;
        audioEl.play().catch(() => { });
        if (!remoteAudioCtxsRef.current.has(peerUid)) {
          try {
            const ctx = new AudioContext();
            remoteAudioCtxsRef.current.set(peerUid, ctx);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            ctx.createMediaStreamSource(new MediaStream([event.track])).connect(analyser);
            remoteAnalysersRef.current.set(peerUid, analyser);
          } catch { }
        }
        return;
      }
      const attachShareTrack = (track: MediaStreamTrack) => {
        remoteShareStream.getTracks().forEach(t => remoteShareStream.removeTrack(t));
        remoteShareStream.addTrack(track);
        const shareEl = remoteShareVideoElsRef.current.get(peerUid);
        if (shareEl) {
          shareEl.srcObject = null;
          shareEl.srcObject = remoteShareStream;
          shareEl.play().catch(() => { });
        }
        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: true } : p));
        track.addEventListener('ended', () => {
          remoteShareStream.removeTrack(track);
          const el = remoteShareVideoElsRef.current.get(peerUid);
          if (el) el.srcObject = null;
          setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: false } : p));
        });
        track.addEventListener('mute', () => {
          const t = shareMuteTimersRef.current.get(peerUid);
          if (t) clearTimeout(t);
          shareMuteTimersRef.current.set(peerUid, setTimeout(() => {
            setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: false } : p));
            const el = remoteShareVideoElsRef.current.get(peerUid);
            if (el) el.srcObject = null;
          }, 1500));
        });
        track.addEventListener('unmute', () => {
          const t = shareMuteTimersRef.current.get(peerUid);
          if (t) { clearTimeout(t); shareMuteTimersRef.current.delete(peerUid); }
          const el = remoteShareVideoElsRef.current.get(peerUid);
          if (el) { el.srcObject = null; el.srcObject = remoteShareStream; el.play().catch(() => { }); }
          setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: true } : p));
        });
      };

      if (callType === 'audio') {
        attachShareTrack(event.track);
        return;
      }
      const alreadyHasCam = remoteStream.getVideoTracks().length > 0;
      if (!alreadyHasCam) {
        remoteStream.addTrack(event.track);
        const videoEl = remoteVideoElsRef.current.get(peerUid);
        if (videoEl) { videoEl.srcObject = remoteStream; videoEl.play().catch(() => { }); }
      } else {
        attachShareTrack(event.track);
      }
    };

    setPeers(prev => {
      if (prev.find(p => p.uid === peerUid)) return prev;
      return [...prev, { uid: peerUid, name: peerData.name, photo: peerData.photo, camOff: false, speaking: false, sharing: false }];
    });

    const pendingCandidates: RTCIceCandidateInit[] = [];
    pendingCandidatesRef.current.set(peerUid, pendingCandidates);

    if (iAmCaller) {
      pc.onicecandidate = (e) => {
        if (e.candidate) addConnectionCallerCandidate(callId, connId, e.candidate.toJSON()).catch(() => { });
      };

      await createConnection(callId, connId, myUid, peerUid);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateConnectionOffer(callId, connId, offer);

      const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
        if (!conn || cancelledRef.current) return;

        const peerCamOff = conn.receiverCamOff ?? false;
        const peerSig = conn.receiverVideoSignal ?? 0;
        if (peerSig !== (lastVideoSignalsByPeerRef.current.get(peerUid) ?? 0)) {
          lastVideoSignalsByPeerRef.current.set(peerUid, peerSig);
          const el = remoteVideoElsRef.current.get(peerUid);
          const rs = remoteStreamsRef.current.get(peerUid);
          if (el && rs) { el.srcObject = rs; el.play().catch(() => { }); }
        }
        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: peerCamOff } : p));

        if (conn.answer && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(conn.answer)).catch(() => { });
          const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
          for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
          pendingCandidatesRef.current.set(peerUid, []);
          connectedPeersRef.current.add(peerUid);
          setStatus('active');
          startTimer();
          pc.onnegotiationneeded = async () => {
            if (pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
              try {
                const newOffer = await pc.createOffer();
                await pc.setLocalDescription(newOffer);
                await updateConnectionOffer(callId, connId, newOffer);
              } catch { }
            }
          };
        }

        const receiverOfferSdp = conn.receiverOffer?.sdp ?? '';
        if (receiverOfferSdp && receiverOfferSdp !== (lastReceiverOfferSdpsByPeerRef.current.get(peerUid) ?? '') && pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
          lastReceiverOfferSdpsByPeerRef.current.set(peerUid, receiverOfferSdp);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(conn.receiverOffer!));
            const reanswer = await pc.createAnswer();
            await pc.setLocalDescription(reanswer);
            await updateConnectionCallerReanswer(callId, connId, reanswer);
          } catch { }
        }
      });

      const unsubCandidates = subscribeToConnectionReceiverCandidates(callId, connId, async (candidate) => {
        const currentPc = pcsRef.current.get(peerUid);
        if (!currentPc) return;
        if (currentPc.remoteDescription) {
          await currentPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        } else {
          const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(peerUid, pending);
        }
      });

      connUnsubsRef.current.set(peerUid, [unsubConn, unsubCandidates]);

    } else {
      pc.onicecandidate = (e) => {
        if (e.candidate) addConnectionReceiverCandidate(callId, connId, e.candidate.toJSON()).catch(() => { });
      };

      const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
        if (!conn || cancelledRef.current) return;

        const peerCamOff = conn.callerCamOff ?? false;
        const peerSig = conn.callerVideoSignal ?? 0;
        if (peerSig !== (lastVideoSignalsByPeerRef.current.get(peerUid) ?? 0)) {
          lastVideoSignalsByPeerRef.current.set(peerUid, peerSig);
          const el = remoteVideoElsRef.current.get(peerUid);
          const rs = remoteStreamsRef.current.get(peerUid);
          if (el && rs) { el.srcObject = rs; el.play().catch(() => { }); }
        }
        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: peerCamOff } : p));

        if (conn.offer) {
          const offerSdp = conn.offer.sdp ?? '';
          if (offerSdp !== (lastOfferSdpsByPeerRef.current.get(peerUid) ?? '') && pc.signalingState === 'stable') {
            lastOfferSdpsByPeerRef.current.set(peerUid, offerSdp);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(conn.offer));
              const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
              for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
              pendingCandidatesRef.current.set(peerUid, []);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await answerConnection(callId, connId, answer);
              if (!connectedPeersRef.current.has(peerUid)) {
                connectedPeersRef.current.add(peerUid);
                setStatus('active');
                startTimer();
                pc.onnegotiationneeded = async () => {
                  if (pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
                    try {
                      const newOffer = await pc.createOffer();
                      await pc.setLocalDescription(newOffer);
                      await updateConnectionReceiverOffer(callId, connId, newOffer);
                    } catch { }
                  }
                };
              }
            } catch { }
          }
        }

        const callerReanswer = conn.callerReanswer;
        if (callerReanswer?.sdp && callerReanswer.sdp !== (lastCallerReanswerSdpsByPeerRef.current.get(peerUid) ?? '') && pc.signalingState === 'have-local-offer') {
          lastCallerReanswerSdpsByPeerRef.current.set(peerUid, callerReanswer.sdp);
          await pc.setRemoteDescription(new RTCSessionDescription(callerReanswer)).catch(() => { });
        }
      });

      const unsubCandidates = subscribeToConnectionCallerCandidates(callId, connId, async (candidate) => {
        const currentPc = pcsRef.current.get(peerUid);
        if (!currentPc) return;
        if (currentPc.remoteDescription) {
          await currentPc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        } else {
          const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
          pending.push(candidate);
          pendingCandidatesRef.current.set(peerUid, pending);
        }
      });

      connUnsubsRef.current.set(peerUid, [unsubConn, unsubCandidates]);
    }
  }, [callId, callType, myUid, startTimer]);

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
          setMediaError(t('call.error_no_devices'));
        }
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) setSelectedMicId(audioTrack.getSettings().deviceId ?? '');
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) { activeVideoTrackRef.current = videoTrack; setSelectedCamId(videoTrack.getSettings().deviceId ?? ''); }

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => { });
      }

      const audioTracks = stream.getAudioTracks();
      let pcAudioTracks: MediaStreamTrack[] = audioTracks;
      if (audioTracks.length > 0) {
        try {
          const gainCtx = new AudioContext();
          gainCtxRef.current = gainCtx;
          const gainNode = gainCtx.createGain();
          gainNodeRef.current = gainNode;
          gainNode.gain.value = 1.0;
          const src = gainCtx.createMediaStreamSource(new MediaStream(audioTracks));
          gainSourceRef.current = src;
          const dest = gainCtx.createMediaStreamDestination();
          gainDestRef.current = dest;
          src.connect(gainNode);
          gainNode.connect(dest);
          const localAnalyser = gainCtx.createAnalyser();
          localAnalyser.fftSize = 256;
          gainNode.connect(localAnalyser);
          localAnalyserRef.current = localAnalyser;
          pcAudioTracks = dest.stream.getAudioTracks();
        } catch { }
      }
      pcAudioTracksRef.current = pcAudioTracks;

      if (isInitiator) {
        setStatus('waiting');
      }

      const unsubGroupCall = subscribeToGroupCall(callId, async (call) => {
        if (!call || cancelledRef.current) return;
        if (call.status === 'ended') { cleanup(); onClose(); return; }

        if (isInitiator || canApprove) {
          const pending = call.pendingParticipants ?? [];
          setPendingApprovals(pending.map(uid => ({
            uid,
            name: call.participantData[uid]?.name ?? 'Usuario',
            photo: call.participantData[uid]?.photo ?? null,
          })));
        }

        const currentParticipants = call.activeParticipants;

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          if (!isInitiator) {
            await joinGroupCall(callId, myUid);
            const existingPeers = currentParticipants.filter(uid => uid !== myUid);
            for (const uid of existingPeers) {
              const data = call.participantData[uid] ?? { name: 'Usuario', photo: null };
              await setupConnectionWithPeer(uid, data, call);
            }
            prevParticipantsRef.current = [...currentParticipants, myUid];
          } else {
            prevParticipantsRef.current = currentParticipants;
          }
          return;
        }

        const newPeers = currentParticipants.filter(uid => uid !== myUid && !prevParticipantsRef.current.includes(uid));
        const removedPeers = prevParticipantsRef.current.filter(uid => uid !== myUid && !currentParticipants.includes(uid));

        for (const uid of newPeers) {
          const data = call.participantData[uid] ?? { name: 'Usuario', photo: null };
          await setupConnectionWithPeer(uid, data, call);
        }
        for (const uid of removedPeers) cleanupPeer(uid);

        prevParticipantsRef.current = currentParticipants;
      });

      unsubsRef.current.push(unsubGroupCall);
    }

    init();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (status !== 'active') return;
    const buf = new Uint8Array(128);
    const THRESHOLD = 15;
    const HOLD_MS = 500;
    const tick = () => {
      const now = performance.now();
      if (localAnalyserRef.current) {
        localAnalyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg > THRESHOLD) localSpeakingUntilRef.current = now + HOLD_MS;
      }
      const isLocal = now < localSpeakingUntilRef.current;
      if (isLocal !== localSpeakingStateRef.current) { localSpeakingStateRef.current = isLocal; setLocalSpeaking(isLocal); }

      for (const [uid, analyser] of remoteAnalysersRef.current) {
        analyser.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg > THRESHOLD) remoteSpeakingUntilRef.current.set(uid, now + HOLD_MS);
        const isSpeaking = now < (remoteSpeakingUntilRef.current.get(uid) ?? 0);
        if (isSpeaking !== (remoteSpeakingStateRef.current.get(uid) ?? false)) {
          remoteSpeakingStateRef.current.set(uid, isSpeaking);
          setPeers(prev => prev.map(p => p.uid === uid ? { ...p, speaking: isSpeaking } : p));
        }
      }

      speakingRafRef.current = requestAnimationFrame(tick);
    };
    speakingRafRef.current = requestAnimationFrame(tick);
    return () => { if (speakingRafRef.current) cancelAnimationFrame(speakingRafRef.current); };
  }, [status]);

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    if (gainNodeRef.current) gainNodeRef.current.gain.value = next ? userGainRef.current : 0;
    setMicOn(next);
  };

  const toggleCam = async () => {
    if (!camOn) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: selectedCamId
            ? { deviceId: { exact: selectedCamId }, width: { ideal: 1280 }, height: { ideal: 720 } }
            : { width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        const track = s.getVideoTracks()[0];
        if (!track) return;
        activeVideoTrackRef.current = track;
        for (const [uid, sender] of videoSendersByPeerRef.current) {
          await sender.replaceTrack(track).catch(() => { });
          const connId = getConnectionId(myUid, uid);
          const iAmCaller = myUid < uid;
          updateConnectionCamState(callId, connId, iAmCaller, false).catch(() => { });
          signalConnectionVideo(callId, connId, iAmCaller).catch(() => { });
        }
        if (localVideoRef.current) { localVideoRef.current.srcObject = s; localVideoRef.current.play().catch(() => { }); }
        setSelectedCamId(track.getSettings().deviceId ?? selectedCamId);
        setCamOn(true);
      } catch { }
    } else {
      activeVideoTrackRef.current?.stop();
      activeVideoTrackRef.current = null;
      for (const [uid, sender] of videoSendersByPeerRef.current) {
        await sender.replaceTrack(null).catch(() => { });
        const connId = getConnectionId(myUid, uid);
        const iAmCaller = myUid < uid;
        updateConnectionCamState(callId, connId, iAmCaller, true).catch(() => { });
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCamOn(false);
    }
  };

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    for (const audioEl of remoteAudioElsRef.current.values()) audioEl.muted = next;
    if (next) {
      preMicOnRef.current = micOn;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      if (gainNodeRef.current) gainNodeRef.current.gain.value = 0;
      setMicOn(false);
    } else {
      const prev = preMicOnRef.current;
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = prev; });
      if (gainNodeRef.current) gainNodeRef.current.gain.value = prev ? userGainRef.current : 0;
      setMicOn(prev);
    }
  };

  const openDevicePicker = async () => {
    setShowMoreMenu(false);
    setShowCamPicker(false);
    if (showDevices) { setShowDevices(false); return; }
    const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    setDevices(list);
    setShowDevices(true);
  };

  const openCamPicker = async () => {
    setShowMoreMenu(false);
    setShowDevices(false);
    if (showCamPicker) { setShowCamPicker(false); return; }
    const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    setDevices(list);
    setShowCamPicker(true);
  };

  const changeAudioInput = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      const track = s.getAudioTracks()[0];
      if (!track) return;
      let trackForSender: MediaStreamTrack = track;
      if (gainCtxRef.current && gainNodeRef.current && gainDestRef.current) {
        try {
          gainSourceRef.current?.disconnect();
          const newSrc = gainCtxRef.current.createMediaStreamSource(new MediaStream([track]));
          gainSourceRef.current = newSrc;
          newSrc.connect(gainNodeRef.current);
          trackForSender = gainDestRef.current.stream.getAudioTracks()[0] ?? track;
        } catch { }
      }
      for (const pc of pcsRef.current.values()) {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) await sender.replaceTrack(trackForSender);
      }
      if (!micOn) track.enabled = false;
    } catch { }
  };

  const changeAudioOutput = (deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    for (const audioEl of remoteAudioElsRef.current.values()) {
      (audioEl as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId?.(deviceId).catch(() => { });
    }
  };

  const changeVideoInput = async (deviceId: string) => {
    if (sharing) return;
    setSelectedCamId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const track = s.getVideoTracks()[0];
      if (!track) return;
      for (const sender of videoSendersByPeerRef.current.values()) {
        await sender.replaceTrack(track);
      }
      activeVideoTrackRef.current?.stop();
      activeVideoTrackRef.current = track;
      if (localVideoRef.current) { localVideoRef.current.srcObject = s; localVideoRef.current.play().catch(() => { }); }
      if (!camOn) track.enabled = false;
    } catch { }
  };

  const stopScreenShare = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenStreamRef.current?.getAudioTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    screenAudioCtxRef.current?.close();
    screenAudioCtxRef.current = null;
    for (const [uid, pc] of pcsRef.current) {
      const sender = screenSendersRef.current.get(uid);
      if (sender) { pc.removeTrack(sender); screenSendersRef.current.delete(uid); }
      const audioSender = screenAudioSendersRef.current.get(uid);
      if (audioSender) { pc.removeTrack(audioSender); screenAudioSendersRef.current.delete(uid); }
    }
    if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
    setSharing(false);
  }, []);

  const toggleScreenShare = async () => {
    if (sharing) { stopScreenShare(); return; }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];
      screenTrackRef.current = videoTrack;
      screenStreamRef.current = screenStream;
      videoTrack.onended = () => stopScreenShare();
      let boostedTrack = audioTrack;
      if (audioTrack) {
        try {
          const ctx = new AudioContext();
          screenAudioCtxRef.current = ctx;
          const src = ctx.createMediaStreamSource(new MediaStream([audioTrack]));
          const gain = ctx.createGain();
          gain.gain.value = 3.5;
          const dest = ctx.createMediaStreamDestination();
          src.connect(gain);
          gain.connect(dest);
          boostedTrack = dest.stream.getAudioTracks()[0];
        } catch { }
      }
      for (const [uid, pc] of pcsRef.current) {
        screenSendersRef.current.set(uid, pc.addTrack(videoTrack, screenStream));
        if (boostedTrack) screenAudioSendersRef.current.set(uid, pc.addTrack(boostedTrack, screenStream));
      }
      setSharing(true);
    } catch { }
  };

  const handleInputVolume = useCallback((v: number) => {
    if (gainCtxRef.current?.state === 'suspended') gainCtxRef.current.resume().catch(() => { });
    userGainRef.current = v / 100;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = micOn ? v / 100 : 0;
  }, [micOn]);

  const handleOutputVolume = useCallback((v: number) => {
    for (const audioEl of remoteAudioElsRef.current.values()) audioEl.volume = v / 100;
  }, []);

  const openDocPip = useCallback(async () => {
    const docPip = (window as any).documentPictureInPicture;
    if (!docPip) { setMinimized(true); return; }
    try {
      const pip: Window = await docPip.requestWindow({ width: 320, height: 280, disallowReturnToOpener: false });
      setMinimized(true);
      setInPip(true);
      pip.document.body.style.cssText = 'margin:0;background:#1e1f22;display:flex;flex-direction:column;height:100vh;font-family:sans-serif;overflow:hidden;';
      docPipWinRef.current = pip;

      const area = pip.document.createElement('div');
      area.style.cssText = 'flex:1;position:relative;background:#2b2d31;overflow:hidden;';
      docPipAreaRef.current = area;

      const pipVideo = pip.document.createElement('video') as HTMLVideoElement;
      pipVideo.autoplay = true; pipVideo.playsInline = true; pipVideo.muted = true;
      pipVideo.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:contain;display:none;';
      area.appendChild(pipVideo);

      const pipAvatar = pip.document.createElement('div');
      pipAvatar.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;';
      const circle = pip.document.createElement('div');
      circle.style.cssText = 'width:56px;height:56px;border-radius:50%;overflow:hidden;background:#36393f;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;';
      const pipNameEl = pip.document.createElement('div');
      pipNameEl.style.cssText = 'color:#fff;font-size:13px;font-weight:600;';
      pipAvatar.appendChild(circle);
      pipAvatar.appendChild(pipNameEl);
      area.appendChild(pipAvatar);

      pip.document.body.appendChild(area);

      const bar = pip.document.createElement('div');
      bar.style.cssText = 'background:#292b2f;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
      const durEl = pip.document.createElement('div');
      durEl.style.cssText = 'color:#b9bbbe;font-size:11px;';
      const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      durEl.textContent = fmt(durationRef.current);
      const durIv = setInterval(() => { durEl.textContent = fmt(durationRef.current); }, 1000);
      const leaveBtn = pip.document.createElement('button');
      leaveBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#ed4245;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      leaveBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.32 9.9a16 16 0 0 0 2.6 3.41z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      leaveBtn.onclick = () => { handleLeave(); pip.close(); };
      bar.appendChild(durEl); bar.appendChild(leaveBtn);
      pip.document.body.appendChild(bar);

      let lastStream: MediaStream | null = null;
      let lastShowVideo = false;
      let lastLabel = '';
      let lastPhoto = '';

      const pipTick = () => {
        if (pip.closed) return;

        const focused = focusedTileRef.current;
        const currentPeers = peersRef.current;
        const currentSharing = sharingRef.current;

        let targetStream: MediaStream | null = null;
        let label = '';
        let photo = '';
        let showVideo = false;

        if (focused && focused.endsWith('-share')) {
          const uid = focused.slice(0, -6);
          const peer = currentPeers.find(p => p.uid === uid);
          if (peer?.sharing) {
            const rs = remoteShareStreamsRef.current.get(uid);
            if (rs && rs.getVideoTracks().some(t => !t.muted)) {
              targetStream = rs; label = `Pantalla de ${peer.name}`; showVideo = true;
            }
          }
        } else if (focused === 'localShare' && currentSharing && screenStreamRef.current) {
          targetStream = screenStreamRef.current; label = 'Tu pantalla'; showVideo = true;
        }

        if (!targetStream) {
          for (const p of currentPeers) {
            if (p.sharing) {
              const rs = remoteShareStreamsRef.current.get(p.uid);
              if (rs && rs.getVideoTracks().some(t => !t.muted)) {
                targetStream = rs; label = `Pantalla de ${p.name}`; showVideo = true; break;
              }
            }
          }
          if (!targetStream && currentSharing && screenStreamRef.current) {
            targetStream = screenStreamRef.current; label = 'Tu pantalla'; showVideo = true;
          }
        }

        if (!targetStream) {
          const speaking = currentPeers.find(p => p.speaking);
          if (speaking) {
            const rs = remoteStreamsRef.current.get(speaking.uid);
            if (rs) { targetStream = rs; label = speaking.name; photo = speaking.photo ?? ''; showVideo = callType === 'video' && !speaking.camOff; }
          }
        }

        if (!targetStream && currentPeers.length > 0) {
          const first = currentPeers[0];
          const rs = remoteStreamsRef.current.get(first.uid);
          if (rs) { targetStream = rs; label = first.name; photo = first.photo ?? ''; showVideo = callType === 'video' && !first.camOff; }
        }

        if (targetStream !== lastStream || showVideo !== lastShowVideo) {
          lastStream = targetStream;
          lastShowVideo = showVideo;
          if (targetStream && showVideo) {
            pipVideo.srcObject = targetStream;
            pipVideo.play().catch(() => { });
            pipVideo.style.display = 'block';
            pipAvatar.style.display = 'none';
          } else {
            pipVideo.srcObject = null;
            pipVideo.style.display = 'none';
            pipAvatar.style.display = 'flex';
          }
        }

        if (label !== lastLabel) {
          lastLabel = label;
          pipNameEl.textContent = label;
        }

        if (photo !== lastPhoto) {
          lastPhoto = photo;
          circle.innerHTML = '';
          if (photo) {
            const img = pip.document.createElement('img') as HTMLImageElement;
            img.src = photo;
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            circle.appendChild(img);
          } else {
            circle.textContent = label[0]?.toUpperCase() || '?';
          }
        }

        pipRafRef.current = requestAnimationFrame(pipTick);
      };
      pipRafRef.current = requestAnimationFrame(pipTick);

      pip.addEventListener('pagehide', () => {
        clearInterval(durIv);
        if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
        docPipWinRef.current = null; docPipAreaRef.current = null;
        setInPip(false); setMinimized(false);
      });
    } catch { }
  }, [callType, handleLeave]);
  useEffect(() => { openDocPipRef.current = openDocPip; }, [openDocPip]);

  const handleExpand = useCallback(async () => {
    if (docPipWinRef.current && !docPipWinRef.current.closed) {
      docPipWinRef.current.close();
      docPipWinRef.current = null; docPipAreaRef.current = null;
    }
    if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => { });
    if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
    setInPip(false);
    setMinimized(false);
  }, []);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const statusLabel =
    status === 'waiting' ? 'Esperando participantes...' :
      status === 'connecting' ? 'Conectando...' :
        status === 'active' ? formatDuration(duration) : 'Conferencia finalizada';


  const localPhoto = myPhoto;
  const localInitial = myName[0]?.toUpperCase() || '?';

  const sharingPeers = peers.filter(p => p.sharing);
  const localTileVisible = camOn ? showLocalVideo : showNoVideoParticipants;
  const visibleTileCount = peers.filter(p => !p.camOff || showNoVideoParticipants).length + (localTileVisible ? 1 : 0) + (sharing ? 1 : 0) + sharingPeers.length;

  const isTwoParty = peers.length === 1 && !sharing && sharingPeers.length === 0;

  const { tileWidth, tileHeight } = (() => {
    if (isTwoParty && !isMobile) return { tileWidth: null, tileHeight: null };
    const gap = 8;
    const pad = 8;
    const n = Math.max(visibleTileCount, 1);
    if (isMobile) {
      const w = window.innerWidth - pad * 2;
      return { tileWidth: '100%', tileHeight: `${Math.floor(w * 9 / 16)}px` };
    }
    const controlsH = isMobile ? 160 : 130;
    const availW = window.innerWidth - pad * 2;
    const availH = window.innerHeight - controlsH - pad * 2;
    const cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
    const rows = Math.ceil(n / cols);
    const tw = Math.floor((availW - gap * (cols - 1)) / cols);
    const thByWidth = Math.floor(tw * 9 / 16);
    const thByHeight = Math.floor((availH - gap * (rows - 1)) / rows);
    const th = Math.min(thByWidth, thByHeight);
    const finalW = Math.floor(th * 16 / 9);
    return { tileWidth: `${finalW}px`, tileHeight: `${th}px` };
  })();

  type TileId = string;
  const onTileClick = (id: TileId) => () => setFocusedTile(f => f === id ? null : id);

  const tileStyle = (id: TileId, extra?: React.CSSProperties): React.CSSProperties => {
    if (focusedTile !== null && focusedTile !== id) return { display: 'none' };
    if (focusedTile === id) return { position: 'absolute', inset: 0, zIndex: 2, overflow: 'hidden', backgroundColor: '#2b2d31', cursor: 'pointer', borderRadius: 0, ...extra };
    if (isTwoParty && !isMobile) {
      return {
        position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#2b2d31',
        cursor: 'pointer', flex: 1, minWidth: 0, aspectRatio: '16/9',
        ...extra,
      };
    }
    return {
      position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#2b2d31',
      cursor: 'pointer', flexShrink: 0, width: tileWidth!, height: tileHeight!,
      ...extra,
    };
  };

  const tileLabel = (text: string) => (
    <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 5, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '3px 10px', color: '#fff', fontSize: 13, fontWeight: 600 }}>
      {text}
    </div>
  );

  return (
    <div
      onMouseDown={minimized ? onDragStart : undefined}
      onTouchStart={minimized ? onDragStart : undefined}
      style={{
        position: 'fixed', zIndex: 9999, display: inPip ? 'none' : 'flex', flexDirection: 'column',
        backgroundColor: '#1e1f22',
        ...(minimized
          ? { left: miniPos.x, top: miniPos.y, width: 280, borderRadius: 14, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.75)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'grab', userSelect: 'none' }
          : { inset: 0 })
      }}
    >
      <div style={{
        ...(minimized ? { height: 158, overflow: 'hidden' } : { flex: 1, overflow: 'hidden' }),
        position: 'relative', boxSizing: 'border-box',
        display: 'flex',
        ...(!minimized
          ? (isTwoParty && !isMobile
              ? { flexDirection: 'row', gap: 8, padding: 8, alignItems: 'center', justifyContent: 'center', overflowY: 'hidden' }
              : { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 8, alignItems: 'center', justifyContent: 'center', alignContent: 'center' })
          : { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }
        ),
      }}>
        {minimized && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: '#2b2d31', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {groupPhoto
                ? <img src={groupPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <Presentation size={24} color="#fff" />}
            </div>
          </div>
        )}

        {!minimized && (
          <>
            {peers.map(peer => (
              <div key={peer.uid} style={{ ...tileStyle(peer.uid), ...(peer.camOff && !showNoVideoParticipants && { display: 'none' }), ...(peer.speaking && !deafened && focusedTile !== peer.uid && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }} onClick={onTileClick(peer.uid)}>
                {callType === 'video' && (
                  <video
                    ref={el => { remoteVideoElsRef.current.set(peer.uid, el); }}
                    autoPlay playsInline
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: !peer.camOff ? 1 : 0, transition: 'opacity 0.3s' }}
                  />
                )}
                {(callType === 'audio' || peer.camOff) && showNoVideoParticipants && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f' }}>
                      {peer.photo
                        ? <img src={peer.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 700 }}>{peer.name[0]?.toUpperCase() || '?'}</div>}
                    </div>
                    <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: '8px 0 2px' }}>{peer.name}</p>
                  </div>
                )}
                {tileLabel(peer.name)}
                {peer.speaking && !deafened && focusedTile === peer.uid && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
                )}
              </div>
            ))}

            {peers.map(peer => (
              <div key={`${peer.uid}-share`} style={{ ...tileStyle(`${peer.uid}-share`, { backgroundColor: '#111214' }), ...(!peer.sharing && { display: 'none' }) }} onClick={onTileClick(`${peer.uid}-share`)}>
                <video
                  ref={el => {
                    remoteShareVideoElsRef.current.set(peer.uid, el);
                    if (el && !el.srcObject) {
                      const rs = remoteShareStreamsRef.current.get(peer.uid);
                      if (rs && rs.getTracks().length > 0) { el.srcObject = rs; el.play().catch(() => { }); }
                    }
                  }}
                  autoPlay playsInline
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
                />
                {tileLabel(`Pantalla de ${peer.name}`)}
              </div>
            ))}

            <div style={{ ...tileStyle('local'), ...(!localTileVisible && { display: 'none' }), ...(localSpeaking && focusedTile !== 'local' && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }} onClick={onTileClick('local')}>
              {callType === 'video' && (
                <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: focusedTile === 'local' ? 'contain' : 'cover', opacity: camOn ? 1 : 0, transition: 'opacity 0.3s' }} />
              )}
              {(callType === 'audio' || !camOn) && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f' }}>
                    {localPhoto ? <img src={localPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 700 }}>{localInitial}</div>}
                  </div>
                  <p style={{ color: '#fff', fontSize: 13, fontWeight: 600, margin: '8px 0 2px' }}>{t('call.you')}</p>
                </div>
              )}
              {tileLabel(t('call.you'))}
              {localSpeaking && focusedTile === 'local' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
              )}
            </div>

            <div style={{ ...tileStyle('localShare', { backgroundColor: '#111214' }), ...(!sharing && { display: 'none' }) }} onClick={onTileClick('localShare')}>
              <video ref={screenShareVideoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
              {tileLabel('Tu pantalla')}
            </div>
          </>
        )}
      </div>

      {minimized && !inPip && (
        <div style={{ backgroundColor: '#292b2f', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{groupName}</div>
            <div style={{ color: '#b9bbbe', fontSize: 11 }}>{statusLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <button onClick={handleExpand} style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'rgba(79,84,92,0.75)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize2 size={14} />
            </button>
            <button onClick={handleLeave} style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#ed4245', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOff size={14} />
            </button>
          </div>
        </div>
      )}

      {(isInitiator || canApprove) && pendingApprovals.length > 0 && !minimized && (
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 10000, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          {pendingApprovals.map(p => (
            <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 10, backgroundColor: '#18191c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 14px', boxShadow: '0 8px 24px rgba(0,0,0,0.7)', pointerEvents: 'auto', minWidth: 260 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.photo
                  ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: '#fff', fontSize: 15, fontWeight: 700 }}>{p.name[0]?.toUpperCase() || '?'}</span>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ color: '#b9bbbe', fontSize: 11, marginTop: 1 }}>Quiere unirse</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => denyConferenceParticipant(callId, p.uid).catch(() => { })}
                  style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#ed4245', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                  title="Denegar"
                >
                  ✕
                </button>
                <button
                  onClick={() => approveConferenceParticipant(callId, p.uid).catch(() => { })}
                  style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#23a55a', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                  title="Admitir"
                >
                  ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!minimized && (
        <div style={{ backgroundColor: '#292b2f', padding: isMobile ? '10px 12px 24px' : '12px 20px 20px', flexShrink: 0, position: 'relative' }}>
          <style>{`
            .call-range { -webkit-appearance: none; appearance: none; width: 100%; height: 4px; border-radius: 2px; outline: none; cursor: pointer; border: none; }
            .call-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 14px; height: 14px; border-radius: 50%; background: #fff; cursor: pointer; }
            .call-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 50%; background: #fff; cursor: pointer; border: none; }
            .dev-row { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 11px 16px; background: none; border: none; cursor: pointer; text-align: left; }
            .dev-row:hover { background: rgba(255,255,255,0.04); }
            .dev-sub { display: flex; align-items: center; gap: 8px; width: 100%; padding: 8px 16px 8px 22px; background: none; border: none; cursor: pointer; }
            .dev-sub:hover { background: rgba(255,255,255,0.04); }
          `}</style>

          <DevicePanel
            show={showDevices}
            subPanel={subPanel}
            setSubPanel={setSubPanel}
            showCamPicker={showCamPicker}
            setShowCamPicker={setShowCamPicker}
            devices={devices}
            selectedMicId={selectedMicId}
            selectedSpeakerId={selectedSpeakerId}
            selectedCamId={selectedCamId}
            callType={callType}
            isMobile={isMobile}
            onChangeAudioInput={changeAudioInput}
            onChangeAudioOutput={changeAudioOutput}
            onChangeVideoInput={changeVideoInput}
            onInputVolume={handleInputVolume}
            onOutputVolume={handleOutputVolume}
            t={t}
          />

          <p style={{ color: mediaError ? '#ed4245' : '#b9bbbe', fontSize: 13, textAlign: 'center', margin: '0 0 10px' }}>
            {mediaError ?? statusLabel}
          </p>

          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: isMobile ? 6 : 8, flexWrap: 'wrap' }}>
            <CompoundBtn
              icon={micOn ? <Mic size={isMobile ? 18 : 20} /> : <MicOff size={isMobile ? 18 : 20} />}
              label={micOn ? t('call.mute') : t('call.unmute')}
              muted={!micOn}
              onClick={toggleMic}
              onChevron={openDevicePicker}
              chevronActive={showDevices}
              mobile={isMobile}
            />
            <CtrlBtn
              icon={deafened ? <HeadphoneOff size={isMobile ? 18 : 20} /> : <Headphones size={isMobile ? 18 : 20} />}
              label={deafened ? t('call.undeafen') : t('call.deafen')}
              muted={deafened}
              onClick={toggleDeafen}
              mobile={isMobile}
            />
            {callType === 'video' && (
              <CompoundBtn
                icon={camOn ? <Video size={isMobile ? 18 : 20} /> : <VideoOff size={isMobile ? 18 : 20} />}
                label={camOn ? t('call.video_off') : t('call.video_on')}
                muted={!camOn}
                onClick={toggleCam}
                onChevron={openCamPicker}
                chevronActive={showCamPicker}
                mobile={isMobile}
              />
            )}
            {status === 'active' && typeof navigator.mediaDevices?.getDisplayMedia === 'function' && (
              <CtrlBtn
                icon={sharing ? <MonitorOff size={isMobile ? 18 : 20} /> : <Monitor size={isMobile ? 18 : 20} />}
                label={sharing ? t('call.stop_share') : t('call.screen_share')}
                green={sharing}
                onClick={toggleScreenShare}
                mobile={isMobile}
              />
            )}
            <CtrlBtn
              icon={<PhoneOff size={isMobile ? 18 : 20} />}
              label={t('common.leave')}
              danger
              onClick={handleLeave}
              mobile={isMobile}
            />
            {status === 'active' && callType === 'video' && (
              <div style={{ position: 'relative' }}>
                {showMoreMenu && (
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                    backgroundColor: '#18191c', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 8, padding: '4px 0', width: 230,
                    zIndex: 30, boxShadow: '0 8px 24px rgba(0,0,0,0.6)'
                  }}>
                    <button
                      onClick={() => setShowLocalVideo(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#dcddde', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 14 }}>{t('call.show_own_camera')}</span>
                      <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, backgroundColor: showLocalVideo ? '#5865f2' : 'transparent', border: `1.5px solid ${showLocalVideo ? '#5865f2' : 'rgba(255,255,255,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {showLocalVideo && <Check size={10} color="#fff" />}
                      </div>
                    </button>
                    <button
                      onClick={() => setShowNoVideoParticipants(v => !v)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#dcddde', textAlign: 'left' }}
                    >
                      <span style={{ fontSize: 14 }}>{t('call.show_no_video_participants')}</span>
                      <div style={{ width: 16, height: 16, borderRadius: 3, flexShrink: 0, backgroundColor: showNoVideoParticipants ? '#5865f2' : 'transparent', border: `1.5px solid ${showNoVideoParticipants ? '#5865f2' : 'rgba(255,255,255,0.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {showNoVideoParticipants && <Check size={10} color="#fff" />}
                      </div>
                    </button>
                    <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
                    <button
                      onClick={() => { setShowMoreMenu(false); openDevicePicker(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#dcddde', textAlign: 'left' }}
                    >
                      <Settings size={15} />
                      <span style={{ fontSize: 14 }}>{t('call.voice_video_settings')}</span>
                    </button>
                  </div>
                )}
                <CtrlBtn
                  icon={<MoreHorizontal size={isMobile ? 18 : 20} />}
                  label={t('common.more')}
                  active={showMoreMenu}
                  onClick={() => { setShowDevices(false); setShowMoreMenu(m => !m); }}
                  mobile={isMobile}
                />
              </div>
            )}
            {status === 'active' && (
              <CtrlBtn
                icon={<ExternalLink size={isMobile ? 18 : 20} />}
                label={t('call.pop_out')}
                onClick={openDocPip}
                mobile={isMobile}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface IncomingConferenceModalProps {
  call: GroupCall;
  onJoin: () => void;
  onDismiss: () => void;
}

export function IncomingConferenceModal({ call, onJoin, onDismiss }: IncomingConferenceModalProps) {
  return (
    <div style={{
      position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
      backgroundColor: '#1C1C1E', borderRadius: '20px', padding: '20px 24px',
      zIndex: 3000, display: 'flex', alignItems: 'center', gap: '16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      width: 'calc(100% - 40px)', maxWidth: '380px'
    }}>
      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#444', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {call.groupPhoto
          ? <img src={call.groupPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Presentation size={22} color="#fff" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: '#fff', fontWeight: '700', fontSize: '15px', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {call.groupName}
        </p>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Presentation size={12} />
          {call.initiatorName} · Conferencia
        </p>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
        <button onClick={onDismiss} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#636366', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <PhoneOff size={20} />
        </button>
        <button onClick={onJoin} style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#34C759', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
          <Presentation size={20} />
        </button>
      </div>
    </div>
  );
}