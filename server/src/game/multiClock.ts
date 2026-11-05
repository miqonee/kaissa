import { PREMOVE_LAG_COMPENSATION_MS } from './clock.js';

export interface MultiClockState {
  remainingMs: number[];
  active: number | null;
  sinceMs: number;
  incMs: number;
}

export function initMultiClock(seats: number, baseMs: number, incMs: number): MultiClockState {
  return {
    remainingMs: Array.from({ length: seats }, () => baseMs),
    active: null,
    sinceMs: 0,
    incMs,
  };
}

export function multiClockSnapshot(
  c: MultiClockState,
  atMs: number,
): { remainingMs: number[]; active: number | null; running: boolean } {
  const remainingMs = [...c.remainingMs];
  if (c.active === null) {
    return { remainingMs, active: null, running: false };
  }
  const elapsed = Math.max(0, atMs - c.sinceMs);
  remainingMs[c.active] = Math.max(0, remainingMs[c.active] - elapsed);
  return { remainingMs, active: c.active, running: true };
}

export function multiClockOnMove(
  c: MultiClockState,
  moverSeat: number,
  nextSeat: number | null,
  atMs: number,
): { clock: MultiClockState; flagged: boolean } {
  const remainingMs = [...c.remainingMs];
  if (c.active === null) {
    return {
      clock: {
        ...c,
        remainingMs,
        active: nextSeat,
        sinceMs: atMs,
      },
      flagged: false,
    };
  }
  if (c.active !== moverSeat) {
    return { clock: { ...c, remainingMs, active: nextSeat, sinceMs: atMs }, flagged: false };
  }
  const elapsed = Math.max(0, atMs - c.sinceMs);
  const effective = elapsed <= PREMOVE_LAG_COMPENSATION_MS ? 0 : elapsed;
  const rem = Math.max(0, remainingMs[moverSeat] - effective);
  if (rem <= 0) {
    remainingMs[moverSeat] = 0;
    return {
      clock: {
        ...c,
        remainingMs,
        active: nextSeat,
        sinceMs: atMs,
      },
      flagged: true,
    };
  }
  remainingMs[moverSeat] = rem + c.incMs;
  return {
    clock: {
      ...c,
      remainingMs,
      active: nextSeat,
      sinceMs: atMs,
    },
    flagged: false,
  };
}

export function multiClockSwitchSeat(
  c: MultiClockState,
  nextSeat: number | null,
  atMs: number,
): MultiClockState {
  const snap = multiClockSnapshot(c, atMs);
  return {
    ...c,
    remainingMs: snap.remainingMs,
    active: nextSeat,
    sinceMs: atMs,
  };
}
