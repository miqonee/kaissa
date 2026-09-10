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

export interface PositionPlan {
  stage: 'opening' | 'middlegame' | 'endgame';
  structureNameRu: string;
  strategicPlanRu: string;
}

export interface DevelopmentInfo {
  whiteDeveloped: number;
  whiteTotal: number;
  blackDeveloped: number;
  blackTotal: number;
  whiteUndeveloped: string[];
  blackUndeveloped: string[];
  complete: boolean;
  summaryRu: string;
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
  positionPlan: PositionPlan;
  development: DevelopmentInfo;
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

function analyzePositionStructure(chess: Chess, isEndgame: boolean): PositionPlan {
  const board = chess.board();
  let whiteQueens = 0;
  let blackQueens = 0;
  let whiteRooks = 0;
  let blackRooks = 0;
  let whiteMinors = 0;
  let blackMinors = 0;

  let d4Pawn = false;
  let e4Pawn = false;
  let d5Pawn = false;
  let e5Pawn = false;
  let c4Pawn = false;
  let c5Pawn = false;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      if (p.type === 'q') {
        if (p.color === 'w') whiteQueens++;
        else blackQueens++;
      } else if (p.type === 'r') {
        if (p.color === 'w') whiteRooks++;
        else blackRooks++;
      } else if (p.type === 'b' || p.type === 'n') {
        if (p.color === 'w') whiteMinors++;
        else blackMinors++;
      } else if (p.type === 'p') {
        if (p.color === 'w') {
          if (r === 4 && c === 3) d4Pawn = true;
          if (r === 4 && c === 4) e4Pawn = true;
          if (r === 4 && c === 2) c4Pawn = true;
        } else {
          if (r === 3 && c === 3) d5Pawn = true;
          if (r === 3 && c === 4) e5Pawn = true;
          if (r === 3 && c === 2) c5Pawn = true;
        }
      }
    }
  }

  const totalQueens = whiteQueens + blackQueens;
  const totalRooks = whiteRooks + blackRooks;
  const totalMinors = whiteMinors + blackMinors;

  if (isEndgame) {
    if (totalQueens === 0 && totalRooks === 0 && totalMinors === 0) {
      return {
        stage: 'endgame',
        structureNameRu: 'Пешечный эндшпиль',
        strategicPlanRu: 'Оппозиция королей, создание отдаленной проходной пешки и прорыв короля к ключевым полям превращения.',
      };
    }
    if (totalQueens === 0 && totalMinors === 0 && totalRooks > 0) {
      return {
        stage: 'endgame',
        structureNameRu: 'Ладейный эндшпиль',
        strategicPlanRu: 'Правило Тарраша: ладья позади проходной. Активизируйте короля, отрезайте короля соперника по вертикали и ведите проходную.',
      };
    }
    if (totalQueens === 0 && totalRooks === 0 && totalMinors > 0) {
      return {
        stage: 'endgame',
        structureNameRu: 'Легкофигурный эндшпиль',
        strategicPlanRu: 'Кони сильны при фиксированных пешечных слабостях в центре, слоны превосходят коней на открытых диагоналях и двух флангах.',
      };
    }
    if (totalQueens === 0 && totalRooks > 0 && totalMinors > 0) {
      return {
        stage: 'endgame',
        structureNameRu: 'Ладейно-фигурный эндшпиль',
        strategicPlanRu: 'Захват открытых вертикалей седьмой горизонтали и сковывание фигур соперника защитой слабых пешек.',
      };
    }
    return {
      stage: 'endgame',
      structureNameRu: 'Ферзевый эндшпиль',
      strategicPlanRu: 'Безопасность короля от вечного шаха и продвижение проходных пешек при активной поддержке ферзя.',
    };
  }

  // Миттельшпиль
  if (d4Pawn && d5Pawn && (e4Pawn || e5Pawn || c4Pawn || c5Pawn)) {
    return {
      stage: 'middlegame',
      structureNameRu: 'Закрытый центр',
      strategicPlanRu: 'Маневренная борьба на флангах. Подготовка пешечных подрывов c4/c5 или f4/f5 для вскрытия линий атаки.',
    };
  }

  if (!d4Pawn && !d5Pawn && !e4Pawn && !e5Pawn) {
    return {
      stage: 'middlegame',
      structureNameRu: 'Открытый центр',
      strategicPlanRu: 'Острая фигурная борьба по открытым центральным линиям. Решают опережение в развитии, тактические удары и форпосты.',
    };
  }

  if ((d4Pawn && !c4Pawn && !e4Pawn) || (d5Pawn && !c5Pawn && !e5Pawn)) {
    return {
      stage: 'middlegame',
      structureNameRu: 'Изолированная ферзевая пешка',
      strategicPlanRu: 'Владелец изолятора стремится к быстрой фигурной атаке и вскрытию центра; соперник блокирует пешку и стремится к размену фигур.',
    };
  }

  return {
    stage: 'middlegame',
    structureNameRu: 'Фигурная игра в миттельшпиле',
    strategicPlanRu: 'Гармоничное взаимодействие фигур, захват ключевых полей и создание слабостей в пешечной структуре соперника.',
  };
}

