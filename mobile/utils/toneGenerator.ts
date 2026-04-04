import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

const SAMPLE_RATE = 44100;

interface ToneSegment {
  freq: number;
  harmonics?: Array<{ freq: number; amp: number }>;
  duration: number;
  amplitude?: number;
  fadeIn?: number;
  fadeOut?: number;
  expDecay?: number;
}

const E5 = 659.25;
const G5 = 783.99;  const A5 = 880.00;

const TONE_DEFINITIONS: Record<string, ToneSegment[]> = {
  default: [
    { freq: E5, duration: 0.11, amplitude: 0.24, fadeIn: 0.04, fadeOut: 0.18, expDecay: 6.0 },
    { freq: G5, duration: 0.11, amplitude: 0.24, fadeIn: 0.04, fadeOut: 0.18, expDecay: 6.0 },
    { freq: A5, duration: 0.22, amplitude: 0.22, fadeIn: 0.04, fadeOut: 0.22, expDecay: 3.5 },
  ],
  classic: [
    { freq: G5, duration: 0.14, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 5.0 },
    { freq: E5, duration: 0.14, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 5.0 },
    { freq: G5, duration: 0.28, amplitude: 0.20, fadeIn: 0.05, fadeOut: 0.25, expDecay: 3.0 },
  ],
  soft: [
    { freq: E5, duration: 0.18, amplitude: 0.16, fadeIn: 0.12, fadeOut: 0.25, expDecay: 2.5 },
    { freq: G5, duration: 0.18, amplitude: 0.15, fadeIn: 0.10, fadeOut: 0.25, expDecay: 2.5 },
    { freq: A5, duration: 0.30, amplitude: 0.14, fadeIn: 0.10, fadeOut: 0.28, expDecay: 2.0 },
  ],
  melody: [
    { freq: E5, duration: 0.10, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 9.0 },
    { freq: G5, duration: 0.10, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 9.0 },
    { freq: A5, duration: 0.10, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 9.0 },
    { freq: G5, duration: 0.10, amplitude: 0.22, fadeIn: 0.05, fadeOut: 0.20, expDecay: 9.0 },
    { freq: E5, duration: 0.24, amplitude: 0.20, fadeIn: 0.04, fadeOut: 0.25, expDecay: 3.5 },
  ],
  bell: [
    { freq: A5, harmonics: [{ freq: 1108.73, amp: 0.18 }, { freq: 2093.00, amp: 0.06 }], duration: 0.90, amplitude: 0.16, fadeIn: 0.008, fadeOut: 0.15, expDecay: 2.5 },
  ],
  pulse: [
    { freq: G5, duration: 0.07, amplitude: 0.22, fadeIn: 0.03, fadeOut: 0.20, expDecay: 14 },
    { freq: 0, duration: 0.04 },
    { freq: G5, duration: 0.07, amplitude: 0.22, fadeIn: 0.03, fadeOut: 0.20, expDecay: 14 },
    { freq: 0, duration: 0.04 },
    { freq: A5, duration: 0.18, amplitude: 0.22, fadeIn: 0.03, fadeOut: 0.22, expDecay: 7.0 },
  ],
  none: [],
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? B64[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? B64[b2 & 63] : '=';
  }
  return out;
}

