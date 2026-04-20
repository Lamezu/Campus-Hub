import React, { useEffect, useRef, useState, useCallback, ReactNode, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { auth, db } from '../../config/firebase';
import {
  PhoneOff, Video, VideoOff, Mic, MicOff,
  Headphones, HeadphoneOff, Monitor, MonitorOff,
  ChevronUp, Check, ExternalLink, Settings, Eye, EyeOff, Volume2, VolumeX, Play, Download, ChevronLeft, Users
} from 'lucide-react';
import { ScreenShareModal } from './ScreenShareModal';
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
  leaveGroupCall,
  requestToJoinConference,
  approveConferenceParticipant,
  denyConferenceParticipant,
  updateConnectionSharingState,
} from '../../services/studyGroupConferenceService';
import { type CallType } from '../../services/callService';
import VideoTile from './VideoTile';
import { useTheme } from '../../contexts/ThemeContext';
import { ThemedText } from '../themed-text';
import { spacing } from '../../constants/styles';

interface CtrlBtnProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
  green?: boolean;
  active?: boolean;
}

const CtrlBtn = ({ icon, label, onClick, muted, green, active }: CtrlBtnProps) => {
  const { colors } = useTheme();
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        width: 48, height: 48, borderRadius: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backgroundColor: muted ? '#ef4444' : (active ? colors.primary : colors.backgroundSecondary),
        border: 'none', cursor: 'pointer', transition: 'all 0.2s',
        color: (muted || active) ? '#fff' : colors.text
      }}
    >
      {icon}
    </button>
  );
};

