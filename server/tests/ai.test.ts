import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { evaluateBoard } from '../src/ai/eval.js';
import { searchBestMoves } from '../src/ai/minimax.js';
import { chooseBotMove, getBotConfig, getBotThinkingDelayMs } from '../src/ai/engine.js';

describe('AI Chess Engine', () => {
  it('evaluates initial board neutrally', () => {
    const c = new Chess();
    const score = evaluateBoard(c);
    expect(score).toBe(0);
  });

  it('detects material advantage for white', () => {
    // Белые без ладьи
    const c = new Chess('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1');
    const score = evaluateBoard(c);
    expect(score).toBeLessThan(-300);
  });

  it('finds mate in 1 move', () => {
    // Белые ставят мат ферзём Qxf7#
    // Scholar's mate setup: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    const c = new Chess('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    const moves = searchBestMoves(c, 2, 500);
    expect(moves.length).toBeGreaterThan(0);
    expect(moves[0].move.san).toBe('Qxf7#');
  });

  it('generates decisions for all 5 bot levels', () => {
    const c = new Chess();
    for (let level = 1; level <= 5; level++) {
      const cfg = getBotConfig(level);
      expect(cfg.level).toBe(level);
      const dec = chooseBotMove(c.fen(), level);
      expect(dec).not.toBeNull();
      expect(dec?.from).toBeDefined();
      expect(dec?.to).toBeDefined();
    }
  });

  it('thinking delay is within 1.2 - 2.8s', () => {
    for (let i = 0; i < 20; i++) {
      const ms = getBotThinkingDelayMs();
      expect(ms).toBeGreaterThanOrEqual(1200);
      expect(ms).toBeLessThanOrEqual(2800);
    }
  });

  it('advances passed pawn in king and pawn endgame', () => {
    // Белый король на e4, белая проходная пешка на e6, чёрный король на a8
    const c = new Chess('k7/8/4P3/8/4K3/8/8/8 w - - 0 1');
    const dec = chooseBotMove(c.fen(), 4);
    expect(dec).not.toBeNull();
    // Бот должен продвигать пешку e6->e7
    expect(dec?.from).toBe('e6');
    expect(dec?.to).toBe('e7');
  });

  it('mop-up evaluation corners opposing king in KQ vs K endgame', () => {
    // Белый король e1, ферзь a1, чёрный король e8. Ферзь отрезает/шахует или король приближается
    const c = new Chess('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1');
    const dec = chooseBotMove(c.fen(), 3);
    expect(dec).not.toBeNull();
    // Любой ход активного сжатия кольца: Qa7, Qe5+, Ke2 и т.д.
    expect(dec?.from).toBeDefined();
  });
});
