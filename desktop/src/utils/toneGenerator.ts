interface ToneSegment {
  freq: number;
  harmonics?: Array<{ freq: number; amp: number }>;
  waveType?: 'sine' | 'sawtooth' | 'square';
  duration: number;
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
  'Trompeta': [
    { freq: 392, waveType: 'sawtooth', duration: 0.08, amplitude: 0.28, fadeIn: 0.010, expDecay: 9 },
    { freq: 0, duration: 0.012 },
    { freq: 392, waveType: 'sawtooth', duration: 0.08, amplitude: 0.28, fadeIn: 0.010, expDecay: 9 },
    { freq: 0, duration: 0.012 },
    { freq: 392, waveType: 'sawtooth', duration: 0.08, amplitude: 0.28, fadeIn: 0.010, expDecay: 9 },
    { freq: 0, duration: 0.012 },
    { freq: 392, waveType: 'sawtooth', duration: 0.08, amplitude: 0.28, fadeIn: 0.010, expDecay: 9 },
    { freq: 0, duration: 0.012 },
    { freq: 440, waveType: 'sawtooth', duration: 0.10, amplitude: 0.29, fadeIn: 0.010, expDecay: 8 },
    { freq: 0, duration: 0.012 },
    { freq: 494, waveType: 'sawtooth', duration: 0.10, amplitude: 0.29, fadeIn: 0.010, expDecay: 8 },
    { freq: 0, duration: 0.012 },
    { freq: 523, waveType: 'sawtooth', duration: 0.25, amplitude: 0.30, fadeIn: 0.014, expDecay: 3.2 },
    { freq: 0, duration: 0.15 },
    { freq: 156, waveType: 'square', duration: 0.12, amplitude: 0.24, fadeIn: 0.010, expDecay: 7 },
    { freq: 0, duration: 0.010 },
    { freq: 208, waveType: 'square', duration: 0.12, amplitude: 0.24, fadeIn: 0.010, expDecay: 7 },
    { freq: 0, duration: 0.010 },
    { freq: 156, waveType: 'square', duration: 0.12, amplitude: 0.24, fadeIn: 0.010, expDecay: 7 },
    { freq: 0, duration: 0.010 },
    { freq: 208, waveType: 'square', duration: 0.12, amplitude: 0.24, fadeIn: 0.010, expDecay: 7 },
    { freq: 0, duration: 0.010 },
    { freq: 156, waveType: 'square', duration: 0.30, amplitude: 0.25, fadeIn: 0.014, expDecay: 2.5 },
    { freq: 0, duration: 2.5 },
  ],

  Dembow: [
    { freq: 440, harmonics: [{ freq: 880, amp: 0.38 }, { freq: 1320, amp: 0.18 }], duration: 0.14, amplitude: 0.28, fadeIn: 0.06, expDecay: 8, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 523, harmonics: [{ freq: 1046, amp: 0.38 }, { freq: 1569, amp: 0.18 }], duration: 0.14, amplitude: 0.27, fadeIn: 0.06, expDecay: 8, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 659, harmonics: [{ freq: 1318, amp: 0.35 }, { freq: 1977, amp: 0.16 }], duration: 0.28, amplitude: 0.29, fadeIn: 0.07, expDecay: 6, vibrato: { rate: 6.5, depth: 0.005, delay: 0.05 } },
    { freq: 0, duration: 0.018 },
    { freq: 392, harmonics: [{ freq: 784, amp: 0.36 }, { freq: 1176, amp: 0.17 }], duration: 0.14, amplitude: 0.27, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 440, harmonics: [{ freq: 880, amp: 0.36 }, { freq: 1320, amp: 0.17 }], duration: 0.14, amplitude: 0.27, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 392, harmonics: [{ freq: 784, amp: 0.35 }, { freq: 1176, amp: 0.16 }], duration: 0.14, amplitude: 0.26, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.36 }, { freq: 990, amp: 0.17 }], duration: 0.34, amplitude: 0.28, fadeIn: 0.08, expDecay: 5, vibrato: { rate: 6.5, depth: 0.005, delay: 0.07 } },
    { freq: 0, duration: 0.018 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.35 }, { freq: 990, amp: 0.16 }], duration: 0.14, amplitude: 0.26, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 392, harmonics: [{ freq: 784, amp: 0.35 }, { freq: 1176, amp: 0.16 }], duration: 0.14, amplitude: 0.27, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 440, harmonics: [{ freq: 880, amp: 0.38 }, { freq: 1320, amp: 0.18 }], duration: 0.28, amplitude: 0.28, fadeIn: 0.07, expDecay: 6, vibrato: { rate: 6.5, depth: 0.005, delay: 0.05 } },
    { freq: 0, duration: 0.018 },
    { freq: 392, harmonics: [{ freq: 784, amp: 0.35 }, { freq: 1176, amp: 0.16 }], duration: 0.14, amplitude: 0.26, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.35 }, { freq: 990, amp: 0.16 }], duration: 0.14, amplitude: 0.26, fadeIn: 0.05, expDecay: 9, vibrato: { rate: 6.5, depth: 0.005, delay: 0.04 } },
    { freq: 0, duration: 0.018 },
    { freq: 262, harmonics: [{ freq: 524, amp: 0.36 }, { freq: 786, amp: 0.17 }], duration: 0.42, amplitude: 0.26, fadeIn: 0.10, expDecay: 4, vibrato: { rate: 6.2, depth: 0.005, delay: 0.09 } },
    { freq: 0, duration: 2.2 },
  ],

  Navideño: [
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }, { freq: 1320, amp: 0.08 }], duration: 0.26, amplitude: 0.24, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.26, amplitude: 0.23, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.50, amplitude: 0.25, fadeIn: 0.07, expDecay: 2.8, vibrato: { rate: 7.0, depth: 0.004, delay: 0.08 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.26, amplitude: 0.23, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.26, amplitude: 0.23, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.50, amplitude: 0.25, fadeIn: 0.07, expDecay: 2.8, vibrato: { rate: 7.0, depth: 0.004, delay: 0.08 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.38 }, { freq: 990, amp: 0.17 }], duration: 0.26, amplitude: 0.22, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 392, harmonics: [{ freq: 784, amp: 0.38 }, { freq: 1176, amp: 0.17 }], duration: 0.26, amplitude: 0.23, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 262, harmonics: [{ freq: 524, amp: 0.38 }, { freq: 786, amp: 0.17 }], duration: 0.38, amplitude: 0.22, fadeIn: 0.07, expDecay: 3.2, vibrato: { rate: 7.0, depth: 0.004, delay: 0.08 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.36 }, { freq: 882, amp: 0.16 }], duration: 0.17, amplitude: 0.21, fadeIn: 0.05, expDecay: 5.5, vibrato: { rate: 7.0, depth: 0.004, delay: 0.05 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.40 }, { freq: 990, amp: 0.18 }], duration: 0.74, amplitude: 0.25, fadeIn: 0.09, expDecay: 2.2, vibrato: { rate: 7.0, depth: 0.004, delay: 0.10 }, chorus: 0.20 },
    { freq: 0, duration: 0.10 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.38 }, { freq: 882, amp: 0.17 }], duration: 0.26, amplitude: 0.22, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.38 }, { freq: 882, amp: 0.17 }], duration: 0.26, amplitude: 0.22, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.38 }, { freq: 882, amp: 0.17 }], duration: 0.50, amplitude: 0.24, fadeIn: 0.07, expDecay: 2.8, vibrato: { rate: 7.0, depth: 0.004, delay: 0.08 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.36 }, { freq: 882, amp: 0.16 }], duration: 0.26, amplitude: 0.21, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 330, harmonics: [{ freq: 660, amp: 0.38 }, { freq: 990, amp: 0.17 }], duration: 0.26, amplitude: 0.22, fadeIn: 0.06, expDecay: 4.0, vibrato: { rate: 7.0, depth: 0.004, delay: 0.07 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 262, harmonics: [{ freq: 524, amp: 0.36 }, { freq: 786, amp: 0.16 }], duration: 0.38, amplitude: 0.21, fadeIn: 0.08, expDecay: 3.2, vibrato: { rate: 7.0, depth: 0.004, delay: 0.08 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 220, harmonics: [{ freq: 440, amp: 0.34 }, { freq: 660, amp: 0.15 }], duration: 0.17, amplitude: 0.20, fadeIn: 0.05, expDecay: 5.5, vibrato: { rate: 7.0, depth: 0.004, delay: 0.05 }, chorus: 0.20 },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.38 }, { freq: 882, amp: 0.17 }], duration: 0.88, amplitude: 0.24, fadeIn: 0.11, expDecay: 1.8, vibrato: { rate: 7.0, depth: 0.004, delay: 0.12 }, chorus: 0.20 },
    { freq: 0, duration: 3.2 },
  ],

  Spooky: [
    { freq: 494, harmonics: [{ freq: 988, amp: 0.52 }, { freq: 1482, amp: 0.34 }, { freq: 1976, amp: 0.17 }, { freq: 247, amp: 0.40 }], duration: 1.30, amplitude: 0.22, fadeIn: 0.52, expDecay: 0.55, vibrato: { rate: 3.4, depth: 0.013, delay: 0.24 } },
    { freq: 0, duration: 0.015 },
    { freq: 415, harmonics: [{ freq: 830, amp: 0.52 }, { freq: 1245, amp: 0.34 }, { freq: 1660, amp: 0.17 }, { freq: 207, amp: 0.40 }], duration: 1.20, amplitude: 0.21, fadeIn: 0.50, expDecay: 0.55, vibrato: { rate: 3.4, depth: 0.013, delay: 0.22 } },
    { freq: 0, duration: 0.015 },
    { freq: 349, harmonics: [{ freq: 698, amp: 0.52 }, { freq: 1047, amp: 0.34 }, { freq: 1396, amp: 0.17 }, { freq: 174, amp: 0.40 }], duration: 1.20, amplitude: 0.21, fadeIn: 0.48, expDecay: 0.55, vibrato: { rate: 3.4, depth: 0.013, delay: 0.22 } },
    { freq: 0, duration: 0.015 },
    { freq: 294, harmonics: [{ freq: 588, amp: 0.52 }, { freq: 882, amp: 0.34 }, { freq: 1176, amp: 0.17 }, { freq: 147, amp: 0.40 }], duration: 1.30, amplitude: 0.20, fadeIn: 0.52, expDecay: 0.50, vibrato: { rate: 3.4, depth: 0.013, delay: 0.24 } },
    { freq: 0, duration: 0.015 },
    { freq: 247, harmonics: [{ freq: 494, amp: 0.52 }, { freq: 741, amp: 0.34 }, { freq: 988, amp: 0.17 }, { freq: 123, amp: 0.40 }], duration: 1.50, amplitude: 0.20, fadeIn: 0.56, expDecay: 0.45, vibrato: { rate: 3.3, depth: 0.014, delay: 0.26 } },
    { freq: 0, duration: 0.24 },
    { freq: 277, harmonics: [{ freq: 554, amp: 0.46 }, { freq: 831, amp: 0.30 }, { freq: 138, amp: 0.37 }], duration: 0.72, amplitude: 0.17, fadeIn: 0.40, expDecay: 0.78, vibrato: { rate: 3.4, depth: 0.012, delay: 0.18 } },
    { freq: 0, duration: 0.015 },
    { freq: 349, harmonics: [{ freq: 698, amp: 0.46 }, { freq: 1047, amp: 0.30 }, { freq: 174, amp: 0.37 }], duration: 0.72, amplitude: 0.18, fadeIn: 0.38, expDecay: 0.78, vibrato: { rate: 3.4, depth: 0.012, delay: 0.17 } },
    { freq: 0, duration: 0.015 },
    { freq: 415, harmonics: [{ freq: 830, amp: 0.46 }, { freq: 1245, amp: 0.30 }, { freq: 207, amp: 0.37 }], duration: 0.72, amplitude: 0.19, fadeIn: 0.36, expDecay: 0.78, vibrato: { rate: 3.4, depth: 0.012, delay: 0.16 } },
    { freq: 0, duration: 0.015 },
    { freq: 494, harmonics: [{ freq: 988, amp: 0.48 }, { freq: 1482, amp: 0.32 }, { freq: 247, amp: 0.38 }], duration: 1.04, amplitude: 0.20, fadeIn: 0.46, expDecay: 0.55, vibrato: { rate: 3.3, depth: 0.013, delay: 0.22 } },
    { freq: 0, duration: 2.8 },
  ],
};

