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

/** Естественный глухой стук деревянной фигуры о доску */
export function playMoveSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(900, now);

  osc.type = 'sine';
  osc.frequency.setValueAtTime(260, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.05);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.065);
}

/** Сочный щелчок взятия фигуры */
export function playCaptureSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(340, now);
  osc.frequency.exponentialRampToValueAtTime(90, now + 0.07);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.35, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.085);
}

/** Звонкий металлический колокольчик при шахе */
export function playCheckSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  [660, 880].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(i === 0 ? 0.25 : 0.18, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.36);
  });
}

/** Сдвоенный перестук рокировки */
export function playCastleSound(): void {
  playMoveSound();
  setTimeout(() => playMoveSound(), 90);
}

/** Выставление фигуры из кармана (багхаус) */
export function playDropSound(): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(320, now);
  osc.frequency.exponentialRampToValueAtTime(110, now + 0.05);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.3, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.065);
}

/** Финальный торжественный аккорд завершения партии */
export function playGameEndSound(won: boolean = true): void {
  if (isMuted.value) return;
  const ctx = getContext();
  if (!ctx) return;

  const now = ctx.currentTime;
  const freqs = won ? [523.25, 659.25, 783.99, 1046.5] : [440.0, 392.0, 349.23, 293.66];

  freqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now + idx * 0.06);

    gain.gain.setValueAtTime(0.001, now + idx * 0.06);
    gain.gain.linearRampToValueAtTime(0.18, now + idx * 0.06 + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.06 + 0.55);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now + idx * 0.06);
    osc.stop(now + idx * 0.06 + 0.58);
  });
}
