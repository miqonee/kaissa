import { Chess, type Square } from 'chess.js';
import { getBotPersonality, type PieceType } from 'shared';
import type { SearchCandidate } from './stockfish.js';

export interface StyleDecision {
  from: string;
  to: string;
  promotion?: PieceType;
  san: string;
  score: number;
}

const CENTER_SQUARES = new Set(['d4', 'e4', 'd5', 'e5', 'c4', 'c5']);

function chebyshevDistance(sq1: string, sq2: string): number {
  const f1 = sq1.charCodeAt(0) - 'a'.charCodeAt(0);
  const r1 = parseInt(sq1[1], 10) - 1;
  const f2 = sq2.charCodeAt(0) - 'a'.charCodeAt(0);
  const r2 = parseInt(sq2[1], 10) - 1;
  return Math.max(Math.abs(f1 - f2), Math.abs(r1 - r2));
}

function findKingSquare(chess: Chess, color: 'w' | 'b'): Square | null {
  const board = chess.board();
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c];
      if (piece && piece.type === 'k' && piece.color === color) {
        return piece.square;
      }
    }
  }
  return null;
}

function isFileOpenOrSemiOpen(chess: Chess, fileChar: string, color: 'w' | 'b'): boolean {
  const board = chess.board();
  const fileIdx = fileChar.charCodeAt(0) - 'a'.charCodeAt(0);
  let friendlyPawns = 0;
  for (let r = 0; r < 8; r++) {
    const piece = board[r][fileIdx];
    if (piece && piece.type === 'p' && piece.color === color) {
      friendlyPawns++;
    }
  }
  return friendlyPawns === 0;
}

