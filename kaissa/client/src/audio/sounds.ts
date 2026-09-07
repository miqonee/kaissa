import { ref } from 'vue';

const STORAGE_KEY = 'kaissa_sound_muted';

export const isMuted = ref(
  typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) === 'true' : false,
);

export function toggleSound(): void {
  isMuted.value = !isMuted.value;
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, String(isMuted.value));
  }
}

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const resumeEvents = ['pointerdown', 'keydown', 'touchstart'];
  const unlock = () => {
    getContext();
    resumeEvents.forEach((ev) => window.removeEventListener(ev, unlock));
  };
  resumeEvents.forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));
}

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/** Упругий, сухой и отчетливый клик хода (стиль Lichess Classic) */
export function playMoveSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(800, now);
  filter.Q.setValueAtTime(1.5, now);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(420, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.05);
}

/** Хлесткий щелчок взятия фигуры */
export function playCaptureSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Короткий акустический шум столкновения
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.02);
  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.setValueAtTime(1100, now);
  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0.0001, now);
  noiseGain.gain.linearRampToValueAtTime(0.10, now + 0.003);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

  noise.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);

  playMoveSound();
}

/** Чистый нерезкий колокольчик шаха */
export function playCheckSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.08, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.23);
}

/** Быстрый перестук рокировки */
export function playCastleSound(): void {
  playMoveSound();
  setTimeout(() => playMoveSound(), 75);
}

/** Постановка фигуры из кармана (багхаус) */
export function playDropSound(): void {
  playMoveSound();
}

/** Финальный торжественный аккорд */
export function playGameEndSound(won: boolean = true): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = won ? [261.63, 329.63, 392.0, 523.25] : [440.0, 392.0, 349.23, 293.66];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.07);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
    gain.gain.linearRampToValueAtTime(0.06, now + idx * 0.07 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.07);
    osc.stop(now + idx * 0.07 + 0.60);
  });
}
