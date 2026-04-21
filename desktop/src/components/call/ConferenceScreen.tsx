import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic, MicOff, Video, VideoOff, PhoneOff,
  Maximize2, Settings, Check,
  Volume2, VolumeX, MoreHorizontal,
  Presentation, Monitor, MonitorOff, ExternalLink,
  Users, X, Eye, EyeOff
} from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import {
  subscribeToGroupCall,
  joinGroupCall,
  leaveGroupCall,
  createConnection,
  subscribeToConnection,
  answerConnection,
  updateConnectionOffer,
  updateConnectionCallerReanswer,
  addConnectionCallerCandidate,
  addConnectionReceiverCandidate,
  subscribeToConnectionCallerCandidates,
  subscribeToConnectionReceiverCandidates,
  updateConnectionMuteState,
  updateConnectionCamState,
  updateConnectionDeafenState,
  updateConnectionSharingState,
  updateConnectionReceiverOffer,
  signalConnectionVideo,
  requestToJoinConference,
  approveConferenceParticipant,
  denyConferenceParticipant
} from '../../services/groupCallService';
import VideoTile from './VideoTile';
import { GroupCall } from '../../services/groupCallService';
import { ScreenShareModal } from './ScreenShareModal';
import { createPortal } from 'react-dom';
import { getCtx } from '../../utils/toneGenerator';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

interface ConferenceScreenProps {
  callId: string;
  isInitiator: boolean;
  callType: 'audio' | 'video';
  groupName: string;
  groupPhoto: string | null;
  myUid: string;
  myName: string;
  myPhoto: string | null;
  myRole?: string;
  onClose: () => void;
}

interface PeerState {
  uid: string;
  name: string;
  photo: string | null;
  stream?: MediaStream | null;
  speaking: boolean;
  camOff: boolean;
  muted: boolean;
  deafened: boolean;
  sharing: boolean;
}

