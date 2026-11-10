/** Best effort feedback: browsers without vibration support silently continue. */
export function vibrateMove(enabled: boolean): void {
  if (!enabled || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  if (typeof matchMedia === 'undefined' || !matchMedia('(pointer: coarse)').matches) return;
  try { navigator.vibrate(12); } catch { /* Device/browser policy may reject vibration. */ }
}
