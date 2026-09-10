// client/src/utils/analysis.ts
// Клиентский анализ шахматной позиции: оценка, материальный перевес и шкала баланса (0% нагрузки на сервер)
import { Chess, type PieceSymbol } from 'chess.js';

export interface MaterialCount {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
}

export interface PositionAnalysis {
  scoreCp: number;          // Оценка в сантипешках со стороны белых (+ = белые, - = чёрные)
  evalText: string;         // Строка оценки (+0.4, -1.2, 0.0, #M1, #-M2)
  evalPercent: number;      // Процент белых для шкалы перевеса (0..100)
  verdictRu: string;        // Вердикт на русском (Равная позиция, Преимущество белых...)
  materialDiff: number;     // Разница материала (в пешках со стороны белых)
  whiteMaterial: number;
  blackMaterial: number;
  isCheck: boolean;
  isCheckmate: boolean;
  isDraw: boolean;
  isEndgame: boolean;
}

const PIECE_VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

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
  -5,  0,   0,   0,   0,   0,   0,  -5,
  -5,  0,   0,   0,   0,   0,   0,  -5,
  -5,  0,   0,   0,   0,   0,   0,  -5,
  -5,  0,   0,   0,   0,   0,   0,  -5,
  -5,  0,   0,   0,   0,   0,   0,  -5,
  0,   0,   0,   5,   5,   0,   0,   0,
];

const QUEEN_PST = [
  -20, -10, -10, -5, -5, -10, -10, -20,
  -10,   0,   0,  0,  0,   0,   0, -10,
  -10,   0,   5,  5,  5,   5,   0, -10,
  -5,    0,   5,  5,  5,   5,   0,  -5,
  0,     0,   5,  5,  5,   5,   0,  -5,
  -10,   5,   5,  5,  5,   5,   0, -10,
  -10,   0,   5,  0,  0,   0,   0, -10,
  -20, -10, -10, -5, -5, -10, -10, -20,
];

const KING_PST = [
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -30, -40, -40, -50, -50, -40, -40, -30,
  -20, -30, -30, -40, -40, -30, -30, -20,
  -10, -20, -20, -20, -20, -20, -20, -10,
  20,   20,   0,   0,   0,   0,  20,  20,
  20,   30,  10,   0,   0,  10,  30,  20,
];

const PST: Record<PieceSymbol, number[]> = {
  p: PAWN_PST,
  n: KNIGHT_PST,
  b: BISHOP_PST,
  r: ROOK_PST,
  q: QUEEN_PST,
  k: KING_PST,
};

export function analyzePosition(fen: string): PositionAnalysis {
  if (!fen) {
    return {
      scoreCp: 0,
      evalText: '0.0',
      evalPercent: 50,
      verdictRu: 'Начальная позиция',
      materialDiff: 0,
      whiteMaterial: 0,
      blackMaterial: 0,
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      isEndgame: false,
    };
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return {
      scoreCp: 0,
      evalText: '0.0',
      evalPercent: 50,
      verdictRu: 'Позиция',
      materialDiff: 0,
      whiteMaterial: 0,
      blackMaterial: 0,
      isCheck: false,
      isCheckmate: false,
      isDraw: false,
      isEndgame: false,
    };
  }

  const isCheckmate = chess.isCheckmate();
  const isDraw = chess.isDraw();
  const isCheck = chess.isCheck();

  if (isCheckmate) {
    const winnerWhite = chess.turn() === 'b';
    return {
      scoreCp: winnerWhite ? 10000 : -10000,
      evalText: winnerWhite ? '#M' : '#-M',
      evalPercent: winnerWhite ? 100 : 0,
      verdictRu: winnerWhite ? 'Мат! Победа белых' : 'Мат! Победа чёрных',
      materialDiff: 0,
      whiteMaterial: 0,
      blackMaterial: 0,
      isCheck: true,
      isCheckmate: true,
      isDraw: false,
      isEndgame: false,
    };
  }

  if (isDraw) {
    return {
      scoreCp: 0,
      evalText: '0.0',
      evalPercent: 50,
      verdictRu: 'Ничья (пат / повторение / правило)',
      materialDiff: 0,
      whiteMaterial: 0,
      blackMaterial: 0,
      isCheck: false,
      isCheckmate: false,
      isDraw: true,
      isEndgame: false,
    };
  }

  let whiteMat = 0;
  let blackMat = 0;
  let whitePos = 0;
  let blackPos = 0;
  let nonPawnTotal = 0;

  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const val = PIECE_VALUES[piece.type];
      const pstArray = PST[piece.type];

      if (piece.color === 'w') {
        whiteMat += val;
        if (piece.type !== 'p' && piece.type !== 'k') nonPawnTotal += val;
        const pstIdx = r * 8 + c;
        whitePos += pstArray[pstIdx];
      } else {
        blackMat += val;
        if (piece.type !== 'p' && piece.type !== 'k') nonPawnTotal += val;
        // Для чёрных отражаем строку
        const pstIdx = (7 - r) * 8 + c;
        blackPos += pstArray[pstIdx];
      }
    }
  }

  const isEndgame = nonPawnTotal < 1600;
  const rawScore = (whiteMat - blackMat) + Math.round((whitePos - blackPos) * 0.4);

  // Ограничиваем разумным диапазоном сантипешек
  const clampedCp = Math.max(-1500, Math.min(1500, rawScore));

  // Преобразуем сантипешки в процент шкалы перевеса (0..100)
  // Формула выигрышных шансов Lichess: winningChances = 2 / (1 + exp(-0.0035 * cp)) - 1
  const winningChances = 2 / (1 + Math.exp(-0.0035 * clampedCp)) - 1;
  const evalPercent = Math.round(50 + winningChances * 50);

  // Форматирование текста оценки (+1.2, -0.4, 0.0)
  const pawns = (clampedCp / 100).toFixed(1);
  const evalText = clampedCp > 0 ? `+${pawns}` : pawns === '-0.0' ? '0.0' : pawns;

  let verdictRu = 'Равная позиция';
  if (clampedCp > 350) verdictRu = 'Решающий перевес белых';
  else if (clampedCp > 130) verdictRu = 'Преимущество белых';
  else if (clampedCp > 40) verdictRu = 'Небольшой перевес белых';
  else if (clampedCp < -350) verdictRu = 'Решающий перевес чёрных';
  else if (clampedCp < -130) verdictRu = 'Преимущество чёрных';
  else if (clampedCp < -40) verdictRu = 'Небольшой перевес чёрных';

  if (isCheck) {
    verdictRu += ` · Шах ${chess.turn() === 'w' ? 'белым' : 'чёрным'}`;
  }

  const materialDiff = Math.round((whiteMat - blackMat) / 100);

  return {
    scoreCp: clampedCp,
    evalText,
    evalPercent,
    verdictRu,
    materialDiff,
    whiteMaterial: whiteMat,
    blackMaterial: blackMat,
    isCheck,
    isCheckmate: false,
    isDraw: false,
    isEndgame,
  };
}