export function ConferenceScreen({
  callId,
  isInitiator,
  callType,
  groupName,
  groupPhoto,
  myUid,
  myName,
  myPhoto,
  myRole,
  onClose
}: ConferenceScreenProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting');
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [duration, setDuration] = useState(0);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('default');
  const [selectedCamId, setSelectedCamId] = useState('');
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<{ uid: string; name: string; photo: string | null }[]>([]);
  const [showMuteWarning, setShowMuteWarning] = useState(false);
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenSources, setScreenSources] = useState<any[]>([]);
  const [loadingScreenSources, setLoadingScreenSources] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [showNoVideoParticipants, setShowNoVideoParticipants] = useState(true);
  const [minimized, setMinimized] = useState(false);
  const [miniPos, setMiniPos] = useState({ x: window.innerWidth - 300, y: 20 });
  const [inPip, setInPip] = useState(false);
  const [subPanel, setSubPanel] = useState<'main' | 'mic' | 'speaker' | 'cam'>('main');

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, tileId: string } | null>(null);
  const [mutedPeers, setMutedPeers] = useState<Set<string>>(new Set());
  const [peerVolumes, setPeerVolumes] = useState<Map<string, number>>(new Map());
  const [hiddenCameraPeers, setHiddenCameraPeers] = useState<Set<string>>(new Set());
  const [hiddenSharePeers, setHiddenSharePeers] = useState<Set<string>>(new Set());
  const [focusedTile, setFocusedTile] = useState<string | null>(null);

  const localStreamRef = useRef<MediaStream | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const unsubsRef = useRef<(() => void)[]>([]);
  const connUnsubsRef = useRef<Map<string, (() => void)[]>>(new Map());
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const cancelledRef = useRef(false);
  const isInitialLoadRef = useRef(true);
  const prevParticipantsRef = useRef<string[]>([]);

  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const remoteGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const speakingRafRef = useRef<number | null>(null);
  const localSpeakingUntilRef = useRef(0);
  const localSpeakingStateRef = useRef(false);
  const remoteSpeakingUntilRef = useRef<Map<string, number>>(new Map());
  const remoteSpeakingStateRef = useRef<Map<string, boolean>>(new Map());

  const gainCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const userGainRef = useRef(1.0);
  const muteWarningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const remoteVideoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteShareVideoElsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteShareStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const pcAudioTracksRef = useRef<MediaStreamTrack[]>([]);
  const videoSendersByPeerRef = useRef<Map<string, RTCRtpSender>>(new Map());
  const screenSendersRef = useRef<Map<string, RTCRtpSender>>(new Map());

  const lastOfferSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const lastReceiverOfferSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const lastCallerReanswerSdpsByPeerRef = useRef<Map<string, string>>(new Map());
  const lastVideoSignalsByPeerRef = useRef<Map<string, number>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, any[]>>(new Map());
  const connectedPeersRef = useRef<Set<string>>(new Set());

  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const pipRafRef = useRef<number | null>(null);
  const docPipWinRef = useRef<Window | null>(null);
  const docPipAreaRef = useRef<HTMLDivElement | null>(null);
  const durationRef = useRef(0);
  const focusedTileRef = useRef<string | null>(null);
  const peersRef = useRef<PeerState[]>([]);
  const sharingRef = useRef(false);
  const hiddenCameraPeersRef = useRef<Set<string>>(new Set());
  const hiddenSharePeersRef = useRef<Set<string>>(new Set());
  const camOnRef = useRef(camOn);
  const statusRef = useRef(status);
  const hasJoinedRef = useRef(false);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const isMobile = window.innerWidth < 768;

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { focusedTileRef.current = focusedTile; }, [focusedTile]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { sharingRef.current = sharing; }, [sharing]);
  useEffect(() => { hiddenCameraPeersRef.current = hiddenCameraPeers; }, [hiddenCameraPeers]);
  useEffect(() => { hiddenSharePeersRef.current = hiddenSharePeers; }, [hiddenSharePeers]);
  useEffect(() => { camOnRef.current = camOn; }, [camOn]);
  useEffect(() => { statusRef.current = status; }, [status]);

  const onDragStart = (e: any) => {
    const startX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const startY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    const initialX = miniPos.x;
    const initialY = miniPos.y;
    const onMove = (me: any) => {
      const cx = me.type === 'touchmove' ? me.touches[0].clientX : me.clientX;
      const cy = me.type === 'touchmove' ? me.touches[0].clientY : me.clientY;
      setMiniPos({ x: initialX + (cx - startX), y: initialY + (cy - startY) });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
  };

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    if (speakingRafRef.current) cancelAnimationFrame(speakingRafRef.current);
    if (pipRafRef.current) cancelAnimationFrame(pipRafRef.current);
    if (muteWarningTimerRef.current) clearTimeout(muteWarningTimerRef.current);

    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenTrackRef.current?.stop();
    screenStreamRef.current?.getTracks().forEach(t => t.stop());

    pcsRef.current.forEach(pc => pc.close());
    pcsRef.current.clear();

    unsubsRef.current.forEach(u => u());
    connUnsubsRef.current.forEach(uList => uList.forEach(u => u()));

    gainCtxRef.current?.close().catch(() => { });
    if (pipVideoRef.current) pipVideoRef.current.remove();
    if (docPipWinRef.current) docPipWinRef.current.close();
  }, []);

  const cleanupPeer = useCallback((uid: string) => {
    const pc = pcsRef.current.get(uid);
    if (pc) pc.close();
    pcsRef.current.delete(uid);

    const unsubs = connUnsubsRef.current.get(uid);
    if (unsubs) unsubs.forEach(u => u());
    connUnsubsRef.current.delete(uid);

    remoteAnalysersRef.current.delete(uid);
    remoteGainNodesRef.current.delete(uid);
    remoteStreamsRef.current.delete(uid);
    remoteVideoElsRef.current.delete(uid);
    remoteAudioElsRef.current.delete(uid);
    remoteShareStreamsRef.current.delete(uid);
    remoteShareVideoElsRef.current.delete(uid);
    videoSendersByPeerRef.current.delete(uid);
    screenSendersRef.current.delete(uid);
    pendingCandidatesRef.current.delete(uid);
    connectedPeersRef.current.delete(uid);

    setPeers(prev => prev.filter(p => p.uid !== uid));
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const getConnectionId = (u1: string, u2: string) => [u1, u2].sort().join('_');

  const setupConnectionWithPeer = useCallback(async (peerUid: string, peerData: any, callData: any) => {
    if (pcsRef.current.has(peerUid) || cancelledRef.current) return;

    const resName = [peerData.displayName, peerData.username, peerData.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous') || peerData.displayName || peerData.username || peerData.name || 'Usuario';
    const resPhoto = peerData.photoURL || peerData.photo || null;

    setPeers(prev => {
      if (prev.some(p => p.uid === peerUid)) return prev;
      return [...prev, {
        uid: peerUid,
        name: resName,
        photo: resPhoto,
        speaking: false,
        camOff: false,
        muted: false,
        deafened: false,
        sharing: false
      }];
    });

    const connId = getConnectionId(myUid, peerUid);
    const iAmCaller = myUid < peerUid;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerUid, pc);

    pc.ontrack = (e) => {
      const track = e.track;
      const stream = e.streams[0] || new MediaStream([track]);

      const transceivers = pc.getTransceivers();
      const idx = transceivers.findIndex(t => t.receiver === e.receiver);

      if (idx === 0) {
        remoteStreamsRef.current.set(peerUid, stream);
        const audioTrack = track;
        if (audioTrack.kind === 'audio') {
          const audioEl = document.createElement('audio');
          audioEl.srcObject = stream;
          audioEl.autoplay = true;
          (audioEl as any).setSinkId?.(selectedSpeakerId).catch(() => { });
          remoteAudioElsRef.current.set(peerUid, audioEl);

          const setupRemoteAnalyser = async () => {
            try {
              const ctx = await getCtx();
              const src = ctx.createMediaStreamSource(stream);
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              src.connect(analyser);
              remoteAnalysersRef.current.set(peerUid, analyser);
            } catch { }
          };
          setupRemoteAnalyser();
        }
      } else if (idx === 1) {
        remoteStreamsRef.current.set(peerUid, stream);
        const el = remoteVideoElsRef.current.get(peerUid);
        if (el) { el.srcObject = stream; el.play().catch(() => { }); }
      } else if (idx === 2) {
        remoteShareStreamsRef.current.set(peerUid, stream);
        const el = remoteShareVideoElsRef.current.get(peerUid);
        if (el) { el.srcObject = stream; el.play().catch(() => { }); }
      }
    };

    const audioTrack = pcAudioTracksRef.current[0];
    if (audioTrack) pc.addTrack(audioTrack);
    else pc.addTransceiver('audio', { direction: 'sendrecv' });

    const videoTrack = activeVideoTrackRef.current;
    if (videoTrack && camOn) {
      const sender = pc.addTrack(videoTrack);
      videoSendersByPeerRef.current.set(peerUid, sender);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    if (sharingRef.current && screenTrackRef.current) {
      const sender = pc.addTrack(screenTrackRef.current);
      screenSendersRef.current.set(peerUid, sender);
    } else {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    if (iAmCaller) {
      pc.onicecandidate = (e) => {
        if (e.candidate) addConnectionCallerCandidate(callId, connId, e.candidate.toJSON(), true).catch(() => { });
      };

      pc.onnegotiationneeded = async () => {
        if (pc.signalingState !== 'stable') return;
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await createConnection(callId, connId, myUid, peerUid, true, sharingRef.current);
          await updateConnectionOffer(callId, connId, offer, true);
        } catch { }
      };

      const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
        if (!conn || cancelledRef.current) return;

        const peerCamOff = conn.receiverCamOff ?? false;
        const peerSharing = conn.receiverSharing ?? false;
        const peerMuted = conn.receiverMuted ?? false;
        const peerDeafened = conn.receiverDeafened ?? false;
        const peerSig = conn.receiverVideoSignal ?? 0;

        if (peerSig !== (lastVideoSignalsByPeerRef.current.get(peerUid) ?? 0)) {
          lastVideoSignalsByPeerRef.current.set(peerUid, peerSig);
          const el = remoteVideoElsRef.current.get(peerUid);
          const rs = remoteStreamsRef.current.get(peerUid);
          if (el && rs) { el.srcObject = rs; el.play().catch(() => { }); }
        }

        if (!peerSharing) {
          const shareEl = remoteShareVideoElsRef.current.get(peerUid);
          if (shareEl) { shareEl.pause(); shareEl.srcObject = null; }
        }

        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: peerCamOff, sharing: peerSharing, muted: peerMuted, deafened: peerDeafened } : p));

        if (conn.answer && pc.signalingState === 'have-local-offer') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(conn.answer));
            const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
            for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
            pendingCandidatesRef.current.set(peerUid, []);

            if (!connectedPeersRef.current.has(peerUid)) {
              connectedPeersRef.current.add(peerUid);
              setStatus('active');
              startTimer();
              pc.onnegotiationneeded = async () => {
                if (pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
                  try {
                    const newOffer = await pc.createOffer();
                    await pc.setLocalDescription(newOffer);
                    await updateConnectionOffer(callId, connId, newOffer, true);
                  } catch { }
                }
              };
            }
          } catch { }
        }

        const receiverOfferSdp = conn.receiverOffer?.sdp ?? '';
        if (receiverOfferSdp && receiverOfferSdp !== (lastReceiverOfferSdpsByPeerRef.current.get(peerUid) ?? '') && pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
          lastReceiverOfferSdpsByPeerRef.current.set(peerUid, receiverOfferSdp);
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(conn.receiverOffer!));
            const reanswer = await pc.createAnswer();
            await pc.setLocalDescription(reanswer);
            await updateConnectionCallerReanswer(callId, connId, reanswer, true);
          } catch { }
        }
      }, true);

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
      }, true);

      connUnsubsRef.current.set(peerUid, [unsubConn, unsubCandidates]);

    } else {
      pc.onicecandidate = (e) => {
        if (e.candidate) addConnectionReceiverCandidate(callId, connId, e.candidate.toJSON(), true).catch(() => { });
      };

      const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
        if (!conn || cancelledRef.current) return;

        const peerCamOff = conn.callerCamOff ?? false;
        const peerSharing = conn.callerSharing ?? false;
        const peerMuted = conn.callerMuted ?? false;
        const peerDeafened = conn.callerDeafened ?? false;
        const peerSig = conn.callerVideoSignal ?? 0;
        if (peerSig !== (lastVideoSignalsByPeerRef.current.get(peerUid) ?? 0)) {
          lastVideoSignalsByPeerRef.current.set(peerUid, peerSig);
          const el = remoteVideoElsRef.current.get(peerUid);
          const rs = remoteStreamsRef.current.get(peerUid);
          if (el && rs) { el.srcObject = rs; el.play().catch(() => { }); }
        }
        if (!peerSharing) {
          const shareEl = remoteShareVideoElsRef.current.get(peerUid);
          if (shareEl) { shareEl.pause(); shareEl.srcObject = null; }
        }
        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: peerCamOff, sharing: peerSharing, muted: peerMuted, deafened: peerDeafened } : p));

        if (conn.offer) {
          const offerSdp = conn.offer.sdp ?? '';
          if (offerSdp !== (lastOfferSdpsByPeerRef.current.get(peerUid) ?? '') && pc.signalingState === 'stable') {
            lastOfferSdpsByPeerRef.current.set(peerUid, offerSdp);
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(conn.offer));
              const pending = pendingCandidatesRef.current.get(peerUid) ?? [];
              for (const c of pending) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
              pendingCandidatesRef.current.set(peerUid, []);
              const txs = pc.getTransceivers();
              if (txs[0]) txs[0].direction = 'sendrecv';
              if (txs[1]) txs[1].direction = 'sendrecv';
              if (txs[2]) txs[2].direction = 'sendrecv';
              const fills: Promise<void>[] = [];
              if (pcAudioTracksRef.current[0] && txs[0]) fills.push(txs[0].sender.replaceTrack(pcAudioTracksRef.current[0]).catch(() => { }));
              if (activeVideoTrackRef.current && txs[1]) fills.push(txs[1].sender.replaceTrack(activeVideoTrackRef.current).catch(() => { }));
              if (sharingRef.current && screenTrackRef.current && txs[2]) fills.push(txs[2].sender.replaceTrack(screenTrackRef.current).catch(() => { }));
              if (!videoSendersByPeerRef.current.has(peerUid) && txs[1]) videoSendersByPeerRef.current.set(peerUid, txs[1].sender);
              if (!screenSendersRef.current.has(peerUid) && txs[2]) screenSendersRef.current.set(peerUid, txs[2].sender);
              await Promise.all(fills);
              const answer = await pc.createAnswer();
              await pc.setLocalDescription(answer);
              await answerConnection(callId, connId, answer, true);
              if (sharingRef.current) updateConnectionSharingState(callId, connId, false, true, true).catch(() => { });
              if (!connectedPeersRef.current.has(peerUid)) {
                connectedPeersRef.current.add(peerUid);
                setStatus('active');
                startTimer();
                pc.onnegotiationneeded = async () => {
                  if (pc.signalingState === 'stable' && connectedPeersRef.current.has(peerUid)) {
                    try {
                      const newOffer = await pc.createOffer();
                      await pc.setLocalDescription(newOffer);
                      await updateConnectionReceiverOffer(callId, connId, newOffer, true);
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
      }, true);

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
      }, true);

      connUnsubsRef.current.set(peerUid, [unsubConn, unsubCandidates]);
    }
  }, [callId, callType, myUid, startTimer, selectedSpeakerId, camOn]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const constraints = {
        audio: { echoCancellation: true, noiseSuppression: true },
        video: callType === 'video'
          ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
          : false
      };

      if (!mediaStreamRef.current) {
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
        mediaStreamRef.current = stream;
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
            const gainCtx = await getCtx();
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
      } else {
        localStreamRef.current = mediaStreamRef.current;
        if (localVideoRef.current && callType === 'video') {
          localVideoRef.current.srcObject = mediaStreamRef.current;
          localVideoRef.current.play().catch(() => { });
        }
      }

      if (isInitiator && !hasJoinedRef.current) {
        setStatus('waiting');
      }

      const unsubGroupCall = subscribeToGroupCall(callId, async (call) => {
        if (!call || cancelledRef.current) return;
        if (call.status === 'ended') { cleanup(); onClose(); return; }

        const canApprove = myRole === 'admin' || myRole === 'owner' || isInitiator;

        if (isInitiator || canApprove) {
          setPendingApprovals((call.pendingParticipants || []).map(uid => {
            const p = (call.participantData[uid] || {}) as any;
            const resName = [p.displayName, p.username, p.name].find(c => c && c !== 'Usuario' && c !== 'Member') || p.displayName || p.username || p.name || 'Usuario';
            return {
              uid,
              name: resName,
              photo: p.photoURL || p.photo || null
            };
          }));
        }

        const currentParticipants = call.activeParticipants;

        setPeers(prev => {
          return prev.map(p => {
            const pData = (call.participantData[p.uid] || {}) as any;
            const resName = [pData.displayName, pData.username, pData.name].find((c: any) => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous') || pData.displayName || pData.username || pData.name || 'Usuario';
            const resPhoto = pData.photoURL || pData.photo || null;
            if (p.name !== resName || p.photo !== resPhoto) {
              return { ...p, name: resName, photo: resPhoto };
            }
            return p;
          });
        });

        const remoteParticipants = currentParticipants.filter(uid => uid !== myUid);
        if (remoteParticipants.length > 0 && status === 'waiting') {
          setStatus('active');
        }

        const amIActive = currentParticipants.includes(myUid);

        if (!hasJoinedRef.current && amIActive) {
          hasJoinedRef.current = true;
          if (!isInitiator) {
            await joinGroupCall(callId, myUid, true);
          }
          
          const existingPeers = currentParticipants.filter(uid => uid !== myUid);
          for (const uid of existingPeers) {
            const pData = (call.participantData[uid] || {}) as any;
            const peerName = [pData.displayName, pData.username, pData.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous') || pData.displayName || pData.username || pData.name || 'Usuario';
            const peerPhoto = pData.photoURL || pData.photo || null;
            await setupConnectionWithPeer(uid, { ...pData, displayName: peerName, photoURL: peerPhoto } as any, call);
          }
          prevParticipantsRef.current = currentParticipants;
          return;
        }

        const newPeers = currentParticipants.filter(uid => uid !== myUid && !prevParticipantsRef.current.includes(uid));
        const removedPeers = prevParticipantsRef.current.filter(uid => uid !== myUid && !currentParticipants.includes(uid));

        for (const uid of newPeers) {
          const pData = call.participantData[uid] || {};
          const resName = [(pData as any).displayName, (pData as any).username, (pData as any).name].find(c => c && c !== 'Usuario' && c !== 'Member') || (pData as any).displayName || (pData as any).username || (pData as any).name || 'Usuario';
          const peerPhoto = (pData as any).photoURL || (pData as any).photo || null;
          await setupConnectionWithPeer(uid, { ...pData, displayName: resName, photoURL: peerPhoto } as any, call);
        }
        for (const uid of removedPeers) cleanupPeer(uid);

        prevParticipantsRef.current = currentParticipants;
      }, true);

      unsubsRef.current.push(unsubGroupCall);
    }

    init();
    return () => {
      cancelled = true;
      unsubsRef.current.forEach(u => u());
      unsubsRef.current = [];
      if (gainCtxRef.current) { gainCtxRef.current = null; }
    };
  }, [callId, callType, isInitiator, myUid, myRole, cleanupPeer, onClose]);

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
      if (isLocal !== localSpeakingStateRef.current) {
        localSpeakingStateRef.current = isLocal;
        setLocalSpeaking(isLocal);
        if (isLocal && !micOn && !deafened) {
          setShowMuteWarning(true);
          if (muteWarningTimerRef.current) clearTimeout(muteWarningTimerRef.current);
          muteWarningTimerRef.current = setTimeout(() => setShowMuteWarning(false), 3000);
        }
      }

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
  }, [status, micOn, deafened, t]);

  const toggleMic = () => {
    const next = !micOn;
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = next; });
    if (gainCtxRef.current && gainNodeRef.current) gainNodeRef.current.gain.value = next ? userGainRef.current : 0;
    setMicOn(next);
    if (next && deafened) {
      setDeafened(false);
      for (const [uid, pc] of pcsRef.current.entries()) {
        const connId = getConnectionId(myUid, uid);
        updateConnectionDeafenState(callId, connId, myUid < uid, false, true).catch(() => { });
      }
    }
    for (const [uid, pc] of pcsRef.current.entries()) {
      const connId = getConnectionId(myUid, uid);
      updateConnectionMuteState(callId, connId, myUid < uid, !next, true).catch(() => { });
    }
    if (next) setShowMuteWarning(false);
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
          updateConnectionCamState(callId, connId, iAmCaller, false, true).catch(() => { });
          signalConnectionVideo(callId, connId, iAmCaller, true).catch(() => { });
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
        updateConnectionCamState(callId, connId, iAmCaller, true, true).catch(() => { });
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCamOn(false);
    }
  };

  useEffect(() => {
    for (const [uid, audioEl] of remoteAudioElsRef.current.entries()) {
      audioEl.muted = deafened || mutedPeers.has(uid);
    }
  }, [deafened, mutedPeers]);

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
    if (next) {
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      if (gainNodeRef.current) gainNodeRef.current.gain.value = 0;
      setMicOn(false);
    }
    for (const [uid, pc] of pcsRef.current.entries()) {
      const connId = getConnectionId(myUid, uid);
      const isCaller = myUid < uid;
      updateConnectionDeafenState(callId, connId, isCaller, next, true).catch(() => { });
      if (next) updateConnectionMuteState(callId, connId, isCaller, true, true).catch(() => { });
    }
  };

  const stopScreenShare = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    for (const [peerUid, sender] of screenSendersRef.current.entries()) {
      sender.replaceTrack(null).catch(() => { });
      const connId = getConnectionId(myUid, peerUid);
      const iAmCaller = myUid < peerUid;
      updateConnectionSharingState(callId, connId, iAmCaller, false, true).catch(() => { });
    }
    if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
    setSharing(false);
  }, [callId, myUid]);

  const handleLeave = useCallback(async () => {
    cleanup();
    try {
      await leaveGroupCall(callId, myUid);
    } catch { }
    onClose();
  }, [callId, myUid, cleanup, onClose]);

  const handleTileContextMenu = (e: React.MouseEvent, tileId: string) => {
    e.preventDefault();
    if (tileId === 'local' || tileId === 'localShare') return;
    setContextMenu({ x: e.clientX, y: e.clientY, tileId });
  };

  const handleHidePeer = (tileId: string) => {
    const isShare = tileId.endsWith('-share');
    const uid = isShare ? tileId.slice(0, -6) : tileId;
    if (isShare) {
      setHiddenSharePeers(prev => new Set([...prev, uid]));
    } else {
      setHiddenCameraPeers(prev => new Set([...prev, uid]));
    }
    if (focusedTile === tileId) setFocusedTile(null);
    setContextMenu(null);
  };

  const handleToggleMutePeer = (uid: string) => {
    setMutedPeers(prev => {
      const n = new Set(prev);
      n.has(uid) ? n.delete(uid) : n.add(uid);
      return n;
    });
    setContextMenu(null);
  };

  const handlePeerVolume = (uid: string, v: number) => {
    const audioEl = remoteAudioElsRef.current.get(uid);
    if (audioEl) audioEl.volume = v / 100;
    setPeerVolumes(prev => new Map(prev).set(uid, v));
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

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
      (audioEl as any).setSinkId?.(deviceId).catch(() => { });
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

  const startScreenShare = async (sourceId: string) => {
    setShowScreenPicker(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: sourceId
          }
        }
      } as any);

      const videoTrack = stream.getVideoTracks()[0];
      screenTrackRef.current = videoTrack;
      screenStreamRef.current = stream;
      videoTrack.onended = () => stopScreenShare();

      for (const [peerUid, sender] of screenSendersRef.current.entries()) {
        await sender.replaceTrack(videoTrack).catch(() => { });
        const connId = getConnectionId(myUid, peerUid);
        const iAmCaller = myUid < peerUid;
        updateConnectionSharingState(callId, connId, iAmCaller, true, true).catch(() => { });
      }

      if (screenShareVideoRef.current) {
        screenShareVideoRef.current.srcObject = stream;
        screenShareVideoRef.current.play().catch(() => { });
      }
      setSharing(true);
    } catch (err) {
      console.error('[ScreenShare] Error starting:', err);
    }
  };

  const toggleScreenShare = async () => {
    if (sharing) { stopScreenShare(); return; }
    try {
      setScreenSources([]);
      setShowScreenPicker(true);
      setLoadingScreenSources(true);
      const sources = await (window as any).electronAPI.getScreenSources();
      setScreenSources(sources);
      setLoadingScreenSources(false);
    } catch (err) {
      setLoadingScreenSources(false);
      console.error('[ScreenShare] Error toggling:', err);
    }
  };

  const handleInputVolume = useCallback((v: number) => {
    if (gainCtxRef.current?.state === 'suspended') gainCtxRef.current.resume().catch(() => { });
    userGainRef.current = v / 100;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = micOn ? v / 100 : 0;
  }, [micOn]);

  const handleOutputVolume = useCallback((v: number) => {
    for (const audioEl of remoteAudioElsRef.current.values()) audioEl.volume = v / 100;
  }, []);

  const triggerPip = useCallback(async () => {
    if (!document.pictureInPictureEnabled || document.pictureInPictureElement) return;
    const onLeavePip = () => { setInPip(false); setMinimized(false); };
    for (const p of peersRef.current) {
      if (p.sharing) {
        const el = remoteShareVideoElsRef.current.get(p.uid);
        if (el && el.srcObject) {
          try { await el.requestPictureInPicture(); setInPip(true); el.addEventListener('leavepictureinpicture', onLeavePip, { once: true }); return; } catch { }
        }
      }
    }
    if (callType === 'video') {
      for (const p of peersRef.current) {
        if (!p.camOff) {
          const el = remoteVideoElsRef.current.get(p.uid);
          if (el && el.srcObject) {
            try { await el.requestPictureInPicture(); setInPip(true); el.addEventListener('leavepictureinpicture', onLeavePip, { once: true }); return; } catch { }
          }
        }
      }
    }
    try {
      if (!pipVideoRef.current) {
        const v = document.createElement('video');
        v.muted = true; v.playsInline = true;
        Object.assign(v.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', top: '-9999px' });
        document.body.appendChild(v);
        pipVideoRef.current = v;
      }
      if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
      const canvas = document.createElement('canvas');
      canvas.width = 280; canvas.height = 180;
      const ctx = canvas.getContext('2d')!;
      const name = groupName;
      const initial = name[0]?.toUpperCase() || '?';
      const draw = () => {
        ctx.fillStyle = '#2b2d31'; ctx.fillRect(0, 0, 280, 180);
        const cx = 140, cy = 80, r = 48;
        ctx.fillStyle = '#5865f2'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 42px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(initial, cx, cy);
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 15px sans-serif'; ctx.textBaseline = 'alphabetic';
        ctx.fillText(name, 140, 148);
        pipRafRef.current = requestAnimationFrame(draw);
      };
      draw();
      pipVideoRef.current.srcObject = (canvas as any).captureStream(15);
      await pipVideoRef.current.play();
      await pipVideoRef.current.requestPictureInPicture();
      setInPip(true);
      pipVideoRef.current.addEventListener('leavepictureinpicture', () => {
        setInPip(false); setMinimized(false);
        if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
      }, { once: true });
    } catch {
      if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
    }
  }, [callType, groupName]);

  const openDocPip = useCallback(async () => {
    const docPip = (window as any).documentPictureInPicture;
    if (!docPip) { await triggerPip(); setMinimized(true); return; }
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

        const hiddenCam = hiddenCameraPeersRef.current;
        const hiddenShare = hiddenSharePeersRef.current;

        if (focused && focused.endsWith('-share')) {
          const uid = focused.slice(0, -6);
          const peer = currentPeers.find(p => p.uid === uid);
          if (peer?.sharing && !hiddenShare.has(uid)) {
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
            if (p.sharing && !hiddenShare.has(p.uid)) {
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
          const speaking = currentPeers.find(p => p.speaking && !hiddenCam.has(p.uid));
          if (speaking) {
            const rs = remoteStreamsRef.current.get(speaking.uid);
            if (rs) { targetStream = rs; label = speaking.name; photo = speaking.photo ?? ''; showVideo = callType === 'video' && !speaking.camOff; }
          }
        }

        if (!targetStream) {
          const first = currentPeers.find(p => !hiddenCam.has(p.uid));
          if (first) {
            const rs = remoteStreamsRef.current.get(first.uid);
            if (rs) { targetStream = rs; label = first.name; photo = first.photo ?? ''; showVideo = callType === 'video' && !first.camOff; }
          }
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
  }, [callType, handleLeave, triggerPip]);

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

  const formatDurationLocal = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const statusLabel =
    status === 'waiting' ? 'Esperando participantes...' :
      status === 'connecting' ? 'Conectando...' :
        status === 'active' ? formatDurationLocal(duration) : 'Conferencia finalizada';

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

  const onTileClick = (id: string) => () => setFocusedTile(f => f === id ? null : id);

  const tileStyle = (id: string, extra?: React.CSSProperties): React.CSSProperties => {
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
            ? { flexDirection: 'row', gap: 8, padding: 8, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }
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

        {showMuteWarning && (
          <div style={{ position: 'absolute', bottom: 100, left: '50%', transform: 'translateX(-50%)', backgroundColor: '#5865f2', color: '#fff', padding: '12px 24px', borderRadius: '8px', fontWeight: 600, fontSize: '14px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.3)', zIndex: 1000, animation: 'muteWarnSlideIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
            <MicOff size={20} />
            {t('call.muted_warning', '¡Estás silenciado! Tu micrófono está apagado.')}
            <button onClick={() => setShowMuteWarning(false)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', padding: 4 }}><X size={16} /></button>
          </div>
        )}

        {!minimized && (
          <>
            {peers.map(peer => {
              const stream = remoteStreamsRef.current.get(peer.uid) || null;
              const isHidden = hiddenCameraPeers.has(peer.uid);
              if (peer.camOff && !showNoVideoParticipants && !isHidden) return null;

              return (
                <div key={peer.uid} style={{ ...tileStyle(peer.uid), ...(peer.speaking && !deafened && focusedTile !== peer.uid && !isHidden && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }}>
                  <VideoTile
                    uid={peer.uid}
                    name={peer.name}
                    photo={peer.photo}
                    stream={stream}
                    speaking={peer.speaking && !deafened}
                    camOff={peer.camOff || isHidden}
                    muted={peer.muted || mutedPeers.has(peer.uid)}
                    deafened={peer.deafened}
                    volume={(peerVolumes.get(peer.uid) ?? 100) / 100}
                    onVolumeChange={(v: number) => handlePeerVolume(peer.uid, v)}
                    onMuteToggle={() => handleToggleMutePeer(peer.uid)}
                    onClick={() => onTileClick(peer.uid)}
                    onContextMenu={(e: React.MouseEvent) => handleTileContextMenu(e, peer.uid)}
                  />
                  {peer.speaking && !deafened && focusedTile === peer.uid && !isHidden && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
                  )}
                </div>
              );
            })}

            {peers.map(peer => {
              const stream = remoteShareStreamsRef.current.get(peer.uid) || null;
              if (!peer.sharing) return null;
              const isHidden = hiddenSharePeers.has(peer.uid);

              return (
                <div key={`${peer.uid}-share`} style={{ ...tileStyle(`${peer.uid}-share`, { backgroundColor: '#111214' }) }}>
                  <VideoTile
                    uid={`${peer.uid}-share`}
                    name={t('call.screen_of', { name: peer.name })}
                    stream={stream}
                    sharing={true}
                    camOff={isHidden}
                    onClick={() => onTileClick(`${peer.uid}-share`)}
                    onContextMenu={(e: React.MouseEvent) => handleTileContextMenu(e, `${peer.uid}-share`)}
                  />
                </div>
              );
            })}

            <div
              style={{ ...tileStyle('local'), ...(!localTileVisible && { display: 'none' }), ...(localSpeaking && focusedTile !== 'local' && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }}
            >
              <VideoTile
                uid="local"
                name={myName}
                photo={myPhoto}
                stream={localStreamRef.current}
                isLocal={true}
                speaking={localSpeaking && !deafened}
                camOff={!camOn}
                muted={!micOn}
                deafened={deafened}
                onClick={() => onTileClick('local')}
                onContextMenu={(e: React.MouseEvent) => handleTileContextMenu(e, 'local')}
              />
              {localSpeaking && focusedTile === 'local' && (
                <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
              )}
            </div>

            <div
              style={{ ...tileStyle('localShare', { backgroundColor: '#111214' }), ...(!sharing && { display: 'none' }) }}
            >
              <VideoTile
                uid="localShare"
                name={t('call.your_screen')}
                stream={screenStreamRef.current}
                isLocal={true}
                sharing={true}
                onStopSharing={stopScreenShare}
                onClick={() => onTileClick('localShare')}
                onContextMenu={(e: React.MouseEvent) => handleTileContextMenu(e, 'localShare')}
              />
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

      {(myRole === 'admin' || myRole === 'owner' || isInitiator) && pendingApprovals.length > 0 && !minimized && (
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
                <div style={{ color: '#b9bbbe', fontSize: 11, marginTop: 1 }}>{t('call.wants_to_join')}</div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => denyConferenceParticipant(callId, p.uid).catch(() => { })}
                  style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#ed4245', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                  title={t('call.deny')}
                >
                  ✕
                </button>
                <button
                  onClick={() => approveConferenceParticipant(callId, p.uid).catch(() => { })}
                  style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#23a55a', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}
                  title={t('call.admit')}
                >
                  ✓
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {contextMenu && (() => {
        const { x, y, tileId } = contextMenu;
        const isLocal = tileId === 'local' || tileId === 'localShare';
        const peerUid = !isLocal ? (tileId.endsWith('-share') ? tileId.slice(0, -6) : tileId) : null;
        const isMuted = peerUid ? mutedPeers.has(peerUid) : false;
        const vol = peerUid ? (peerVolumes.get(peerUid) ?? 100) : 100;
        const menuX = Math.min(x, window.innerWidth - 230);
        const menuY = Math.min(y, window.innerHeight - 180);
        const itemStyle: React.CSSProperties = {
          display: 'flex', alignItems: 'center', gap: 10,
          width: '100%', padding: '9px 14px',
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#dcddde', textAlign: 'left', fontSize: 14,
        };
        return (
          <div
            onMouseDown={e => e.stopPropagation()}
            style={{
              position: 'fixed', left: menuX, top: menuY, zIndex: 10002,
              backgroundColor: '#18191c', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, padding: '4px 0', minWidth: 210,
              boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
            }}
          >
            {isLocal ? (
              <button
                style={itemStyle}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                onClick={() => { tileId === 'localShare' ? stopScreenShare() : toggleCam(); setContextMenu(null); }}
              >
                <MonitorOff size={15} color="#dcddde" />
                {t('call.stop_broadcasting')}
              </button>
            ) : (
              <>
                {tileId.endsWith('-share') && (
                  <button
                    style={itemStyle}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => handleHidePeer(tileId)}
                  >
                    <EyeOff size={15} color="#dcddde" />
                    {t('call.hide_stream')}
                  </button>
                )}
                <button
                  style={itemStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => handleToggleMutePeer(peerUid!)}
                >
                  {isMuted ? <Volume2 size={15} color="#dcddde" /> : <VolumeX size={15} color="#dcddde" />}
                  {isMuted ? t('call.unmute_stream') : t('call.mute_stream')}
                </button>
                <div style={{ padding: '8px 14px 10px' }} onMouseDown={e => e.stopPropagation()}>
                  <div style={{ color: '#b9bbbe', fontSize: 12, marginBottom: 6 }}>{t('call.stream_volume')}</div>
                  <input
                    type="range" min={0} max={100} value={vol}
                    onChange={e => handlePeerVolume(peerUid!, Number(e.target.value))}
                    className="call-range"
                    style={{ background: `linear-gradient(to right, #5865f2 ${vol}%, rgba(255,255,255,0.15) ${vol}%)` }}
                  />
                </div>
              </>
            )}
          </div>
        );
      })()}

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

          {(showDevices || showCamPicker) && (
            <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '12px', width: '300px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
              {showDevices ? (
                <>
                  <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{t('call.audio_input', 'Micrófono')}</div>
                  {devices.filter(d => d.kind === 'audioinput').map((d, i) => (
                    <div key={`mic-${i}`} onClick={() => changeAudioInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedMicId === d.deviceId ? 'rgba(88,101,242,0.15)' : 'transparent', marginBottom: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Mic ${i + 1}`}</span>
                      {selectedMicId === d.deviceId && <Check size={14} color="#5865f2" />}
                    </div>
                  ))}
                  <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px', letterSpacing: '0.5px' }}>{t('call.audio_output', 'Altavoces')}</div>
                  {devices.filter(d => d.kind === 'audiooutput').map((d, i) => (
                    <div key={`out-${i}`} onClick={() => changeAudioOutput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedSpeakerId === d.deviceId ? 'rgba(34,197,94,0.15)' : 'transparent', marginBottom: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Speaker ${i + 1}`}</span>
                      {selectedSpeakerId === d.deviceId && <Check size={14} color="#22c55e" />}
                    </div>
                  ))}
                </>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{t('call.video_devices')}</div>
                  {devices.filter(d => d.kind === 'videoinput').map((d, i) => (
                    <div key={`cam-${i}`} onClick={() => changeVideoInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedCamId === d.deviceId ? 'rgba(88,101,242,0.15)' : 'transparent', marginBottom: '2px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Cam ${i + 1}`}</span>
                      {selectedCamId === d.deviceId && <Check size={14} color="#5865f2" />}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}

          {showScreenPicker && <ScreenShareModal onClose={() => setShowScreenPicker(false)} onSelect={startScreenShare} />}

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
            {status === 'active' && typeof (navigator.mediaDevices as any)?.getDisplayMedia === 'function' && (
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

export function IncomingConferenceModal({ call, onJoin, onDismiss }: { call: GroupCall; onJoin: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
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
          {call.initiatorName} · {t('conference.label')}
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

const CtrlBtn = ({ icon, label, onClick, muted, danger, active, green, mobile }: any) => (
  <button
    onClick={onClick}
    title={label}
    style={{
      width: mobile ? 42 : 48, height: mobile ? 42 : 48, borderRadius: '50%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: danger ? '#ed4245' : (muted ? '#ed4245' : (green ? '#23a55a' : (active ? '#36373d' : 'rgba(79,84,92,0.75)'))),
      border: 'none', cursor: 'pointer', color: '#fff', transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
    }}
  >
    {icon}
  </button>
);

const CompoundBtn = ({ icon, label, onClick, onChevron, muted, chevronActive, mobile }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: muted ? '#ed4245' : 'rgba(79,84,92,0.75)', borderRadius: 24, height: mobile ? 42 : 48, transition: 'all 0.2s ease' }}>
    <button onClick={onClick} title={label} style={{ width: mobile ? 38 : 44, height: mobile ? 42 : 48, borderRadius: '24px 0 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#fff' }}>{icon}</button>
    <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />
    <button onClick={onChevron} style={{ width: mobile ? 24 : 28, height: mobile ? 42 : 48, borderRadius: '0 24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#fff' }}>
      <div style={{ transform: chevronActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease', display: 'flex', alignItems: 'center' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
      </div>
    </button>
  </div>
);

const Headphones = ({ size, color }: { size: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6" /><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" /></svg>
);

const HeadphoneOff = ({ size, color }: { size: number, color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color || "currentColor"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 14h-3a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2z" /><path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2z" /><path d="M20.4 4.5A9 9 0 0 0 5.6 4.5" /><path d="m2 2 20 20" /></svg>
);