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

/**
 * Ясный, менее глухой деревянный ход (Crisp Acoustic Wood).
 * Комбинация резонанса доски (210 -> 68 Гц) и сухого деревянного контакта (360 -> 140 Гц).
 */
export function playMoveSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // 1. Корпус доски (низкий упругий бас)
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(720, now);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(210, now);
  osc.frequency.exponentialRampToValueAtTime(68, now + 0.045);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.19, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.052);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.055);

  // 2. Акустический контакт сухого дуба (быстрый мягкий импульс)
  const clack = ctx.createOscillator();
  const clackFilter = ctx.createBiquadFilter();
  const clackGain = ctx.createGain();

  clackFilter.type = 'bandpass';
  clackFilter.frequency.setValueAtTime(540, now);
  clackFilter.Q.setValueAtTime(2.0, now);

  clack.type = 'triangle';
  clack.frequency.setValueAtTime(360, now);
  clack.frequency.exponentialRampToValueAtTime(140, now + 0.02);

  clackGain.gain.setValueAtTime(0.0001, now);
  clackGain.gain.linearRampToValueAtTime(0.12, now + 0.002);
  clackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

  clack.connect(clackFilter);
  clackFilter.connect(clackGain);
  clackGain.connect(ctx.destination);
  clack.start(now);
  clack.stop(now + 0.028);
}

/**
 * Отчетливый двойной перестук соударения деревянных фигур.
 */
export function playCaptureSound(): void {
  if (isMuted.value) return;
  playMoveSound();
  setTimeout(() => playMoveSound(), 25);
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
