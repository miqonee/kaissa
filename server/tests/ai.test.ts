import { describe, it, expect } from 'vitest';
import { Chess } from 'chess.js';
import { evaluateBoard } from '../src/ai/eval.js';
import { searchBestMoves } from '../src/ai/minimax.js';
import { chooseBotMove, getBotConfig, getBotThinkingDelayMs } from '../src/ai/engine.js';
import { stockfish } from '../src/ai/stockfish.js';
import { selectMoveByPersonality } from '../src/ai/personalities.js';
import { getOpeningBookMove } from '../src/ai/openings.js';
import { BOT_PERSONALITIES, detectOpening, eloToLevel, levelToElo, getBotPersonality, getBotTooltip } from 'shared';

describe('AI Chess Engine & Stockfish WASM', () => {
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

  it('finds mate in 1 move via Stockfish WASM', async () => {
    // Scholar's mate setup: 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    const res = await stockfish.search(fen, { depth: 6, skillLevel: 20 });
    expect(res.bestmove).toBe('h5f7');
  });

  it('supports 12-level calibration scale and maps Elo correctly', () => {
    expect(eloToLevel(550)).toBe(1);
    expect(eloToLevel(800)).toBe(2);
    expect(eloToLevel(1000)).toBe(3);
    expect(eloToLevel(1150)).toBe(4);
    expect(eloToLevel(1200)).toBe(4);
    expect(eloToLevel(1350)).toBe(5);
    expect(eloToLevel(1500)).toBe(6);
    expect(eloToLevel(1650)).toBe(7);
    expect(eloToLevel(1800)).toBe(8);
    expect(eloToLevel(1950)).toBe(9);
    expect(eloToLevel(2100)).toBe(10);
    expect(eloToLevel(2300)).toBe(11);
    expect(eloToLevel(2500)).toBe(12);

    expect(levelToElo(4)).toBe(1150);
    expect(levelToElo(12)).toBe(2500);
  });

  it('provides all 12 personalities with badges, descriptions, and tooltips', () => {
    const personalities = Object.values(BOT_PERSONALITIES);
    expect(personalities.length).toBe(12);

    for (const p of personalities) {
      expect(p.id).toBeDefined();
      expect(p.username).toBeDefined();
      expect(p.badge).toBeDefined();
      expect(p.description).toBeDefined();
      expect(p.defaultElo).toBeGreaterThan(500);

      const found = getBotPersonality(p.username);
      expect(found?.id).toBe(p.id);

      const tooltip = getBotTooltip(p.username, p.defaultElo);
      expect(tooltip).toContain(p.name);
      expect(tooltip).toContain(p.title);
    }
  });

  it('selects opening book moves for initial position influenced by bot personality', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const morphyMove = getOpeningBookMove(fen, 'bot_morphy');
    expect(morphyMove).not.toBeNull();
    expect(['e2e4', 'd2d4', 'c2c4', 'g1f3']).toContain(`${morphyMove?.from}${morphyMove?.to}`);

    const karpovMove = getOpeningBookMove(fen, 'bot_karpov');
    expect(karpovMove).not.toBeNull();
    expect(['e2e4', 'd2d4', 'c2c4', 'g1f3']).toContain(`${karpovMove?.from}${karpovMove?.to}`);
  });

  it('personality style selection picks check/attack for Tal', () => {
    // White can play check or quiet move with equal/similar score
    const fen = 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 4 5';
    const candidates = [
      { uci: 'c4f7', score: 10, depth: 8, pv: 'c4f7', multipv: 1 }, // Bxf7+ check
      { uci: 'd2d3', score: 15, depth: 8, pv: 'd2d3', multipv: 2 }, // quiet
      { uci: 'e1g1', score: 15, depth: 8, pv: 'e1g1', multipv: 3 }, // castle
    ];

    const decision = selectMoveByPersonality(fen, candidates, 'bot_tal', 1500);
    expect(decision).not.toBeNull();
    expect(decision?.from).toBe('c4');
    expect(decision?.to).toBe('f7');
  });

  it('generates decisions for bot levels and personalities via chooseBotMove', async () => {
    // Non-book position
    const fen = 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/2N2N2/PPPP1PPP/R1BQ1RK1 w - - 6 5';

    // Test with Tal
    const decTal = await chooseBotMove(fen, 'bot_tal');
    expect(decTal).not.toBeNull();
    expect(decTal?.from).toBeDefined();
    expect(decTal?.to).toBeDefined();

    // Test with dynamic Elo spec
    const decDynamic = await chooseBotMove(fen, { username: 'bot_morphy', elo: 2000 });
    expect(decDynamic).not.toBeNull();
    expect(decDynamic?.from).toBeDefined();
  });

  it('thinking delay is within 1.2 - 2.8s', () => {
    for (let i = 0; i < 20; i++) {
      const ms = getBotThinkingDelayMs();
      expect(ms).toBeGreaterThanOrEqual(1200);
      expect(ms).toBeLessThanOrEqual(2800);
    }
  });

  it('advances passed pawn in king and pawn endgame', async () => {
    // Белый король на e4, белая проходная пешка на e6, чёрный король на a8
    const c = new Chess('k7/8/4P3/8/4K3/8/8/8 w - - 0 1');
    const dec = await chooseBotMove(c.fen(), { username: 'bot_fischer', elo: 1800 });
    expect(dec).not.toBeNull();
    // Бот должен продвигать пешку e6->e7
    expect(dec?.from).toBe('e6');
    expect(dec?.to).toBe('e7');
  });

  it('game with 2 kings returns null from chooseBotMove without hang', async () => {
    const dec = await chooseBotMove('4k3/8/8/8/8/8/8/4K3 w - - 0 1', 2);
    expect(dec).toBeNull();
  });

  it('detectOpening recognizes openings and strategic plans without emojis', () => {
    // 1. Initial position
    const start = detectOpening([]);
    expect(start.eco).toBe('A00');
    expect(start.stage).toBe('start');
    expect(start.planRu).toBeDefined();

    // 2. Italian Game (Giuoco Piano)
    const italian = detectOpening(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
    expect(italian.eco).toBe('C50');
    expect(italian.nameRu).toBe('Итальянская партия');
    expect(italian.variationRu).toBe('Вариант Джоко Пиано');
    expect(italian.stage).toBe('theory');
    expect(italian.planRu).toContain('Белые готовят захват центра');
    expect(italian.continuations.length).toBeGreaterThan(0);
    expect(italian.playedMovesSan).toContain('1. e4 e5');

    // 3. Sicilian Najdorf
    const najdorf = detectOpening(['e4', 'c5', 'Nf3', 'd6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'a6']);
    expect(najdorf.eco).toBe('B90');
    expect(najdorf.nameRu).toBe('Сицилианская защита');
    expect(najdorf.variationRu).toBe('Вариант Найдорфа');

    // 4. Transition to middlegame
    const midgameMoves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd4', 'exd4', 'cxd4', 'Bb4+'];
    const mid = detectOpening(midgameMoves);
    expect(['C50', 'C54']).toContain(mid.eco);
    expect(mid.stage).toBe('middlegame');
  });
});
