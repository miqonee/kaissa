export function formatGameClock(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  const s = Math.max(0, Math.ceil(ms / 100) / 10);
  if (ms < 20_000) return s.toFixed(1);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Chessground only needs the adaptive animation range, not every clock tick.
// Representatives retain the exact <= thresholds in settings.resolveAnimation.
export function animationClockRange(ms: number | null): number | null {
  if (ms === null || !Number.isFinite(ms)) return null;
  if (ms <= 60_000) return 60_000;
  if (ms <= 120_000) return 120_000;
  return 120_001;
}
