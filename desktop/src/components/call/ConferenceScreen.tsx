import './ConferenceScreen.css';
import { useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../contexts/LanguageContext';
import { playRingback, stopRingback } from '../../utils/toneGenerator';
import {
  PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming,
  Headphones, HeadphoneOff, Monitor, MonitorOff, Settings,
  MoreHorizontal, Check, Maximize2, ExternalLink, Users, Presentation,
  Eye, EyeOff, Volume2, VolumeX, ChevronUp, X, Layout, RefreshCw, Layers
} from 'lucide-react';
import VideoTile from './VideoTile';

import {
  ICE_SERVERS,
  getConnectionId,
  createConnection,
  updateConnectionOffer,
  answerConnection,
  updateConnectionCamState,
  updateConnectionSharingState,
  updateConnectionMuteState,
  updateConnectionDeafenState,
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
} from '../../services/groupCallService';
import { type CallType } from '../../services/callService';

// --- Local Hooks ---

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handle = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}

function useDrag() {
  const [miniPos, setMiniPos] = useState({ x: 20, y: 20 });
  const isDraggingRef = useRef(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  const onDragStart = (e: any) => {
    isDraggingRef.current = true;
    const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
    const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
    offsetRef.current = { x: clientX - miniPos.x, y: clientY - miniPos.y };
  };

  useEffect(() => {
    const onMove = (e: any) => {
      if (!isDraggingRef.current) return;
      const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
      const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
      setMiniPos({ x: clientX - offsetRef.current.x, y: clientY - offsetRef.current.y });
    };
    const onEnd = () => { isDraggingRef.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };
  }, [miniPos]);

  return { miniPos, onDragStart };
}

// --- Local Components ---

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
    <div 
      style={{ 
        width: size, height: size, borderRadius: '50%', backgroundColor: bg, 
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        color: '#fff', cursor: 'pointer', transition: 'all 0.2s' 
      }} 
      onClick={onClick}
      title={label}
    >
      {icon}
    </div>
  );
}

function CompoundBtn({ icon, label, onClick, onChevron, muted, chevronActive, mobile }: any) {
  const bg = muted ? '#ed4245' : 'rgba(79,84,92,0.75)';
  const size = mobile ? 44 : 48;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <button 
        onClick={onClick} 
        title={label}
        style={{ width: size, height: size, borderRadius: '50% 0 0 50%', backgroundColor: bg, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}
      >
        {icon}
      </button>
      <button 
        onClick={onChevron} 
        style={{ width: 20, height: size, borderRadius: '0 50% 50% 0', backgroundColor: chevronActive ? '#5865f2' : 'rgba(79,84,92,0.8)', border: 'none', cursor: 'pointer', color: '#fff', marginLeft: '1px' }}
      >
        <ChevronUp size={12} />
      </button>
    </div>
  );
}

