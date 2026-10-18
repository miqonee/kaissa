import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { BughouseGame, isDrop } from 'shared/bughouse';
import { chooseBughouseMove, fallbackBughouseMove, moveUci, selectBughouseCandidate } from '../src/ai/bughouse.js';
import { fairyPool, FairyStockfish } from '../src/ai/fairyStockfish.js';

afterEach(() => vi.restoreAllMocks());
afterAll(() => fairyPool.quit());
describe('Bughouse AI', () => {
  it('accepts defensive drops in positions considered mate by classical chess', () => {
    const game = new BughouseGame(['3rrr1k/8/8/8/8/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w').n = 1;
    expect(game.boards[0].isCheckmate()).toBe(true);
    const move = selectBughouseCandidate(game, 0, [{ uci: 'N@e2', score: 0 }]);
    expect(move && isDrop(move)).toBe(true);
    expect(() => game.apply(move!)).not.toThrow();
    expect(game.isCheck(0)).toBe(false);
  });
  it('rejects illegal engine output and finds a legal fallback including drops', async () => {
    const game = new BughouseGame(['3rrr1k/8/8/8/8/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w').n = 1;
    vi.spyOn(fairyPool, 'search').mockRejectedValue(new Error('simulated engine failure'));
    const move = await chooseBughouseMove(game.snapshot(), 0, 1200);
    expect(move && isDrop(move)).toBe(true);
    expect(() => game.apply(move!)).not.toThrow();
    expect(selectBughouseCandidate(game, 0, [{ uci: 'K@z9', score: 10000 }])).toBeNull();
  });
  it('delivers a knight which gives the partner a mating drop', () => {
    const game = new BughouseGame(['7k/n7/8/8/8/8/8/R5K1 w - - 0 1', '4k3/8/8/2b5/8/8/6PP/6RK b - - 0 1']);
    const move = selectBughouseCandidate(game, 0, [{ uci: 'g1f1', score: 50 }, { uci: 'a1a7', score: 0 }]);
    expect(moveUci(move!)).toBe('a1a7');
    game.apply(move!); game.apply({ board: 1, piece: 'n', to: 'f2' });
    expect(game.isBughouseCheckmate(1)).toBe(true);
  });
  it('fallback can finish with a mating drop', () => {
    const game = new BughouseGame(['6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w').n = 1;
    const move = fallbackBughouseMove(game, 0)!;
    game.apply(move); expect(game.isBughouseCheckmate(0)).toBe(true);
  });
  it('real WASM engine solves a mating drop, then handles a fresh request after restart', async () => {
    const engine = new FairyStockfish();
    const game = new BughouseGame(['6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w').n = 1;
    try {
      const candidates = await engine.search(game.engineFen(0), 12, 200);
      expect(candidates.some(c => c.uci.toLowerCase() === 'n@f7')).toBe(true);
      game.apply(selectBughouseCandidate(game, 0, candidates)!);
      expect(game.isBughouseCheckmate(0)).toBe(true);
      engine.quit();
      const again = await engine.search(new BughouseGame().engineFen(0), 2, 50);
      expect(again.length).toBeGreaterThan(0);
    } finally { engine.quit(); }
  }, 20_000);
});
