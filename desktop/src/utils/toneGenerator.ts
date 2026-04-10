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

export const TONE_DEFINITIONS: Record<string, ToneSegment[]> = {
  default: [
    { freq: 1047, harmonics: [{ freq: 2093, amp: 0.3 }], duration: 0.09, amplitude: 0.52, fadeIn: 0.04, expDecay: 5 },
    { freq: 0, duration: 0.03 },
    { freq: 1319, harmonics: [{ freq: 2637, amp: 0.25 }], duration: 0.24, amplitude: 0.55, fadeIn: 0.02, expDecay: 4.5 },
  ],
  classic: [
    { freq: 880, harmonics: [{ freq: 1320, amp: 0.45 }, { freq: 1760, amp: 0.2 }], duration: 0.4, amplitude: 0.5, fadeIn: 0.01, expDecay: 2.5 },
    { freq: 0, duration: 0.06 },
    { freq: 659, harmonics: [{ freq: 990, amp: 0.4 }], duration: 0.4, amplitude: 0.48, fadeIn: 0.01, expDecay: 2.5 },
  ],
  soft: [
    { freq: 523, harmonics: [{ freq: 784, amp: 0.35 }, { freq: 1047, amp: 0.2 }], duration: 0.6, amplitude: 0.4, fadeIn: 0.14, expDecay: 1.8 },
    { freq: 0, duration: 0.05 },
    { freq: 659, harmonics: [{ freq: 988, amp: 0.3 }], duration: 0.55, amplitude: 0.38, fadeIn: 0.1, expDecay: 1.8 },
  ],
  melody: [
    { freq: 1047, harmonics: [{ freq: 2093, amp: 0.25 }], duration: 0.1, amplitude: 0.52, fadeIn: 0.02, expDecay: 6 },
    { freq: 0, duration: 0.04 },
    { freq: 1319, harmonics: [{ freq: 2637, amp: 0.2 }], duration: 0.1, amplitude: 0.55, fadeIn: 0.02, expDecay: 6 },
    { freq: 0, duration: 0.04 },
    { freq: 1568, harmonics: [{ freq: 3136, amp: 0.2 }, { freq: 2352, amp: 0.15 }], duration: 0.28, amplitude: 0.58, fadeIn: 0.02, expDecay: 4 },
  ],
  bell: [
    { freq: 880, harmonics: [{ freq: 1100, amp: 0.6 }, { freq: 2200, amp: 0.35 }, { freq: 3520, amp: 0.18 }], duration: 0.9, amplitude: 0.48, fadeIn: 0.005, expDecay: 2.8 },
  ],
  pulse: [
    { freq: 1047, harmonics: [{ freq: 2093, amp: 0.3 }], duration: 0.08, amplitude: 0.5, fadeIn: 0.01, expDecay: 10 },
    { freq: 0, duration: 0.07 },
    { freq: 1047, harmonics: [{ freq: 2093, amp: 0.3 }], duration: 0.08, amplitude: 0.5, fadeIn: 0.01, expDecay: 10 },
    { freq: 0, duration: 0.07 },
    { freq: 1319, harmonics: [{ freq: 2637, amp: 0.25 }], duration: 0.1, amplitude: 0.56, fadeIn: 0.01, expDecay: 8 },
  ],
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
  for (const seg of segments) {
    const n = Math.floor(seg.duration * SAMPLE_RATE);
    if (seg.freq !== 0) {
      const amp = seg.amplitude ?? 0.55;
      const harmonics = seg.harmonics ?? [];
      const normFactor = 1 + harmonics.reduce((s, h) => s + h.amp, 0);
      const fadeInSamples = Math.floor((seg.fadeIn ?? 0) * n);

      for (let i = 0; i < n; i++) {
        const t = i / SAMPLE_RATE;
        let env: number;
        if (i < fadeInSamples) {
          env = i / Math.max(1, fadeInSamples);
        } else if (seg.expDecay !== undefined) {
          const decayI = i - fadeInSamples;
          const decayN = Math.max(1, n - fadeInSamples);
          env = Math.exp(-seg.expDecay * decayI / decayN);
        } else {
          env = 1;
        }

        let wave = Math.sin(2 * Math.PI * seg.freq * t);
        for (const h of harmonics) {
          wave += h.amp * Math.sin(2 * Math.PI * h.freq * t);
        }
        wave /= normFactor;

        const sample = amp * env * wave;
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
  }

  return toBase64(new Uint8Array(buf));
}

let activeAudio: HTMLAudioElement | null = null;
const toneCache: Record<string, string> = {};

export function playTone(name: string) {
  if (name === 'silent' || name === 'Sin tono') return;
  const segments = TONE_DEFINITIONS[name];
  if (!segments) return;

  try {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio = null;
    }

    let dataUrl = toneCache[name];
    if (!dataUrl) {
      const base64 = buildWavBase64(segments);
      dataUrl = `data:audio/wav;base64,${base64}`;
      toneCache[name] = dataUrl;
    }

    const audio = new Audio(dataUrl);
    audio.play().catch(err => console.warn('[toneGenerator] Play error:', err));
    activeAudio = audio;
  } catch (error) {
    console.error('[toneGenerator] Error playing tone:', error);
  }
}
