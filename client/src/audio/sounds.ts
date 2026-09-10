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

function createNoiseBuffer(ctx: AudioContext, durationSec: number): AudioBuffer {
  const bufferSize = Math.floor(ctx.sampleRate * durationSec);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

if (typeof window !== 'undefined') {
  const resumeEvents = ['pointerdown', 'keydown', 'touchstart'];
  const unlock = () => {
    getContext();
    resumeEvents.forEach((ev) => window.removeEventListener(ev, unlock));
  };
  resumeEvents.forEach((ev) => window.addEventListener(ev, unlock, { once: true, passive: true }));
}

/**
 * Звонкий упругий ход (Snappy Blitz Tap).
 * Сухой, компактный, отчетливый клик для быстрого блица.
 */
export function playMoveSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Быстрый сухой клик контакта дерева
  const tap = ctx.createOscillator();
  const tapFilter = ctx.createBiquadFilter();
  const tapGain = ctx.createGain();

  tapFilter.type = 'bandpass';
  tapFilter.frequency.setValueAtTime(780, now);
  tapFilter.Q.setValueAtTime(2.4, now);

  tap.type = 'triangle';
  tap.frequency.setValueAtTime(520, now);
  tap.frequency.exponentialRampToValueAtTime(170, now + 0.018);

  tapGain.gain.setValueAtTime(0.0001, now);
  tapGain.gain.linearRampToValueAtTime(0.18, now + 0.0015);
  tapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

  tap.connect(tapFilter);
  tapFilter.connect(tapGain);
  tapGain.connect(ctx.destination);
  tap.start(now);
  tap.stop(now + 0.025);

  // 2. Компактный упругий бас доски
  const punch = ctx.createOscillator();
  const punchFilter = ctx.createBiquadFilter();
  const punchGain = ctx.createGain();

  punchFilter.type = 'lowpass';
  punchFilter.frequency.setValueAtTime(550, now);

  punch.type = 'sine';
  punch.frequency.setValueAtTime(230, now);
  punch.frequency.exponentialRampToValueAtTime(80, now + 0.032);

  punchGain.gain.setValueAtTime(0.0001, now);
  punchGain.gain.linearRampToValueAtTime(0.17, now + 0.0025);
  punchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

  punch.connect(punchFilter);
  punchFilter.connect(punchGain);
  punchGain.connect(ctx.destination);
  punch.start(now);
  punch.stop(now + 0.04);
}

/**
 * Хрусткое сочное взятие в темпе блица (Snappy Blitz Capture).
 * Резкий щелчок соударения сбиваемой фигуры + сочный транзиент + плотный упругий бас.
 */
export function playCaptureSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Phase 1: Резкий щелчок фигуры о фигуру (удаление с поля)
  const knock = ctx.createOscillator();
  const knockFilter = ctx.createBiquadFilter();
  const knockGain = ctx.createGain();

  knockFilter.type = 'bandpass';
  knockFilter.frequency.setValueAtTime(950, now);
  knockFilter.Q.setValueAtTime(2.2, now);

  knock.type = 'triangle';
  knock.frequency.setValueAtTime(860, now);
  knock.frequency.exponentialRampToValueAtTime(260, now + 0.02);

  knockGain.gain.setValueAtTime(0.0001, now);
  knockGain.gain.linearRampToValueAtTime(0.21, now + 0.0015);
  knockGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.024);

  knock.connect(knockFilter);
  knockFilter.connect(knockGain);
  knockGain.connect(ctx.destination);
  knock.start(now);
  knock.stop(now + 0.026);

  // Хрусткий микро-транзиент контакта
  try {
    const noiseBuf = createNoiseBuffer(ctx, 0.005);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(2000, now);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.09, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
  } catch {}

  // Phase 2: Плотная, упругая посадка фигуры на клетку через 22 мс
  const t2 = now + 0.022;

  const body = ctx.createOscillator();
  const bodyFilter = ctx.createBiquadFilter();
  const bodyGain = ctx.createGain();

  bodyFilter.type = 'lowpass';
  bodyFilter.frequency.setValueAtTime(620, t2);

  body.type = 'sine';
  body.frequency.setValueAtTime(220, t2);
  body.frequency.exponentialRampToValueAtTime(68, t2 + 0.038);

  bodyGain.gain.setValueAtTime(0.0001, t2);
  bodyGain.gain.linearRampToValueAtTime(0.24, t2 + 0.003);
  bodyGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.045);

  body.connect(bodyFilter);
  bodyFilter.connect(bodyGain);
  bodyGain.connect(ctx.destination);
  body.start(t2);
  body.stop(t2 + 0.048);

  // Деревянный призвук посадки
  const wood = ctx.createOscillator();
  const woodFilter = ctx.createBiquadFilter();
  const woodGain = ctx.createGain();

  woodFilter.type = 'bandpass';
  woodFilter.frequency.setValueAtTime(600, t2);
  woodFilter.Q.setValueAtTime(2.0, t2);

  wood.type = 'triangle';
  wood.frequency.setValueAtTime(380, t2);
  wood.frequency.exponentialRampToValueAtTime(140, t2 + 0.018);

  woodGain.gain.setValueAtTime(0.0001, t2);
  woodGain.gain.linearRampToValueAtTime(0.15, t2 + 0.002);
  woodGain.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.025);

  wood.connect(woodFilter);
  woodFilter.connect(woodGain);
  woodGain.connect(ctx.destination);
  wood.start(t2);
  wood.stop(t2 + 0.028);
}

/**
 * Драматический звук потери королевы (ферзя).
 * Тревожный нисходящий тритон (D4 -> Ab3) с плотным басовым рокотом.
 */
export function playQueenLossSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Нисходящий тритон
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, now);
  filter.frequency.exponentialRampToValueAtTime(320, now + 0.35);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(293.66, now);
  osc.frequency.exponentialRampToValueAtTime(207.65, now + 0.26);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.24, now + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.42);

  // Тревожный низкий басовый рокот
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();

  sub.type = 'sine';
  sub.frequency.setValueAtTime(146.83, now);
  sub.frequency.exponentialRampToValueAtTime(55, now + 0.35);

  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.linearRampToValueAtTime(0.18, now + 0.006);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);

  sub.connect(subGain);
  subGain.connect(ctx.destination);
  sub.start(now);
  sub.stop(now + 0.38);
}

/**
 * Ясный двухтональный колокольчик при шахе (F5 + C6).
 */
export function playCheckSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [698.46, 1046.5].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2200, now);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(idx === 0 ? 0.14 : 0.09, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.34);
  });
}

/** Быстрый двойной перестук рокировки */
export function playCastleSound(): void {
  playMoveSound();
  setTimeout(() => playMoveSound(), 75);
}

/** Постановка фигуры из кармана (багхаус) */
export function playDropSound(): void {
  playMoveSound();
}

/** Мрачный, торжественный аккорд поражения */
export function playDefeatSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = [174.61, 146.83, 116.54, 98.0];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(650, now + idx * 0.08);

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + idx * 0.08);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
    gain.gain.linearRampToValueAtTime(0.13, now + idx * 0.08 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.55);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + idx * 0.08);
    osc.stop(now + idx * 0.08 + 0.6);
  });
}

/** Финальный звук окончания партии (победа или поражение) */
export function playGameEndSound(won: boolean = true): void {
  if (won) {
    if (isMuted.value) return;
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [261.63, 329.63, 392.0, 523.25];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.065);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.065);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.065 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.065 + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.065);
      osc.stop(now + idx * 0.065 + 0.55);
    });
  } else {
    playDefeatSound();
  }
}
