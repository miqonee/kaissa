// server/src/ai/eval.ts
// Оценка позиции: материал + Piece-Square Tables (PST)
import { Chess, type PieceSymbol, type Color } from 'chess.js';

export const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// PST (ориентированы для белых: ранг 8 = индекс 0..7, ранг 1 = индекс 56..63)
const PAWN_PST = [
  0,   0,   0,   0,   0,   0,   0,   0,
  50,  50,  50,  50,  50,  50,  50,  50,
  10,  10,  20,  30,  30,  20,  10,  10,
  5,   5,  10,  25,  25,  10,   5,   5,
  0,   0,   0,  20,  20,   0,   0,   0,
  5,  -5, -10,   0,   0, -10,  -5,   5,
  5,  10,  10, -20, -20,  10,  10,   5,
  0,   0,   0,   0,   0,   0,   0,   0,
];

const KNIGHT_PST = [
  -50, -40, -30, -30, -30, -30, -40, -50,
  -40, -20,   0,   0,   0,   0, -20, -40,
  -30,   0,  10,  15,  15,  10,   0, -30,
  -30,   5,  15,  20,  20,  15,   5, -30,
  -30,   0,  15,  20,  20,  15,   0, -30,
  -30,   5,  10,  15,  15,  10,   5, -30,
  -40, -20,   0,   5,   5,   0, -20, -40,
  -50, -40, -30, -30, -30, -30, -40, -50,
];

const BISHOP_PST = [
  -20, -10, -10, -10, -10, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,  10,  10,   5,   0, -10,
  -10,   5,   5,  10,  10,   5,   5, -10,
  -10,   0,  10,  10,  10,  10,   0, -10,
  -10,  10,  10,  10,  10,  10,  10, -10,
  -10,   5,   0,   0,   0,   0,   5, -10,
  -20, -10, -10, -10, -10, -10, -10, -20,
];

const ROOK_PST = [
  0,   0,   0,   0,   0,   0,   0,   0,
  5,  10,  10,  10,  10,  10,  10,   5,
 -5,   0,   0,   0,   0,   0,   0,  -5,
 -5,   0,   0,   0,   0,   0,   0,  -5,
 -5,   0,   0,   0,   0,   0,   0,  -5,
 -5,   0,   0,   0,   0,   0,   0,  -5,
 -5,   0,   0,   0,   0,   0,   0,  -5,
  0,   0,   0,   5,   5,   0,   0,   0,
];

const QUEEN_PST = [
  -20, -10, -10,  -5,  -5, -10, -10, -20,
  -10,   0,   0,   0,   0,   0,   0, -10,
  -10,   0,   5,   5,   5,   5,   0, -10,
   -5,   0,   5,   5,   5,   5,   0,  -5,
    0,   0,   5,   5,   5,   5,   0,  -5,
  -10,   5,   5,   5,   5,   5,   0, -10,
  -10,   0,   5,   0,   0,   0,   0, -10,
  -20, -10, -10,  -5,  -5, -10, -10, -20,
];

const KING_MID_PST = [
  -40, -40, -40, -50, -50, -40, -40, -40,
  -40, -40, -40, -50, -50, -40, -40, -40,
  -40, -40, -40, -50, -50, -40, -40, -40,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -35, -45, -45, -35, -30, -20,
  -10, -20, -25, -35, -35, -25, -20, -10,
   15,  15, -20, -25, -25, -20,  15,  15,
   20,  30,  25,   0,   5,   0,  30,  20,
];

const KING_END_PST = [
  -50, -30, -30, -30, -30, -30, -30, -50,
  -30, -10,   0,   0,   0,   0, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  30,  40,  40,  30, -10, -30,
  -30, -10,  20,  30,  30,  20, -10, -30,
  -30, -20, -10,   0,   0, -10, -20, -30,
  -50, -40, -30, -20, -20, -30, -40, -50,
];

const PST_MAP: Record<PieceSymbol, number[]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_MID_PST,
};

/**
 * Оценка позиции с точки зрения белых (положительное = перевес белых, отрицательное = чёрных).
 */
