import { ChevronRight, Settings } from 'lucide-react';
import { VolumeSlider } from './CallUIComponents';
import type { CallType } from '../../../services/firebase/callService';

const sinkIdSupported = typeof (document.createElement('audio') as HTMLAudioElement & { setSinkId?: unknown }).setSinkId === 'function';

interface DevicePanelProps {
  show: boolean;
  subPanel: 'input' | 'output' | null;
  setSubPanel: React.Dispatch<React.SetStateAction<'input' | 'output' | null>>;
  showCamPicker: boolean;
  setShowCamPicker: (v: boolean) => void;
  devices: MediaDeviceInfo[];
  selectedMicId: string;
  selectedSpeakerId: string;
  selectedCamId: string;
  callType: CallType;
  isMobile: boolean;
  onChangeAudioInput: (deviceId: string) => void;
  onChangeAudioOutput: (deviceId: string) => void;
  onChangeVideoInput: (deviceId: string) => void;
  onInputVolume: (v: number) => void;
  onOutputVolume: (v: number) => void;
  t: (key: string) => string;
}

export function DevicePanel({
  show, subPanel, setSubPanel, showCamPicker, setShowCamPicker,
  devices, selectedMicId, selectedSpeakerId, selectedCamId,
  callType, isMobile,
  onChangeAudioInput, onChangeAudioOutput, onChangeVideoInput,
  onInputVolume, onOutputVolume, t
}: DevicePanelProps) {
  return (
    <>
      {show && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)',
          ...(isMobile ? { left: 12, right: 12, width: 'auto' } : { left: '50%', transform: 'translateX(-50%)', width: 280 }),
          backgroundColor: '#111214', borderRadius: 8,
          zIndex: 30, boxShadow: '0 16px 32px rgba(0,0,0,0.8)'
        }}>
          <button className="dev-row" onClick={() => setSubPanel(p => p === 'input' ? null : 'input')}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{t('call.input_device')}</div>
              <div style={{ fontSize: 12, color: '#72767d', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                {devices.find(d => d.kind === 'audioinput' && d.deviceId === selectedMicId)?.label || t('call.microphone')}
              </div>
            </div>
            <ChevronRight size={16} style={{ flexShrink: 0, color: subPanel === 'input' ? '#5865f2' : '#72767d' }} />
          </button>

          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

          {sinkIdSupported && (
            <>
              <button className="dev-row" onClick={() => setSubPanel(p => p === 'output' ? null : 'output')}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{t('call.output_device')}</div>
                  <div style={{ fontSize: 12, color: '#72767d', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 210 }}>
                    {devices.find(d => d.kind === 'audiooutput' && d.deviceId === selectedSpeakerId)?.label || t('call.default_speaker')}
                  </div>
                </div>
                <ChevronRight size={16} style={{ flexShrink: 0, color: subPanel === 'output' ? '#5865f2' : '#72767d' }} />
              </button>
              <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />
            </>
          )}

          <div style={{ padding: '11px 16px' }}>
            <div style={{ fontSize: 13, color: '#b9bbbe', marginBottom: 10 }}>{t('call.input_volume')}</div>
            <VolumeSlider initialValue={100} onChange={onInputVolume} />
          </div>

          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)' }} />

          <div style={{ padding: '11px 16px' }}>
            <div style={{ fontSize: 13, color: '#b9bbbe', marginBottom: 10 }}>{t('call.output_volume')}</div>
            <VolumeSlider initialValue={100} onChange={onOutputVolume} />
          </div>
        </div>
      )}

      {show && subPanel !== null && (
        <div style={{
          position: 'absolute',
          ...(isMobile
            ? { bottom: 'calc(100% + 8px)', left: 12, right: 12, width: 'auto' }
            : { bottom: 'calc(100% + 8px)', left: 'calc(50% + 148px)', width: 260 }),
          backgroundColor: '#111214', borderRadius: 8,
          zIndex: 31, boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
          maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden'
        }}>
          {subPanel === 'input' && devices.filter(d => d.kind === 'audioinput').map(d => (
            <button key={d.deviceId} className="dev-row" onClick={() => { onChangeAudioInput(d.deviceId); setSubPanel(null); }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || t('call.microphone')}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${selectedMicId === d.deviceId ? '#5865f2' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedMicId === d.deviceId && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#5865f2' }} />}
              </div>
            </button>
          ))}
          {subPanel === 'output' && devices.filter(d => d.kind === 'audiooutput').map(d => (
            <button key={d.deviceId} className="dev-row" onClick={() => { onChangeAudioOutput(d.deviceId); setSubPanel(null); }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || t('call.speaker')}</div>
              </div>
              <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: `2px solid ${selectedSpeakerId === d.deviceId ? '#5865f2' : 'rgba(255,255,255,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {selectedSpeakerId === d.deviceId && <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: '#5865f2' }} />}
              </div>
            </button>
          ))}
        </div>
      )}

      {showCamPicker && callType === 'video' && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)',
          ...(isMobile ? { left: 12, right: 12, width: 'auto' } : { left: '50%', transform: 'translateX(-50%)', width: 280 }),
          backgroundColor: '#111214', borderRadius: 8,
          zIndex: 30, boxShadow: '0 16px 32px rgba(0,0,0,0.8)',
          maxHeight: '60vh', overflowY: 'auto', overflowX: 'hidden'
        }}>
          <div style={{ padding: '11px 16px 4px' }}>
            <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>{t('call.camera')}</div>
            <div style={{ fontSize: 12, color: '#72767d', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {devices.find(d => d.kind === 'videoinput' && d.deviceId === selectedCamId)?.label || t('call.default_camera')}
            </div>
          </div>
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '8px 0 4px' }} />
          {devices.filter(d => d.kind === 'videoinput').map(d => (
            <button key={d.deviceId} className="dev-sub" onClick={() => onChangeVideoInput(d.deviceId)}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', flexShrink: 0, backgroundColor: selectedCamId === d.deviceId ? '#5865f2' : 'transparent', border: '1.5px solid rgba(255,255,255,0.25)' }} />
              <span style={{ fontSize: 13, color: selectedCamId === d.deviceId ? '#fff' : '#b9bbbe', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.label || t('call.camera')}</span>
            </button>
          ))}
          <div style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.06)', margin: '4px 0 0' }} />
          <button className="dev-row" onClick={() => setShowCamPicker(false)}>
            <span style={{ fontSize: 13, color: '#fff' }}>{t('call.video_settings')}</span>
            <Settings size={15} color="#72767d" style={{ flexShrink: 0 }} />
          </button>
        </div>
      )}
    </>
  );
}