const CompoundBtn = ({ icon, label, onClick, onChevron, muted, chevronActive }: any) => {
  const { colors } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', backgroundColor: muted ? '#ef4444' : colors.backgroundSecondary, borderRadius: 24, height: 48, transition: 'all 0.2s' }}>
      <button onClick={onClick} title={label} style={{ width: 44, height: 48, borderRadius: '24px 0 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#fff' }}>
        {icon}
      </button>
      <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />
      <button onClick={onChevron} style={{ width: 28, height: 48, borderRadius: '0 24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: chevronActive ? colors.primary : '#fff' }}>
        <ChevronUp size={16} style={{ transform: chevronActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
      </button>
    </div>
  );
};

interface PeerState {
  uid: string;
  name: string;
  photo: string | null;
  camOff: boolean;
  speaking: boolean;
  sharing: boolean;
}

export default function ConferenceScreen({
  callId, myUid, myName, myPhoto, isInitiator, callType, onClose, groupName, groupPhoto, myRole
}: {
  callId: string; myUid: string; myName: string; myPhoto: string | null;
  isInitiator: boolean; callType: CallType; onClose: () => void;
  groupName?: string; groupPhoto?: string | null;
  myRole?: string;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'active' | 'ended'>('waiting');
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [activeTab, setActiveTab] = useState<'grid' | 'settings'>('grid');
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedCamId, setSelectedCamId] = useState('');
  const [selectedOutputId, setSelectedOutputId] = useState('');
  const [showDevices, setShowDevices] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Set<string>>(new Set());
  const [pendingApprovals, setPendingApprovals] = useState<{ uid: string; name: string; photo: string | null }[]>([]);
  const [duration, setDuration] = useState(0);

  const localStreamRef = useRef<MediaStream | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteShareStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const unsubsRef = useRef<(() => void)[]>([]);
  const connUnsubsRef = useRef<Map<string, (() => void)[]>>(new Map());

  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainCtxRef = useRef<AudioContext | null>(null);
  const gainSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const remoteGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const [localSharingStream, setLocalSharingStream] = useState<MediaStream | null>(null);

  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const signalingLockRef = useRef<Map<string, boolean>>(new Map());
  const candQueueRef = useRef<Map<string, any[]>>(new Map());
  const cancelledRef = useRef(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const changeAudioInput = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      const track = s.getAudioTracks()[0]; if (!track) return;
      localStreamRef.current?.getAudioTracks().forEach(t => t.stop());
      
      let targetTrack = track;
      if (gainCtxRef.current && gainNodeRef.current && gainDestRef.current) {
        gainSourceRef.current?.disconnect();
        const nsrc = gainCtxRef.current.createMediaStreamSource(new MediaStream([track]));
        gainSourceRef.current = nsrc; nsrc.connect(gainNodeRef.current);
        targetTrack = gainDestRef.current.stream.getAudioTracks()[0] || track;
      }
      
      const vTracks = localStreamRef.current?.getVideoTracks() || [];
      localStreamRef.current = new MediaStream([targetTrack, ...vTracks]);
      
      pcsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) sender.replaceTrack(targetTrack);
      });
      setMicOn(true);
      setStreamVersion(v => v + 1);
    } catch (err) { console.error(err); }
  };

  const changeAudioOutput = async (deviceId: string) => {
    setSelectedOutputId(deviceId);
    remoteAudioElsRef.current.forEach(async (el) => {
      if ((el as any).setSinkId) {
        try { await (el as any).setSinkId(deviceId); } catch (err) { console.error(err); }
      }
    });
  };

  const changeVideoInput = async (deviceId: string) => {
    setSelectedCamId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      const track = s.getVideoTracks()[0]; if (!track) return;
      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      
      pcsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) sender.replaceTrack(track);
      });
      
      const aTracks = localStreamRef.current?.getAudioTracks() || [];
      localStreamRef.current = new MediaStream([track, ...aTracks]);
      setCamOn(true);
      setStreamVersion(v => v + 1);
    } catch (err) { console.error(err); }
  };

  const openDevicePicker = async () => {
    const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    setDevices(list); setShowDevices(!showDevices); setShowCamPicker(false);
  };
  const openCamPicker = async () => {
    const list = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
    setDevices(list); setShowCamPicker(!showCamPicker); setShowDevices(false);
  };

  const cleanupPeer = useCallback((uid: string) => {
    pcsRef.current.get(uid)?.close(); pcsRef.current.delete(uid);
    remoteStreamsRef.current.delete(uid); remoteShareStreamsRef.current.delete(uid);
    connUnsubsRef.current.get(uid)?.forEach(u => u()); connUnsubsRef.current.delete(uid);
    remoteAudioElsRef.current.get(uid)?.remove(); remoteAudioElsRef.current.delete(uid);
    remoteAnalysersRef.current.delete(uid); remoteGainNodesRef.current.delete(uid);
    setPeers(prev => prev.filter(p => p.uid !== uid));
  }, []);

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    pcsRef.current.forEach(pc => pc.close());
    unsubsRef.current.forEach(u => u());
    connUnsubsRef.current.forEach(u => u.forEach(fn => fn()));
    audioCtxRef.current?.close();
    gainCtxRef.current?.close();
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const handleLeave = useCallback(async () => {
    cleanup();
    await leaveGroupCall(callId, myUid).catch(() => {});
    onClose();
  }, [callId, myUid, cleanup, onClose]);

  useEffect(() => {
    remoteGainNodesRef.current.forEach((gn, uid) => {
      const vol = (peerMuted.has(uid) || deafened) ? 0 : (peerVolumes[uid] ?? 1);
      gn.gain.setTargetAtTime(vol, 0, 0.05);
    });
  }, [peerMuted, peerVolumes, deafened]);

  const setupRemoteAudio = async (uid: string, track: MediaStreamTrack) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        try { await ctx.resume(); setIsAudioBlocked(ctx.state === 'suspended'); } catch { setIsAudioBlocked(true); }
      }
      const stream = new MediaStream([track]);
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser(); an.fftSize = 32;
      const gn = ctx.createGain();
      gn.gain.value = (peerMuted.has(uid) || deafened) ? 0 : (peerVolumes[uid] ?? 1);
      src.connect(an); an.connect(gn); gn.connect(ctx.destination);
      remoteAnalysersRef.current.set(uid, an);
      remoteGainNodesRef.current.set(uid, gn);
    } catch (err) { }
  };

  const setupConnectionWithPeer = useCallback(async (peerUid: string, peerData: any) => {
    if (pcsRef.current.has(peerUid) || cancelledRef.current) return;
    const connId = getConnectionId(myUid, peerUid);
    const iAmCaller = myUid < peerUid;
    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcsRef.current.set(peerUid, pc);

    if (iAmCaller) {
      const audioT = gainDestRef.current?.stream.getAudioTracks()[0] || localStreamRef.current?.getAudioTracks()[0];
      const videoT = localStreamRef.current?.getVideoTracks()[0];
      if (audioT) pc.addTransceiver(audioT, { direction: 'sendrecv', streams: [localStreamRef.current!] });
      else pc.addTransceiver('audio', { direction: 'sendrecv' });
      if (videoT) pc.addTransceiver(videoT, { direction: 'sendrecv', streams: [localStreamRef.current!] });
      else pc.addTransceiver('video', { direction: 'sendrecv' });
      if (screenTrackRef.current) pc.addTransceiver(screenTrackRef.current, { direction: 'sendrecv' });
      else pc.addTransceiver('video', { direction: 'sendrecv' });
    }

    const rStream = new MediaStream(); remoteStreamsRef.current.set(peerUid, rStream);
    const rsStream = new MediaStream(); remoteShareStreamsRef.current.set(peerUid, rsStream);

    pc.onicecandidate = (e) => {
      if (!e.candidate || !pc.remoteDescription) return;
      const add = iAmCaller ? addConnectionCallerCandidate : addConnectionReceiverCandidate;
      add(callId, connId, e.candidate.toJSON()).catch(() => {});
    };

    pc.onnegotiationneeded = async () => {
      if (makingOfferRef.current.get(peerUid)) return;
      try {
        makingOfferRef.current.set(peerUid, true);
        await pc.setLocalDescription();
        const sync = iAmCaller ? updateConnectionOffer : updateConnectionReceiverOffer;
        await sync(callId, connId, pc.localDescription!.toJSON());
      } catch {} finally { makingOfferRef.current.set(peerUid, false); }
    };

    pc.ontrack = (e) => {
      const transceivers = pc.getTransceivers();
      const idx = transceivers.findIndex(t => t.receiver === e.receiver);
      if (idx === 0) {
        rStream.getAudioTracks().forEach(t => rStream.removeTrack(t));
        rStream.addTrack(e.track);
        setupRemoteAudio(peerUid, e.track);
      } else if (idx === 1) {
        rStream.getVideoTracks().forEach(t => rStream.removeTrack(t));
        rStream.addTrack(e.track);
      } else if (idx === 2) {
        rsStream.getVideoTracks().forEach(t => rsStream.removeTrack(t));
        rsStream.addTrack(e.track);
        setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: true } : p));
        e.track.onended = () => {
          setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: false } : p));
        };
      }
      setStreamVersion(v => v + 1);
    };

    const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
      if (!conn || cancelledRef.current) return;
      const remoteSDP = iAmCaller ? conn.answer : conn.offer;
      if (!remoteSDP || signalingLockRef.current.get(peerUid)) return;
      try {
        signalingLockRef.current.set(peerUid, true);
        if (remoteSDP.type === 'offer') {
          if (pc.signalingState !== 'stable') {
            if (makingOfferRef.current.get(peerUid)) return;
            await Promise.all([pc.setLocalDescription({ type: 'rollback' }), pc.setRemoteDescription(remoteSDP)]);
          } else await pc.setRemoteDescription(remoteSDP);
          const transceivers = pc.getTransceivers();
          transceivers.forEach(t => { t.direction = 'sendrecv'; });
          if (localStreamRef.current) {
            const audioT = gainDestRef.current?.stream.getAudioTracks()[0] || localStreamRef.current.getAudioTracks()[0];
            const videoT = localStreamRef.current.getVideoTracks()[0];
            if (audioT && transceivers[0]) await transceivers[0].sender.replaceTrack(audioT);
            if (videoT && camOn && transceivers[1]) await transceivers[1].sender.replaceTrack(videoT);
          }
          if (screenTrackRef.current && transceivers[2]) await transceivers[2].sender.replaceTrack(screenTrackRef.current);
          const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
          await answerConnection(callId, connId, pc.localDescription!.toJSON());
        } else if (pc.signalingState !== 'stable') {
          await pc.setRemoteDescription(remoteSDP);
        }
        const q = candQueueRef.current.get(peerUid) || [];
        while (q.length > 0) { const c = q.shift(); if (c) pc.addIceCandidate(c).catch(() => {}); }
      } finally { signalingLockRef.current.set(peerUid, false); }
      const peerCam = iAmCaller ? conn.receiverCamOff : conn.callerCamOff;
      setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: !!peerCam } : p));
      const peerSharing = iAmCaller ? conn.receiverSharing : conn.callerSharing;
      setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: !!peerSharing } : p));
    });

    const candSub = iAmCaller ? subscribeToConnectionReceiverCandidates : subscribeToConnectionCallerCandidates;
    const unsubCand = candSub(callId, connId, async (c) => {
      if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => {});
      else { const q = candQueueRef.current.get(peerUid) || []; q.push(c); candQueueRef.current.set(peerUid, q); }
    });

    if (iAmCaller) await createConnection(callId, connId, myUid, peerUid);
    connUnsubsRef.current.set(peerUid, [unsubConn, unsubCand]);
    setPeers(prev => [...prev.filter(p => p.uid !== peerUid), {
      uid: peerUid,
      name: peerData.displayName || peerData.name || 'Usuario',
      photo: peerData.photoURL || peerData.photo || null,
      camOff: false, speaking: false, sharing: false
    }]);

    const senders = pc.getSenders();
    if (localStreamRef.current) {
      const audioT = gainDestRef.current?.stream.getAudioTracks()[0] || localStreamRef.current.getAudioTracks()[0];
      if (audioT && senders[0]) senders[0].replaceTrack(audioT);
      const videoT = localStreamRef.current.getVideoTracks()[0];
      if (videoT && camOn && senders[1]) senders[1].replaceTrack(videoT);
    }
  }, [myUid, callId, camOn, peerMuted, deafened, peerVolumes, cleanupPeer]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        gainCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
        const gn = ctx.createGain();
        const dest = ctx.createMediaStreamDestination();
        src.connect(gn); gn.connect(dest);
        gainSourceRef.current = src; gainNodeRef.current = gn; gainDestRef.current = dest;
        gn.gain.value = micOn ? 1 : 0;
        const devList = await navigator.mediaDevices.enumerateDevices();
        setDevices(devList);
        setStatus('connecting'); startTimer();
      } catch (err) { console.error(err); setStatus('ended'); return; }

      const unsubGroup = subscribeToGroupCall(callId, async (call) => {
        if (cancelledRef.current) return;
        if (!call) { if (status === 'connecting' || status === 'waiting') setStatus('ended'); return; }
        if (call.status === 'ended') { cleanup(); onClose(); return; }
        if (isInitiator) {
          const pending = call.pendingParticipants || [];
          setPendingApprovals(pending.map(uid => ({
            uid,
            name: (call.participantData[uid] as any)?.displayName || (call.participantData[uid] as any)?.name || t('call.member'),
            photo: (call.participantData[uid] as any)?.photoURL || (call.participantData[uid] as any)?.photo || null
          })));
        }
        const others = call.activeParticipants.filter(uid => uid !== myUid);
        for (const uid of others) {
          const pData = call.participantData[uid] || { name: 'Usuario', photo: null };
          await setupConnectionWithPeer(uid, pData);
        }
        pcsRef.current.forEach((_, uid) => { if (!call.activeParticipants.includes(uid)) cleanupPeer(uid); });
      });
      unsubsRef.current.push(unsubGroup);
      if (!isInitiator) requestToJoinConference(callId, myUid, { displayName: myName, photoURL: myPhoto }).catch(() => setStatus('ended'));
    }
    init(); return () => { cancelled = true; };
  }, [callId, myUid, isInitiator, callType, startTimer, cleanupPeer, setupConnectionWithPeer, handleLeave]);

  const toggleMic = () => {
    const next = !micOn; setMicOn(next);
    if (gainNodeRef.current) gainNodeRef.current.gain.value = next ? 1 : 0;
  };

  const toggleCam = () => {
    const next = !camOn;
    if (next) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        const t = s.getVideoTracks()[0]; if (!t) return;
        pcsRef.current.forEach(pc => pc.getSenders()[1]?.replaceTrack(t));
        for (const uid of pcsRef.current.keys()) signalConnectionVideo(callId, getConnectionId(myUid, uid), myUid < uid);
        setCamOn(true);
      });
    } else {
      pcsRef.current.forEach(pc => pc.getSenders()[1]?.replaceTrack(null));
      for (const uid of pcsRef.current.keys()) updateConnectionCamState(callId, getConnectionId(myUid, uid), myUid < uid, true);
      setCamOn(false);
    }
  };

  const toggleDeafen = () => {
    const next = !deafened; setDeafened(next);
    if (next) setMicOn(false);
  };

  const onHandleSourceSelect = async (sid: string) => {
    if (screenTrackRef.current) screenTrackRef.current.stop();
    try {
      const s = await (navigator.mediaDevices as any).getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sid } } });
      const t = s.getVideoTracks()[0]; screenTrackRef.current = t; setLocalSharingStream(s); setSharing(true); setShowShareModal(false);
      pcsRef.current.forEach(async (pc, peerUid) => {
        const senders = pc.getSenders(); if (senders[2]) await senders[2].replaceTrack(t);
        updateConnectionSharingState(callId, getConnectionId(myUid, peerUid), myUid < peerUid, true);
      });
      t.onended = () => {
        setSharing(false); setLocalSharingStream(null);
        pcsRef.current.forEach(async (pc, peerUid) => {
          const senders = pc.getSenders(); if (senders[2]) await senders[2].replaceTrack(null);
          updateConnectionSharingState(callId, getConnectionId(myUid, peerUid), myUid < peerUid, false);
        });
      };
    } catch {}
  };

  const formatDuration = (s: number) => {
    const min = Math.floor(s / 60); const sec = s % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  if (status === 'waiting' || status === 'connecting') {
    return (
      <div style={{ position: 'fixed', inset: 0, backgroundColor: '#000', zIndex: 2000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <div style={{ width: 120, height: 120, borderRadius: 60, overflow: 'hidden', border: `4px solid ${colors.primary}` }}>
          {myPhoto ? <img src={myPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', backgroundColor: colors.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><ThemedText style={{ fontSize: 40, fontWeight: 'bold', color: '#fff' }}>{myName[0]}</ThemedText></div>}
        </div>
        <ThemedText style={{ fontSize: 20, fontWeight: 700 }}>{isInitiator ? t('chat_ui.calling') : t('chat_ui.connecting')}</ThemedText>
        <div style={{ display: 'flex', gap: 16 }}>
          <CtrlBtn icon={micOn ? <Mic size={24} /> : <MicOff size={24} />} label="Mute" onClick={toggleMic} muted={!micOn} />
          <CtrlBtn icon={camOn ? <Video size={24} /> : <VideoOff size={24} />} label="Cam" onClick={toggleCam} muted={!camOn} />
          <CtrlBtn icon={<PhoneOff size={24} />} label="End" onClick={handleLeave} muted />
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111', zIndex: 2000, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ThemedText style={{ color: '#fff', fontWeight: 800 }}>{groupName || t('chat_ui.conference')}</ThemedText>
          <div style={{ padding: '4px 8px', borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.1)' }}>
            <ThemedText style={{ color: colors.primary, fontSize: 12, fontWeight: 700 }}>{formatDuration(duration)}</ThemedText>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setActiveTab('grid')} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: activeTab === 'grid' ? colors.primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Grid</button>
          <button onClick={() => setActiveTab('settings')} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: activeTab === 'settings' ? colors.primary : 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}>Settings</button>
        </div>
      </div>

      <div style={{ flex: 1, padding: 20, overflowY: 'auto' }} className="custom-scrollbar">
        {activeTab === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, height: '100%' }}>
            <VideoTile uid="local" stream={localStreamRef.current} name={t('call.you')} isLocal camOff={!camOn} />
            {peers.map(p => (
              <React.Fragment key={p.uid}>
                <VideoTile
                  uid={p.uid} stream={remoteStreamsRef.current.get(p.uid) || null} name={p.name} photo={p.photo} camOff={p.camOff}
                  muted={peerMuted.has(p.uid)} volume={peerVolumes[p.uid] ?? 1}
                  onMuteToggle={(m) => setPeerMuted(prev => { const n = new Set(prev); if (m) n.add(p.uid); else n.delete(p.uid); return n; })}
                  onVolumeChange={(v) => setPeerVolumes(prev => ({ ...prev, [p.uid]: v / 100 }))}
                />
                {p.sharing && <VideoTile uid={`${p.uid}-share`} stream={remoteShareStreamsRef.current.get(p.uid) || null} name={p.name} photo={p.photo} sharing />}
              </React.Fragment>
            ))}
          </div>
        ) : (
          <div style={{ maxWidth: 600, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div>
              <ThemedText style={{ color: '#fff', opacity: 0.6, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', marginBottom: 12 }}>{t('common.participants')}</ThemedText>
              {pendingApprovals.length > 0 && (
                <div style={{ marginBottom: 20, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12 }}>
                  <ThemedText style={{ color: colors.primary, fontWeight: 700, marginBottom: 12 }}>{t('call.admission_request')}</ThemedText>
                  {pendingApprovals.map(p => (
                    <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 16, overflow: 'hidden' }}>{p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ backgroundColor: colors.primary, width: '100%', height: '100%' }} />}</div>
                      <ThemedText style={{ flex: 1, color: '#fff' }}>{p.name}</ThemedText>
                      <button onClick={() => approveConferenceParticipant(callId, p.uid)} style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: colors.primary, border: 'none', color: '#fff', cursor: 'pointer' }}>{t('call.admit')}</button>
                      <button onClick={() => denyConferenceParticipant(callId, p.uid)} style={{ padding: '6px 12px', borderRadius: 6, backgroundColor: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer' }}>Rechazar</button>
                    </div>
                  ))}
                </div>
              )}
              {peers.map(p => (
                <div key={p.uid} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, marginBottom: 8 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 20, overflow: 'hidden' }}>{p.photo ? <img src={p.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ backgroundColor: colors.primary, width: '100%', height: '100%' }} />}</div>
                  <div style={{ flex: 1 }}>
                    <ThemedText style={{ color: '#fff', fontWeight: 600 }}>{p.name}</ThemedText>
                    <ThemedText style={{ color: '#fff', opacity: 0.5, fontSize: 12 }}>{p.camOff ? 'Cámara apagada' : 'Cámara encendida'}</ThemedText>
                  </div>
                  <button onClick={() => setPeerMuted(prev => { const n = new Set(prev); if (n.has(p.uid)) n.delete(p.uid); else n.add(p.uid); return n; })} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {peerMuted.has(p.uid) ? <VolumeX size={20} color="#ef4444" /> : <Volume2 size={20} color="#fff" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', justifyContent: 'center', gap: 16, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)', borderTop: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 32, top: '50%', transform: 'translateY(-50%)' }}>
          <ThemedText style={{ color: colors.primary, fontWeight: 800, fontSize: 14 }}>{formatDuration(duration)}</ThemedText>
        </div>
        <CompoundBtn icon={micOn ? <Mic size={20} /> : <MicOff size={20} />} label={t('call.mic')} onClick={toggleMic} onChevron={openDevicePicker} muted={!micOn} chevronActive={showDevices} />
        <CtrlBtn icon={deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />} label={t('call.deafen')} onClick={toggleDeafen} active={deafened} />
        <CompoundBtn icon={camOn ? <Video size={20} /> : <VideoOff size={20} />} label={t('call.video')} onClick={toggleCam} onChevron={openCamPicker} muted={!camOn} chevronActive={showCamPicker} />
        <CtrlBtn icon={sharing ? <MonitorOff size={20} /> : <Monitor size={20} />} label={t('call.share_screen')} onClick={() => sharing ? setSharing(false) : setShowShareModal(true)} active={sharing} />
        <CtrlBtn icon={<PhoneOff size={20} />} label={t('call.hang_up')} onClick={handleLeave} muted />
      </div>

      {pendingApprovals.length > 0 && isInitiator && (
        <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '16px', padding: '16px 24px', zIndex: 10002, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: 20, animation: 'fadeInDown 0.4s ease-out' }}>
          <style>{`@keyframes fadeInDown { from { opacity: 0; transform: translate(-50%, -20px); } to { opacity: 1; transform: translate(-50%, 0); } }`}</style>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, animation: 'pulse 1.5s infinite' }} />
            <ThemedText style={{ color: '#fff', fontWeight: 700 }}>{t('call.waiting_admission', 'Personas esperando')} ({pendingApprovals.length})</ThemedText>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setPendingApprovals([])} style={{ background: 'none', border: 'none', color: '#949ba4', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{t('common.dismiss', 'Ignorar')}</button>
            <button onClick={() => setActiveTab('settings')} style={{ padding: '8px 16px', borderRadius: 8, backgroundColor: colors.primary, color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{t('common.view', 'Ver')}</button>
          </div>
        </div>
      )}

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
                <div key={`out-${i}`} onClick={() => changeAudioOutput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedOutputId === d.deviceId ? 'rgba(34,197,94,0.15)' : 'transparent', marginBottom: '2px' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Speaker ${i + 1}`}</span>
                  {selectedOutputId === d.deviceId && <Check size={14} color="#22c55e" />}
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
      {showShareModal && <ScreenShareModal onClose={() => setShowShareModal(false)} onSelect={onHandleSourceSelect} />}
    </div>
  );
}

export function IncomingConferenceModal({ call, onJoin, onDismiss }: { call: any; onJoin: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return createPortal(
    <div style={{ position: 'fixed', top: '24px', right: '24px', width: '340px', backgroundColor: 'rgba(30,31,34,0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '20px', zIndex: 10000, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
      <style>{`@keyframes slideIn { from { transform: translateX(120%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          {call.groupPhoto ? (
            <img src={call.groupPhoto} style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #7c3aed' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: 700 }}>
              {call.groupName.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: '16px', height: '16px', backgroundColor: '#7c3aed', borderRadius: '50%', border: '3px solid #1E1F22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={10} color="#fff" />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{call.groupName}</div>
          <div style={{ color: '#b5bac1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#7c3aed', animation: 'pulse 1.5s infinite' }} />
             {t('call.incoming_conference', 'Videoconferencia entrante')}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={onDismiss}
          style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'rgba(237,66,69,0.15)', color: '#ed4245', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = 'rgba(237,66,69,0.25)'}
          onMouseOut={(e) => e.currentTarget.style.background = 'rgba(237,66,69,0.15)'}
        >
          {t('call.reject', 'Rechazar')}
        </button>
        <button
          onClick={onJoin}
          style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#7c3aed', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' }}
          onMouseOver={(e) => e.currentTarget.style.background = '#6d28d9'}
          onMouseOut={(e) => e.currentTarget.style.background = '#7c3aed'}
        >
          {t('call.admit', 'Aceptar')}
        </button>
      </div>
    </div>,
    document.body
  );
}