export const MESSAGE_TONE_NAMES = Object.keys(MESSAGE_TONES);
export const CALL_TONE_NAMES = Object.keys(CALL_TONE_DEFINITIONS);

const FADE_OUT_SAMPLES = Math.floor(0.022 * SAMPLE_RATE);

function buildAudioBuffer(ctx: AudioContext, segments: ToneSegment[]): AudioBuffer {
  const totalSamples = segments.reduce((acc, s) => acc + Math.floor(s.duration * SAMPLE_RATE), 0);
  const buffer = ctx.createBuffer(1, Math.max(totalSamples, 1), SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  let offset = 0;
  for (const seg of segments) {
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

        const vibratoMod = (vRate > 0 && t > vDelay)
          ? 1 + vDepth * Math.sin(2 * Math.PI * vRate * (t - vDelay))
          : 1;

        const dt = vibratoMod / SAMPLE_RATE;
        mainPhase += 2 * Math.PI * seg.freq * dt;
        if (chorusAmt > 0) chorusPhase += 2 * Math.PI * seg.freq * 1.0028 * dt;
        for (let h = 0; h < harmonics.length; h++) {
          hPhases[h] += 2 * Math.PI * harmonics[h].freq * dt;
        }

        const waveType = seg.waveType ?? 'sine';
        let wave: number;
        if (waveType === 'sawtooth') {
          wave = (2 / Math.PI) * (
            Math.sin(mainPhase) -
            Math.sin(2 * mainPhase) / 2 +
            Math.sin(3 * mainPhase) / 3 -
            Math.sin(4 * mainPhase) / 4 +
            Math.sin(5 * mainPhase) / 5 -
            Math.sin(6 * mainPhase) / 6
          );
        } else if (waveType === 'square') {
          wave = (4 / Math.PI) * (
            Math.sin(mainPhase) +
            Math.sin(3 * mainPhase) / 3 +
            Math.sin(5 * mainPhase) / 5 +
            Math.sin(7 * mainPhase) / 7
          );
        } else {
          wave = Math.sin(mainPhase);
          if (chorusAmt > 0) {
            wave = (wave + chorusAmt * Math.sin(chorusPhase)) / (1 + chorusAmt);
          }
          for (let h = 0; h < harmonics.length; h++) {
            wave += harmonics[h].amp * Math.sin(hPhases[h]);
          }
          wave /= normFactor;
        }

        data[offset + i] = amp * env * wave;
      }
    }
    offset += n;
  }

  return buffer;
}

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

