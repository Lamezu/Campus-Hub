import { useState, useEffect, useRef } from 'react';
import { Search, X, Play, Pause, Check, Music } from 'lucide-react';
import { searchTracks } from '../config/jamendo';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from '../hooks/useTranslation';
import type { JamendoTrack } from '../types';

interface SongPickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (track: JamendoTrack | null) => void;
  selected: JamendoTrack | null;
}

export function SongPicker({ visible, onClose, onSelect, selected }: SongPickerProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<JamendoTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setTracks([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setTracks(await searchTracks(query));
      } catch {
        setTracks([]);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const stopPreview = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
  };

  const togglePreview = (track: JamendoTrack) => {
    if (playingId === track.id) {
      stopPreview();
      return;
    }
    stopPreview();
    setPlayingId(track.id);
    const audio = new Audio(track.audioUrl);
    audioRef.current = audio;
    audio.play().catch(() => setPlayingId(null));
    audio.onended = () => setPlayingId(null);
  };

  const handleClose = () => {
    stopPreview();
    onClose();
  };

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
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 600,
          height: '80vh',
          backgroundColor: colors.background,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: `1px solid ${colors.border}`,
          }}
        >
          <span style={{ fontSize: 18, fontWeight: '600', color: colors.text }}>
            {t('song_picker.title')}
          </span>
          <button
            onClick={handleClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.primary, fontWeight: '600', fontSize: 15 }}
          >
            {t('common.close')}
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            margin: 16,
            padding: '8px 12px',
            backgroundColor: colors.backgroundSecondary,
            borderRadius: 12,
          }}
        >
          <Search size={18} color={colors.textSecondary} />
          <input
            autoFocus
            type="text"
            placeholder={t('song_picker.search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 16,
              color: colors.text,
            }}
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
            >
              <X size={18} color={colors.textSecondary} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                border: `3px solid ${colors.backgroundSecondary}`,
                borderTopColor: colors.primary,
                animation: 'spin 0.8s linear infinite',
              }} />
            </div>
          ) : tracks.length === 0 ? (
            <p style={{ textAlign: 'center', color: colors.textSecondary, padding: 32, fontSize: 14 }}>
              {query.trim() ? t('song_picker.no_results') : t('song_picker.search_prompt')}
            </p>
          ) : (
            tracks.map((track) => {
              const isSelected = selected?.id === track.id;
              const isPlaying = playingId === track.id;
              return (
                <div
                  key={track.id}
                  onClick={() => handleSelect(track)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '8px 16px',
                    borderBottom: `1px solid ${colors.border}`,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? colors.primary + '18' : 'transparent',
                  }}
                >
                  {track.coverUrl ? (
                    <img
                      src={track.coverUrl}
                      alt={track.name}
                      style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 48, height: 48, borderRadius: 8,
                      backgroundColor: colors.backgroundSecondary,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Music size={20} color={colors.textSecondary} />
                    </div>
                  )}

                  <div style={{ flex: 1, marginLeft: 8, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: '600', color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.name}
                    </div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {track.artistName}
                    </div>
                  </div>

                  <button
                    onClick={(e) => { e.stopPropagation(); togglePreview(track); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: colors.primary }}
                  >
                    {isPlaying
                      ? <Pause size={34} color={colors.primary} />
                      : <Play size={34} color={colors.primary} />
                    }
                  </button>

                  {isSelected && (
                    <Check size={22} color={colors.primary} style={{ marginLeft: 4, flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