function analyzeDevelopment(chess: Chess): DevelopmentInfo {
  const board = chess.board();
  const files = 'abcdefgh';
  const sq = (r: number, c: number): string => `${files[c]}${8 - r}`;
  const at = (r: number, c: number): { type: string; color: string } | null => {
    const p = board[r]?.[c];
    return p ? { type: p.type, color: p.color } : null;
  };

  // Считаем развитие лёгких фигур + ферзь + король (рокировка/ход короля). Ладьи — позже, не шумят в дебюте.
  const mk = (color: 'w' | 'b'): { r: number; c: number; type: 'n' | 'b' | 'q' | 'k'; label: string }[] => {
    const home = color === 'w' ? 7 : 0;
    return [
      { r: home, c: 1, type: 'n', label: `К${sq(home, 1)}` },
      { r: home, c: 6, type: 'n', label: `К${sq(home, 6)}` },
      { r: home, c: 2, type: 'b', label: `С${sq(home, 2)}` },
      { r: home, c: 5, type: 'b', label: `С${sq(home, 5)}` },
      { r: home, c: 3, type: 'q', label: `Ф${sq(home, 3)}` },
      { r: home, c: 4, type: 'k', label: `Кр${sq(home, 4)}` },
    ];
  };

  const evalSide = (color: 'w' | 'b'): { developed: number; total: number; undeveloped: string[] } => {
    const list = mk(color);
    let developed = 0;
    const undeveloped: string[] = [];
    for (const s of list) {
      const p = at(s.r, s.c);
      const home = p && p.color === color && p.type === s.type;
      if (home) undeveloped.push(s.label);
      else developed++;
    }
    return { developed, total: list.length, undeveloped };
  };

  const w = evalSide('w');
  const b = evalSide('b');
  const complete = w.developed === w.total && b.developed === b.total;
  const parts: string[] = [];
  if (w.undeveloped.length && w.developed < w.total) parts.push(`белые дома: ${w.undeveloped.join(', ')}`);
  if (b.undeveloped.length && b.developed < b.total) parts.push(`чёрные дома: ${b.undeveloped.join(', ')}`);
  // Полное пояснение при завершённом развитии живёт в тултипе (см. GamePage), в строке — коротко.
  const summaryRu = complete
    ? 'Развитие завершено'
    : `Развитие ${w.developed}/${w.total} — ${b.developed}/${b.total}${parts.length ? ` · ${parts.join(' · ')}` : ''}`;

  return {
    whiteDeveloped: w.developed,
    whiteTotal: w.total,
    blackDeveloped: b.developed,
    blackTotal: b.total,
    whiteUndeveloped: w.undeveloped,
    blackUndeveloped: b.undeveloped,
    complete,
    summaryRu,
  };
}

function emptyDevelopment(): DevelopmentInfo {
  return {
    whiteDeveloped: 0,
    whiteTotal: 6,
    blackDeveloped: 0,
    blackTotal: 6,
    whiteUndeveloped: [],
    blackUndeveloped: [],
    complete: false,
    summaryRu: 'Начальная расстановка — выводите коней и слонов, рокируйтесь',
  };
}

export function analyzePosition(fen: string): PositionAnalysis {
  const defaultPlan: PositionPlan = {
    stage: 'opening',
    structureNameRu: 'Начальная расстановка',
    strategicPlanRu: 'Борьба за центр, развитие легких фигур и обеспечение безопасности короля.',
  };

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
      positionPlan: defaultPlan,
      development: emptyDevelopment(),
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
      positionPlan: defaultPlan,
      development: emptyDevelopment(),
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
      positionPlan: {
        stage: 'endgame',
        structureNameRu: 'Мат на доске',
        strategicPlanRu: 'Партия завершена матом.',
      },
      development: analyzeDevelopment(chess),
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
      positionPlan: {
        stage: 'endgame',
        structureNameRu: 'Ничейная позиция',
        strategicPlanRu: 'Партия завершена вничью.',
      },
      development: analyzeDevelopment(chess),
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
  const positionPlan = analyzePositionStructure(chess, isEndgame);
  const development = analyzeDevelopment(chess);

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
    positionPlan,
    development,
  };
}
