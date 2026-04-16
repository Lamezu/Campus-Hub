import { memo, useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import { ChevronUp } from 'lucide-react';

export interface CtrlBtnProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  muted?: boolean;
  green?: boolean;
  danger?: boolean;
  active?: boolean;
  mobile?: boolean;
}

export function CtrlBtn({ icon, label, onClick, muted, green, danger, active, mobile }: CtrlBtnProps) {
  const [hovered, setHovered] = useState(false);
  const bg = danger || muted ? '#ed4245' : green ? '#23a55a' : active ? '#5865f2' : 'rgba(79,84,92,0.75)';
  const size = mobile ? 44 : 48;
  return (
    <div
      style={{ position: 'relative', cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={() => !mobile && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !mobile && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#111214', color: '#fff', fontSize: 12, fontWeight: 500,
          padding: '5px 10px', borderRadius: 5, whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)', pointerEvents: 'none', zIndex: 100
        }}>
          {label}
        </div>
      )}
      <div style={{
        width: size, height: size, borderRadius: '50%', backgroundColor: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff',
        transition: 'background-color 0.15s'
      }}>
        {icon}
      </div>
    </div>
  );
}

export interface CompoundBtnProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  onChevron: () => void;
  muted?: boolean;
  chevronActive?: boolean;
  mobile?: boolean;
}

export function CompoundBtn({ icon, label, onClick, onChevron, muted, chevronActive, mobile }: CompoundBtnProps) {
  const [hovered, setHovered] = useState(false);
  const bg = muted ? '#ed4245' : 'rgba(79,84,92,0.75)';
  const size = mobile ? 44 : 48;
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => !mobile && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {hovered && !mobile && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
          backgroundColor: '#111214', color: '#fff', fontSize: 12, fontWeight: 500,
          padding: '5px 10px', borderRadius: 5, whiteSpace: 'nowrap',
          boxShadow: '0 4px 12px rgba(0,0,0,0.6)', pointerEvents: 'none', zIndex: 100
        }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button onClick={onClick} style={{
          width: size, height: size, borderRadius: '50%', backgroundColor: bg,
          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
          justifyContent: 'center', color: '#fff', transition: 'background-color 0.15s'
        }}>
          {icon}
        </button>
        <button onClick={onChevron} style={{
          width: mobile ? 20 : 18, height: mobile ? 20 : 18, borderRadius: 4,
          backgroundColor: chevronActive ? '#5865f2' : 'rgba(79,84,92,0.8)',
          border: 'none', cursor: 'pointer', color: '#b9bbbe',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginLeft: 2, flexShrink: 0
        }}>
          <ChevronUp size={11} />
        </button>
      </div>
    </div>
  );
}

export const VolumeSlider = memo(function VolumeSlider({ initialValue, onChange }: { initialValue: number; onChange: (v: number) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.style.background = `linear-gradient(to right, #5865f2 ${initialValue}%, #4f545c ${initialValue}%)`;
  }, []);
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value);
    if (ref.current) ref.current.style.background = `linear-gradient(to right, #5865f2 ${v}%, #4f545c ${v}%)`;
    onChange(v);
  }, [onChange]);
  return <input ref={ref} type="range" min={0} max={100} defaultValue={initialValue} onChange={handleChange} className="call-range" />;
});
