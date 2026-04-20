import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, MicOff, Volume2, VolumeX, X, MonitorOff, Repeat, EyeOff, Maximize2 } from 'lucide-react';
import { useTranslation } from '@/contexts/LanguageContext';
import { Avatar } from '../common/Avatar';

interface VideoTileProps {
  uid: string;
  name: string;
  nameFallback?: string;
  photo?: string | null;
  stream: MediaStream | null;
  sharing?: boolean;
  speaking?: boolean;
  camOff?: boolean;
  muted?: boolean;
  isLocal?: boolean;
  onMuteToggle?: (muted: boolean) => void;
  onVolumeChange?: (volume: number) => void;
  onStopSharing?: () => void;
  onChangeSource?: () => void;
  onStopViewing?: () => void;
  isViewing?: boolean;
  onContextMenu?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
  onClick?: () => void;
  volume?: number;
}

const VideoTile = memo(function VideoTile({
  uid, name, nameFallback, photo, stream, sharing, speaking, camOff, muted, isLocal,
  onMuteToggle, onVolumeChange, onStopSharing, onChangeSource, onStopViewing, isViewing = true, onContextMenu, style, onClick, volume = 1
}: VideoTileProps) {
  const { t } = useTranslation();
  const [showOptions, setShowOptions] = useState(false);
  const [volValue, setVolValue] = useState(volume * 100);
  
  useEffect(() => {
    setVolValue(Math.round(volume * 100));
  }, [volume]);
  const [menuPos, setMenuPos] = useState<{ top: number; right: number } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const displayName = (name.startsWith('call.') || name.startsWith('common.')) ? (nameFallback || name) : name;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.muted = true;
    if (video.srcObject !== stream) video.srcObject = stream;
    const playVideo = () => video.play().catch(() => {});
    playVideo();
    stream.addEventListener('addtrack', playVideo);
    stream.addEventListener('removetrack', playVideo);
    return () => {
      stream.removeEventListener('addtrack', playVideo);
      stream.removeEventListener('removetrack', playVideo);
    };
  }, [stream]);

  const toggleOptions = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showOptions) { setShowOptions(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    setShowOptions(true);
  };

  const showVideo = (!camOff || sharing) && !!stream && stream.getVideoTracks().length > 0 && isViewing;

  return (
    <div
      key={`tile-${uid}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        position: 'relative', width: '100%', aspectRatio: '16/9',
        backgroundColor: '#1E1F22', borderRadius: '12px', overflow: 'hidden',
        border: speaking ? '2px solid #23a55a' : '2px solid transparent',
        transition: 'border 0.2s', cursor: onClick ? 'pointer' : 'default',
        boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
        ...style
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2B2D31', zIndex: 1 }}>
        <div style={{ width: '100px', height: '100px', borderRadius: '50%', backgroundColor: '#1E1F22', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid rgba(255,255,255,0.05)', boxShadow: '0 8px 16px rgba(0,0,0,0.3)' }}>
          <Avatar 
            src={photo} 
            name={displayName} 
            size={100} 
          />
        </div>
      </div>

      <video
        ref={videoRef} autoPlay playsInline muted
        style={{
          position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: sharing ? 'contain' : 'cover',
          transform: isLocal && !sharing ? 'scaleX(-1)' : 'none',
          opacity: showVideo ? 1 : 0, transition: 'opacity 0.3s', zIndex: 2
        }}
      />

      <div style={{ position: 'absolute', bottom: '12px', left: '12px', zIndex: 10, display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)', padding: '4px 10px', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {muted && !sharing && <MicOff size={11} style={{ color: '#ed4245' }} />}
          {displayName} {isLocal && !sharing && `(${t('common.you', 'Tú')})`}
          {sharing && <span style={{ color: '#23a55a', fontWeight: 800 }}>LIVE</span>}
        </div>
      </div>

      {(!isLocal || (sharing && isLocal)) && (
        <button
          ref={btnRef} onClick={toggleOptions}
          style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 20, width: '32px', height: '32px', borderRadius: '50%', border: 'none', backgroundColor: 'rgba(0,0,0,0.4)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
        >
          <MoreHorizontal size={18} />
        </button>
      )}

      {showOptions && menuPos && createPortal(
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 99999 }} onClick={() => setShowOptions(false)} />
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ position: 'fixed', top: menuPos.top, right: menuPos.right, backgroundColor: '#111214', borderRadius: '12px', padding: '12px', width: '260px', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', zIndex: 100000, border: '1px solid rgba(255,255,255,0.08)', animation: 'fadeIn 0.12s ease-out' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {sharing && !isLocal && (
                  <>
                    <button 
                      onClick={() => { onStopViewing?.(); setShowOptions(false); }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#dbdee1', fontSize: '14px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      {isViewing ? t('call.stop_viewing', 'Dejar de ver') : t('call.start_viewing', 'Ver transmisión')} 
                      <EyeOff size={16} />
                    </button>
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />
                    <div 
                      onClick={(e) => { e.stopPropagation(); onMuteToggle?.(!muted); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <span style={{ color: '#dbdee1', fontSize: '14px', fontWeight: 500 }}>{t('call.mute', 'Silenciar')}</span>
                      <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: muted ? '#ed4245' : '#4e5058', position: 'relative', transition: 'background-color 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: muted ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#949ba4', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('call.stream_volume', 'Volumen de la transmisión')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="range" min="0" max="100" value={volValue}
                          onChange={(e) => { const v = parseInt(e.target.value); setVolValue(v); onVolumeChange?.(v); }}
                          style={{ flex: 1, accentColor: '#5865f2', cursor: 'pointer', height: '4px' }}
                        />
                        <span style={{ color: '#dbdee1', fontSize: '11px', width: '32px', textAlign: 'right' }}>{volValue}%</span>
                      </div>
                    </div>
                  </>
                )}
                
                {sharing && isLocal && (
                  <>
                    <button 
                      onClick={() => { onStopSharing?.(); setShowOptions(false); }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#ed4245', fontSize: '14px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      {t('call.stop_sharing', 'Dejar de transmitir')} <X size={18} />
                    </button>
                    <button 
                      onClick={() => { onChangeSource?.(); setShowOptions(false); }}
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: 'none', backgroundColor: 'transparent', color: '#dbdee1', fontSize: '14px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                    >
                      {t('call.change_stream', 'Cambiar transmisión')} <Repeat size={18} />
                    </button>
                  </>
                )}

                {!sharing && !isLocal && (
                  <>
                    <div 
                      onClick={(e) => { e.stopPropagation(); onMuteToggle?.(!muted); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', cursor: 'pointer' }}
                    >
                      <span style={{ color: '#dbdee1', fontSize: '14px', fontWeight: 500 }}>{t('call.mute', 'Silenciar')}</span>
                      <div style={{ width: '36px', height: '20px', borderRadius: '10px', backgroundColor: muted ? '#ed4245' : '#4e5058', position: 'relative', transition: 'background-color 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: muted ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.2s' }} />
                      </div>
                    </div>
                    <div style={{ padding: '8px 12px' }}>
                      <div style={{ fontSize: '11px', color: '#949ba4', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>{t('call.user_volume', 'Volumen del usuario')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <input
                          type="range" min="0" max="100" value={volValue}
                          onChange={(e) => { const v = parseInt(e.target.value); setVolValue(v); onVolumeChange?.(v); }}
                          style={{ flex: 1, accentColor: '#5865f2', cursor: 'pointer', height: '4px' }}
                        />
                        <span style={{ color: '#dbdee1', fontSize: '11px', width: '32px', textAlign: 'right' }}>{volValue}%</span>
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>
        </>,
        document.body
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
});

export default VideoTile;
