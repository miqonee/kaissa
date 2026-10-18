import { CrazyhouseGame, type CrazyhouseSnapshot } from 'shared/crazyhouse';
import { isDrop, type AnyMove } from 'shared/bughouse';
import { eloToLevel } from 'shared';
import { fairyPool } from './fairyStockfish.js';
import { moveUci } from './bughouse.js';

export function fallbackCrazyhouseMove(game: CrazyhouseGame): AnyMove | null {
  const legal = game.legalMoves(0, game.turn(0));
  let best = legal[0] ?? null;
  let bestScore = -Infinity;
  const deadline = Date.now() + 80;
  for (const move of legal.slice().sort((a, b) => Number(isDrop(b)) - Number(isDrop(a)))) {
    const probe = CrazyhouseGame.fromSnapshot(game.snapshot());
    const result = probe.apply(move);
    if (probe.isBughouseCheckmate(0)) return move;
    const score = (result.captured ? ({ p: 100, n: 320, b: 330, r: 500, q: 900 })[result.captured.piece] : 0) + (result.check ? 60 : 0) + (isDrop(move) ? 10 : 0);
    if (score > bestScore) { best = move; bestScore = score; }
    if (Date.now() >= deadline) break;
  }
  return best;
}

export async function chooseCrazyhouseMove(snapshot: CrazyhouseSnapshot, elo: number, remainingMs?: number): Promise<AnyMove | null> {
  const game = CrazyhouseGame.fromSnapshot(snapshot);
  const level = eloToLevel(elo);
  const legal = game.legalMoves(0, game.turn(0));
  if (!legal.length) return null;
  try {
    const budget = Math.max(20, Math.min(100 + level * 25, remainingMs === undefined ? 400 : remainingMs / 30));
    const candidates = await fairyPool.search(game.engineFen(0), level, budget, 'kaissa-crazyhouse');
    for (const candidate of candidates) {
      const move = legal.find(m => moveUci(m).toLowerCase() === candidate.uci.toLowerCase());
      if (move) return move;
    }
  } catch (error) { console.warn('[crazyhouse] Engine unavailable; using legal fallback:', error instanceof Error ? error.message : error); }
  return fallbackCrazyhouseMove(game);
}