export function selectMoveByPersonality(
  fen: string,
  candidates: SearchCandidate[],
  usernameOrId = 'bot_tal',
  elo = 1200,
): StyleDecision | null {
  if (!candidates.length) return null;

  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;

  const personality = getBotPersonality(usernameOrId);
  const personalityId = personality?.id ?? 'tal';

  // If best candidate is a forced checkmate, immediately pick the quickest mate!
  if (candidates[0].score >= 80000) {
    const uci = candidates[0].uci;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? (uci[4].toLowerCase() as PieceType) : undefined;
    const moveRes = chess.move({ from, to, promotion });
    if (moveRes) {
      return { from, to, promotion, san: moveRes.san, score: candidates[0].score };
    }
  }

  // Determine allowed centipawn delta corridor based on personality and Elo
  let maxDelta = 60;
  if (['fischer', 'carlsen'].includes(personalityId)) maxDelta = 35;
  else if (['kasparov', 'karpov', 'botvinnik'].includes(personalityId)) maxDelta = 50;
  else if (['tal', 'morphy', 'nakamura'].includes(personalityId)) maxDelta = 85;

  if (elo < 1000) maxDelta += 30;
  else if (elo > 1900) maxDelta = Math.min(maxDelta, 40);

  const bestScore = candidates[0].score;
  const acceptable = candidates.filter((c) => Math.abs(bestScore - c.score) <= maxDelta);
  const pool = acceptable.length > 0 ? acceptable : [candidates[0]];

  const turn = chess.turn();
  const opponentColor = turn === 'w' ? 'b' : 'w';
  const enemyKingSq = findKingSquare(chess, opponentColor);

  let bestCandidate = pool[0];
  let highestPreference = -Infinity;

  for (let i = 0; i < pool.length; i++) {
    const cand = pool[i];
    const uci = cand.uci;
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? (uci[4].toLowerCase() as PieceType) : undefined;

    const clone = new Chess(fen);
    let moveRes;
    try {
      moveRes = clone.move({ from, to, promotion });
    } catch {
      continue;
    }
    if (!moveRes) continue;

    const san = moveRes.san;
    const piece = moveRes.piece;
    const isCheck = san.includes('+') || san.includes('#');
    const isCapture = !!moveRes.captured;
    const isCastling = san === 'O-O' || san === 'O-O-O';
    const isCenter = CENTER_SQUARES.has(to);
    const isPawnBreak = piece === 'p' && (to[1] === '4' || to[1] === '5') && isCenter;
    const isDeveloping = (piece === 'n' || piece === 'b') && from[1] === (turn === 'w' ? '1' : '8');
    const attacksKing = enemyKingSq ? chebyshevDistance(to, enemyKingSq) <= 2 : false;
    const isRookOpenFile = piece === 'r' && isFileOpenOrSemiOpen(chess, to[0], turn);
    const isTrade = isCapture && moveRes.captured !== 'p' && piece !== 'p';
    const isProphylaxis = (piece === 'p' && ['a3', 'h3', 'a6', 'h6', 'b3', 'g3', 'b6', 'g6'].includes(to)) ||
                          (piece === 'k' && !isCheck);

    let styleBonus = 0;

    switch (personalityId) {
      case 'tal': // Михаил Таль · Атакующий романтик
        if (isCheck) styleBonus += 45;
        if (attacksKing) styleBonus += 35;
        if (isPawnBreak) styleBonus += 25;
        if (isTrade) styleBonus -= 20;
        break;

      case 'karpov': // Анатолий Карпов · Позиционный стратег
        if (isRookOpenFile) styleBonus += 40;
        if (isProphylaxis) styleBonus += 35;
        if (isCenter) styleBonus += 25;
        if (isCastling) styleBonus += 20;
        break;

      case 'kasparov': // Гарри Каспаров · Динамический напор
        if (isCenter) styleBonus += 40;
        if (isPawnBreak) styleBonus += 35;
        if (attacksKing) styleBonus += 30;
        if (isDeveloping) styleBonus += 25;
        break;

      case 'petrosian': // Тигран Петросян · Железная крепость
        if (isProphylaxis) styleBonus += 45;
        if (isCastling) styleBonus += 35;
        if (isTrade) styleBonus += 20;
        if (attacksKing && !isCheck) styleBonus -= 15;
        break;

      case 'capablanca': // Хосе Капабланка · Чистый классик
        if (isTrade) styleBonus += 40;
        if (isRookOpenFile) styleBonus += 30;
        if (isDeveloping) styleBonus += 25;
        if (isCastling) styleBonus += 25;
        break;

      case 'morphy': // Пол Морфи · Гамбитный гений
        if (isDeveloping) styleBonus += 50;
        if (isCastling) styleBonus += 40;
        if (isCheck) styleBonus += 35;
        if (attacksKing) styleBonus += 30;
        break;

      case 'fischer': // Бобби Фишер · Бескомпромиссная точность
        if (cand.multipv === 1) styleBonus += 55;
        if (isDeveloping || isCenter) styleBonus += 25;
        if (isCheck) styleBonus += 20;
        break;

      case 'spassky': // Борис Спасский · Универсал
        if (isCenter) styleBonus += 20;
        if (isDeveloping) styleBonus += 20;
        if (isCastling) styleBonus += 20;
        if (isCheck) styleBonus += 15;
        break;

      case 'aljechin': // Александр Алехин · Комбинационный вихрь
        if (isCapture) styleBonus += 35;
        if (attacksKing) styleBonus += 35;
        if (isPawnBreak) styleBonus += 30;
        break;

      case 'carlsen': // Магнус Карлсен · Эндшпильный эвапоратор
        if (isCenter) styleBonus += 30;
        if (isRookOpenFile) styleBonus += 30;
        if (isTrade && cand.score < 50) styleBonus -= 20; // keeps pieces on board to squeeze
        if (isProphylaxis) styleBonus += 25;
        break;

      case 'botvinnik': // Михаил Ботвинник · Железная логика
        if (isCenter) styleBonus += 45;
        if (isDeveloping) styleBonus += 30;
        if (isCastling) styleBonus += 25;
        break;

      case 'nakamura': // Хикару Накамура · Блиц-провокатор
        if (isCheck) styleBonus += 35;
        if (attacksKing) styleBonus += 30;
        if (piece === 'n' && isCenter) styleBonus += 35;
        if (isProphylaxis) styleBonus += 20;
        break;

      default:
        if (isCenter) styleBonus += 20;
        if (isDeveloping) styleBonus += 20;
        break;
    }

    const jitter = Math.random() * 8;
    const prefScore = cand.score + styleBonus + jitter;

    if (prefScore > highestPreference) {
      highestPreference = prefScore;
      bestCandidate = cand;
    }
  }

  const chosenUci = bestCandidate.uci;
  const chosenFrom = chosenUci.slice(0, 2);
  const chosenTo = chosenUci.slice(2, 4);
  const chosenProm = chosenUci.length > 4 ? (chosenUci[4].toLowerCase() as PieceType) : undefined;
  const res = chess.move({ from: chosenFrom, to: chosenTo, promotion: chosenProm });

  if (!res) return null;

  return {
    from: chosenFrom,
    to: chosenTo,
    promotion: chosenProm,
    san: res.san,
    score: bestCandidate.score,
  };
}
