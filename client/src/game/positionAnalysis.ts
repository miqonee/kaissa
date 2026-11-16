import { Chess } from 'chess.js';

/** One immutable position's derived data. Never expose the mutable Chess engine.
 * Keep this per-board, not in a global FEN cache (long games must stay bounded).
 * Move generation is lazy so spectators/check-only consumers do not pay for it.
 */
export function createPositionAnalysis(fen: string) {
  let chess: Chess | null = null;
  try { if (fen) chess = new Chess(fen); } catch { /* Invalid/transient snapshot. */ }
  let destinations: Record<string, string[]> | undefined;
  let checkedKing: string | null | undefined;
  return {
    destinations(): Record<string, string[]> {
      if (destinations) return destinations;
      destinations = {};
      if (chess) {
        for (const move of chess.moves({ verbose: true })) {
          (destinations[move.from] ??= []).push(move.to);
        }
      }
      return destinations;
    },
    checkedKing(): string | null {
      if (checkedKing !== undefined) return checkedKing;
      checkedKing = null;
      if (chess?.isCheck()) {
        const king = chess.findPiece({ type: 'k', color: chess.turn() });
        checkedKing = king.length ? String(king[0]) : null;
      }
      return checkedKing;
    },
  };
}
