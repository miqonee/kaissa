export const YANDEX_METRIKA_ID = 113120948;

/** Goals contain game context only, never names, chat, or credentials. */
export function trackGoal(goal: string, params: Record<string, string | number | boolean> = {}, onceKey?: string): void {
  if (typeof window === 'undefined') return;
  const ym = (window as any).ym;
  if (typeof ym !== 'function') return;
  try {
    const key = onceKey ? `kaissa.goal.${goal}.${onceKey}` : null;
    if (key && sessionStorage.getItem(key)) return;
    ym(YANDEX_METRIKA_ID, 'reachGoal', goal, params);
    if (key) sessionStorage.setItem(key, '1');
  } catch { /* Analytics must never interrupt a game. */ }
}
