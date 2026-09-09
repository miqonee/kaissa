// server/src/ai/minimax.ts
// Alpha-Beta Minimax с ограничением раздумий 80 мс
import { Chess, type Move } from 'chess.js';
import { evaluateBoard, PIECE_VALUES } from './eval.js';

export interface ScoredMove {
  move: Move;
  score: number;
}

const MAX_TIME_MS = 80;

function orderMoves(moves: Move[]): Move[] {
  return moves.slice().sort((a, b) => {
    let scoreA = 0;
    let scoreB = 0;

    if (a.captured) {
      scoreA += (PIECE_VALUES[a.captured] || 0) * 10 - (PIECE_VALUES[a.piece] || 0);
    }
    if (a.promotion) scoreA += 800;
    if (a.san.includes('+')) scoreA += 50;

    if (b.captured) {
      scoreB += (PIECE_VALUES[b.captured] || 0) * 10 - (PIECE_VALUES[b.piece] || 0);
    }
    if (b.promotion) scoreB += 800;
    if (b.san.includes('+')) scoreB += 50;

    return scoreB - scoreA;
  });
}

/**
 * Minimax с Alpha-Beta отсечением и контролем времени.
 */
export function searchBestMoves(
  chess: Chess,
  maxDepth: number,
  timeBudgetMs = MAX_TIME_MS,
): ScoredMove[] {
  const isWhite = chess.turn() === 'w';
  const rootMoves = chess.moves({ verbose: true });
  if (rootMoves.length === 0) return [];
  if (rootMoves.length === 1) return [{ move: rootMoves[0], score: 0 }];

  const startTime = Date.now();
  let rankedMoves: ScoredMove[] = rootMoves.map((m) => ({ move: m, score: 0 }));

  // Итеративное углубление: от 1 до maxDepth
  for (let currentDepth = 1; currentDepth <= maxDepth; currentDepth++) {
    if (currentDepth > 1 && Date.now() - startTime >= timeBudgetMs) break;

    const currentRanked: ScoredMove[] = [];
    const ordered = orderMoves(rankedMoves.map((r) => r.move));
    let alpha = -Infinity;
    let beta = Infinity;
    let timeExceeded = false;

    for (const m of ordered) {
      if (currentDepth > 1 && Date.now() - startTime >= timeBudgetMs) {
        timeExceeded = true;
        break;
      }

      chess.move(m);
      const score = alphaBeta(chess, currentDepth - 1, alpha, beta, !isWhite, startTime, timeBudgetMs);
      chess.undo();

      currentRanked.push({ move: m, score });

      if (isWhite) {
        alpha = Math.max(alpha, score);
      } else {
        beta = Math.min(beta, score);
      }
    }

    if (!timeExceeded && currentRanked.length === rootMoves.length) {
      // Сортируем: для белых от высшего к низшему, для чёрных от низшего к высшему
      currentRanked.sort((a, b) => (isWhite ? b.score - a.score : a.score - b.score));
      rankedMoves = currentRanked;
    }
  }

  return rankedMoves;
}

function alphaBeta(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean,
  startTime: number,
  timeBudgetMs: number,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  if (Date.now() - startTime >= timeBudgetMs) {
    return evaluateBoard(chess);
  }

  const moves = orderMoves(chess.moves({ verbose: true }));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const m of moves) {
      chess.move(m);
      const ev = alphaBeta(chess, depth - 1, alpha, beta, false, startTime, timeBudgetMs);
      chess.undo();
      maxEval = Math.max(maxEval, ev);
      alpha = Math.max(alpha, ev);
      if (beta <= alpha) break;
      if (Date.now() - startTime >= timeBudgetMs) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const m of moves) {
      chess.move(m);
      const ev = alphaBeta(chess, depth - 1, alpha, beta, true, startTime, timeBudgetMs);
      chess.undo();
      minEval = Math.min(minEval, ev);
      beta = Math.min(beta, ev);
      if (beta <= alpha) break;
      if (Date.now() - startTime >= timeBudgetMs) break;
    }
    return minEval;
  }
}
