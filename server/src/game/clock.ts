// ============================================================
// Часы: авторитет — сервер. Храним remaining и timestamp последнего
// события; фактическое время списывается лениво при следующем событии.
// ============================================================

export interface ClockState {
  /** осталось у белых, мс */
  whiteMs: number;
  /** осталось у чёрных, мс */
  blackMs: number;
  /** чей ход: 'w' | 'b' | null (не запущены) */
  active: 'w' | 'b' | null;
  /** когда началось списание (server time) */
  sinceMs: number;
  /** инкремент, мс */
  incMs: number;
}

export function initClock(baseMs: number, incMs: number): ClockState {
  return { whiteMs: baseMs, blackMs: baseMs, active: null, sinceMs: 0, incMs };
}

/** Запустить часы для стороны, начинающей первой (без немедленного списания) */
export function startClockFor(c: ClockState, color: 'w' | 'b', atMs: number): ClockState {
  if (c.active !== null) return c;
  return { ...c, active: color, sinceMs: atMs };
}

/** Ход сделан: остановить списание, добавить инкремент сделавшему, передать ход */
export function clockOnMove(
  c: ClockState,
  moverColor: 'w' | 'b',
  atMs: number,
): { clock: ClockState; flagged: 'w' | 'b' | null } {
  if (c.active === null) {
    // Первый ход в партии: часы ещё не запущены — просто активируем вторую сторону
    return { clock: { ...c, active: oppositeColor(moverColor), sinceMs: atMs }, flagged: null };
  }
  if (c.active !== moverColor) return { clock: c, flagged: null };
  const elapsed = atMs - c.sinceMs;
  const remaining = Math.max(0, (moverColor === 'w' ? c.whiteMs : c.blackMs) - elapsed);
  let flagged: 'w' | 'b' | null = null;
  if (remaining <= 0) flagged = moverColor;
  const next: ClockState = {
    ...c,
    ...(moverColor === 'w' ? { whiteMs: remaining + c.incMs } : { blackMs: remaining + c.incMs }),
    active: oppositeColor(moverColor),
    sinceMs: atMs,
  };
  return { clock: next, flagged };
}

/** Текущие остатки с учётом списания (для отдачи клиентам) */
export function clockSnapshot(c: ClockState, atMs: number): { whiteMs: number; blackMs: number; running: boolean } {
  if (c.active === null) return { whiteMs: c.whiteMs, blackMs: c.blackMs, running: false };
  const elapsed = Math.max(0, atMs - c.sinceMs);
  const remaining = Math.max(0, (c.active === 'w' ? c.whiteMs : c.blackMs) - elapsed);
  return c.active === 'w'
    ? { whiteMs: remaining, blackMs: c.blackMs, running: true }
    : { whiteMs: c.whiteMs, blackMs: remaining, running: true };
}

export function oppositeColor(c: 'w' | 'b'): 'w' | 'b' {
  return c === 'w' ? 'b' : 'w';
}
