import React, { useState, useRef } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { useTranslation } from '../../hooks/useTranslation';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react';

interface ChatBackgroundEditorProps {
  imageUrl: string;
  onClose: () => void;
  onSave: (themeId: string, offsetX: number, offsetY: number, scale: number) => void;
}

export default function ChatBackgroundEditor({ imageUrl, onClose, onSave }: ChatBackgroundEditorProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPos.current.x;
    const dy = e.clientY - lastPos.current.y;
    lastPos.current = { x: e.clientX, y: e.clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleMouseUp = () => { dragging.current = false; };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      dragging.current = true;
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - lastPos.current.x;
    const dy = e.touches[0].clientY - lastPos.current.y;
    lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  };

  const handleTouchEnd = () => { dragging.current = false; };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.max(0.5, Math.min(4, prev - e.deltaY * 0.001)));
  };

  const handleSave = () => {
    onSave(`custom_${Date.now()}`, offset.x, offset.y, scale);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 2000, backgroundColor: '#000', userSelect: 'none' }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div
        style={{ position: 'absolute', inset: 0, overflow: 'hidden', cursor: dragging.current ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      >
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center',
            pointerEvents: 'none',
          }}
        />
      </div>

      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '20px 24px 180px', gap: 10 }}>
        <div style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', fontSize: 14, color: '#1c1c1c', maxWidth: '70%' }}>
          {t('chat.settings.sample_message')}
        </div>
        <div style={{ alignSelf: 'flex-end', backgroundColor: `${colors.primary}EE`, borderRadius: '18px 18px 4px 18px', padding: '10px 14px', fontSize: 14, color: '#fff', maxWidth: '70%' }}>
          {t('chat.settings.background_editor.sample_reply')}
        </div>
        <div style={{ alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: '18px 18px 18px 4px', padding: '10px 14px', fontSize: 14, color: '#1c1c1c', maxWidth: '70%' }}>
          {t('chat.settings.background_editor.drag_to_adjust')}
        </div>
      </div>

      <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={() => setScale(s => Math.min(4, +(s + 0.25).toFixed(2)))}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ZoomIn size={20} color="#fff" />
        </button>
        <button
          onClick={() => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)))}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.22)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <ZoomOut size={20} color="#fff" />
        </button>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '24px 32px 36px', backgroundColor: 'rgba(0,0,0,0.62)', backdropFilter: 'blur(14px)', borderRadius: '28px 28px 0 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{t('chat.settings.background_editor.title')}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>{t('chat.settings.background_editor.hint')}</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 28 }}>
          <button
            onClick={onClose}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={24} color="#fff" />
          </button>
          <button
            onClick={handleSave}
            style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <Check size={24} color="#fff" />
          </button>
        </div>
      </div>
    </div>
  );
}
