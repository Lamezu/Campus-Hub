interface ToneSegment {
  freq: number;
  harmonics?: Array<{ freq: number; amp: number }>;
  waveType?: 'sine' | 'sawtooth' | 'square' | 'noise';
  startTime?: number;
  duration: number;
  pitchDrop?: number;
  amplitude?: number;
  fadeIn?: number;
  expDecay?: number;
  vibrato?: { rate: number; depth: number; delay?: number };
  chorus?: number;
  fadeOut?: number;
}

const SAMPLE_RATE = 44100;

const E5 = 659.25;
const G5 = 783.99;
const A5 = 880.00;

const MESSAGE_TONES: Record<string, ToneSegment[]> = {
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
    { freq: E5, duration: 0.22, amplitude: 0.10, fadeIn: 0.18, fadeOut: 0.30, expDecay: 1.8 },
    { freq: G5, duration: 0.22, amplitude: 0.09, fadeIn: 0.16, fadeOut: 0.30, expDecay: 1.8 },
    { freq: A5, duration: 0.38, amplitude: 0.08, fadeIn: 0.16, fadeOut: 0.36, expDecay: 1.4 },
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
  silent: [],
};

const CALL_TONE_DEFINITIONS: Record<string, ToneSegment[]> = {
  Zen: [
    { startTime: 0.0, freq: 440, waveType: 'sine', harmonics: [{ freq: 880, amp: 0.15 }, { freq: 1320, amp: 0.05 }], duration: 2.0, amplitude: 0.14, fadeIn: 0.4, expDecay: 1.5, chorus: 0.3 },
    { startTime: 0.8, freq: 554.37, waveType: 'sine', harmonics: [{ freq: 1108, amp: 0.15 }], duration: 2.0, amplitude: 0.12, fadeIn: 0.4, expDecay: 1.5 },
    { startTime: 1.6, freq: 659.25, waveType: 'sine', harmonics: [{ freq: 1318, amp: 0.15 }], duration: 2.0, amplitude: 0.10, fadeIn: 0.4, expDecay: 1.5 },
    { startTime: 2.4, freq: 830.61, waveType: 'sine', harmonics: [{ freq: 1661, amp: 0.10 }], duration: 2.0, amplitude: 0.08, fadeIn: 0.4, expDecay: 1.5 },
    { startTime: 4.5, freq: 0, duration: 0.5 },
  ],

  Navideño: [
    { startTime: 0.0, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 0.28, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 0.56, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.50, amplitude: 0.25, expDecay: 6 },
    { startTime: 1.12, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 1.40, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 1.68, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.50, amplitude: 0.25, expDecay: 6 },
    { startTime: 2.24, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 2.52, freq: 587.33, waveType: 'sine', harmonics: [{ freq: 1174, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 2.80, freq: 392.00, waveType: 'sine', harmonics: [{ freq: 784, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 3.08, freq: 440.00, waveType: 'sine', harmonics: [{ freq: 880, amp: 0.2 }], duration: 0.25, amplitude: 0.22, expDecay: 12 },
    { startTime: 3.36, freq: 493.88, waveType: 'sine', harmonics: [{ freq: 987, amp: 0.2 }], duration: 0.80, amplitude: 0.28, expDecay: 4 },
    { startTime: 0.0, freq: 8000, waveType: 'noise', duration: 0.03, amplitude: 0.06, expDecay: 60 },
    { startTime: 0.56, freq: 8000, waveType: 'noise', duration: 0.03, amplitude: 0.06, expDecay: 60 },
    { startTime: 1.12, freq: 8000, waveType: 'noise', duration: 0.03, amplitude: 0.06, expDecay: 60 },
    { startTime: 1.68, freq: 8000, waveType: 'noise', duration: 0.03, amplitude: 0.06, expDecay: 60 },
    { startTime: 2.24, freq: 8000, waveType: 'noise', duration: 0.03, amplitude: 0.06, expDecay: 60 },
    { startTime: 4.8, freq: 0, duration: 0.5 },
  ],

  Spooky: [
    { startTime: 0.0, freq: 220, waveType: 'sine', harmonics: [{ freq: 440, amp: 0.1 }], duration: 0.8, amplitude: 0.20, expDecay: 3 },
    { startTime: 0.8, freq: 233.08, waveType: 'sine', harmonics: [{ freq: 466, amp: 0.1 }], duration: 0.8, amplitude: 0.18, expDecay: 3 },
    { startTime: 1.6, freq: 164.81, waveType: 'sine', harmonics: [{ freq: 329, amp: 0.1 }], duration: 1.2, amplitude: 0.22, expDecay: 1.5 },
    { startTime: 2.8, freq: 155.56, waveType: 'sine', harmonics: [{ freq: 311, amp: 0.1 }], duration: 1.2, amplitude: 0.22, expDecay: 1.5 },
    { startTime: 0.0, freq: 110, waveType: 'sine', duration: 4.0, amplitude: 0.05, fadeIn: 1.0 },
    { startTime: 4.5, freq: 0, duration: 0.5 },
  ],

  default: [
    { startTime: 0.0, freq: 659.25, waveType: 'sine', duration: 0.5, amplitude: 0.25, fadeIn: 0.05, expDecay: 8 },
    { startTime: 0.2, freq: 783.99, waveType: 'sine', duration: 0.5, amplitude: 0.25, fadeIn: 0.05, expDecay: 8 },
    { startTime: 0.4, freq: 880.00, waveType: 'sine', duration: 0.8, amplitude: 0.28, fadeIn: 0.05, expDecay: 4 },
    { startTime: 2.5, freq: 0, duration: 0.5 },
  ],

  Dembow: [
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.06, expDecay: 90 },
    { freq: 130, pitchDrop: 1.0, waveType: 'sine', harmonics: [{ freq: 260, amp: 0.1 }], duration: 0.10, amplitude: 0.45, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.08, expDecay: 90 },
    { freq: 220, waveType: 'sine', harmonics: [{ freq: 440, amp: 0.2 }], duration: 0.10, amplitude: 0.30, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.06, expDecay: 90 },
    { freq: 130, pitchDrop: 1.0, waveType: 'sine', harmonics: [{ freq: 260, amp: 0.1 }], duration: 0.10, amplitude: 0.42, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 0, duration: 0.012 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.07, expDecay: 90 },
    { freq: 220, waveType: 'sine', harmonics: [{ freq: 440, amp: 0.1 }], duration: 0.08, amplitude: 0.25, expDecay: 20 },
    { freq: 0, duration: 0.015 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.06, expDecay: 90 },
    { freq: 130, pitchDrop: 1.0, waveType: 'sine', harmonics: [{ freq: 260, amp: 0.1 }], duration: 0.10, amplitude: 0.42, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.08, expDecay: 90 },
    { freq: 220, waveType: 'sine', harmonics: [{ freq: 440, amp: 0.2 }], duration: 0.10, amplitude: 0.30, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.06, expDecay: 90 },
    { freq: 130, pitchDrop: 1.0, waveType: 'sine', harmonics: [{ freq: 260, amp: 0.1 }], duration: 0.10, amplitude: 0.42, expDecay: 20 },
    { freq: 0, duration: 0.007 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
    { freq: 0, duration: 0.010 },
    { freq: 4000, waveType: 'square', duration: 0.02, amplitude: 0.07, expDecay: 90 },
    { freq: 220, waveType: 'sine', harmonics: [{ freq: 440, amp: 0.1 }], duration: 0.08, amplitude: 0.25, expDecay: 20 },
    { freq: 0, duration: 0.017 },
    { freq: 5000, waveType: 'sine', duration: 0.015, amplitude: 0.03, expDecay: 100 },
    { freq: 0, duration: 0.112 },
  ],
};

export const MESSAGE_TONE_NAMES = Object.keys(MESSAGE_TONES);
export const CALL_TONE_NAMES = Object.keys(CALL_TONE_DEFINITIONS);

const FADE_OUT_SAMPLES = Math.floor(0.022 * SAMPLE_RATE);

function buildAudioBuffer(ctx: AudioContext, segments: ToneSegment[]): AudioBuffer {
  let currentPos = 0;
  const segmentsWithTimes = segments.map(s => {
    const start = s.startTime !== undefined ? s.startTime : currentPos;
    currentPos = start + s.duration;
    return { ...s, start };
  });

  const maxDuration = segmentsWithTimes.reduce((acc, s) => Math.max(acc, s.start + s.duration), 0);
  const totalSamples = Math.floor(maxDuration * SAMPLE_RATE);
  const buffer = ctx.createBuffer(1, Math.max(totalSamples, 1), SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  for (const seg of segmentsWithTimes) {
    const startOffset = Math.floor(seg.start * SAMPLE_RATE);
    const n = Math.floor(seg.duration * SAMPLE_RATE);
    
    if (seg.freq !== 0) {
      const amp = seg.amplitude ?? 0.55;
      const harmonics = seg.harmonics ?? [];
      const fadeInSamples = Math.floor((seg.fadeIn ?? 0) * n);
      const fadeOutStart = Math.max(fadeInSamples, n - FADE_OUT_SAMPLES);
      const normFactor = 1 + harmonics.reduce((s, h) => s + h.amp, 0);

      const vRate = seg.vibrato?.rate ?? 0;
      const vDepth = seg.vibrato?.depth ?? 0;
      const vDelay = seg.vibrato?.delay ?? 0;
      const chorusAmt = seg.chorus ?? 0;

      let mainPhase = 0;
      let chorusPhase = 0;
      const hPhases = harmonics.map(() => 0);

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
        if (i >= fadeOutStart) {
          env = Math.min(env, 1 - (i - fadeOutStart) / Math.max(1, n - fadeOutStart));
        }

        const dt = ( (vRate > 0 && t > vDelay) ? 1 + vDepth * Math.sin(2 * Math.PI * vRate * (t - vDelay)) : 1 ) / SAMPLE_RATE;
        
        let currentFreq = seg.freq;
        if (seg.pitchDrop && seg.pitchDrop !== 0) {
          currentFreq = seg.freq * Math.exp(-seg.pitchDrop * (i / n));
        }

        mainPhase += 2 * Math.PI * currentFreq * dt;
        if (chorusAmt > 0) chorusPhase += 2 * Math.PI * currentFreq * 1.0028 * dt;
        for (let h = 0; h < harmonics.length; h++) {
          const hFreq = harmonics[h].freq * (currentFreq / seg.freq);
          hPhases[h] += 2 * Math.PI * hFreq * dt;
        }

        const waveType = seg.waveType ?? 'sine';
        let sample = 0;
        if (waveType === 'sine') {
          sample = Math.sin(mainPhase);
          if (chorusAmt > 0) sample = (sample + Math.sin(chorusPhase) * chorusAmt) / (1 + chorusAmt);
        } else if (waveType === 'sawtooth') {
          sample = 2 * (mainPhase / (2 * Math.PI) - Math.floor(mainPhase / (2 * Math.PI) + 0.5));
        } else if (waveType === 'square') {
          sample = Math.sin(mainPhase) > 0 ? 1 : -1;
        } else if (waveType === 'noise') {
          sample = Math.random() * 2 - 1;
        }

        for (let h = 0; h < harmonics.length; h++) {
          sample += harmonics[h].amp * Math.sin(hPhases[h]);
        }
        
        data[startOffset + i] += (sample / normFactor) * amp * env;
      }
    }
  }
  return buffer;
}

let audioCtx: AudioContext | null = null;
async function getCtx(): Promise<AudioContext> {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
  return audioCtx;
}

export async function playMessageTone(name: string): Promise<void> {
  const segments = MESSAGE_TONES[name] ?? MESSAGE_TONES.default;
  if (!segments || segments.length === 0) return;
  try {
    const ctx = await getCtx();
    const source = ctx.createBufferSource();
    source.buffer = buildAudioBuffer(ctx, segments);
    source.connect(ctx.destination);
    source.start();
  } catch (err) {
    console.error('[ToneGen] playMessageTone error:', err);
  }
}

export const playTone = playMessageTone;

let callSource: AudioBufferSourceNode | null = null;
let activeRequestId: number = 0;
let stopTimeout: any = null;

export function stopCallTone(): void {
  if (stopTimeout) {
    clearTimeout(stopTimeout);
    stopTimeout = null;
  }
  if (callSource) {
    try {
      callSource.stop();
      callSource.disconnect();
    } catch {}
    callSource = null;
  }
}

export async function playCallTone(name: string, durationMs?: number): Promise<void> {
  const requestId = ++activeRequestId;
  const segments = CALL_TONE_DEFINITIONS[name] ?? CALL_TONE_DEFINITIONS['default'];
  if (!segments || segments.length === 0) return;

  try {
    const ctx = await getCtx();
    if (requestId !== activeRequestId) return;

    const actualDuration = durationMs ? Math.min(durationMs, 10000) : undefined;

    stopCallTone();
    const source = ctx.createBufferSource();
    source.buffer = buildAudioBuffer(ctx, segments);
    
    source.loop = !actualDuration;
    
    source.connect(ctx.destination);
    source.start();
    callSource = source;

    if (actualDuration) {
      stopTimeout = setTimeout(() => {
        if (requestId === activeRequestId) {
          stopCallTone();
        }
      }, actualDuration);
    }
  } catch (err) {
    console.warn('[ToneGen] playCallTone error:', err);
  }
}

let ringbackIntervalId: ReturnType<typeof setInterval> | null = null;
let ringbackSource: AudioBufferSourceNode | null = null;

function buildRingbackBuffer(ctx: AudioContext): AudioBuffer {
  const freq = 370;
  const n = Math.floor(0.85 * SAMPLE_RATE);
  const buffer = ctx.createBuffer(1, n, SAMPLE_RATE);
  const data = buffer.getChannelData(0);
  const fadeIn = Math.floor(0.04 * SAMPLE_RATE);
  const fadeOut = Math.floor(0.06 * SAMPLE_RATE);
  for (let i = 0; i < n; i++) {
    let env: number;
    if (i < fadeIn) env = i / fadeIn;
    else if (i > n - fadeOut) env = (n - i) / Math.max(1, fadeOut);
    else env = 1;
    data[i] = 0.22 * env * Math.sin(2 * Math.PI * freq * i / SAMPLE_RATE);
  }
  return buffer;
}

export async function playRingback(): Promise<void> {
  stopRingback();
  try {
    const ctx = await getCtx();
    const buffer = buildRingbackBuffer(ctx);
    const beep = () => {
      try {
        const src = ctx.createBufferSource();
        src.buffer = buffer;
        src.connect(ctx.destination);
        src.start();
        ringbackSource = src;
      } catch {}
    };
    beep();
    ringbackIntervalId = setInterval(beep, 3000);
  } catch {}
}

export function stopRingback(): void {
  if (ringbackIntervalId) {
    clearInterval(ringbackIntervalId);
    ringbackIntervalId = null;
  }
  if (ringbackSource) {
    try { ringbackSource.stop(); } catch {}
    ringbackSource = null;
  }
}