function ScreenPicker({ show, sources, onSelect, onClose, t, loading, onRefresh }: any) {
  const [tab, setTab] = useState<'apps' | 'screens'>('apps');
  if (!show) return null;

  let filteredSources = sources.filter((s: any) => {
    const id = s.id.toLowerCase();
    if (tab === 'apps') return id.includes('window') || (!id.includes('screen') && !id.includes('monitor'));
    return id.includes('screen') || id.includes('monitor');
  });
  if (filteredSources.length === 0 && sources.length > 0) filteredSources = sources;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10005, backgroundColor: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', backdropFilter: 'blur(4px)' }}>
      <div style={{ backgroundColor: '#313338', width: '100%', maxWidth: '800px', height: '80vh', borderRadius: '12px', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.8)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ padding: '24px 24px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Monitor size={20} color="#5865f2" />
            <h2 style={{ color: '#fff', margin: 0, fontSize: '18px', fontWeight: 700 }}>{t('call.sharing.title')}</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b5bac1' }}><X size={24} /></button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 24px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setTab('apps')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                backgroundColor: tab === 'apps' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === 'apps' ? '#fff' : '#b5bac1', transition: 'all 0.2s'
              }}
            >
              <Layout size={18} />
              {t('call.sharing.apps')}
            </button>
            <button
              onClick={() => setTab('screens')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 6,
                border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                backgroundColor: tab === 'screens' ? 'rgba(255,255,255,0.1)' : 'transparent',
                color: tab === 'screens' ? '#fff' : '#b5bac1', transition: 'all 0.2s'
              }}
            >
              <Monitor size={18} />
              {t('call.sharing.fullscreen')}
            </button>
          </div>
          <button
            onClick={onRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#b5bac1', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('call.sharing.refresh')}
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#b5bac1' }}>
              <RefreshCw size={32} className="animate-spin" />
              {t('call.sharing.loading')}
            </div>
          ) : filteredSources.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#b5bac1' }}>
              <Layers size={32} opacity={0.5} />
              {t('call.sharing.no_sources')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
              {filteredSources.map((source: any) => (
                <div 
                  key={source.id} 
                  onClick={() => onSelect(source.id)}
                  className="source-card"
                  style={{ 
                    backgroundColor: '#2b2d31', borderRadius: '8px', cursor: 'pointer', border: '2px solid transparent', 
                    transition: 'all 0.2s', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' 
                  }}
                >
                  <div style={{ width: '100%', aspectRatio: '16/9', backgroundColor: '#1e1f22', position: 'relative', overflow: 'hidden' }}>
                    <img src={source.thumbnail} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="" />
                    <div className="share-overlay" style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.2s' }}>
                      <div style={{ backgroundColor: '#fff', color: '#313338', padding: '8px 16px', borderRadius: 4, fontWeight: 700, fontSize: 13 }}>{t('call.sharing.share_btn')}</div>
                    </div>
                  </div>
                  <div style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {source.appIcon && <img src={source.appIcon} alt="" style={{ width: 16, height: 16 }} />}
                    <span style={{ color: '#dbdee1', fontSize: '13px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{source.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <style>{`
          .source-card:hover { border-color: #5865f2 !important; transform: translateY(-2px); }
          .source-card:hover .share-overlay { opacity: 1 !important; }
          .animate-spin { animation: spin 1s linear infinite; }
          @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes muteWarnSlideIn {
            from { opacity: 0; transform: translate(-50%, 20px); }
            to { opacity: 1; transform: translate(-50%, 0); }
          }
        `}</style>
      </div>
    </div>
  );
}

function DevicePanel({ 
  show, devices, selectedMicId, selectedSpeakerId, selectedCamId, 
  onChangeAudioInput, onChangeAudioOutput, onChangeVideoInput, t 
}: any) {
  if (!show) return null;
  return (
    <div style={{ position: 'absolute', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#1E1F22', borderRadius: '12px', padding: '12px', width: '300px', zIndex: 200, boxShadow: '0 8px 32px rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>{t('call.audio_input')}</div>
      {devices.filter((d: any) => d.kind === 'audioinput').map((d: any, i: number) => (
        <div key={`mic-${i}`} onClick={() => onChangeAudioInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedMicId === d.deviceId ? 'rgba(88,101,242,0.15)' : 'transparent', marginBottom: '2px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Mic ${i + 1}`}</span>
          {selectedMicId === d.deviceId && <Check size={14} color="#5865f2" />}
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px', letterSpacing: '0.5px' }}>{t('call.audio_output')}</div>
      {devices.filter((d: any) => d.kind === 'audiooutput').map((d: any, i: number) => (
        <div key={`out-${i}`} onClick={() => onChangeAudioOutput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedSpeakerId === d.deviceId ? 'rgba(34,197,94,0.15)' : 'transparent', marginBottom: '2px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Speaker ${i + 1}`}</span>
          {selectedSpeakerId === d.deviceId && <Check size={14} color="#22c55e" />}
        </div>
      ))}
      <div style={{ fontSize: '10px', color: '#949ba4', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', marginTop: '12px', letterSpacing: '0.5px' }}>{t('call.video_input')}</div>
      {devices.filter((d: any) => d.kind === 'videoinput').map((d: any, i: number) => (
        <div key={`cam-${i}`} onClick={() => onChangeVideoInput(d.deviceId)} style={{ padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#dbdee1', fontSize: '13px', background: selectedCamId === d.deviceId ? 'rgba(88,101,242,0.15)' : 'transparent', marginBottom: '2px' }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || `Cam ${i + 1}`}</span>
          {selectedCamId === d.deviceId && <Check size={14} color="#5865f2" />}
        </div>
      ))}
    </div>
  );
}

// --- Main Component ---

interface PeerState {
  uid: string;
  name: string;
  photo: string | null;
  camOff: boolean;
  speaking: boolean;
  sharing: boolean;
  muted?: boolean;
  deafened?: boolean;
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
  myRole?: string;
  onClose: () => void;
}

export default function ConferenceScreen({
  callId, isInitiator, canApprove, callType, groupName, groupPhoto,
  myUid, myName, myPhoto, myRole, onClose
}: ConferenceScreenProps) {
  const [status, setStatus] = useState<'connecting' | 'waiting' | 'active' | 'ended'>('connecting');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(callType === 'video');
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showMuteWarning, setShowMuteWarning] = useState(false);
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
  const [hiddenCameraPeers, setHiddenCameraPeers] = useState<Set<string>>(new Set());
  const [hiddenSharePeers, setHiddenSharePeers] = useState<Set<string>>(new Set());
  const [mutedPeers, setMutedPeers] = useState<Set<string>>(new Set());
  const [peerVolumes, setPeerVolumes] = useState<Map<string, number>>(new Map());
  const [showScreenPicker, setShowScreenPicker] = useState(false);
  const [screenSources, setScreenSources] = useState([]);
  const [loadingScreenSources, setLoadingScreenSources] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tileId: string } | null>(null);

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
  const screenAudioSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const screenAudioGainRef = useRef<GainNode | null>(null);
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
  const muteWarningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
  const hiddenCameraPeersRef = useRef<Set<string>>(new Set());
  const hiddenSharePeersRef = useRef<Set<string>>(new Set());

  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { peersRef.current = peers; }, [peers]);
  useEffect(() => { sharingRef.current = sharing; }, [sharing]);
  useEffect(() => { focusedTileRef.current = focusedTile; }, [focusedTile]);
  useEffect(() => { hiddenCameraPeersRef.current = hiddenCameraPeers; }, [hiddenCameraPeers]);
  useEffect(() => { hiddenSharePeersRef.current = hiddenSharePeers; }, [hiddenSharePeers]);

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
  }, [minimized, inPip, showLocalVideo, peers, sharing]);

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
    lastReceiverOfferSdpsByPeerRef.current.get(peerUid);
    lastReceiverOfferSdpsByPeerRef.current.delete(peerUid);
    lastCallerReanswerSdpsByPeerRef.current.delete(peerUid);
    remoteSpeakingUntilRef.current.delete(peerUid);
    remoteSpeakingStateRef.current.delete(peerUid);
    const muteTimer = shareMuteTimersRef.current.get(peerUid);
    if (muteTimer) { clearTimeout(muteTimer); shareMuteTimersRef.current.delete(peerUid); }

    setPeers(prev => prev.filter(p => p.uid !== peerUid));
    setHiddenCameraPeers(prev => { const n = new Set(prev); n.delete(peerUid); return n; });
    setHiddenSharePeers(prev => { const n = new Set(prev); n.delete(peerUid); return n; });
    setMutedPeers(prev => { const n = new Set(prev); n.delete(peerUid); return n; });
    setPeerVolumes(prev => { const n = new Map(prev); n.delete(peerUid); return n; });
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
  }, [cleanupPeer]);

  const handleLeave = useCallback(async () => {
    cleanup();
    try { await leaveGroupCall(callId, myUid, true); } catch { }
    onClose();
  }, [callId, myUid, cleanup, onClose]);

  const setupConnectionWithPeer = useCallback(async (
    peerUid: string,
    peerData: { name?: string; displayName?: string; photo?: string | null; photoURL?: string | null },
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

    const attachShareTrack = (track: MediaStreamTrack) => {
      remoteShareStream.getTracks().forEach(t => remoteShareStream.removeTrack(t));
      remoteShareStream.addTrack(track);
      const shareEl = remoteShareVideoElsRef.current.get(peerUid);
      if (shareEl) {
        shareEl.srcObject = null;
        shareEl.srcObject = remoteShareStream;
        shareEl.play().catch(() => { });
      }
      track.onunmute = () => {
        const el = remoteShareVideoElsRef.current.get(peerUid);
        if (el) { el.srcObject = null; el.srcObject = remoteShareStream; el.play().catch(() => { }); }
      };
    };

    pc.ontrack = (event) => {
      const idx = pc.getTransceivers().findIndex(tx => tx === event.transceiver);
      if (idx === 0) {
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
      } else if (idx === 1) {
        if (callType !== 'video') return;
        if (!remoteStream.getTracks().find(t => t.id === event.track.id)) remoteStream.addTrack(event.track);
        const videoEl = remoteVideoElsRef.current.get(peerUid);
        if (videoEl) { videoEl.srcObject = null; videoEl.srcObject = remoteStream; videoEl.play().catch(() => { }); }
        event.track.onended = () => {
          remoteStream.removeTrack(event.track);
          const el = remoteVideoElsRef.current.get(peerUid);
          if (el) el.srcObject = null;
        };
        event.track.onunmute = () => {
          const el = remoteVideoElsRef.current.get(peerUid);
          if (el && el.srcObject !== remoteStream) { el.srcObject = remoteStream; el.play().catch(() => { }); }
        };
      } else if (idx === 2) {
        attachShareTrack(event.track);
      }
    };

    const getResolvedName = (data: any) => {
      const candidates = [data.displayName, data.username, data.name];
      for (const c of candidates) {
        if (c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous') return c;
      }
      return data.displayName || data.username || data.name || 'Usuario';
    };

    const finalName = getResolvedName(peerData);
    const finalPhoto = peerData.photo || peerData.photoURL || null;

    setStatus('active');
    setPeers(prev => {
      if (prev.find(p => p.uid === peerUid)) return prev;
      return [...prev, { uid: peerUid, name: finalName, photo: finalPhoto, camOff: false, speaking: false, sharing: false, muted: false, deafened: false }];
    });

    const pendingCandidates: RTCIceCandidateInit[] = [];
    pendingCandidatesRef.current.set(peerUid, pendingCandidates);

    if (iAmCaller) {
      pc.onicecandidate = (e) => {
        if (e.candidate) addConnectionCallerCandidate(callId, connId, e.candidate.toJSON(), true).catch(() => { });
      };

      const txAudio = pc.addTransceiver('audio', { direction: 'sendrecv' });
      const txVideo = pc.addTransceiver('video', { direction: 'sendrecv' });
      const txScreen = pc.addTransceiver('video', { direction: 'sendrecv' });
      if (pcAudioTracksRef.current[0]) await txAudio.sender.replaceTrack(pcAudioTracksRef.current[0]).catch(() => { });
      if (activeVideoTrackRef.current) await txVideo.sender.replaceTrack(activeVideoTrackRef.current).catch(() => { });
      videoSendersByPeerRef.current.set(peerUid, txVideo.sender);
      screenSendersRef.current.set(peerUid, txScreen.sender);
      if (sharingRef.current && screenTrackRef.current) await txScreen.sender.replaceTrack(screenTrackRef.current).catch(() => { });

      await createConnection(callId, connId, myUid, peerUid, true, sharingRef.current);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await updateConnectionOffer(callId, connId, offer, true);

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
                await updateConnectionOffer(callId, connId, newOffer, true);
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
          gainCtx.resume().catch(() => { });
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

        // Reactive update for participant names/photos
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

        if (isInitialLoadRef.current) {
          isInitialLoadRef.current = false;
          if (!isInitiator) {
            await joinGroupCall(callId, myUid, true);
            const existingPeers = currentParticipants.filter(uid => uid !== myUid);
            for (const uid of existingPeers) {
              const pData = (call.participantData[uid] || {}) as any;
              const peerName = [pData.displayName, pData.username, pData.name].find(c => c && c !== 'Usuario' && c !== 'Member' && c !== 'Anonymous') || pData.displayName || pData.username || pData.name || 'Usuario';
              const peerPhoto = pData.photoURL || pData.photo || null;
              await setupConnectionWithPeer(uid, { ...pData, displayName: peerName, photoURL: peerPhoto } as any, call);
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
  }, [status]);

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

  const stopScreenShare = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    screenAudioSrcRef.current?.disconnect();
    screenAudioSrcRef.current = null;
    screenAudioGainRef.current?.disconnect();
    screenAudioGainRef.current = null;
    for (const [peerUid, sender] of screenSendersRef.current.entries()) {
      sender.replaceTrack(null).catch(() => { });
      const connId = getConnectionId(myUid, peerUid);
      const iAmCaller = myUid < peerUid;
      updateConnectionSharingState(callId, connId, iAmCaller, false, true).catch(() => { });
    }
    if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
    setSharing(false);
  }, [callId, myUid]);

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
                    onVolumeChange={(v) => handlePeerVolume(peer.uid, v)}
                    onMuteToggle={() => handleToggleMutePeer(peer.uid)}
                    onClick={() => onTileClick(peer.uid)}
                    onContextMenu={(e) => handleTileContextMenu(e, peer.uid)}
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
                    onContextMenu={(e) => handleTileContextMenu(e, `${peer.uid}-share`)}
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
                onContextMenu={(e) => handleTileContextMenu(e, 'local')}
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
                onContextMenu={(e) => handleTileContextMenu(e, 'localShare')}
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

          <ScreenPicker
            show={showScreenPicker}
            sources={screenSources}
            loading={loadingScreenSources}
            onSelect={startScreenShare}
            onClose={() => setShowScreenPicker(false)}
            onRefresh={async () => {
              setLoadingScreenSources(true);
              const sources = await (window as any).electronAPI.getScreenSources();
              setScreenSources(sources);
              setLoadingScreenSources(false);
            }}
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