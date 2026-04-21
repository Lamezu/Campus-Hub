import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Pause, CheckCircle, Music } from 'lucide-react';
import { searchTracks } from '@/config/jamendo';
import { ThemedText } from './themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { spacing, typography } from '@/constants/styles';
import type { JamendoTrack } from '@/types';

interface SongPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: JamendoTrack | null) => void;
  selected: JamendoTrack | null;
}

export function SongPicker({ visible, onClose, onSelect, selected }: SongPickerProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!query.trim()) { setTracks([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try { setTracks(await searchTracks(query)); }
      catch { setTracks([]); }
      finally { setLoading(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  const togglePreview = (track: JamendoTrack) => {
    if (playingId === track.id) { stopPreview(); return; }
    stopPreview();
    const audio = new Audio(track.audioUrl);
    audio.play();
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const handleClose = () => { stopPreview(); onClose(); };
  const handleSelect = (track: JamendoTrack) => {
    stopPreview();
    onSelect(selected?.id === track.id ? null : track);
    onClose();
  };

  if (!visible) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 600, height: '80vh',
          backgroundColor: colors.background,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md, borderBottom: `1px solid ${colors.border}` }}>
          <ThemedText style={{ fontSize: typography.sizes.lg, fontWeight: '600', color: colors.text }}>Elegir canción</ThemedText>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: '600', fontSize: 16 }}>Cerrar</button>
        </div>

        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, margin: spacing.md, padding: `${spacing.sm}px ${spacing.md}px`, backgroundColor: colors.backgroundSecondary, borderRadius: 12 }}>
          <Search size={18} color={colors.textSecondary} />
          <input
            type="text"
            autoFocus
            placeholder="Buscar canción o artista..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent',
              fontSize: typography.sizes.md, color: colors.text,
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={18} color={colors.textSecondary} />
            </button>
          )}
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: spacing.xl }}>
              <div style={{ width: 32, height: 32, border: `3px solid ${colors.backgroundSecondary}`, borderTop: `3px solid ${colors.primary}`, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          ) : tracks.length === 0 ? (
            <ThemedText style={{ textAlign: 'center', fontSize: typography.sizes.sm, color: colors.textSecondary, padding: spacing.xl, display: 'block' }}>
              {query.trim() ? 'No se encontraron canciones' : 'Busca una canción para añadir a tu post'}
            </ThemedText>
          ) : (
            tracks.map(item => {
              const isSelected = selected?.id === item.id;
              const isPlaying = playingId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: spacing.sm,
                    padding: `${spacing.sm}px ${spacing.md}px`,
                    borderBottom: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? `${colors.primary}18` : 'transparent',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.backgroundColor = colors.backgroundSecondary;}}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = isSelected ? `${colors.primary}18` : 'transparent';}}
                >
                  {item.coverUrl ? (
                    <img src={item.coverUrl} alt={item.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: colors.backgroundSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Music size={20} color={colors.textSecondary} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <ThemedText numberOfLines={1} style={{ fontSize: typography.sizes.sm, fontWeight: '600', color: colors.text, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</ThemedText>
                    <ThemedText numberOfLines={1} style={{ fontSize: typography.sizes.xs, color: colors.textSecondary, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.artistName}</ThemedText>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); togglePreview(item); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: spacing.xs, color: colors.primary }}
                  >
                    {isPlaying ? <Pause size={34} color={colors.primary} /> : <Play size={34} color={colors.primary} />}
                  </button>
                  {isSelected && <CheckCircle size={22} color={colors.primary} />}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
