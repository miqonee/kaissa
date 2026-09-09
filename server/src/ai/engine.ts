// server/src/ai/engine.ts
// Главный интерфейс шахматного ИИ для 5 уровней сложности
import { Chess, type PieceSymbol } from 'chess.js';
import { BOT_PRESETS, type BotConfig, type PieceType } from 'shared';
import { searchBestMoves } from './minimax.js';

export interface BotDecision {
  from: string;
  to: string;
  promotion?: PieceType;
  san: string;
}

export function getBotConfig(levelOrUsername: number | string): BotConfig {
  if (typeof levelOrUsername === 'number') {
    return BOT_PRESETS.find((b) => b.level === levelOrUsername) || BOT_PRESETS[1];
  }
  return BOT_PRESETS.find((b) => b.username === levelOrUsername) || BOT_PRESETS[1];
}

/**
 * Расчёт задержки перед ходом (1.2 - 2.8 с) для естественности игры
 */
export function getBotThinkingDelayMs(): number {
  return Math.floor(1200 + Math.random() * 1600);
}

/**
 * Выбор хода ботом по уровню сложности с учётом вероятности зевка.
 */
export function chooseBotMove(
  fen: string,
  level = 2,
  gameErrorJitter?: number,
): BotDecision | null {
  const cfg = getBotConfig(level);
  const chess = new Chess(fen);
  if (chess.isGameOver()) return null;

  const jitter = gameErrorJitter ?? (Math.random() * 2 - 1) * cfg.errorJitter;
  const errorRate = Math.max(0.01, Math.min(0.5, cfg.errorRate + jitter));

  // Поиск ходов
  const scored = searchBestMoves(chess, cfg.depth, 80);
  if (!scored.length) return null;

  let chosenIndex = 0;

  // Механика зевков: выбор 2-го или 3-го хода вместо оптимального
  if (Math.random() < errorRate && scored.length > 1) {
    if (scored.length > 2 && Math.random() < 0.35) {
      chosenIndex = 2;
    } else {
      chosenIndex = 1;
    }
  }

  const best = scored[chosenIndex] || scored[0];
  const m = best.move;

  return {
    from: m.from,
    to: m.to,
    promotion: (m.promotion as PieceType) || (m.flags.includes('p') ? 'q' : undefined),
    san: m.san,
  };
}