function buildWavBase64(segments: ToneSegment[]): string {
  const totalSamples = segments.reduce(
    (acc, s) => acc + Math.floor(s.duration * SAMPLE_RATE), 0
  );
  const dataSize = totalSamples * 2;
  const buf = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buf);

  const ws = (off: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };

  ws(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  ws(8, 'WAVE');
  ws(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ws(36, 'data');
  view.setUint32(40, dataSize, true);

  let off = 44;
  let continuousTime = 0;

  for (const seg of segments) {
    const n = Math.floor(seg.duration * SAMPLE_RATE);
    if (seg.freq !== 0) {
      const amp = seg.amplitude ?? 0.55;
      const harmonics = seg.harmonics ?? [];
      const normFactor = 1 + harmonics.reduce((s, h) => s + h.amp, 0);
      const fadeInSamples  = Math.floor((seg.fadeIn  ?? 0) * n);
      const fadeOutSamples = Math.floor((seg.fadeOut ?? 0) * n);

      for (let i = 0; i < n; i++) {
        const t = continuousTime + i / SAMPLE_RATE;

        let env: number;
        if (i < fadeInSamples) {
          env = i / Math.max(1, fadeInSamples - 1);
        } else if (seg.expDecay !== undefined) {
          const decayI = i - fadeInSamples;
          const decayN = Math.max(1, n - fadeInSamples);
          env = Math.exp(-seg.expDecay * decayI / decayN);
        } else {
          env = 1.0;
        }

        const fromEnd = n - 1 - i;
        if (fadeOutSamples > 0 && fromEnd < fadeOutSamples) {
          env *= fromEnd / Math.max(1, fadeOutSamples - 1);
        }

        let wave = Math.sin(2 * Math.PI * seg.freq * t);
        for (const h of harmonics) {
          wave += h.amp * Math.sin(2 * Math.PI * h.freq * t);
        }
        wave /= normFactor;

        const raw = amp * env * wave;
        const abs = Math.abs(raw);
        const sample = abs > 0.32
          ? Math.sign(raw) * (0.32 + 0.68 * Math.tanh((abs - 0.32) / 0.68))
          : raw;
        const s16 = Math.round(Math.max(-1, Math.min(1, sample)) * 32767);
        view.setInt16(off, s16, true);
        off += 2;
      }
    } else {
      for (let i = 0; i < n; i++) {
        view.setInt16(off, 0, true);
        off += 2;
      }
    }
    continuousTime += seg.duration;
  }

  return toBase64(new Uint8Array(buf));
}

let activeSound: Audio.Sound | null = null;
let isAudioModeSet = false;
const toneCache: Record<string, string> = {};

export async function prewarmTones(): Promise<void> {
  try {
    if (!isAudioModeSet) {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });
      isAudioModeSet = true;
    }

    const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';

    for (const name of Object.keys(TONE_DEFINITIONS)) {
      if (name === 'none') continue;
      if (toneCache[name]) continue;

      const segments = TONE_DEFINITIONS[name];
      const base64 = buildWavBase64(segments);
      const path = `${cacheDir}tone_cache_${name}.wav`;

      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
      toneCache[name] = path;
    }
  } catch (e) {
    console.warn('[toneGenerator] Error in prewarmTones:', e);
  }
}

export async function previewTone(name: string): Promise<void> {
  const key = name.toLowerCase();
  if (key === 'none') return;
  const segments = TONE_DEFINITIONS[key];
  if (!segments || segments.length === 0) return;

  try {
    const cachedPath = toneCache[name];
    let path = cachedPath;

    if (!path) {
      const base64 = buildWavBase64(segments);
      const cacheDir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      path = `${cacheDir}tone_temp_${Date.now()}.wav`;
      await FileSystem.writeAsStringAsync(path, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    if (activeSound) {
      try {
        await activeSound.stopAsync();
        await activeSound.unloadAsync();
      } catch (e) { }
      activeSound = null;
    }

    const { sound } = await Audio.Sound.createAsync(
      { uri: path },
      { shouldPlay: true, volume: 1.0, isMuted: false }
    );
    activeSound = sound;

    sound.setOnPlaybackStatusUpdate(async (status) => {
      if (status.isLoaded && status.didJustFinish) {
        try {
          await sound.unloadAsync();
          if (!cachedPath) await FileSystem.deleteAsync(path!, { idempotent: true });
        } catch (e) { }
        if (activeSound === sound) activeSound = null;
      }
    });
  } catch (e) {
    console.warn('[toneGenerator] Error playing tone:', e);
  }
}
