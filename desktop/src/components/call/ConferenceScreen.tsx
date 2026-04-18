import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '@/contexts/LanguageContext';
import { auth } from '../../config/firebase';
import {
  PhoneOff, Video, VideoOff, Mic, MicOff,
  Headphones, HeadphoneOff, Monitor, MonitorOff,
  ChevronUp, Check, ExternalLink, Settings, Eye, EyeOff, Volume2, VolumeX
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
} from '../../services/groupCallService';
import { type CallType } from '../../services/callService';
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
  callType: CallType;
  groupName: string;
  groupPhoto: string | null;
  myUid: string;
  myName: string;
  myPhoto: string | null;
  myRole?: string;
  onClose: () => void;
}

export default function ConferenceScreen({
  callId, isInitiator, callType, groupName, groupPhoto,
  myUid, myName, myPhoto, onClose
}: ConferenceScreenProps) {
  const { t } = useTranslation();
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [peers, setPeers] = useState<PeerState[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<{ uid: string; name: string; photo: string | null }[]>([]);
  const [duration, setDuration] = useState(0);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [localSharingStream, setLocalSharingStream] = useState<MediaStream | null>(null);
  const [focusedTile, setFocusedTile] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showDevices, setShowDevices] = useState(false);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [selectedMicId, setSelectedMicId] = useState('default');
  const [selectedCamId, setSelectedCamId] = useState('default');

  const [peerVolumes, setPeerVolumes] = useState<Record<string, number>>({});
  const [peerMuted, setPeerMuted] = useState<Set<string>>(new Set());
  const [hiddenStreams, setHiddenStreams] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; peerUid: string } | null>(null);
  const [localSpeaking, setLocalSpeaking] = useState(false);

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const signalingLockRef = useRef<Map<string, boolean>>(new Map());
  const connUnsubsRef = useRef<Map<string, (() => void)[]>>(new Map());
  const candQueueRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteShareStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const remoteAudioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const remoteAnalysersRef = useRef<Map<string, AnalyserNode>>(new Map());
  const remoteGainNodesRef = useRef<Map<string, GainNode>>(new Map());
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const unsubsRef = useRef<(() => void)[]>([]);

  const gainCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const startTimer = useCallback(() => { if (!timerRef.current) timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); }, []);

  const cleanupPeer = useCallback((uid: string) => {
    const pc = pcsRef.current.get(uid); if (pc) { pc.close(); pcsRef.current.delete(uid); }
    connUnsubsRef.current.get(uid)?.forEach(u => u()); connUnsubsRef.current.delete(uid);
    const audioEl = remoteAudioElsRef.current.get(uid); if (audioEl) audioEl.remove();
    remoteAudioElsRef.current.delete(uid); remoteAnalysersRef.current.delete(uid);
    remoteGainNodesRef.current.delete(uid); remoteStreamsRef.current.delete(uid);
    remoteShareStreamsRef.current.delete(uid);
    setPeers(prev => prev.filter(p => p.uid !== uid));
  }, []);

  const cleanup = useCallback(() => {
    cancelledRef.current = true; unsubsRef.current.forEach(u => u());
    for (const uid of pcsRef.current.keys()) cleanupPeer(uid);
    if (timerRef.current) clearInterval(timerRef.current);
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenTrackRef.current?.stop();
  }, [cleanupPeer]);

  const handleLeave = useCallback(async () => {
    cleanup(); try { await leaveGroupCall(callId, myUid); } catch {} onClose();
  }, [callId, myUid, cleanup, onClose]);

  useEffect(() => {
    remoteGainNodesRef.current.forEach((gn, uid) => {
      const vol = (peerMuted.has(uid) || deafened) ? 0 : (peerVolumes[uid] ?? 1);
      gn.gain.setTargetAtTime(vol, 0, 0.05);
    });
  }, [peerMuted, peerVolumes, deafened]);

  const setupConnectionWithPeer = useCallback(async (peerUid: string, peerData: { name: string; photo: string | null }) => {
    if (pcsRef.current.has(peerUid) || cancelledRef.current) return;
    const connId = getConnectionId(myUid, peerUid); const iAmCaller = myUid < peerUid;
    const pc = new RTCPeerConnection(ICE_SERVERS); pcsRef.current.set(peerUid, pc);
    
    pc.addTransceiver('audio', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });
    pc.addTransceiver('video', { direction: 'sendrecv' });

    const rStream = new MediaStream(); remoteStreamsRef.current.set(peerUid, rStream);
    const rsStream = new MediaStream(); remoteShareStreamsRef.current.set(peerUid, rsStream);
    const audioEl = document.createElement('audio'); audioEl.autoplay = true; audioEl.style.display = 'none';
    document.body.appendChild(audioEl); remoteAudioElsRef.current.set(peerUid, audioEl);

    pc.onicecandidate = (e) => {
      if (!e.candidate || !pc.remoteDescription) return;
      const add = iAmCaller ? addConnectionCallerCandidate : addConnectionReceiverCandidate;
      add(callId, connId, e.candidate.toJSON()).catch(() => {});
    };

    pc.onnegotiationneeded = async () => {
      if (makingOfferRef.current.get(peerUid)) return;
      try {
        makingOfferRef.current.set(peerUid, true); await pc.setLocalDescription();
        const sync = iAmCaller ? updateConnectionOffer : updateConnectionReceiverOffer;
        await sync(callId, connId, pc.localDescription!.toJSON());
      } catch {} finally { makingOfferRef.current.set(peerUid, false); }
    };

    pc.ontrack = (e) => {
      const track = e.track;
      const transceivers = pc.getTransceivers();
      const transceiverIndex = transceivers.findIndex(t => t === e.transceiver);
      
      if (track.kind === 'audio') {
        rStream.getAudioTracks().forEach(t => { if (t.id !== track.id) rStream.removeTrack(t); });
        rStream.addTrack(track);
        audioEl.srcObject = rStream;
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const an = ctx.createAnalyser(); const gn = ctx.createGain();
          const src = ctx.createMediaStreamSource(new MediaStream([track]));
          src.connect(gn); gn.connect(an); gn.connect(ctx.destination);
          remoteAnalysersRef.current.set(peerUid, an); remoteGainNodesRef.current.set(peerUid, gn);
          gn.gain.value = (peerMuted.has(peerUid) || deafened) ? 0 : (peerVolumes[peerUid] ?? 1);
        } catch {}
      } else {
        // Strict mapping: Index 1 = Camera, Index 2 = Screen
        if (transceiverIndex === 2 || track.label.toLowerCase().includes('screen') || track.label.toLowerCase().includes('window')) {
          // Screen Share track
          rsStream.getVideoTracks().forEach(t => rsStream.removeTrack(t));
          rsStream.addTrack(track);
          const updateUI = () => setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, sharing: track.readyState === 'live' } : p));
          track.onunmute = updateUI; track.onmute = updateUI; track.onended = updateUI;
          updateUI();
        } else {
          // Camera track (likely index 1)
          rStream.getVideoTracks().forEach(t => { if (t.id !== track.id) rStream.removeTrack(t); });
          rStream.addTrack(track);
          setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: false } : p));
        }
      }
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
          while (q.length > 0) { const c = q.shift(); if (c) pc.addIceCandidate(c).catch(() => {}); }
        }
      } finally { signalingLockRef.current.set(peerUid, false); }
      const peerCam = iAmCaller ? conn.receiverCamOff : conn.callerCamOff;
      setPeers(prev => prev.map(p => p.uid === peerUid ? { ...p, camOff: !!peerCam } : p));
    });

    const candSub = iAmCaller ? subscribeToConnectionReceiverCandidates : subscribeToConnectionCallerCandidates;
    const unsubCand = candSub(callId, connId, async (c) => {
      if (pc.remoteDescription) pc.addIceCandidate(c).catch(() => {});
      else { const q = candQueueRef.current.get(peerUid) || []; q.push(c); candQueueRef.current.set(peerUid, q); }
    });

    if (iAmCaller) await createConnection(callId, connId, myUid, peerUid);
    connUnsubsRef.current.set(peerUid, [unsubConn, unsubCand]);
    setPeers(prev => [...prev.filter(p => p.uid !== peerUid), { uid: peerUid, name: peerData.name, photo: peerData.photo, camOff: false, speaking: false, sharing: false }]);

    const senders = pc.getSenders();
    if (localStreamRef.current) {
      const audioT = gainDestRef.current?.stream.getAudioTracks()[0] || localStreamRef.current.getAudioTracks()[0];
      if (audioT) senders[0].replaceTrack(audioT);
      const videoT = localStreamRef.current.getVideoTracks()[0];
      if (videoT && camOn) senders[1].replaceTrack(videoT);
      if (screenTrackRef.current && sharing) senders[2].replaceTrack(screenTrackRef.current);
    }
  }, [callId, myUid, camOn, sharing, peerMuted, peerVolumes, deafened]);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callType === 'video' ? { width: 1280, height: 720 } : false }).catch(() => new MediaStream());
      if (cancelled) return; localStreamRef.current = stream; setLocalStream(stream);
      const audioT = stream.getAudioTracks()[0];
      if (audioT) {
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          gainCtxRef.current = ctx; const g = ctx.createGain(); g.gain.value = 1.0; gainNodeRef.current = g;
          const src = ctx.createMediaStreamSource(new MediaStream([audioT])); gainSourceRef.current = src;
          const dst = ctx.createMediaStreamDestination(); gainDestRef.current = dst;
          const an = ctx.createAnalyser(); an.fftSize = 256; localAnalyserRef.current = an;
          src.connect(g); g.connect(dst); g.connect(an);
        } catch {}
      }
      if (isInitiator) setStatus('waiting');
      const unsubGroup = subscribeToGroupCall(callId, async (call) => {
        if (!call || cancelledRef.current) return;
        if (call.status === 'ended') { cleanup(); onClose(); return; }
        if (isInitiator) setPendingApprovals((call.pendingParticipants || []).map(uid => ({ uid, name: call.participantData[uid]?.name || 'Usuario', photo: call.participantData[uid]?.photo || null })));
        else {
          const active = call.activeParticipants.includes(myUid);
          if (active && status !== 'active') { setStatus('active'); startTimer(); }
          else if (!active && call.pendingParticipants?.includes(myUid)) setStatus('waiting');
          else if (call.rejectedParticipants?.includes(myUid)) { handleLeave(); return; }
        }
        const others = call.activeParticipants.filter(uid => uid !== myUid);
        for (const uid of others) await setupConnectionWithPeer(uid, call.participantData[uid] || { name: 'Usuario', photo: null });
        pcsRef.current.forEach((_, uid) => { if (!call.activeParticipants.includes(uid)) cleanupPeer(uid); });
      });
      unsubsRef.current.push(unsubGroup);
      if (!isInitiator) requestToJoinConference(callId, myUid);
    }
    init(); return () => { cancelled = true; };
  }, [callId, myUid, isInitiator, callType, startTimer, cleanupPeer, setupConnectionWithPeer, handleLeave]);

  useEffect(() => {
    if (status !== 'active') return;
    const buf = new Uint8Array(128); let lspeak = 0; let remS = new Map<string, number>();
    const tick = () => {
      const now = performance.now();
      if (localAnalyserRef.current) { localAnalyserRef.current.getByteFrequencyData(buf); if (buf.reduce((a,b)=>a+b,0)/128 > 15) lspeak = now + 500; }
      remoteAnalysersRef.current.forEach((an, uid) => { an.getByteFrequencyData(buf); if (buf.reduce((a,b)=>a+b,0)/128 > 15) remS.set(uid, now + 500); });
      setLocalSpeaking(now < lspeak); setPeers(prev => prev.map(p => ({ ...p, speaking: now < (remS.get(p.uid) || 0) })));
      requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, [status]);

  const toggleMic = () => {
    const next = !micOn; setMicOn(next);
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = next);
    if (gainNodeRef.current) gainNodeRef.current.gain.value = next ? 1.0 : 0.0;
  };
  const toggleCam = () => {
    const next = !camOn;
    if (next) {
      navigator.mediaDevices.getUserMedia({ video: true }).then(s => {
        const t = s.getVideoTracks()[0]; if (!t) return;
        pcsRef.current.forEach(pc => pc.getSenders()[1].replaceTrack(t));
        pcsRef.current.forEach((_, uid) => signalConnectionVideo(callId, getConnectionId(myUid, uid), myUid < uid));
        setCamOn(true);
      });
    } else {
      localStreamRef.current?.getVideoTracks().forEach(t => t.stop());
      pcsRef.current.forEach(pc => pc.getSenders()[1].replaceTrack(null));
      pcsRef.current.forEach((_, uid) => updateConnectionCamState(callId, getConnectionId(myUid, uid), myUid < uid, true));
      setCamOn(false);
    }
  };
  const toggleDeafen = () => {
    const next = !deafened; setDeafened(next);
    remoteAudioElsRef.current.forEach(el => el.muted = next);
    if (next) setMicOn(false);
  };
  const changeAudioInput = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { exact: deviceId } } });
      const track = s.getAudioTracks()[0]; if (!track) return;
      let targetTrack = track;
      if (gainCtxRef.current && gainNodeRef.current && gainDestRef.current) {
        gainSourceRef.current?.disconnect();
        const nsrc = gainCtxRef.current.createMediaStreamSource(new MediaStream([track]));
        gainSourceRef.current = nsrc; nsrc.connect(gainNodeRef.current);
        targetTrack = gainDestRef.current.stream.getAudioTracks()[0] || track;
      }
      pcsRef.current.forEach(pc => pc.getSenders()[0].replaceTrack(targetTrack));
    } catch {}
  };
  const changeVideoInput = async (deviceId: string) => {
    setSelectedCamId(deviceId);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: deviceId } } });
      const track = s.getVideoTracks()[0]; if (!track) return;
      pcsRef.current.forEach(pc => pc.getSenders()[1].replaceTrack(track));
      setCamOn(true);
    } catch {}
  };
  const toggleHiddenStream = (id: string) => { setHiddenStreams(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; }); };
  const togglePeerMuted = (uid: string) => { setPeerMuted(prev => { const n = new Set(prev); if (n.has(uid)) n.delete(uid); else n.add(uid); return n; }); };
  const setPeerVolume = (uid: string, vol: number) => { setPeerVolumes(prev => ({ ...prev, [uid]: vol })); };

  const onHandleSourceSelect = async (sid: string) => {
    if (screenTrackRef.current) screenTrackRef.current.stop();
    const s = await (navigator.mediaDevices as any).getUserMedia({ video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: sid } } });
    const t = s.getVideoTracks()[0]; screenTrackRef.current = t; setLocalSharingStream(s); setSharing(true); setShowShareModal(false);
    pcsRef.current.forEach(pc => pc.getSenders()[2].replaceTrack(t));
    t.onended = () => { setSharing(false); setLocalSharingStream(null); pcsRef.current.forEach(pc => pc.getSenders()[2].replaceTrack(null)); };
  };

  const openDevicePicker = async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list); setShowDevices(!showDevices); setShowCamPicker(false);
  };
  const openCamPicker = async () => {
    const list = await navigator.mediaDevices.enumerateDevices();
    setDevices(list); setShowCamPicker(!showCamPicker); setShowDevices(false);
  };

  const totalMembers = peers.length + (sharing?1:0) + peers.filter(p=>p.sharing).length + 1;
  const basis = totalMembers <= 2 ? 'calc(50% - 24px)' : totalMembers <= 4 ? 'calc(48% - 12px)' : 'calc(32% - 12px)';

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: '#111214', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      
      {/* MAIN AREA */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        {status === 'connecting' && <div style={{ color: '#fff' }}><h2>{groupName}</h2><p>{t('call.connecting')}...</p></div>}
        {status === 'waiting' && <div style={{ color: '#fff' }}><h2>{groupName}</h2><p>{t('call.waiting_approval')}...</p></div>}

        {status === 'active' && (
          !focusedTile ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', width: '100%', maxWidth: '1400px', justifyContent: 'center', overflowY: 'auto' }}>
              {peers.map(p => <div key={p.uid} style={{ width: basis, minWidth: '300px' }}><VideoTile uid={p.uid} name={p.name} photo={p.photo} stream={remoteStreamsRef.current.get(p.uid) || null} speaking={p.speaking} camOff={p.camOff} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, peerUid: p.uid }); }} onClick={() => setFocusedTile(p.uid)} /></div>)}
              {peers.filter(p => p.sharing).map(p => <div key={p.uid + '-s'} style={{ width: basis, minWidth: '300px' }}><VideoTile uid={p.uid + '-s'} name={t('call.user_screen', { name: p.name })} stream={remoteShareStreamsRef.current.get(p.uid) || null} sharing onClick={() => setFocusedTile(p.uid + '-s')} /></div>)}
              <div style={{ width: basis, minWidth: '300px' }}><VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} isLocal onClick={() => setFocusedTile('local')} /></div>
              {sharing && <div style={{ width: basis, minWidth: '300px' }}><VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onStopSharing={() => { screenTrackRef.current?.stop(); setSharing(false); }} onClick={() => setFocusedTile('localShare')} /></div>}
            </div>
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '80px' }}>
              <div style={{ flex: 1, minHeight: 0 }}>
                {focusedTile === 'local' && <VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} speaking={localSpeaking} camOff={!camOn} isLocal onClick={() => setFocusedTile(null)} />}
                {focusedTile === 'localShare' && <VideoTile uid="localShare" name="Your Screen" stream={localSharingStream} sharing isLocal onStopSharing={() => { screenTrackRef.current?.stop(); setSharing(false); }} onClick={() => setFocusedTile(null)} />}
                {focusedTile.endsWith('-s') ? 
                  <VideoTile uid={focusedTile} name={t('call.user_screen', { name: peers.find(p=>p.uid+'-s'===focusedTile)?.name || '' })} stream={remoteShareStreamsRef.current.get(focusedTile.slice(0,-2)) || null} sharing onClick={() => setFocusedTile(null)} /> :
                  <VideoTile uid={focusedTile} name={peers.find(p=>p.uid===focusedTile)?.name || ''} photo={peers.find(p=>p.uid===focusedTile)?.photo} stream={remoteStreamsRef.current.get(focusedTile) || null} speaking={peers.find(p=>p.uid===focusedTile)?.speaking} camOff={peers.find(p=>p.uid===focusedTile)?.camOff} onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, peerUid: focusedTile }); }} onClick={() => setFocusedTile(null)} />
                }
              </div>
              <div style={{ height: '110px', display: 'flex', gap: '12px', overflowX: 'auto', padding: '4px', justifyContent: 'center' }}>
                {peers.filter(p => !hiddenStreams.has(p.uid) && p.uid !== focusedTile).map(p => <div key={p.uid} style={{ width: '160px', flexShrink: 0 }}><VideoTile uid={p.uid} name={p.name} photo={p.photo} stream={remoteStreamsRef.current.get(p.uid) || null} onMuteToggle={() => togglePeerMuted(p.uid)} onVolumeChange={(v) => setPeerVolume(p.uid, v / 100)} onClick={() => setFocusedTile(p.uid)} /></div>)}
                {peers.filter(p => p.sharing && p.uid + '-s' !== focusedTile).map(p => <div key={p.uid + '-s'} style={{ width: '160px', flexShrink: 0 }}><VideoTile uid={p.uid + '-s'} name={t('call.user_screen', { name: p.name })} stream={remoteShareStreamsRef.current.get(p.uid) || null} sharing onClick={() => setFocusedTile(p.uid + '-s')} /></div>)}
                {focusedTile !== 'local' && <div style={{ width: '160px', flexShrink: 0 }}><VideoTile uid="local" name={t('call.you')} photo={myPhoto} stream={localStream} isLocal onClick={() => setFocusedTile('local')} /></div>}
                {sharing && focusedTile !== 'localShare' && <div style={{ width: '160px', flexShrink: 0 }}><VideoTile uid="localShare" name={t('call.your_screen')} stream={localSharingStream} sharing isLocal onClick={() => setFocusedTile('localShare')} /></div>}
              </div>
            </div>
          )
        )}
      </div>

      {/* CONTROLS */}
      <div style={{ position: 'absolute', bottom: '32px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(30,31,34,0.85)', backdropFilter: 'blur(20px)', borderRadius: '16px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '16px', zIndex: 100, border: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, minWidth: 40 }}>{status === 'active' ? formatDuration(duration) : t(`call.${status}`)}</div>
        <CompoundBtn icon={micOn ? <Mic size={20} /> : <MicOff size={20} />} label={t('call.mic')} onClick={toggleMic} onChevron={openDevicePicker} muted={!micOn} chevronActive={showDevices} />
        <CtrlBtn icon={deafened ? <HeadphoneOff size={20} /> : <Headphones size={20} />} label={t('call.deafen')} onClick={toggleDeafen} active={deafened} />
        {callType === 'video' && <CompoundBtn icon={camOn ? <Video size={20} /> : <VideoOff size={20} />} label={t('call.video')} onClick={toggleCam} onChevron={openCamPicker} muted={!camOn} chevronActive={showCamPicker} />}
        <CtrlBtn icon={sharing ? <MonitorOff size={20} /> : <Monitor size={20} />} label={t('call.share_screen')} onClick={() => sharing ? screenTrackRef.current?.stop() : setShowShareModal(true)} active={sharing} />
        <CtrlBtn icon={<PhoneOff size={20} />} label={t('call.hang_up')} onClick={handleLeave} danger />
      </div>

      {/* MODALS */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, backgroundColor: '#111214', borderRadius: 12, padding: '16px', width: 220, zIndex: 10005, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => { toggleHiddenStream(contextMenu.peerUid); setContextMenu(null); }} style={{ width: '100%', padding: '10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#dbdee1', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}>
            {hiddenStreams.has(contextMenu.peerUid) ? <Eye size={18} /> : <EyeOff size={18} />} {hiddenStreams.has(contextMenu.peerUid) ? t('call.view_stream') : t('call.stop_viewing')}
          </button>
          <button onClick={() => { togglePeerMuted(contextMenu.peerUid); setContextMenu(null); }} style={{ width: '100%', padding: '10px', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', color: '#dbdee1', cursor: 'pointer', textAlign: 'left', fontSize: '13px' }}>
            {peerMuted.has(contextMenu.peerUid) ? <Volume2 size={18} /> : <VolumeX size={18} />} {peerMuted.has(contextMenu.peerUid) ? t('call.unmute_user') : t('call.mute_user')}
          </button>
          <div style={{ padding: '0 10px 10px 10px' }}>
            <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>{t('call.user_volume')}</div>
            <input type="range" min="0" max="1" step="0.01" value={peerVolumes[contextMenu.peerUid] ?? 1} onChange={(e) => setPeerVolume(contextMenu.peerUid, parseFloat(e.target.value))} style={{ width: '100%', cursor: 'pointer' }} />
          </div>
        </div>
      )}
      {contextMenu && <div style={{ position: 'fixed', inset: 0, zIndex: 10004 }} onClick={() => setContextMenu(null)} />}

      {pendingApprovals.length > 0 && isInitiator && (
        <div style={{ position: 'fixed', top: '24px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '16px', zIndex: 10002, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', minWidth: '320px' }}>
          <div style={{ marginBottom: '12px', color: '#fff', fontWeight: 700 }}>{t('call.admission_request')} ({pendingApprovals.length})</div>
          {pendingApprovals.map(req => (
            <div key={req.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '8px', marginBottom: '8px' }}>
              <span style={{ color: '#fff', fontSize: '13px' }}>{req.name}</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => denyConferenceParticipant(callId, req.uid)} style={{ padding: '6px 12px', borderRadius: '6px', background: 'rgba(237,66,69,0.1)', color: '#ed4245', border: 'none', cursor: 'pointer' }}>{t('call.reject')}</button>
                <button onClick={() => approveConferenceParticipant(callId, req.uid)} style={{ padding: '6px 14px', borderRadius: '6px', background: '#23a559', color: '#fff', border: 'none', cursor: 'pointer' }}>{t('call.admit')}</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {(showDevices || showCamPicker) && (
        <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '12px', width: '280px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '11px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px' }}>{showDevices ? t('call.audio_devices') : t('call.video_devices')}</div>
          {devices.filter(d => showDevices ? d.kind.startsWith('audio') : d.kind === 'videoinput').map((d, i) => (
            <div key={i} onClick={() => d.kind === 'videoinput' ? changeVideoInput(d.deviceId) : {}} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: (selectedCamId === d.deviceId) ? 'rgba(88,101,242,0.1)' : 'transparent' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Device ${i}`}</span>
              {(selectedCamId === d.deviceId) && <Check size={14} color="#5865f2" />}
            </div>
          ))}
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
          {call.groupPhoto || call.initiatorPhoto ? (
            <img src={call.groupPhoto || call.initiatorPhoto} style={{ width: '56px', height: '56px', borderRadius: '12px', objectFit: 'cover', border: '2px solid #7c3aed' }} />
          ) : (
            <div style={{ width: '56px', height: '56px', borderRadius: '12px', backgroundColor: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '20px', fontWeight: 700 }}>
              {(call.groupName || call.initiatorName || 'C').charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ position: 'absolute', bottom: -2, right: -2, width: '16px', height: '16px', backgroundColor: '#7c3aed', borderRadius: '50%', border: '3px solid #1E1F22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Video size={10} color="#fff" />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>{call.groupName || call.initiatorName || t('call.incoming_title', 'Llamada de CampusHub')}</div>
          <div style={{ color: '#b5bac1', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
             <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#22c55e', animation: 'pulse 1.5s infinite' }} />
             {t('call.incoming_call', 'Llamada entrante')}
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
