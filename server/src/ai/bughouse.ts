import { BughouseGame, isDrop, partnerOf, type AnyMove, type Board, type BughouseSnapshot } from 'shared/bughouse';
import { eloToLevel, type PieceType } from 'shared';
import { fairyPool, type FairyCandidate } from './fairyStockfish.js';

export type BughouseBotDecision = AnyMove;
const VALUES: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
export const moveUci = (move: AnyMove): string => isDrop(move) ? `${move.piece.toUpperCase()}@${move.to}` : `${move.from}${move.to}${move.promotion ?? ''}`;
export function bughouseThinkingDelay(remainingMs?: number): number {
  return remainingMs !== undefined && remainingMs < 10_000 ? 80 : 350 + Math.floor(Math.random() * 650);
}

function teamBonus(game: BughouseGame, move: AnyMove): number {
  const color = game.turn(move.board);
  const partner = partnerOf({ board: move.board, color });
  const before = game.pocketOf(partner.board, partner.color);
  const next = BughouseGame.fromSnapshot(game.snapshot());
  const result = next.apply(move);
  // Immediate terminal wins always outrank positional scores.
  if (next.isBughouseCheckmate(move.board) || next.isBughouseStalemate(move.board)) return 100_000;
  if (!result.captured) return 0;
  const piece = result.captured.piece;
  let bonus = VALUES[piece] * 0.05;
  if (game.turn(partner.board) === partner.color && before[piece] === 0) {
    const drops = next.legalDrops(partner.board)[piece] ?? [];
    if (game.isCheck(partner.board) && drops.length) bonus += 60;
    // A newly supplied mating drop wins the entire match.
    for (const to of drops) {
      const probe = BughouseGame.fromSnapshot(next.snapshot());
      probe.apply({ board: partner.board, piece, to });
      if (probe.isBughouseCheckmate(partner.board)) return 100_000;
    }
  }
  return Math.min(80, bonus);
}

/** Filter UCI output through the authoritative variant rules, then choose
 * amongst close alternatives using the other board's tactical needs. */
export function selectBughouseCandidate(game: BughouseGame, board: Board, candidates: FairyCandidate[]): AnyMove | null {
  const legal = game.legalMoves(board, game.turn(board));
  const valid = candidates.flatMap(candidate => {
    const move = legal.find(move => moveUci(move).toLowerCase() === candidate.uci.toLowerCase());
    return move ? [{ ...candidate, move }] : [];
  });
  if (!valid.length) return null;
  const best = Math.max(...valid.map(candidate => candidate.score));
  // Never trade away a forced mate for a positional team bonus.
  const close = valid.filter(candidate => best - candidate.score <= 100);
  return close.map(candidate => ({ move: candidate.move, score: candidate.score + teamBonus(game, candidate.move) })).sort((a, b) => b.score - a.score)[0].move;
}

export function fallbackBughouseMove(game: BughouseGame, board: Board): AnyMove | null {
  const legal = game.legalMoves(board, game.turn(board));
  if (!legal.length) return null;
  // Prefer checks and captures, but include every legal drop, including the
  // sole defence in positions chess.js considers checkmate.
  const deadline = Date.now() + 80;
  let best = legal[0];
  let bestScore = -Infinity;
  const ordered = legal.slice().sort((a, b) => Number(isDrop(b)) - Number(isDrop(a)));
  for (const move of ordered) {
    const next = BughouseGame.fromSnapshot(game.snapshot());
    const result = next.apply(move);
    const score = (result.captured ? VALUES[result.captured.piece] : 0) + (result.check ? 60 : 0) + (isDrop(move) ? 10 : 0);
    if (next.isBughouseCheckmate(board) || next.isBughouseStalemate(board)) return move;
    if (score > bestScore) { best = move; bestScore = score; }
    if (Date.now() >= deadline) break;
  }
  return best;
}

export async function chooseBughouseMove(snapshot: BughouseSnapshot, board: Board, elo: number, remainingMs?: number): Promise<AnyMove | null> {
  const game = BughouseGame.fromSnapshot(snapshot);
  const level = eloToLevel(elo);
  const budgetMs = Math.max(20, Math.min(100 + level * 25, remainingMs === undefined ? 400 : remainingMs / 30));
  try {
    const candidates = await fairyPool.search(game.engineFen(board), level, budgetMs);
    const move = selectBughouseCandidate(game, board, candidates);
    if (move) return move;
  } catch (error) { console.warn('[bughouse] Engine unavailable; using legal variant fallback:', error instanceof Error ? error.message : error); }
  return fallbackBughouseMove(game, board);
}
