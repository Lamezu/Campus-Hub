import { useEffect, useRef, useState, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { playRingback, stopRingback } from '../../utils/toneGenerator';
import { auth } from '../../config/firebase';
import {
  Phone, PhoneOff, Video, VideoOff, Mic, MicOff, PhoneIncoming,
  Headphones, HeadphoneOff, Monitor, MonitorOff, Settings,
  MoreHorizontal, Check, Maximize2, ExternalLink,
  Eye, EyeOff, Volume2, VolumeX
} from 'lucide-react';
import { CtrlBtn, CompoundBtn } from './shared/CallUIComponents';
import { DevicePanel } from './shared/DevicePanel';
import { useIsMobile, useDrag } from './shared/useCallUI';
import {
  answerCall,
  endCall,
  addCallerCandidate,
  addReceiverCandidate,
  updateCallOffer,
  updateReceiverOffer,
  updateCallerReanswer,
  updateCamState,
  updateCallSharingState,
  signalVideo,
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
  const [deafened, setDeafened] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showLocalVideo, setShowLocalVideo] = useState(true);
  const [showNoVideoParticipants, setShowNoVideoParticipants] = useState(true);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [remoteSpeaking, setRemoteSpeaking] = useState(false);
  const [subPanel, setSubPanel] = useState<'input' | 'output' | null>(null);
  const [showCamPicker, setShowCamPicker] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState('');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('');
  const [selectedCamId, setSelectedCamId] = useState('');
  const [duration, setDuration] = useState(0);
  const [remoteVideoReady, setRemoteVideoReady] = useState(false);
  const [remoteVideoMuted, setRemoteVideoMuted] = useState(false);
  const [remoteSharing, setRemoteSharing] = useState(false);
  const [focusedTile, setFocusedTile] = useState<'remote' | 'remoteShare' | 'localShare' | 'local' | null>(null);
  const [hiddenRemoteCamera, setHiddenRemoteCamera] = useState(false);
  const [hiddenRemoteShare, setHiddenRemoteShare] = useState(false);
  const [remoteMuted, setRemoteMuted] = useState(false);
  const [remoteVolume, setRemoteVolume] = useState(100);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; tileId: 'remote' | 'remoteShare' | 'localShare' | 'local' } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [minimized, setMinimized] = useState(false);
  const [inPip, setInPip] = useState(false);
  const [videoFit, setVideoFit] = useState<'contain' | 'cover'>('contain');
  const { miniPos, onDragStart } = useDrag();

  const pipVideoRef = useRef<HTMLVideoElement | null>(null);
  const docPipWinRef = useRef<Window | null>(null);
  const docPipAreaRef = useRef<Element | null>(null);
  const pipRafRef = useRef<number | null>(null);
  const avatarImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    if (!otherUserPhoto) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `${otherUserPhoto}${otherUserPhoto.includes('?') ? '&' : '?'}t=session`;
    img.onload = () => { avatarImgRef.current = img; };
  }, [otherUserPhoto]);

  useEffect(() => {
    return () => {
      if (pipRafRef.current) cancelAnimationFrame(pipRafRef.current);
      pipVideoRef.current?.remove();
      if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => { });
    };
  }, []);

  const triggerPip = useCallback(async () => {
    if (!document.pictureInPictureEnabled || document.pictureInPictureElement) return;

    const onLeavePip = () => { setInPip(false); setMinimized(false); };
    if (remoteSharing && remoteShareVideoRef.current) {
      try {
        await remoteShareVideoRef.current.requestPictureInPicture();
        setInPip(true);
        remoteShareVideoRef.current.addEventListener('leavepictureinpicture', onLeavePip, { once: true });
        return;
      } catch { }
    }
    if (callType === 'video' && remoteVideoRef.current && remoteVideoReady && !remoteVideoMuted) {
      try {
        await remoteVideoRef.current.requestPictureInPicture();
        setInPip(true);
        remoteVideoRef.current.addEventListener('leavepictureinpicture', onLeavePip, { once: true });
        return;
      } catch { }
    }

    try {
      if (!pipVideoRef.current) {
        const v = document.createElement('video');
        v.muted = true;
        v.playsInline = true;
        Object.assign(v.style, { position: 'fixed', width: '1px', height: '1px', opacity: '0', pointerEvents: 'none', top: '-9999px' });
        document.body.appendChild(v);
        pipVideoRef.current = v;
      }

      if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }

      const canvas = document.createElement('canvas');
      canvas.width = 280; canvas.height = 180;
      const ctx = canvas.getContext('2d')!;

      const name = otherUserName;
      const initial = name[0]?.toUpperCase() || '?';
      const draw = () => {
        ctx.fillStyle = '#2b2d31';
        ctx.fillRect(0, 0, 280, 180);
        const cx = 140, cy = 80, r = 48;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        if (avatarImgRef.current) {
          ctx.drawImage(avatarImgRef.current, cx - r, cy - r, r * 2, r * 2);
        } else {
          ctx.fillStyle = '#5865f2';
          ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
          ctx.restore();
          ctx.save();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 42px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(initial, cx, cy);
        }
        ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(name, 140, 148);
        pipRafRef.current = requestAnimationFrame(draw);
      };
      draw();

      pipVideoRef.current.srcObject = canvas.captureStream(15);
      await pipVideoRef.current.play();
      await pipVideoRef.current.requestPictureInPicture();
      setInPip(true);

      pipVideoRef.current.addEventListener('leavepictureinpicture', () => {
        setInPip(false);
        setMinimized(false);
        if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
      }, { once: true });
    } catch {
      if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
    }
  }, [callType, otherUserName, remoteVideoReady, remoteVideoMuted, remoteSharing]);


  const handleExpand = useCallback(async () => {
    if (docPipWinRef.current && !docPipWinRef.current.closed) {
      docPipWinRef.current.close();
      docPipWinRef.current = null;
      docPipAreaRef.current = null;
    }
    if (document.pictureInPictureElement) await document.exitPictureInPicture().catch(() => { });
    if (pipRafRef.current) { cancelAnimationFrame(pipRafRef.current); pipRafRef.current = null; }
    setInPip(false);
    setMinimized(false);
  }, []);

  useEffect(() => {
    const pip = docPipWinRef.current;
    const area = docPipAreaRef.current;
    if (!pip || pip.closed || !area) return;

    while (area.firstChild) area.removeChild(area.firstChild);

    const shareStream = remoteSharing && !hiddenRemoteShare ? remoteShareStreamRef.current : null;
    const hasVideo = shareStream != null || (callType === 'video' && remoteVideoReady && !remoteVideoMuted && !hiddenRemoteCamera);
    if (hasVideo) {
      const v = pip.document.createElement('video') as HTMLVideoElement;
      v.autoplay = true; v.playsInline = true; v.muted = true;
      v.srcObject = shareStream ?? remoteStreamRef.current;
      v.style.cssText = 'width:100%;height:100%;object-fit:contain;';
      area.appendChild(v);
    } else {
      const av = pip.document.createElement('div');
      av.style.cssText = 'width:72px;height:72px;border-radius:50%;overflow:hidden;background:#36393f;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;';
      if (otherUserPhoto) {
        const img = pip.document.createElement('img') as HTMLImageElement;
        img.crossOrigin = "anonymous";
        img.src = `${otherUserPhoto}${otherUserPhoto.includes('?') ? '&' : '?'}t=session`;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        av.appendChild(img);
      } else { av.textContent = otherUserName[0]?.toUpperCase() || '?'; }
      area.appendChild(av);
    }
  }, [remoteVideoReady, remoteVideoMuted, callType, otherUserName, otherUserPhoto, remoteSharing, hiddenRemoteCamera, hiddenRemoteShare]);

  const durationRef = useRef(0);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  useEffect(() => {
    const video = remoteVideoRef.current;
    if (!video) return;
    const onLeave = () => { setInPip(false); setMinimized(false); };
    video.addEventListener('leavepictureinpicture', onLeave);
    return () => video.removeEventListener('leavepictureinpicture', onLeave);
  }, []);

  useEffect(() => {
    if (!inPip || docPipWinRef.current) return;
    if (!document.pictureInPictureElement) return;
    document.exitPictureInPicture().then(() => triggerPip()).catch(() => {});
  }, [remoteSharing]);

  useEffect(() => {
    if (callType !== 'video') return;
    const v = remoteVideoRef.current;
    if (!v) return;
    if (!remoteVideoMuted && remoteVideoReady) {
      if (!v.srcObject) v.srcObject = remoteStreamRef.current;
      if (v.paused) v.play().catch(() => { });
    }
  }, [remoteVideoMuted, remoteVideoReady, callType]);

  useEffect(() => {
    if (focusedTile === 'remoteShare' && !remoteSharing) setFocusedTile(null);
    if (focusedTile === 'localShare' && !sharing) setFocusedTile(null);
  }, [remoteSharing, sharing, focusedTile]);

  useEffect(() => {
    if (!sharing) return;
    const video = screenShareVideoRef.current;
    const stream = screenStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.play().catch(() => { });
  }, [sharing]);

  useEffect(() => {
    const video = remoteShareVideoRef.current;
    if (!remoteSharing) {
      if (video) { video.pause(); video.srcObject = null; }
      return;
    }
    const stream = remoteShareStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = null;
    video.srcObject = stream;
    video.play().catch(() => { });
  }, [remoteSharing]);

  useEffect(() => {
    if (minimized || inPip) return;
    if (callType === 'video') {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        remoteVideoRef.current.play().catch(() => { });
      }
      if (localVideoRef.current && activeVideoTrackRef.current) {
        const ms = new MediaStream([activeVideoTrackRef.current]);
        localVideoRef.current.srcObject = ms;
        localVideoRef.current.play().catch(() => { });
      }
    }
    if (remoteShareVideoRef.current && remoteSharing) {
      remoteShareVideoRef.current.srcObject = remoteShareStreamRef.current;
      remoteShareVideoRef.current.play().catch(() => { });
    }
    if (screenShareVideoRef.current && sharing && screenStreamRef.current) {
      screenShareVideoRef.current.srcObject = screenStreamRef.current;
      screenShareVideoRef.current.play().catch(() => { });
    }
  }, [minimized, inPip]);

  const location = useLocation();
  const initialPathRef = useRef(location.pathname);
  const openDocPipRef = useRef<() => void>(() => { });
  useEffect(() => {
    if (location.pathname === initialPathRef.current) return;
    openDocPipRef.current();
  }, [location.pathname]);

  const { t } = useTranslation();
  const isMobile = useIsMobile();

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const gainCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const gainSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const gainDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream>(new MediaStream());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubsRef = useRef<(() => void)[]>([]);
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([]);
  const screenTrackRef = useRef<MediaStreamTrack | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const screenSenderRef = useRef<RTCRtpSender | null>(null);
  const screenAudioSrcRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const screenAudioGainRef = useRef<GainNode | null>(null);
  const videoSenderRef = useRef<RTCRtpSender | null>(null);
  const activeVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const remoteShareStreamRef = useRef<MediaStream>(new MediaStream());
  const remoteShareVideoRef = useRef<HTMLVideoElement>(null);
  const connectedRef = useRef(false);
  const preMicOnRef = useRef(true);
  const userGainRef = useRef(1.0);
  const lastVideoSignalRef = useRef<number>(0);
  const lastReceiverOfferSdpRef = useRef<string>('');
  const lastCallerReanswerSdpRef = useRef<string>('');
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAudioCtxRef = useRef<AudioContext | null>(null);
  const speakingRafRef = useRef<number | null>(null);
  const localSpeakingUntilRef = useRef(0);
  const remoteSpeakingUntilRef = useRef(0);
  const localSpeakingStateRef = useRef(false);
  const remoteSpeakingStateRef = useRef(false);

  useEffect(() => {
    if (isCaller && status === 'ringing') playRingback();
    else stopRingback();
    return () => stopRingback();
  }, [isCaller, status]);

  const startTimer = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    }
  }, []);

  const cleanup = useCallback(() => {
    unsubsRef.current.forEach(u => u());
    unsubsRef.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    gainSourceRef.current?.disconnect();
    gainSourceRef.current = null;
    gainNodeRef.current?.disconnect();
    gainNodeRef.current = null;
    gainDestRef.current = null;
    gainCtxRef.current?.close().catch(() => { });
    gainCtxRef.current = null;
    if (speakingRafRef.current) { cancelAnimationFrame(speakingRafRef.current); speakingRafRef.current = null; }
    remoteAudioCtxRef.current?.close().catch(() => { });
    remoteAudioCtxRef.current = null;
    localAnalyserRef.current = null;
    remoteAnalyserRef.current = null;
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
    try { await endCall(callId); } catch { }
    onClose();
  }, [callId, cleanup, onClose]);

  const openDocPip = useCallback(async () => {
    const docPip = (window as any).documentPictureInPicture;
    if (!docPip) { await triggerPip(); setMinimized(true); return; }
    try {
      const pip: Window = await docPip.requestWindow({ width: 300, height: 260, disallowReturnToOpener: false });
      setMinimized(true);
      setInPip(true);
      pip.document.body.style.cssText = 'margin:0;background:#1e1f22;display:flex;flex-direction:column;height:100vh;font-family:sans-serif;overflow:hidden;';

      docPipWinRef.current = pip;
      pip.addEventListener('pagehide', () => { docPipWinRef.current = null; docPipAreaRef.current = null; });

      const area = pip.document.createElement('div');
      area.style.cssText = 'flex:1;display:flex;align-items:center;justify-content:center;background:#2b2d31;overflow:hidden;';
      docPipAreaRef.current = area;
      const shareStream = remoteSharing && !hiddenRemoteShare ? remoteShareStreamRef.current : null;
      const hasVideo = shareStream != null || (callType === 'video' && remoteVideoReady && !remoteVideoMuted && !hiddenRemoteCamera);
      if (hasVideo) {
        const v = pip.document.createElement('video') as HTMLVideoElement;
        v.autoplay = true; v.playsInline = true; v.muted = true;
        v.srcObject = shareStream ?? remoteStreamRef.current;
        v.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        area.appendChild(v);
      } else {
        const av = pip.document.createElement('div');
        av.style.cssText = 'width:72px;height:72px;border-radius:50%;overflow:hidden;background:#36393f;display:flex;align-items:center;justify-content:center;color:#fff;font-size:28px;font-weight:700;';
        if (otherUserPhoto) {
          const img = pip.document.createElement('img') as HTMLImageElement;
          img.src = otherUserPhoto; img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          av.appendChild(img);
        } else { av.textContent = otherUserName[0]?.toUpperCase() || '?'; }
        area.appendChild(av);
      }
      pip.document.body.appendChild(area);

      const bar = pip.document.createElement('div');
      bar.style.cssText = 'background:#292b2f;padding:8px 12px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;';
      const info = pip.document.createElement('div');
      const nameEl = pip.document.createElement('div');
      nameEl.textContent = otherUserName; nameEl.style.cssText = 'color:#fff;font-size:13px;font-weight:600;';
      const durEl = pip.document.createElement('div');
      durEl.style.cssText = 'color:#b9bbbe;font-size:11px;margin-top:2px;';
      info.appendChild(nameEl); info.appendChild(durEl);
      const hangBtn = pip.document.createElement('button');
      hangBtn.style.cssText = 'width:32px;height:32px;border-radius:50%;background:#ed4245;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;';
      hangBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.42 19.42 0 0 1 4.43 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.34 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.32 9.9a16 16 0 0 0 2.6 3.41z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>';
      hangBtn.onclick = () => { handleHangUp(); pip.close(); };
      bar.appendChild(info); bar.appendChild(hangBtn);
      pip.document.body.appendChild(bar);

      const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      durEl.textContent = fmt(durationRef.current);
      const iv = setInterval(() => { durEl.textContent = fmt(durationRef.current); }, 1000);
      pip.addEventListener('pagehide', () => {
        clearInterval(iv);
        docPipWinRef.current = null;
        docPipAreaRef.current = null;
        setInPip(false);
        setMinimized(false);
      });
    } catch { }
  }, [callType, otherUserName, otherUserPhoto, remoteVideoReady, remoteVideoMuted, remoteSharing, hiddenRemoteCamera, hiddenRemoteShare, triggerPip, handleHangUp]);
  useEffect(() => { openDocPipRef.current = openDocPip; }, [openDocPip]);

  const refreshRemoteMedia = useCallback(() => {
    const rs = remoteStreamRef.current;
    if (callType === 'video' && remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = rs;
      remoteVideoRef.current.play().catch(() => { });
      if (rs.getVideoTracks().some(t => !t.muted)) {
        setRemoteVideoReady(true);
      }
    } else if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = rs;
      remoteAudioRef.current.play().catch(() => { });
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
          setMediaError(t('call.error_no_devices_windows'));
        }
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      localStreamRef.current = stream;

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) setSelectedMicId(audioTrack.getSettings().deviceId ?? '');
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) setSelectedCamId(videoTrack.getSettings().deviceId ?? '');

      if (localVideoRef.current && callType === 'video') {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.play().catch(() => { });
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;
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
      pc.ontrack = (e: RTCTrackEvent) => {
        const idx = pc.getTransceivers().findIndex(tx => tx === e.transceiver);
        const track = e.track;

        if (idx === 0) {
          // slot 0 = remote audio
          const rs = remoteStreamRef.current;
          if (!rs.getTracks().find(t => t.id === track.id)) rs.addTrack(track);
          if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = rs; remoteAudioRef.current.play().catch(() => { }); }
          if (remoteVideoRef.current?.srcObject) { remoteVideoRef.current.srcObject = rs; }
          if (!remoteAudioCtxRef.current) {
            try {
              const ctx = new AudioContext();
              remoteAudioCtxRef.current = ctx;
              const analyser = ctx.createAnalyser();
              analyser.fftSize = 256;
              ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
              remoteAnalyserRef.current = analyser;
            } catch { }
          }
        } else if (idx === 1) {
          // slot 1 = remote camera
          // remoteVideoMuted is controlled by Firestore (callerCamOff/receiverCamOff).
          // Don't read track.muted here — the track arrives muted during ICE setup
          // regardless of whether the peer actually has their camera on.
          const rs = remoteStreamRef.current;
          if (!rs.getTracks().find(t => t.id === track.id)) rs.addTrack(track);
          if (callType === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = rs;
            remoteVideoRef.current.play().catch(() => { });
          }
          setRemoteVideoReady(true);
          track.addEventListener('mute', () => setRemoteVideoMuted(true));
          track.addEventListener('unmute', () => {
            setRemoteVideoMuted(false);
            setRemoteVideoReady(true);
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => { });
            }
          });
        } else if (idx === 2) {
          const rss = remoteShareStreamRef.current;
          rss.getTracks().forEach(t => rss.removeTrack(t));
          rss.addTrack(track);
          if (remoteShareVideoRef.current) { remoteShareVideoRef.current.srcObject = rss; remoteShareVideoRef.current.play().catch(() => { }); }
          track.addEventListener('unmute', () => {
            if (remoteShareVideoRef.current) remoteShareVideoRef.current.play().catch(() => { });
          });
        }
      };

      if (isCaller) {
        const txAudio = pc.addTransceiver('audio', { direction: 'sendrecv' });
        const txVideo = pc.addTransceiver('video', { direction: 'sendrecv' });
        const txScreen = pc.addTransceiver('video', { direction: 'sendrecv' });
        if (pcAudioTracks[0]) txAudio.sender.replaceTrack(pcAudioTracks[0]).catch(() => { });
        if (videoTrack && callType === 'video') { activeVideoTrackRef.current = videoTrack; txVideo.sender.replaceTrack(videoTrack).catch(() => { }); }
        videoSenderRef.current = txVideo.sender;
        screenSenderRef.current = txScreen.sender;

        pc.onicecandidate = (e) => {
          if (e.candidate) addCallerCandidate(callId, e.candidate.toJSON()).catch(() => { });
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
          const receiverCamOff = call.receiverCamOff ?? false;
          setRemoteVideoMuted(receiverCamOff);
          if (!receiverCamOff) setRemoteVideoReady(true);
          setRemoteSharing(call.receiverSharing ?? false);
          const receiverSig = call.receiverVideoSignal ?? 0;
          if (receiverSig !== lastVideoSignalRef.current) {
            lastVideoSignalRef.current = receiverSig;
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => { });
            }
          }
          if (call.answer && pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(new RTCSessionDescription(call.answer)).catch(() => { });
            for (const c of pendingCandidates.current) {
              await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
            }
            pendingCandidates.current = [];
            setStatus('active');
            startTimer();
            connectedRef.current = true;
            pc.onnegotiationneeded = async () => {
              if (pc.signalingState === 'stable' && connectedRef.current) {
                try {
                  const newOffer = await pc.createOffer();
                  await pc.setLocalDescription(newOffer);
                  await updateCallOffer(callId, newOffer);
                } catch { }
              }
            };
          }
          const receiverOfferSdp = call.receiverOffer?.sdp ?? '';
          if (receiverOfferSdp && receiverOfferSdp !== lastReceiverOfferSdpRef.current && pc.signalingState === 'stable' && connectedRef.current) {
            lastReceiverOfferSdpRef.current = receiverOfferSdp;
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(call.receiverOffer!));
              const reanswer = await pc.createAnswer();
              await pc.setLocalDescription(reanswer);
              await updateCallerReanswer(callId, reanswer);
            } catch { }
          }
        });

        const unsubCandidates = subscribeToReceiverCandidates(callId, async (candidate) => {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
          } else {
            pendingCandidates.current.push(candidate);
          }
        });

        unsubsRef.current = [unsubCall, unsubCandidates];

      } else {
        pc.onicecandidate = (e) => {
          if (e.candidate) addReceiverCandidate(callId, e.candidate.toJSON()).catch(() => { });
        };

        const lastOfferRef = { sdp: '' };

        const unsubCallStatus = subscribeToCall(callId, async (call) => {
          if (!call) { handleHangUp(); return; }
          if (call.status === 'ended' || call.status === 'missed') { cleanup(); onClose(); return; }
          const callerCamOff = call.callerCamOff ?? false;
          setRemoteVideoMuted(callerCamOff);
          if (!callerCamOff) setRemoteVideoReady(true);
          setRemoteSharing(call.callerSharing ?? false);
          const callerSig = call.callerVideoSignal ?? 0;
          if (callerSig !== lastVideoSignalRef.current) {
            lastVideoSignalRef.current = callerSig;
            if (callType === 'video' && remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => { });
            }
          }
          if (connectedRef.current && call.offer && pc.signalingState === 'stable') {
            const offerSdp = call.offer.sdp ?? '';
            if (offerSdp !== lastOfferRef.sdp) {
              lastOfferRef.sdp = offerSdp;
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(call.offer));
                const reanswer = await pc.createAnswer();
                await pc.setLocalDescription(reanswer);
                await answerCall(callId, reanswer);
              } catch { }
            }
          }
          const callerReanswer = call.callerReanswer;
          if (callerReanswer?.sdp && callerReanswer.sdp !== lastCallerReanswerSdpRef.current && pc.signalingState === 'have-local-offer') {
            lastCallerReanswerSdpRef.current = callerReanswer.sdp;
            await pc.setRemoteDescription(new RTCSessionDescription(callerReanswer)).catch(() => { });
          }
        });

        const unsubCandidates = subscribeToCallerCandidates(callId, async (candidate) => {
          if (pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
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
          await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => { });
        }
        pendingCandidates.current = [];

        const txs = pc.getTransceivers();
        if (txs[0]) txs[0].direction = 'sendrecv';
        if (txs[1]) txs[1].direction = 'sendrecv';
        if (txs[2]) txs[2].direction = 'sendrecv';
        videoSenderRef.current = txs[1]?.sender ?? null;
        screenSenderRef.current = txs[2]?.sender ?? null;
        if (pcAudioTracks[0] && txs[0]) txs[0].sender.replaceTrack(pcAudioTracks[0]).catch(() => { });
        if (videoTrack && callType === 'video' && txs[1]) {
          activeVideoTrackRef.current = videoTrack;
          txs[1].sender.replaceTrack(videoTrack).catch(() => { });
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await answerCall(callId, answer);
        setStatus('active');
        startTimer();
        connectedRef.current = true;
        pc.onnegotiationneeded = async () => {
          if (pc.signalingState === 'stable' && connectedRef.current) {
            try {
              const offer = await pc.createOffer();
              await pc.setLocalDescription(offer);
              await updateReceiverOffer(callId, offer);
            } catch { }
          }
        };
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
      if (remoteAnalyserRef.current) {
        remoteAnalyserRef.current.getByteFrequencyData(buf);
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
        if (avg > THRESHOLD) remoteSpeakingUntilRef.current = now + HOLD_MS;
      }
      const isRemote = now < remoteSpeakingUntilRef.current;
      if (isRemote !== remoteSpeakingStateRef.current) { remoteSpeakingStateRef.current = isRemote; setRemoteSpeaking(isRemote); }
      speakingRafRef.current = requestAnimationFrame(tick);
    };
    speakingRafRef.current = requestAnimationFrame(tick);
    return () => { if (speakingRafRef.current) cancelAnimationFrame(speakingRafRef.current); };
  }, [status]);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

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
        const sender = videoSenderRef.current;
        if (sender) await sender.replaceTrack(track).catch(() => { });
        if (localVideoRef.current) { localVideoRef.current.srcObject = s; localVideoRef.current.play().catch(() => { }); }
        setSelectedCamId(track.getSettings().deviceId ?? selectedCamId);
        setCamOn(true);
        updateCamState(callId, isCaller, false).catch(() => { });
        signalVideo(callId, isCaller).catch(() => { });
      } catch { }
    } else {
      activeVideoTrackRef.current?.stop();
      activeVideoTrackRef.current = null;
      const sender = videoSenderRef.current;
      if (sender) await sender.replaceTrack(null).catch(() => { });
      if (localVideoRef.current) localVideoRef.current.srcObject = null;
      setCamOn(false);
      updateCamState(callId, isCaller, true).catch(() => { });
    }
  };

  useEffect(() => {
    const muted = deafened || remoteMuted;
    if (remoteAudioRef.current) remoteAudioRef.current.muted = muted;
    if (remoteVideoRef.current) remoteVideoRef.current.muted = muted;
  }, [deafened, remoteMuted]);

  useEffect(() => {
    if (remoteAudioRef.current) remoteAudioRef.current.volume = remoteVolume / 100;
    if (remoteVideoRef.current) remoteVideoRef.current.volume = remoteVolume / 100;
  }, [remoteVolume]);

  const handleTileContextMenu = (e: React.MouseEvent, tileId: 'remote' | 'remoteShare' | 'localShare' | 'local') => {
    e.preventDefault();
    if (tileId === 'local' || tileId === 'localShare') return;
    setContextMenu({ x: e.clientX, y: e.clientY, tileId });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  const toggleDeafen = () => {
    const next = !deafened;
    setDeafened(next);
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
      const sender = pcRef.current?.getTransceivers()[0]?.sender;
      if (sender) await sender.replaceTrack(trackForSender);
      localStreamRef.current?.getAudioTracks().forEach(t => t.stop());
      if (!micOn) track.enabled = false;
    } catch { }
  };

  const changeAudioOutput = (deviceId: string) => {
    setSelectedSpeakerId(deviceId);
    const audio = remoteAudioRef.current as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    audio?.setSinkId?.(deviceId).catch(() => { });
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
      const sender = videoSenderRef.current;
      if (sender) await sender.replaceTrack(track);
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
    if (screenSenderRef.current) screenSenderRef.current.replaceTrack(null).catch(() => { });
    if (screenShareVideoRef.current) screenShareVideoRef.current.srcObject = null;
    setSharing(false);
    updateCallSharingState(callId, isCaller, false).catch(() => { });
  }, [callId, isCaller]);

  const toggleScreenShare = async () => {
    if (sharing) { stopScreenShare(); return; }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      const audioTrack = screenStream.getAudioTracks()[0];
      screenTrackRef.current = videoTrack;
      videoTrack.onended = () => stopScreenShare();
      if (screenSenderRef.current) {
        await screenSenderRef.current.replaceTrack(videoTrack).catch(() => { });
      } else if (pcRef.current) {
        try {
          const tx = pcRef.current.addTransceiver('video', { direction: 'sendrecv' });
          screenSenderRef.current = tx.sender;
          await tx.sender.replaceTrack(videoTrack).catch(() => { });
        } catch { }
      }
      if (audioTrack && gainCtxRef.current && gainDestRef.current) {
        try {
          if (gainCtxRef.current.state === 'suspended') gainCtxRef.current.resume().catch(() => { });
          const src = gainCtxRef.current.createMediaStreamSource(new MediaStream([audioTrack]));
          const gain = gainCtxRef.current.createGain();
          gain.gain.value = 3.5;
          src.connect(gain);
          gain.connect(gainDestRef.current);
          screenAudioSrcRef.current = src;
          screenAudioGainRef.current = gain;
        } catch { }
      }
      screenStreamRef.current = screenStream;
      setSharing(true);
      updateCallSharingState(callId, isCaller, true).catch(() => { });
    } catch { }
  };

  const handleInputVolume = useCallback((v: number) => {
    if (gainCtxRef.current?.state === 'suspended') gainCtxRef.current.resume().catch(() => { });
    userGainRef.current = v / 100;
    if (gainNodeRef.current) gainNodeRef.current.gain.value = micOn ? v / 100 : 0;
  }, [micOn]);

  const handleOutputVolume = useCallback((v: number) => {
    if (remoteAudioRef.current) remoteAudioRef.current.volume = v / 100;
    if (remoteVideoRef.current) remoteVideoRef.current.volume = v / 100;
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const statusLabel =
    status === 'ringing' ? t('call.calling') :
      status === 'connecting' ? t('call.connecting') :
        status === 'active' ? formatDuration(duration) : t('call.call_ended');


  const currentUserPhoto = auth.currentUser?.photoURL ?? null;
  const currentUserInitial = (auth.currentUser?.displayName ?? auth.currentUser?.email ?? '?')[0]?.toUpperCase() ?? '?';

  const remoteVideoVisible = remoteVideoReady && !remoteVideoMuted;

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
      }}>
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

      <div style={{
        ...(minimized ? { height: inPip ? 0 : 158 } : { flex: 1 }),
        position: 'relative', overflow: 'hidden', boxSizing: 'border-box',
        display: 'flex',
        ...(!minimized
          ? { flexDirection: isMobile ? 'column' : 'row', gap: 8, padding: 8, alignItems: 'center', justifyContent: 'center', overflowY: isMobile ? 'auto' : 'hidden' }
          : { alignItems: 'center', justifyContent: 'center' }
        ),
      }}>
        {minimized && !inPip && !remoteVideoVisible && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 5, backgroundColor: '#2b2d31', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f' }}>
              {otherUserPhoto
                ? <img crossOrigin="anonymous" src={`${otherUserPhoto}${otherUserPhoto.includes('?') ? '&' : '?'}t=session`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', fontWeight: 700 }}>
                  {otherUserName[0]?.toUpperCase() || '?'}
                </div>
              }
            </div>
          </div>
        )}

        {!minimized && (() => {
          type TileId = 'remote' | 'remoteShare' | 'localShare' | 'local';
          const tileStyle = (id: TileId, extra?: React.CSSProperties): React.CSSProperties => {
            if (focusedTile !== null && focusedTile !== id) return { display: 'none' };
            if (focusedTile === id) return { position: 'absolute', inset: 0, zIndex: 2, overflow: 'hidden', backgroundColor: '#2b2d31', cursor: 'pointer', ...extra };
            return {
              position: 'relative', borderRadius: 12, overflow: 'hidden', backgroundColor: '#2b2d31',
              aspectRatio: '16/9', cursor: 'pointer',
              ...(isMobile ? { width: '100%', flexShrink: 0 } : { flex: 1, minWidth: 0 }),
              ...extra,
            };
          };
          const onTileClick = (id: TileId) => () => setFocusedTile(f => f === id ? null : id);
          const label = (text: string) => (
            <div style={{ position: 'absolute', bottom: 10, left: 10, zIndex: 5, background: 'rgba(0,0,0,0.55)', borderRadius: 6, padding: '3px 10px', color: '#fff', fontSize: 13, fontWeight: 600 }}>
              {text}
            </div>
          );
          return (
            <>
              <div
                style={{ ...tileStyle('remote'), ...(!showNoVideoParticipants && (callType === 'audio' || !remoteVideoVisible) && !hiddenRemoteCamera && { display: 'none' }), ...(remoteSpeaking && !deafened && focusedTile !== 'remote' && !hiddenRemoteCamera && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }}
                onClick={onTileClick('remote')}
                onContextMenu={e => handleTileContextMenu(e, 'remote')}
              >
                {callType === 'video' && (
                  <video ref={remoteVideoRef} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: remoteVideoVisible && !hiddenRemoteCamera ? 1 : 0, transition: 'opacity 0.3s' }} />
                )}
                {(callType === 'audio' || !remoteVideoVisible) && !hiddenRemoteCamera && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f' }}>
                      {otherUserPhoto ? <img crossOrigin="anonymous" src={`${otherUserPhoto}${otherUserPhoto.includes('?') ? '&' : '?'}t=session`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', fontWeight: 700 }}>{otherUserName[0]?.toUpperCase() || '?'}</div>}
                    </div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '10px 0 3px' }}>{otherUserName}</p>
                    <p style={{ color: '#b9bbbe', fontSize: 12, margin: 0 }}>{mediaError ?? (callType === 'audio' ? statusLabel : (!remoteVideoReady ? statusLabel : t('call.camera_disabled')))}</p>
                  </div>
                )}
                {!hiddenRemoteCamera && label(otherUserName)}
                {remoteSpeaking && !deafened && focusedTile === 'remote' && !hiddenRemoteCamera && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
                )}
                {hiddenRemoteCamera && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 8, backgroundColor: '#2b2d31', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f', opacity: 0.5 }}>
                      {otherUserPhoto ? <img crossOrigin="anonymous" src={`${otherUserPhoto}${otherUserPhoto.includes('?') ? '&' : '?'}t=session`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: '#fff', fontWeight: 700 }}>{otherUserName[0]?.toUpperCase() || '?'}</div>}
                    </div>
                    <span style={{ color: '#72767d', fontSize: 12, fontWeight: 600 }}>{otherUserName}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        title={t('call.watch_again')}
                        onClick={e => { e.stopPropagation(); setHiddenRemoteCamera(false); setFocusedTile('remote'); }}
                        style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Maximize2 size={14} color="#dcddde" />
                      </button>
                      <button
                        title={t('call.show_in_grid')}
                        onClick={e => { e.stopPropagation(); setHiddenRemoteCamera(false); }}
                        style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Eye size={14} color="#dcddde" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div
                style={{ ...tileStyle('remoteShare', { backgroundColor: '#111214' }), ...(!remoteSharing && { display: 'none' }) }}
                onClick={onTileClick('remoteShare')}
                onContextMenu={e => handleTileContextMenu(e, 'remoteShare')}
              >
                <video ref={remoteShareVideoRef} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: hiddenRemoteShare ? 0 : 1, transition: 'opacity 0.2s' }} />
                {!hiddenRemoteShare && label(t('call.screen_of', { name: otherUserName }))}
                {hiddenRemoteShare && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 8, backgroundColor: '#111214', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Monitor size={32} color="#4e5058" strokeWidth={1.5} />
                    <span style={{ color: '#72767d', fontSize: 12, fontWeight: 600 }}>{otherUserName}</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        title={t('call.watch_again')}
                        onClick={e => { e.stopPropagation(); setHiddenRemoteShare(false); setFocusedTile('remoteShare'); }}
                        style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Maximize2 size={14} color="#dcddde" />
                      </button>
                      <button
                        title={t('call.show_in_grid')}
                        onClick={e => { e.stopPropagation(); setHiddenRemoteShare(false); }}
                        style={{ width: 32, height: 32, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <Eye size={14} color="#dcddde" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ ...tileStyle('localShare', { backgroundColor: '#111214' }), ...(!sharing && { display: 'none' }) }} onClick={onTileClick('localShare')} onContextMenu={e => handleTileContextMenu(e, 'localShare')}>
                <video ref={screenShareVideoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }} />
                {label(t('call.your_screen'))}
              </div>

              <div style={{ ...tileStyle('local'), ...((camOn ? !showLocalVideo : !showNoVideoParticipants) && { display: 'none' }), ...(localSpeaking && focusedTile !== 'local' && { boxShadow: '0 0 0 2px #23a55a, 0 0 12px rgba(35,165,90,0.45)' }) }} onClick={onTileClick('local')} onContextMenu={e => handleTileContextMenu(e, 'local')}>
                {callType === 'video' && (
                  <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: focusedTile === 'local' ? 'contain' : 'cover', opacity: camOn ? 1 : 0, transition: 'opacity 0.3s' }} />
                )}
                {(callType === 'audio' || !camOn) && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 72, height: 72, borderRadius: '50%', overflow: 'hidden', backgroundColor: '#36393f' }}>
                      {currentUserPhoto ? <img crossOrigin="anonymous" src={`${currentUserPhoto}${currentUserPhoto.includes('?') ? '&' : '?'}t=session`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, color: '#fff', fontWeight: 700 }}>{currentUserInitial}</div>}
                    </div>
                    <p style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '10px 0 3px' }}>{t('call.you')}</p>
                    {callType === 'video' && <p style={{ color: '#b9bbbe', fontSize: 12, margin: 0 }}>{t('call.camera_disabled')}</p>}
                  </div>
                )}
                {label(t('call.you'))}
                {localSpeaking && focusedTile === 'local' && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none', border: '3px solid #23a55a', boxShadow: 'inset 0 0 20px rgba(35,165,90,0.35)' }} />
                )}
              </div>
            </>
          );
        })()}

        {callType === 'video' && minimized && (
          <video ref={remoteVideoRef} autoPlay playsInline style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', opacity: remoteVideoVisible ? 1 : 0, transition: 'opacity 0.3s'
          }} />
        )}


      </div>

      {minimized && !inPip && (
        <div style={{ backgroundColor: '#292b2f', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0, flex: 1, marginRight: 8 }}>
            <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherUserName}</div>
            <div style={{ color: '#b9bbbe', fontSize: 11 }}>{statusLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }} onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <button onClick={handleExpand} style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: 'rgba(79,84,92,0.75)', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Maximize2 size={14} />
            </button>
            <button onClick={handleHangUp} style={{ width: 30, height: 30, borderRadius: '50%', backgroundColor: '#ed4245', border: 'none', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneOff size={14} />
            </button>
          </div>
        </div>
      )}

      {contextMenu && (() => {
        const { x, y, tileId } = contextMenu;
        const isLocal = tileId === 'local' || tileId === 'localShare';
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
                {tileId === 'remoteShare' && (
                  <button
                    style={itemStyle}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    onClick={() => {
                      setHiddenRemoteShare(true);
                      if (focusedTile === 'remoteShare') setFocusedTile(null);
                      setContextMenu(null);
                    }}
                  >
                    <EyeOff size={15} color="#dcddde" />
                    {t('call.hide_stream')}
                  </button>
                )}
                <button
                  style={itemStyle}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  onClick={() => { setRemoteMuted(m => !m); setContextMenu(null); }}
                >
                  {remoteMuted ? <Volume2 size={15} color="#dcddde" /> : <VolumeX size={15} color="#dcddde" />}
                  {remoteMuted ? t('call.unmute_stream') : t('call.mute_stream')}
                </button>
                <div style={{ padding: '8px 14px 10px' }} onMouseDown={e => e.stopPropagation()}>
                  <div style={{ color: '#b9bbbe', fontSize: 12, marginBottom: 6 }}>{t('call.stream_volume')}</div>
                  <input
                    type="range" min={0} max={100} value={remoteVolume}
                    onChange={e => setRemoteVolume(Number(e.target.value))}
                    className="call-range"
                    style={{ background: `linear-gradient(to right, #5865f2 ${remoteVolume}%, rgba(255,255,255,0.15) ${remoteVolume}%)` }}
                  />
                </div>
              </>
            )}
          </div>
        );
      })()}

      {!minimized && <div style={{ backgroundColor: '#292b2f', padding: isMobile ? '10px 12px 24px' : '12px 20px 20px', flexShrink: 0, position: 'relative' }}>

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
            label={t('call.hang_up')}
            danger
            onClick={handleHangUp}
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
                    <div style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      backgroundColor: showLocalVideo ? '#5865f2' : 'transparent',
                      border: `1.5px solid ${showLocalVideo ? '#5865f2' : 'rgba(255,255,255,0.35)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      {showLocalVideo && <Check size={10} color="#fff" />}
                    </div>
                  </button>
                  <button
                    onClick={() => setShowNoVideoParticipants(v => !v)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', color: '#dcddde', textAlign: 'left' }}
                  >
                    <span style={{ fontSize: 14 }}>{t('call.show_no_video_participants')}</span>
                    <div style={{
                      width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                      backgroundColor: showNoVideoParticipants ? '#5865f2' : 'transparent',
                      border: `1.5px solid ${showNoVideoParticipants ? '#5865f2' : 'rgba(255,255,255,0.35)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
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
      </div>}
    </div>
  );
}

interface IncomingCallModalProps {
  call: Call;
  onAccept: () => void;
  onReject: () => void;
}

export function IncomingCallModal({ call, onAccept, onReject }: IncomingCallModalProps) {
  const { t } = useTranslation();
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
          <img crossOrigin="anonymous" src={`${call.callerPhoto}${call.callerPhoto.includes('?') ? '&' : '?'}t=session`} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          {call.type === 'video' ? t('call.incoming_video') : t('call.incoming')}
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
