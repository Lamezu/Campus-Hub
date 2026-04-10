import React, { useState, useRef, useEffect } from 'react';
import { X, Check, ZoomIn, ZoomOut, Move } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ThemedText } from '@/components/themed-text';

interface ChatBackgroundEditorProps {
  imageUri: string;
  onClose: () => void;
  onSave: (url: string, x: number, y: number, scale: number) => void;
}

export function ChatBackgroundEditor({ imageUri, onClose, onSave }: ChatBackgroundEditorProps) {
  const { colors } = useTheme();
  
  // States for transform
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Handle Zoom with Wheel (using manual listener for passive: false)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelManual = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setScale(prev => Math.max(1, Math.min(prev + delta, 5)));
    };

    container.addEventListener('wheel', handleWheelManual, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelManual);
  }, []);

  // Handle Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !containerRef.current) return;
    
    const container = containerRef.current;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    
    // Calculate boundaries relative to scale
    // If scale is 1, and object-fit covers, we are already at boundary
    // The width of the image is at least cw * scale (because of object-fit: cover)
    const maxX = (cw * scale - cw) / 2;
    const maxY = (ch * scale - ch) / 2;

    const newX = e.clientX - startPos.x;
    const newY = e.clientY - startPos.y;

    setOffset({
      x: Math.max(-maxX, Math.min(newX, maxX)),
      y: Math.max(-maxY, Math.min(newY, maxY))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset if image changes or on mount
  useEffect(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [imageUri]);

  return (
    <div style={{
      position: 'fixed', inset: 0, 
      backgroundColor: 'rgba(0,0,0,0.9)', 
      zIndex: 3000, 
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      backdropFilter: 'blur(10px)'
    }}>
      {/* Header */}
      <div style={{ 
        width: '100%', maxWidth: 1000, 
        padding: '20px', 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        color: '#fff'
      }}>
        <div>
          <ThemedText style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>Editar fondo de chat</ThemedText>
          <ThemedText style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Arrastra para mover y usa la rueda del ratón para hacer zoom</ThemedText>
        </div>
        <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', padding: 10, cursor: 'pointer', color: '#fff' }}>
          <X size={24} />
        </button>
      </div>

      {/* Editor Main Area */}
      <div 
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        ref={containerRef}
        style={{ 
          width: '90%', maxWidth: 1000, 
          aspectRatio: '16/9', 
          backgroundColor: '#111', 
          borderRadius: 24, 
          overflow: 'hidden', 
          position: 'relative',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
          cursor: isDragging ? 'grabbing' : 'grab',
          userSelect: 'none',
          WebkitUserSelect: 'none'
        } as any}
      >
        {/* The Image */}
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none'
        }}>
          <img 
            src={imageUri} 
            alt="" 
            draggable="false"
            style={{ 
              width: '100%', height: '100%', 
              objectFit: 'cover',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              userSelect: 'none'
            }}
          />
        </div>

        {/* Preview Overlay (Chat Bubbles) */}
        <div style={{ 
          position: 'absolute', inset: 0, 
          padding: 40, 
          display: 'flex', flexDirection: 'column', 
          justifyContent: 'flex-end',
          pointerEvents: 'none'
        }}>
          <div style={{ 
            alignSelf: 'flex-start', 
            backgroundColor: `${colors.backgroundSecondary}CC`, 
            padding: '12px 16px', 
            borderRadius: 20, 
            borderBottomLeftRadius: 4,
            marginBottom: 12,
            backdropFilter: 'blur(4px)',
            maxWidth: '60%'
          }}>
            <ThemedText style={{ fontSize: 14 }}>¡Este fondo se ve increíble!</ThemedText>
          </div>
          <div style={{ 
            alignSelf: 'flex-end', 
            backgroundColor: `${colors.primary}CC`, 
            padding: '12px 16px', 
            borderRadius: 20, 
            borderBottomRightRadius: 4,
            backdropFilter: 'blur(4px)',
            maxWidth: '60%',
            color: '#fff'
          }}>
            <ThemedText style={{ fontSize: 14, color: '#fff' }}>Sí, me encanta cómo queda con mis mensajes.</ThemedText>
          </div>
        </div>

        {/* Zoom Indicator */}
        <div style={{
          position: 'absolute', bottom: 20, right: 20,
          backgroundColor: 'rgba(0,0,0,0.6)', padding: '8px 16px',
          borderRadius: 20, color: '#fff', fontSize: 12, fontWeight: 700,
          backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <ZoomIn size={14} /> {Math.round(scale * 100)}%
        </div>
      </div>

      {/* Controls / Footer */}
      <div style={{ 
        marginTop: 40, 
        display: 'flex', gap: 20,
        width: '100%', maxWidth: 400
      }}>
        <button 
          onClick={onClose}
          style={{ 
            flex: 1, padding: '16px', borderRadius: 16, 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            border: 'none', color: '#fff', fontWeight: 700, 
            cursor: 'pointer' 
          }}
        >
          Cancelar
        </button>
        <button 
          onClick={() => {
            if (containerRef.current) {
              const cw = containerRef.current.clientWidth;
              const ch = containerRef.current.clientHeight;
              // Calculamos el % relativo al contenedor real (cw, ch)
              // En CSS, translate(X%, Y%) se calcula sobre el tamaño base del elemento
              const pctX = offset.x / cw;
              const pctY = offset.y / ch;
              onSave(imageUri, pctX, pctY, scale);
            }
          }}
          style={{ 
            flex: 1, padding: '16px', borderRadius: 16, 
            backgroundColor: colors.primary, 
            border: 'none', color: '#fff', fontWeight: 700, 
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
          }}
        >
          <Check size={20} /> Guardar fondo
        </button>
      </div>

      <style>{`
        body { overflow: hidden; }
      `}</style>
    </div>
  );
}