export function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    return chess.turn() === 'w' ? -100000 : 100000;
  }
  if (chess.isDraw()) {
    return 0;
  }

  let score = 0;
  let whiteMaterial = 0;
  let blackMaterial = 0;
  let whiteNonPawn = 0;
  let blackNonPawn = 0;

  let wKingR = 7, wKingC = 4;
  let bKingR = 0, bKingC = 4;

  const board = chess.board();

  // Первый проход: сбор материала и позиций королей
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type];
      if (piece.color === 'w') {
        whiteMaterial += val;
        if (piece.type !== 'p' && piece.type !== 'k') whiteNonPawn += val;
        if (piece.type === 'k') { wKingR = r; wKingC = c; }
      } else {
        blackMaterial += val;
        if (piece.type !== 'p' && piece.type !== 'k') blackNonPawn += val;
        if (piece.type === 'k') { bKingR = r; bKingC = c; }
      }
    }
  }

  // Вес эндшпиля: 0 (дебют/миттельшпиль) -> 1 (глубокий эндшпиль)
  const nonPawnTotal = whiteNonPawn + blackNonPawn;
  const endgameWeight = Math.max(0, Math.min(1, (2600 - nonPawnTotal) / 2000));

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type];
      const pst = PST_MAP[piece.type];
      const pstIdx = piece.color === 'w' ? r * 8 + c : (7 - r) * 8 + c;

      let posBonus = 0;
      if (piece.type === 'k') {
        // Динамический переход короля в центр в эндшпиле
        const midScore = KING_MID_PST[pstIdx];
        const endScore = KING_END_PST[pstIdx];
        posBonus = Math.round((1 - endgameWeight) * midScore + endgameWeight * endScore);
      } else if (piece.type === 'p') {
        posBonus = pst[pstIdx] || 0;
        // Экспоненциальный бонус за продвинутые пешки в эндшпиле
        const rankAdv = piece.color === 'w' ? (7 - r) : r;
        if (rankAdv >= 4) {
          posBonus += Math.round((rankAdv - 3) * 18 * endgameWeight);
        }
      } else {
        posBonus = pst[pstIdx] || 0;
      }

      const pieceTotal = val + posBonus;
      if (piece.color === 'w') {
        score += pieceTotal;
      } else {
        score -= pieceTotal;
      }
    }
  }

  // Бонусы за рокировку и пешечный/фианкетто щит в дебюте и миттельшпиле
  if (endgameWeight < 0.7) {
    const wRights = chess.getCastlingRights('w');
    const bRights = chess.getCastlingRights('b');

    // Белые
    const wCastled = wKingR === 7 && (wKingC === 6 || wKingC === 2 || wKingC === 1);
    if (wCastled) {
      score += 35;
      // Проверка пешечного щита на королевском фланге с поддержкой фианкетто (g3 + Bg2)
      if (wKingC === 6) {
        const hasF = (board[6][5]?.type === 'p' && board[6][5]?.color === 'w') || (board[5][5]?.type === 'p' && board[5][5]?.color === 'w');
        const hasGStandard = board[6][6]?.type === 'p' && board[6][6]?.color === 'w';
        const hasGFianchetto = board[5][6]?.type === 'p' && board[5][6]?.color === 'w' && board[6][6]?.type === 'b' && board[6][6]?.color === 'w';
        const hasH = (board[6][7]?.type === 'p' && board[6][7]?.color === 'w') || (board[5][7]?.type === 'p' && board[5][7]?.color === 'w');
        if (hasF) score += 8;
        if (hasGStandard || hasGFianchetto) score += 10;
        if (hasH) score += 8;
      }
    } else if (wRights.k || wRights.q) {
      score += 15; // Сохранение права на рокировку
    } else {
      score -= 30; // Потеря права на рокировку королём в центре
    }

    // Чёрные
    const bCastled = bKingR === 0 && (bKingC === 6 || bKingC === 2 || bKingC === 1);
    if (bCastled) {
      score -= 35;
      if (bKingC === 6) {
        const hasF = (board[1][5]?.type === 'p' && board[1][5]?.color === 'b') || (board[2][5]?.type === 'p' && board[2][5]?.color === 'b');
        const hasGStandard = board[1][6]?.type === 'p' && board[1][6]?.color === 'b';
        const hasGFianchetto = board[2][6]?.type === 'p' && board[2][6]?.color === 'b' && board[1][6]?.type === 'b' && board[1][6]?.color === 'b';
        const hasH = (board[1][7]?.type === 'p' && board[1][7]?.color === 'b') || (board[2][7]?.type === 'p' && board[2][7]?.color === 'b');
        if (hasF) score -= 8;
        if (hasGStandard || hasGFianchetto) score -= 10;
        if (hasH) score -= 8;
      }
    } else if (bRights.k || bRights.q) {
      score -= 15;
    } else {
      score += 30;
    }
  }

  // Mop-up эвалюация: активируется ИСКЛЮЧИТЕЛЬНО в глубоком эндшпиле без ферзей у слабейшей стороны
  if (endgameWeight >= 0.75) {
    if (whiteMaterial - blackMaterial >= 350 && blackNonPawn <= 330) {
      const bKingCenterDist = Math.max(3 - bKingR, bKingR - 4) + Math.max(3 - bKingC, bKingC - 4);
      const kingsDist = Math.max(Math.abs(wKingR - bKingR), Math.abs(wKingC - bKingC));
      score += Math.round((bKingCenterDist * 16 + (7 - kingsDist) * 22) * endgameWeight);
    } else if (blackMaterial - whiteMaterial >= 350 && whiteNonPawn <= 330) {
      const wKingCenterDist = Math.max(3 - wKingR, wKingR - 4) + Math.max(3 - wKingC, wKingC - 4);
      const kingsDist = Math.max(Math.abs(wKingR - bKingR), Math.abs(wKingC - bKingC));
      score -= Math.round((wKingCenterDist * 16 + (7 - kingsDist) * 22) * endgameWeight);
    }
  }

  return score;
}
