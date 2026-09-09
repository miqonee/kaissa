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
    const moves = searchBestMoves(c, 2, 100);
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
});
