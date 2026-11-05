import { MultiChess, type MultiSnapshot, type Role } from 'shared';

export interface MultiBotMove {
  from: string;
  to: string;
}

/**
 * Simple, fast greedy heuristic bot for 3-player and 4-player FFA modes.
 * Evaluates captures, check/checkmate bonuses, promotions, central control, and hanging-piece risk.
 */
export function chooseMultiMove(snapshot: MultiSnapshot, botRating = 1200): MultiBotMove | null {
  const base = MultiChess.fromSnapshot(snapshot);
  const seat = base.turn();
  const legalMap = base.legalMoves(seat);
  if (legalMap.size === 0) return null;

  const pieceValues = base.topology.pieceValues();
  const candidates: { from: string; to: string; score: number }[] = [];
  const centerX = base.topology.viewSize / 2;
  const centerY = base.topology.viewSize / 2;
  const maxDist = base.topology.viewSize * 0.7;

  for (const [from, tos] of legalMap.entries()) {
    const moving = base.pieceAt(from);
    if (!moving) continue;

    for (const to of tos) {
      const sim = MultiChess.fromSnapshot(snapshot);
      const outcome = sim.move(seat, from, to);

      let score = outcome.pointsAwarded * 12;

      // Checkmate / elimination bonus is already included in pointsAwarded (+20),
      // add extra tactical priority for delivering check or mate
      if (outcome.eliminated.some((e) => e.bySeat === seat)) {
        score += 80;
      }
      if (outcome.checkedSeats.length > 0) {
        score += outcome.checkedSeats.length * 6;
      }
      if (outcome.promoted) {
        score += 35;
      }

      // Evaluate hanging risk on the destination square
      const placedRole: Role = outcome.promoted ? 'q' : moving.role;
      const myValue = outcome.promoted ? 5 : pieceValues[placedRole];
      const attackers = sim.attackersOfSquare(to, seat);
      if (attackers.length > 0) {
        // Check if defended by another own piece
        const simBoard = sim.snapshot().board;
        delete simBoard[to];
        const defended = sim.isSquareAttacked(to, -1, Object.fromEntries(
          Object.entries(simBoard).filter(([, p]) => p.seat === seat && !p.dead),
        ));
        if (!defended) {
          score -= myValue * 11;
        } else {
          const cheapestAttacker = Math.min(...attackers.map((a) => pieceValues[a.role]));
          if (cheapestAttacker < myValue) {
            score -= (myValue - cheapestAttacker) * 9;
          } else {
            score -= myValue * 2;
          }
        }
      }

      // Slight advancement / centralization bonus
      const cell = base.topology.cellById.get(to);
      const origCell = base.topology.cellById.get(from);
      if (cell && origCell && moving.role !== 'k') {
        const dNew = Math.hypot(cell.center[0] - centerX, cell.center[1] - centerY);
        const dOld = Math.hypot(origCell.center[0] - centerX, origCell.center[1] - centerY);
        score += ((dOld - dNew) / maxDist) * (moving.role === 'p' ? 4 : 2.5);
      }

      // Avoid moving the king unnecessarily early unless castling
      if (moving.role === 'k') {
        const isCastle = base.topology.castling(seat).some((c) => c.king === from && c.kingTo === to);
        if (isCastle) score += 10;
        else if (!base.isSeatInCheck(seat)) score -= 3;
      }

      // Rating-dependent noise so weaker bots play less accurately
      const noiseAmp = Math.max(1, (1900 - Math.min(1800, Math.max(600, botRating))) / 110);
      score += (Math.random() - 0.5) * noiseAmp;

      candidates.push({ from, to, score });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  return { from: candidates[0].from, to: candidates[0].to };
}

export function multiBotThinkingDelayMs(remainingMs?: number, isDemo = false): number {
  if (isDemo) return 450 + Math.floor(Math.random() * 350);
  if (remainingMs !== undefined && remainingMs < 15_000) {
    return 220 + Math.floor(Math.random() * 200);
  }
  return 600 + Math.floor(Math.random() * 550);
}
