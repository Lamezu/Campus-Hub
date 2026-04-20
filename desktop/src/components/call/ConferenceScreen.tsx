import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import {
  PhoneOff, Video, VideoOff, Mic, MicOff,
  Headphones, HeadphoneOff, Monitor, MonitorOff,
  ChevronUp, Check, Users, Eye, EyeOff, Volume2, VolumeX, AlertCircle
} from 'lucide-react';
import { ScreenShareModal } from './ScreenShareModal';
import {
  ICE_SERVERS,
  getConnectionId,
  createConnection,
  updateConnectionOffer,
  answerConnection,
  updateConnectionCamState,
  updateConnectionSharingState,
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
  type GroupCall
} from '../../services/studyGroupConferenceService';
import { type CallType } from '../../services/callService';
import VideoTile from './VideoTile';

interface PeerState {
  uid: string;
  name: string;
  photo: string | null;
  camOff: boolean;
  speaking: boolean;
  sharing: boolean;
  connectionState: RTCIceConnectionState;
}

export default function ConferenceScreen({
  callId, myUid, myName, myPhoto, isInitiator, callType, onClose, groupName, groupPhoto
}: {
  callId: string; myUid: string; myName: string; myPhoto: string | null;
  isInitiator: boolean; callType: CallType; onClose: () => void;
  groupName?: string; groupPhoto?: string | null;
}) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'waiting' | 'connecting' | 'active' | 'ended'>(isInitiator ? 'active' : 'waiting');
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [streamVersion, setStreamVersion] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState('default');
  const [selectedCamId, setSelectedCamId] = useState('default');
  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Set<string>>(new Set());
  const [hiddenStreams, setHiddenStreams] = useState<Set<string>>(new Set());
  const [focusedTile, setFocusedTile] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, peerUid: string } | null>(null);
  const [pendingApprovals, setPendingApprovals] = useState<{ uid: string; name: string; photo: string | null }[]>([]);
  const [duration, setDuration] = useState(0);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localSharingStream, setLocalSharingStream] = useState<MediaStream | null>(null);
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteShareStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const remoteGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  const unsubGroupRef = useRef<(() => void) | null>(null);
  const connUnsubsRef = useRef<Map<string, (() => void)[]>>(new Map());
  const localStreamRef = useRef<MediaStream>(new MediaStream());
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const signalingLockRef = useRef<Map<string, boolean>>(new Map());
  const candQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const cancelledRef = useRef(false);
  const timerRef = useRef<any>(null);
  const remoteAudioElRef = useRef<HTMLAudioElement>(null);
  const statusRef = useRef(isInitiator ? 'active' : 'waiting');

  const formatDuration = (s: number) => {
    const min = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${min}:${sec}`;
  };

  const startTimer = useCallback(() => {
    if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, []);

  const cleanupPeer = useCallback((uid: string) => {
    const pc = pcsRef.current.get(uid);
    if (pc) { pc.close(); pcsRef.current.delete(uid); }
    connUnsubsRef.current.get(uid)?.forEach(u => u());
    connUnsubsRef.current.delete(uid);
    remoteStreamsRef.current.delete(uid);
    remoteShareStreamsRef.current.delete(uid);
    remoteAnalysersRef.current.delete(uid);
    const gn = remoteGainNodesRef.current.get(uid);
    if (gn) { gn.disconnect(); remoteGainNodesRef.current.delete(uid); }
    makingOfferRef.current.delete(uid);
    signalingLockRef.current.delete(uid);
    candQueueRef.current.delete(uid);
    setPeers(prev => prev.filter(p => p.uid !== uid));
  }, []);

  const cleanup = useCallback(() => {
    cancelledRef.current = true;
    if (unsubGroupRef.current) { unsubGroupRef.current(); unsubGroupRef.current = null; }
    for (const uid of pcsRef.current.keys()) cleanupPeer(uid);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenTrackRef.current?.stop();
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => { }); audioCtxRef.current = null; }
  }, [cleanupPeer]);

  const handleLeave = useCallback(async () => {
    cleanup(); try { await leaveGroupCall(callId, myUid); } catch { } onClose();
  }, [callId, myUid, cleanup, onClose]);

  const resumeAudio = useCallback(() => {
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume().catch(() => { });
    }
  }, []);

  // Listener exclusivo para admisiones
  useEffect(() => {
    if (!callId) return;
    const unsub = subscribeToGroupCall(callId, (call) => {
      if (!call) return;
      const pending = (call.pendingParticipants || []).map(uid => {
        const data = call.participantData[uid] || {};
        return {
          uid,
          name: (data as any).displayName || (data as any).name || 'Usuario',
          photo: (data as any).photoURL || (data as any).photo || null
        };
      });
      setPendingApprovals(pending);
    });
    return () => unsub();
  }, [callId]);

  const setupConnectionWithPeer = useCallback(async (peerUid: string, peerData: any) => {
    if (pcsRef.current.has(peerUid) || cancelledRef.current) return;
    const connId = getConnectionId(myUid, peerUid); const iAmCaller = myUid < peerUid;
    const pc = new RTCPeerConnection(ICE_SERVERS); pcsRef.current.set(peerUid, pc);

    pc.oniceconnectionstatechange = () => {
      setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, connectionState: pc.iceConnectionState } : p));
      if (pc.iceConnectionState === 'failed') {
        setTimeout(() => { if (pcsRef.current.get(peerUid) === pc) cleanupPeer(peerUid); }, 3000);
      }
    };

    const audioT = localStreamRef.current?.getAudioTracks()[0];
    const videoT = localStreamRef.current?.getVideoTracks()[0];

    if (audioT) pc.addTrack(audioT, localStreamRef.current!);
    else pc.addTransceiver('audio', { direction: 'sendrecv' });

    if (videoT && camOn) pc.addTrack(videoT, localStreamRef.current!);
    else pc.addTransceiver('video', { direction: 'sendrecv' });

    if (screenTrackRef.current) pc.addTrack(screenTrackRef.current, localStreamRef.current!);
    else pc.addTransceiver('video', { direction: 'sendrecv' });

    const rStream = new MediaStream(); remoteStreamsRef.current.set(peerUid, rStream);
    const rsStream = new MediaStream(); remoteShareStreamsRef.current.set(peerUid, rsStream);

    pc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const add = iAmCaller ? addConnectionCallerCandidate : addConnectionReceiverCandidate;
      add(callId, connId, e.candidate.toJSON()).catch(() => { });
    };

    const setupRemoteAudio = async (uid: string, track: MediaStreamTrack) => {
      try {
        if (!audioCtxRef.current) {
          audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ latencyHint: 'interactive' });
        }
        const ctx = audioCtxRef.current;
        if (ctx.state === 'suspended') { ctx.resume().catch(() => { }); }
        const stream = new MediaStream([track]);
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser(); an.fftSize = 32;
        const gn = ctx.createGain();
        gn.gain.value = (peerMuted.has(uid) || deafened) ? 0 : (peerVolumes[uid] ?? 1);
        src.connect(an); an.connect(gn); gn.connect(ctx.destination);
        remoteAnalysersRef.current.set(uid, an);
        remoteGainNodesRef.current.set(uid, gn);
      } catch { }
    };

    pc.onnegotiationneeded = async () => {
      if (!iAmCaller || makingOfferRef.current.get(peerUid)) return;
      try {
        makingOfferRef.current.set(peerUid, true);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateConnectionOffer(callId, connId, pc.localDescription!.toJSON());
      } catch { } finally { makingOfferRef.current.set(peerUid, false); }
    };

    pc.ontrack = (e) => {
      const transceivers = pc.getTransceivers();
      const idx = transceivers.findIndex(t => t.receiver === e.receiver);
      const update = () => setStreamVersion(v => v + 1);
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
      }
      update();
    };

    const unsubConn = subscribeToConnection(callId, connId, async (conn) => {
      if (!conn || cancelledRef.current || signalingLockRef.current.get(peerUid)) return;
      signalingLockRef.current.set(peerUid, true);
      try {
        const description = iAmCaller ? conn.receiverOffer : conn.offer;
        if (description && pc.signalingState !== 'closed') {
          const isPolite = myUid > peerUid;
          const ready = !makingOfferRef.current.get(peerUid) && pc.signalingState === "stable";
          if (!(description.type === "offer" && !ready && !isPolite)) {
            await pc.setRemoteDescription(new RTCSessionDescription(description));
            if (description.type === "offer") {
              await pc.setLocalDescription();
              const sync = iAmCaller ? updateConnectionCallerReanswer : answerConnection;
              await sync(callId, connId, pc.localDescription!.toJSON());
            }
          }
        }
        const answer = iAmCaller ? (conn.answer || conn.callerReanswer) : conn.callerReanswer;
        if (answer && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          const q = candQueueRef.current.get(peerUid) || [];
          while (q.length > 0) { const c = q.shift(); if (c) pc.addIceCandidate(c).catch(() => { }); }
        }
      } finally { signalingLockRef.current.set(peerUid, false); }
      const peerCam = iAmCaller ? conn.receiverCamOff : conn.callerCamOff;
      const peerSharing = iAmCaller ? conn.receiverSharing : conn.callerSharing;
      setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: !!peerCam, sharing: !!peerSharing } : p));
    });

    const candSub = iAmCaller ? subscribeToConnectionReceiverCandidates : subscribeToConnectionCallerCandidates;
    const unsubCand = candSub(callId, connId, async (c) => {
      if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => { });
      else { const q = candQueueRef.current.get(peerUid) || []; q.push(c); candQueueRef.current.set(peerUid, q); }
    });

    if (iAmCaller) await createConnection(callId, connId, myUid, peerUid);
    connUnsubsRef.current.set(peerUid, [unsubConn, unsubCand]);
    setPeers(prev => [...prev.filter(p => p.uid !== peerUid), {
      uid: peerUid, name: peerData.displayName || peerData.name || 'Usuario', photo: peerData.photoURL || peerData.photo || null,
      camOff: false, speaking: false, sharing: false, connectionState: 'new'
    }]);

    if (iAmCaller) {
      pc.onnegotiationneeded?.(new Event('negotiationneeded'));
    }
  }, [callId, myUid, camOn, cleanupPeer]);

  useEffect(() => {
    let cancelledEffect = false;
    async function init() {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: callType === 'video' ? { width: 1280, height: 720 } : false
        });
      } catch {
        try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false }); }
        catch { stream = new MediaStream(); }
      }
      if (cancelledEffect) return;
      localStreamRef.current = stream; setLocalStream(stream);
      if (stream.getAudioTracks()[0]) {
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          localAnalyserRef.current = audioCtxRef.current.createAnalyser();
          const src = audioCtxRef.current.createMediaStreamSource(new MediaStream([stream.getAudioTracks()[0]]));
          src.connect(localAnalyserRef.current);
        } catch { }
      }

      unsubGroupRef.current = subscribeToGroupCall(callId, async (call) => {
        if (!call || cancelledRef.current) return;
        if (call.status === 'ended') { cleanup(); onClose(); return; }

        const isActive = call.activeParticipants.includes(myUid);
        if (isActive && statusRef.current !== 'active') {
          statusRef.current = 'active'; setStatus('active'); startTimer(); resumeAudio();
        } else if (!isActive && (call.pendingParticipants || []).includes(myUid)) {
          statusRef.current = 'waiting'; setStatus('waiting');
        } else if (isInitiator && statusRef.current !== 'active') {
          statusRef.current = 'active'; setStatus('active'); startTimer();
        }

        const others = call.activeParticipants.filter(uid => uid !== myUid);
        for (const uid of others) {
          const pData = call.participantData[uid] || { name: 'Usuario', photo: null };
          await setupConnectionWithPeer(uid, pData);
        }
        pcsRef.current.forEach((_, uid) => { if (!call.activeParticipants.includes(uid)) cleanupPeer(uid); });
      });

      if (!isInitiator) {
        requestToJoinConference(callId, myUid, { name: myName, photo: myPhoto });
      }
    }
    init(); return () => { cancelledEffect = true; cleanup(); };
  }, [callId, myUid, isInitiator, myName, myPhoto, setupConnectionWithPeer, cleanupPeer, cleanup, onClose, startTimer, resumeAudio]);

  useEffect(() => {
    if (status !== 'active') return;
    const buf = new Uint8Array(128);
    const tick = () => {
      if (micOn && localAnalyserRef.current) {
        localAnalyserRef.current.getByteFrequencyData(buf);
        setLocalSpeaking(buf.reduce((a, b) => a + b, 0) / 128 > 15);
      }
      const remS = new Map<string, boolean>();
      remoteAnalysersRef.current.forEach((an, uid) => {
        if (!deafened && !peerMuted.has(uid)) {
          an.getByteFrequencyData(buf);
          if (buf.reduce((a, b) => a + b, 0) / 128 > 15) remS.set(uid, true);
        }
      });
      setPeers(prev => prev.map(p => ({ ...p, speaking: !!remS.get(p.uid) })));
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, micOn, deafened, peerMuted]);

  const toggleMic = () => {
    resumeAudio(); const next = !micOn; setMicOn(next);
    if (localStreamRef.current) localStreamRef.current.getAudioTracks().forEach(t => t.enabled = next);
    pcsRef.current.forEach(pc => { const s = pc.getSenders()[0]; if (s) s.replaceTrack(next ? localStreamRef.current.getAudioTracks()[0] : null); });
  };

  const toggleCam = async () => {
    const next = !camOn;
    if (next) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 } });
        const t = s.getVideoTracks()[0];
        if (t && localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(old => { old.stop(); localStreamRef.current?.removeTrack(old); });
          localStreamRef.current.addTrack(t); setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
          pcsRef.current.forEach(pc => pc.getSenders()[1]?.replaceTrack(t));
          pcsRef.current.forEach((_, uid) => updateConnectionCamState(callId, getConnectionId(myUid, uid), myUid < uid, false));
          setCamOn(true); setStreamVersion(v => v + 1);
        }
      } catch { }
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => { t.stop(); localStreamRef.current?.removeTrack(t); });
      setLocalStream(new MediaStream(localStreamRef.current?.getTracks() || []));
      pcsRef.current.forEach(pc => pc.getSenders()[1]?.replaceTrack(null));
      pcsRef.current.forEach((_, uid) => updateConnectionCamState(callId, getConnectionId(myUid, uid), myUid < uid, true));
      setCamOn(false); setStreamVersion(v => v + 1);
    }
  };

  const toggleDeafen = () => { resumeAudio(); setDeafened(!deafened); if (!deafened) setMicOn(false); };

  const stopSharing = useCallback(() => {
    if (screenTrackRef.current) { screenTrackRef.current.stop(); screenTrackRef.current = null; }
    setSharing(false); setLocalSharingStream(null);
    pcsRef.current.forEach((pc, uid) => {
      pc.getSenders()[2]?.replaceTrack(null);
      updateConnectionSharingState(callId, getConnectionId(myUid, uid), myUid < uid, false).catch(() => { });
    });
  }, [callId, myUid]);

  const onHandleSourceSelect = async (sid: string) => {
    if (screenTrackRef.current) screenTrackRef.current.stop();
    try {
      const s = await (navigator.mediaDevices as any).getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sid } } });
      const t = s.getVideoTracks()[0]; if (!t) return;
      screenTrackRef.current = t; setLocalSharingStream(s); setSharing(true); setShowShareModal(false);
      pcsRef.current.forEach((pc, uid) => {
        pc.getSenders()[2]?.replaceTrack(t);
        updateConnectionSharingState(callId, getConnectionId(myUid, uid), myUid < uid, true).catch(() => { });
      });
      t.onended = stopSharing;
    } catch { stopSharing(); }
  };

  const openDevicePicker = async () => { resumeAudio(); const list = await navigator.mediaDevices.enumerateDevices(); setDevices(list); setShowDevices(!showDevices); setShowCamPicker(false); };
  const openCamPicker = async () => { resumeAudio(); const list = await navigator.mediaDevices.enumerateDevices(); setDevices(list); setShowDevices(!showDevices); setShowCamPicker(!showCamPicker); setShowDevices(false); };
  const changeAudioInput = async (id: string) => { setSelectedMicId(id); try { const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: id !== 'default' ? { exact: id } : undefined } }); const t = s.getAudioTracks()[0]; if (t) pcsRef.current.forEach(pc => pc.getSenders()[0]?.replaceTrack(t)); } catch { } };
  const changeVideoInput = async (id: string) => { setSelectedCamId(id); try { const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: id } } }); const t = s.getVideoTracks()[0]; if (t) pcsRef.current.forEach(pc => pc.getSenders()[1]?.replaceTrack(t)); } catch { } };

  const totalMembers = peers.length + (sharing ? 1 : 0) + peers.filter(p => p.sharing).length + 1;
  const basis = totalMembers <= 2 ? 'calc(50% - 24px)' : totalMembers <= 4 ? 'calc(48% - 12px)' : 'calc(32% - 12px)';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111214', zIndex: 9999, display: 'flex', flexDirection: 'column' }} onClick={resumeAudio}>
      <audio ref={remoteAudioElRef} autoPlay playsInline style={{ display: 'none' }} />
      {isAudioBlocked && (
        <div style={{ position: 'absolute', top: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 10002, backgroundColor: '#ed4245', color: '#fff', padding: '12px 24px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 8px 16px rgba(0,0,0,0.4)' }}>
          <VolumeX size={20} /> <span style={{ fontWeight: 600 }}>{t('call.audio_blocked')}</span>
          <button onClick={() => { resumeAudio(); setIsAudioBlocked(false); }} style={{ backgroundColor: '#fff', color: '#ed4245', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 700, cursor: 'pointer', fontSize: '12px' }}>{t('call.enable_audio')}</button>
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {status === 'active' ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%', maxWidth: '1400px', justifyContent: 'center', alignContent: 'center', overflowY: 'auto' }}>
            {peers.filter(p => !hiddenStreams.has(p.uid)).map(p => (
              <div key={`${p.uid}-${streamVersion}`} style={{ width: basis, minWidth: '300px', position: 'relative' }}>
                <VideoTile
                  uid={p.uid} name={p.name} photo={p.photo} stream={remoteStreamsRef.current.get(p.uid) || null}
                  speaking={p.speaking} camOff={p.camOff} muted={peerMuted.has(p.uid)} volume={peerVolumes[p.uid] ?? 1}
                  onMuteToggle={(m) => setPeerMuted(prev => { const n = new Set(prev); if (m) n.add(p.uid); else n.delete(p.uid); return n; })}
                  onVolumeChange={(v) => setPeerVolumes(prev => ({ ...prev, [p.uid]: v / 100 }))}
                  onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, peerUid: p.uid }); }}
                  onClick={() => setFocusedTile(p.uid)}
                />
                {p.connectionState !== 'connected' && (
                  <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', zIndex: 10 }}>
                    <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid #5865f2', borderTopColor: 'transparent', borderRadius: '50%' }} />
                    <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600 }}>{p.connectionState === 'failed' ? 'Reconnecting...' : 'Connecting...'}</span>
                  </div>
                )}
              </div>
            ))}
            {peers.filter(p => p.sharing).map(p => (
              <div key={`${p.uid}-s-${streamVersion}`} style={{ width: basis, minWidth: '300px' }}>
                <VideoTile uid={p.uid + '-s'} name={t('call.user_screen', { name: p.name })} stream={remoteShareStreamsRef.current.get(p.uid) || null} sharing onClick={() => setFocusedTile(p.uid + '-s')} />
              </div>
            ))}
            <div style={{ width: basis, minWidth: '300px' }}>
              <VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} isLocal onClick={() => setFocusedTile('local')} />
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>{groupName}</div>
            <div style={{ color: '#b5bac1', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
              <div className="animate-spin" style={{ width: 16, height: 16, border: '2px solid #5865f2', borderTopColor: 'transparent', borderRadius: '50%' }} />
              {t(`call.${status}`)}...
            </div>
          </div>
        )}
      </div>

      <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(30,31,34,0.85)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, minWidth: 40 }}>{status === 'active' ? formatDuration(duration) : t(`call.${status}`)}</div>
        <CompoundBtn icon={micOn ? <Mic size={20} /> : <MicOff size={20} />} label={t('call.mic')} onClick={toggleMic} onChevron={openDevicePicker} muted={!micOn} chevronActive={showDevices} />
        <CtrlBtn icon={deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />} label={t('call.deafen')} onClick={toggleDeafen} active={deafened} />
        {callType === 'video' && <CompoundBtn icon={camOn ? <Video size={20} /> : <VideoOff size={20} />} label={t('call.video')} onClick={toggleCam} onChevron={openCamPicker} muted={!camOn} chevronActive={showCamPicker} />}
        <CtrlBtn icon={sharing ? <MonitorOff size={20} /> : <Monitor size={20} />} label={t('call.share_screen')} onClick={() => sharing ? stopSharing() : setShowShareModal(true)} active={sharing} />
        <CtrlBtn icon={<PhoneOff size={20} />} label={t('call.hang_up')} onClick={handleLeave} danger />
      </div>

      {pendingApprovals.length > 0 && (
        <div style={{ position: 'fixed', top: '24px', left: '24px', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '16px', zIndex: 300000, boxShadow: '0 8px 32px rgba(0,0,0,0.8)', minWidth: '320px', border: '2px solid #5865f2' }}>
          <div style={{ marginBottom: '12px', color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={18} color="#5865f2" />
            PETICIÓN DE ADMISIÓN ({pendingApprovals.length})
          </div>
          {pendingApprovals.map(req => (
            <div key={req.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {req.photo ? <img src={req.photo} style={{ width: '32px', height: '32px', borderRadius: '50%' }} /> : <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '12px' }}>{req.name?.charAt(0)}</div>}
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{req.name}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => denyConferenceParticipant(callId, req.uid)} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(237,66,69,0.15)', color: '#ed4245', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>RECHAZAR</button>
                <button onClick={() => approveConferenceParticipant(callId, req.uid)} style={{ padding: '6px 14px', borderRadius: '6px', background: '#23a559', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>ADMITIR</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showDevices || showCamPicker) && (
        <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '12px', width: '300px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{showDevices ? t('call.audio_input') : t('call.video_devices')}</div>
          {devices.filter(d => d.kind === (showDevices ? 'audioinput' : 'videoinput')).map((d, i) => (
            <div key={i} onClick={() => showDevices ? changeAudioInput(d.deviceId) : changeVideoInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: (showDevices ? selectedMicId : selectedCamId) === d.deviceId ? 'rgba(88,101,242,0.15)' : 'transparent', marginBottom: '2px' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `${showDevices ? 'Mic' : 'Cam'} ${i + 1}`}</span>
              {(showDevices ? selectedMicId : selectedCamId) === d.deviceId && <Check size={14} color="#5865f2" />}
            </div>
          ))}
        </div>
      )}

      {showShareModal && <ScreenShareModal onClose={() => setShowShareModal(false)} onSelect={onHandleSourceSelect} />}

      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, backgroundColor: '#111214', borderRadius: 12, padding: '16px', width: 220, zIndex: 10005, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => { setHiddenStreams(prev => { const n = new Set(prev); if (n.has(contextMenu.peerUid)) n.delete(contextMenu.peerUid); else n.add(contextMenu.peerUid); return n; }); setContextMenu(null); }} style={{ width: '100%', padding: '10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#dbdee1', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}>
            {hiddenStreams.has(contextMenu.peerUid) ? <Eye size={18} /> : <EyeOff size={18} />} {hiddenStreams.has(contextMenu.peerUid) ? t('call.view_stream') : t('call.stop_viewing')}
          </button>
          <button onClick={() => { setPeerMuted(prev => { const n = new Set(prev); if (n.has(contextMenu.peerUid)) n.delete(contextMenu.peerUid); else n.add(contextMenu.peerUid); return n; }); setContextMenu(null); }} style={{ width: '100%', padding: '10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#dbdee1', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}>
            {peerMuted.has(contextMenu.peerUid) ? <Volume2 size={18} /> : <VolumeX size={18} />} {peerMuted.has(contextMenu.peerUid) ? t('call.unmute_user') : t('call.mute_user')}
          </button>
        </div>
      )}
    </div>
  );
}

const CtrlBtn = ({ icon, label, onClick, muted, active, danger }: any) => (
  <button onClick={onClick} title={label} style={{ width: 48, height: 48, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: danger || muted ? '#ed4245' : (active ? '#5865f2' : 'rgba(79,84,92,0.75)'), border: 'none', cursor: 'pointer', transition: 'all 0.2s', color: '#fff' }}>
    {icon}
  </button>
);

const CompoundBtn = ({ icon, label, onClick, onChevron, muted, chevronActive }: any) => (
  <div style={{ display: 'flex', alignItems: 'center', backgroundColor: muted ? '#ed4245' : 'rgba(79,84,92,0.75)', borderRadius: 24, height: 48 }}>
    <button onClick={onClick} title={label} style={{ width: 44, height: 48, borderRadius: '24px 0 0 24px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#fff' }}>{icon}</button>
    <div style={{ width: 1, height: 24, backgroundColor: 'rgba(255,255,255,0.1)' }} />
    <button onClick={onChevron} style={{ width: 28, height: 48, borderRadius: '0 24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer', color: '#fff' }}>
      <ChevronUp size={14} style={{ transform: chevronActive ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
    </button>
  </div>
);

export function IncomingConferenceModal({ call, onJoin, onDismiss }: { call: any; onJoin: () => void; onDismiss: () => void }) {
  const { t } = useTranslation();
  return createPortal(
    <div style={{ position: 'fixed', top: '24px', right: '24px', width: '340px', backgroundColor: 'rgba(30,31,34,0.95)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '20px', zIndex: 10000, boxShadow: '0 12px 48px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.1)', animation: 'slideIn 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.28)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          {call.groupPhoto ? <img src={call.groupPhoto} style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #5865f2' }} /> : <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#5865f2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: 700 }}>{call.groupName?.charAt(0).toUpperCase()}</div>}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{call.groupName}</div>
          <div style={{ color: '#b5bac1', fontSize: '13px' }}>{t('call.incoming_conference')}</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onDismiss} style={{ flex: 1, height: '38px', borderRadius: '8px', background: 'rgba(237,66,69,0.15)', color: '#ed4245', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{t('call.reject')}</button>
        <button onClick={onJoin} style={{ flex: 1, height: '38px', borderRadius: '8px', background: '#23a557', color: '#fff', border: 'none', fontWeight: 700, cursor: 'pointer' }}>{t('call.join')}</button>
      </div>
    </div>,
    document.body
  );
}