let activeMessageSource: AudioBufferSourceNode | null = null;

export function previewTone(name: string): void {
  const segments = MESSAGE_TONES[name];
  if (!segments || segments.length === 0) return;

  try {
    const ctx = getCtx();
    if (activeMessageSource) {
      try { activeMessageSource.stop(); } catch {}
      activeMessageSource = null;
    }
    const source = ctx.createBufferSource();
    source.buffer = buildAudioBuffer(ctx, segments);
    source.connect(ctx.destination);
    source.start();
    source.onended = () => { if (activeMessageSource === source) activeMessageSource = null; };
    activeMessageSource = source;
  } catch {}
}

export function playMessageTone(name: string): void {
  previewTone(name);
}

export const playTone = playMessageTone;


let callSource: AudioBufferSourceNode | null = null;

export function playCallTone(name: string): void {
  const segments = CALL_TONE_DEFINITIONS[name] ?? CALL_TONE_DEFINITIONS['Trompeta'];
  if (!segments || segments.length === 0) return;

  try {
    const ctx = getCtx();
    stopCallTone();
    const source = ctx.createBufferSource();
    source.buffer = buildAudioBuffer(ctx, segments);
    source.loop = true;
    source.connect(ctx.destination);
    source.start();
    callSource = source;
  } catch {}
}

export function stopCallTone(): void {
  if (callSource) {
    try { callSource.stop(); } catch {}
    callSource = null;
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

export function playRingback(): void {
  stopRingback();
  try {
    const ctx = getCtx();
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
