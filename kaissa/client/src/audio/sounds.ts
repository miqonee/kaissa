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
 * Естественный глухой стук деревянной фигуры о доску (без резких щелчков).
 * Акустическая модель: мягкий войлочный контакт (480Hz lowpass) + резонанс доски (190Hz -> 65Hz).
 */
export function playMoveSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(460, now);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(195, now);
  osc.frequency.exponentialRampToValueAtTime(62, now + 0.048);

  // Мягкая атака (5мс) исключает резкий цифровой щелчок (click/pop)
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.18, now + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.058);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.062);
}

/**
 * Акустическое взятие: соударение двух деревянных фигур (сдвоенный мягкий стук).
 */
export function playCaptureSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Первый глухой стук (сбиваемая фигура сдвигается)
  const osc1 = ctx.createOscillator();
  const filter1 = ctx.createBiquadFilter();
  const gain1 = ctx.createGain();

  filter1.type = 'lowpass';
  filter1.frequency.setValueAtTime(520, now);
  osc1.type = 'sine';
  osc1.frequency.setValueAtTime(240, now);
  osc1.frequency.exponentialRampToValueAtTime(80, now + 0.04);

  gain1.gain.setValueAtTime(0.0001, now);
  gain1.gain.linearRampToValueAtTime(0.14, now + 0.004);
  gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

  osc1.connect(filter1);
  filter1.connect(gain1);
  gain1.connect(ctx.destination);
  osc1.start(now);
  osc1.stop(now + 0.05);

  // Второй стук со смещением 22мс (фигура ставится на поле)
  const t2 = now + 0.022;
  const osc2 = ctx.createOscillator();
  const filter2 = ctx.createBiquadFilter();
  const gain2 = ctx.createGain();

  filter2.type = 'lowpass';
  filter2.frequency.setValueAtTime(420, t2);
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(175, t2);
  osc2.frequency.exponentialRampToValueAtTime(58, t2 + 0.05);

  gain2.gain.setValueAtTime(0.0001, t2);
  gain2.gain.linearRampToValueAtTime(0.20, t2 + 0.004);
  gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.055);

  osc2.connect(filter2);
  filter2.connect(gain2);
  gain2.connect(ctx.destination);
  osc2.start(t2);
  osc2.stop(t2 + 0.06);
}

/**
 * Драматический звук потери королевы (ферзя).
 * Глубокий, напряженный нисходящий тритон с темным резонатором.
 */
export function playQueenLossSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Нисходящий тревожный тон (D4 -> Ab3 / 293.7 -> 207.6 Гц)
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(700, now);
  filter.frequency.exponentialRampToValueAtTime(250, now + 0.35);

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(293.66, now);
  osc.frequency.exponentialRampToValueAtTime(207.65, now + 0.28);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.linearRampToValueAtTime(0.22, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.45);

  // Глухой низкий бас-удар под ферзем
  const sub = ctx.createOscillator();
  const subGain = ctx.createGain();
  sub.type = 'sine';
  sub.frequency.setValueAtTime(110, now);
  sub.frequency.exponentialRampToValueAtTime(45, now + 0.3);

  subGain.gain.setValueAtTime(0.0001, now);
  subGain.gain.linearRampToValueAtTime(0.18, now + 0.008);
  subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

  sub.connect(subGain);
  subGain.connect(ctx.destination);

  sub.start(now);
  sub.stop(now + 0.38);
}

/**
 * Мягкий гармоничный колокольчик при шахе (не резкий писк).
 */
export function playCheckSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [587.33, 880].forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(idx === 0 ? 0.12 : 0.07, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.32);
  });
}

/** Быстрый двойной перестук рокировки */
export function playCastleSound(): void {
  playMoveSound();
  setTimeout(() => playMoveSound(), 80);
}

/** Мягкая постановка фигуры из кармана (багхаус) */
export function playDropSound(): void {
  playMoveSound();
}

/** Звук поражения (торжественно-минорное нисходящее созвучие) */
export function playDefeatSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  // Минорный аккорд: Eb3, C3, Ab2, G2
  const freqs = [155.56, 130.81, 103.83, 98.0];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(500, now + idx * 0.09);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.09);

    gain.gain.setValueAtTime(0.0001, now + idx * 0.09);
    gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.09 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.09 + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.09);
    osc.stop(now + idx * 0.09 + 0.65);
  });
}

/** Финальный звук окончания партии (победа или поражение) */
export function playGameEndSound(won: boolean = true): void {
  if (won) {
    if (isMuted.value) return;
    const ctx = getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Мажорный перебор: C4, E4, G4, C5
    const freqs = [261.63, 329.63, 392.0, 523.25];

    freqs.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.07 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.6);
    });
  } else {
    playDefeatSound();
  }
}
