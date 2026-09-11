// server/src/ai/engine.ts
// Шахматный ИИ на базе Stockfish WASM, 12 стилей персоналий и рандомизатора дебютов
import { Chess } from 'chess.js';
import {
  BOT_LEVELS,
  BOT_PRESETS,
  eloToLevel,
  getBotPersonality,
  levelToElo,
  type BotConfig,
  type PieceType,
} from 'shared';
import { stockfish } from './stockfish.js';
import { selectMoveByPersonality } from './personalities.js';
import { getOpeningBookMove } from './openings.js';
import { searchBestMoves } from './minimax.js';

export interface BotDecision {
  from: string;
  to: string;
  promotion?: PieceType;
  san: string;
  score?: number;
}

export interface BotSearchSpec {
  username?: string;
  elo?: number;
  level?: number;
}

export function getBotConfig(levelOrUsername: number | string): BotConfig {
  if (typeof levelOrUsername === 'number') {
    return BOT_PRESETS.find((b) => b.level === levelOrUsername) || BOT_PRESETS[0];
  }
  return BOT_PRESETS.find((b) => b.username === levelOrUsername) || BOT_PRESETS[0];
}

/**
 * Расчёт задержки перед ходом в зависимости от стадии и ситуации:
 * - Для Chess TV (демо-партии на главной, 1.0 - 5.0 с):
 *   - Дебют / очевидные ответные взятия: 1.0 – 2.0 с
 *   - Сложные счётные позиции (шах королю, острая тактика): 3.5 – 5.0 с
 *   - Обычный миттельшпиль / позиционная игра: 2.0 – 3.5 с
 * - Для игровых партий (1.0 - 10.0 с):
 *   - Дебют / очевидные ответные взятия: 1.0 – 2.5 с
 *   - Сложные счётные позиции (шах королю, острая тактика): 5.0 – 10.0 с
 *   - Обычный миттельшпиль / позиционная игра: 3.0 – 5.0 с
 */
export function getBotThinkingDelayMs(
  fen?: string,
  lastMove?: { from?: string; to?: string; captured?: string } | null,
  ply?: number,
  isDemo?: boolean,
): number {
  if (!fen) {
    return isDemo
      ? Math.floor(1000 + Math.random() * 4000)
      : Math.floor(1000 + Math.random() * 9000);
  }

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return isDemo
      ? Math.floor(1000 + Math.random() * 4000)
      : Math.floor(1000 + Math.random() * 9000);
  }

  const moves = chess.moves({ verbose: true });
  const moveNumber = parseInt(fen.split(' ')[5] || '1', 10);
  const currentPly = ply ?? (moveNumber * 2 - (chess.turn() === 'w' ? 2 : 1));

  // 1. Дебют или очевидное ответное взятие (Chess TV: 1.0 - 2.0 с, обычные: 1.0 - 2.5 с)
  const isOpening = currentPly <= 8;
  const isRecapture = Boolean(
    lastMove?.to &&
    lastMove.captured &&
    moves.some((m) => m.to === lastMove.to && m.captured)
  );

  if (isOpening || isRecapture) {
    return isDemo
      ? Math.floor(1000 + Math.random() * 1000)
      : Math.floor(1000 + Math.random() * 1500);
  }

  // 2. Сложные счётные позиции (Chess TV: 3.5 - 5.0 с, обычные: 5.0 - 10.0 с)
  // Шах королю или высокая тактическая напряженность (множество взятий и шахов)
  const isCheck = chess.isCheck();
  const checksAndCaptures = moves.filter((m) => m.captured || m.san.includes('+') || m.san.includes('#')).length;
  const isSharpPosition = isCheck || checksAndCaptures >= 5;

  if (isSharpPosition) {
    return isDemo
      ? Math.floor(3500 + Math.random() * 1500)
      : Math.floor(5000 + Math.random() * 5000);
  }

  // 3. Обычный миттельшпиль / позиционная игра (Chess TV: 2.0 - 3.5 с, обычные: 3.0 - 5.0 с)
  return isDemo
    ? Math.floor(2000 + Math.random() * 1500)
    : Math.floor(3000 + Math.random() * 2000);
}

