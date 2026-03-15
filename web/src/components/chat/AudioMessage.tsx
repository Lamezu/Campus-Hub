import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface AudioMessageProps {
  url: string;
  duration: number;
  isOwnMessage: boolean;
}

const WAVE_BARS = [4, 8, 12, 7, 14, 6, 11, 9, 13, 5, 10, 7, 12, 5];
const SPEEDS = [1, 1.5, 2] as const;

function formatAudioTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function toMp3Url(url: string): string {
  if (!url.includes('cloudinary.com')) return url;
  return url
    .replace('/upload/', '/upload/f_mp3,q_auto/')
    .replace(/\.[^/.]+$/, '.mp3');
}

export default function AudioMessage({ url, duration, isOwnMessage }: AudioMessageProps) {
  const { colors } = useTheme();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(duration);
  const [speedIndex, setSpeedIndex] = useState(0);

  const audioUrl = toMp3Url(url);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      const dur = audio.duration || duration;
      setProgress(audio.currentTime / dur);
      setCurrentSeconds(Math.max(0, Math.ceil(dur - audio.currentTime)));
    };

    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentSeconds(duration);
    };

    return () => {
      audio.pause();
      audio.ontimeupdate = null;
      audio.onended = null;
      audioRef.current = null;
    };
  }, [audioUrl, duration]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = SPEEDS[speedIndex];
      audio.play();
      setIsPlaying(true);
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  };

  const btnBg = isOwnMessage ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.08)';
  const iconColor = isOwnMessage ? '#FFFFFF' : colors.primary;
  const waveOn = isOwnMessage ? 'rgba(255,255,255,1)' : colors.primary;
  const waveOff = isOwnMessage ? 'rgba(255,255,255,0.35)' : colors.primary + '59';
  const timerColor = isOwnMessage ? 'rgba(255,255,255,0.8)' : colors.textSecondary;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '180px' }}>
      <button
        onClick={togglePlay}
        style={{
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.3)' : colors.border}`,
          backgroundColor: btnBg,
          color: iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          padding: 0,
        }}
      >
        {isPlaying
          ? <Pause size={15} fill={iconColor} color={iconColor} />
          : <Play size={15} fill={iconColor} color={iconColor} />
        }
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flex: 1 }}>
        {WAVE_BARS.map((h, i) => (
          <div
            key={i}
            style={{
              width: '3px',
              height: `${h * 2}px`,
              borderRadius: '2px',
              backgroundColor: (i / WAVE_BARS.length) < progress ? waveOn : waveOff,
              transition: 'background-color 0.1s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0 }}>
        <span style={{ fontSize: '11px', color: timerColor, fontVariantNumeric: 'tabular-nums' as const }}>
          {formatAudioTime(currentSeconds)}
        </span>
        {isPlaying && (
          <button
            onClick={cycleSpeed}
            style={{
              background: isOwnMessage ? 'rgba(255,255,255,0.2)' : colors.primary + '22',
              border: 'none',
              borderRadius: '10px',
              padding: '1px 6px',
              fontSize: '10px',
              fontWeight: '600',
              color: isOwnMessage ? '#FFFFFF' : colors.primary,
              cursor: 'pointer',
              lineHeight: '14px',
            }}
          >
            {SPEEDS[speedIndex]}×
          </button>
        )}
      </div>
    </div>
  );
}