/**
 * Выбор хода ботом с учетом Stockfish WASM, стиля персоналии, динамического Elo и дебютной книги.
 */
export async function chooseBotMove(
  fen: string,
  botSpec?: number | string | BotSearchSpec,
  _gameErrorJitter?: number,
): Promise<BotDecision | null> {
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;

  let username = 'bot_tal';
  let elo = 1200;
  let level = 4;

  if (typeof botSpec === 'number') {
    level = Math.max(1, Math.min(12, botSpec));
    elo = levelToElo(level);
    const preset = BOT_PRESETS.find((b) => b.level === level);
    if (preset) username = preset.username;
  } else if (typeof botSpec === 'string') {
    username = botSpec;
    const personality = getBotPersonality(username);
    if (personality) {
      elo = personality.defaultElo;
      level = eloToLevel(elo);
    }
  } else if (botSpec && typeof botSpec === 'object') {
    if (botSpec.username) username = botSpec.username;
    if (botSpec.elo !== undefined) {
      elo = botSpec.elo;
      level = eloToLevel(elo);
    } else if (botSpec.level !== undefined) {
      level = botSpec.level;
      elo = levelToElo(level);
    } else {
      const personality = getBotPersonality(username);
      if (personality) {
        elo = personality.defaultElo;
        level = eloToLevel(elo);
      }
    }
  }

  // 1. Проверка дебютной книги на первых ходах
  const bookMove = getOpeningBookMove(fen, username);
  if (bookMove) {
    return bookMove;
  }

  // 2. Расчет ходов через Stockfish WASM
  const levelCfg = BOT_LEVELS[level - 1] || BOT_LEVELS[3]; // default level 4
  const depth = levelCfg.depth;
  const skillLevel = levelCfg.skillLevel;
  const multiPv = 3;

  try {
    const searchRes = await stockfish.search(fen, {
      elo,
      skillLevel,
      depth,
      multiPv,
    });

    if (searchRes.candidates.length > 0) {
      const decision = selectMoveByPersonality(fen, searchRes.candidates, username, elo);
      if (decision) {
        return {
          from: decision.from,
          to: decision.to,
          promotion: decision.promotion,
          san: decision.san,
          score: decision.score,
        };
      }
    }

    // Fallback к bestmove Stockfish
    if (searchRes.bestmove && searchRes.bestmove !== '(none)') {
      const from = searchRes.bestmove.slice(0, 2);
      const to = searchRes.bestmove.slice(2, 4);
      const promotion = searchRes.bestmove.length > 4 ? (searchRes.bestmove[4].toLowerCase() as PieceType) : undefined;
      const res = chess.move({ from, to, promotion });
      if (res) {
        return { from, to, promotion, san: res.san };
      }
    }
  } catch (err) {
    console.warn('[AI] Stockfish WASM error, falling back to local search:', err);
  }

  // 3. Аварийный fallback (Minimax) на случай непредвиденных сбоев
  try {
    const scored = searchBestMoves(chess, 2, 80);
    if (scored.length > 0) {
      const m = scored[0].move;
      return {
        from: m.from,
        to: m.to,
        promotion: (m.promotion as PieceType) || (m.flags.includes('p') ? 'q' : undefined),
        san: m.san,
      };
    }
  } catch {
    // ignore
  }

  // 4. Крайний fallback: любой легальный ход
  const legalMoves = chess.moves({ verbose: true });
  if (legalMoves.length > 0) {
    const m = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    return {
      from: m.from,
      to: m.to,
      promotion: m.promotion as PieceType,
      san: m.san,
    };
  }

  return null;
}
