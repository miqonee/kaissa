import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { CrazyhouseGame } from 'shared/crazyhouse';
import { BughouseGame, isDrop } from 'shared/bughouse';
import { chooseCrazyhouseMove } from '../src/ai/crazyhouse.js';
import { fairyPool, FairyStockfish } from '../src/ai/fairyStockfish.js';
afterEach(() => vi.restoreAllMocks());
afterAll(() => fairyPool.quit());
describe('Crazyhouse AI', () => {
  it.each(['failure', 'illegal'])('uses a defensive drop when the engine returns %s', async kind => {
    const g = new CrazyhouseGame(false, '3rrr1k/8/8/8/8/8/8/4K3 w - - 0 1'); g.pocketOf(0, 'w').n = 1;
    const search = vi.spyOn(fairyPool, 'search');
    if (kind === 'failure') search.mockRejectedValue(new Error('unavailable')); else search.mockResolvedValue([{ uci: 'K@z9', score: 999 }]);
    const move = await chooseCrazyhouseMove(g.snapshot(), 1200);
    expect(move && isDrop(move)).toBe(true); g.apply(move!); expect(g.isCheck(0)).toBe(false);
    expect(search.mock.calls[0][3]).toBe('kaissa-crazyhouse');
  });
  it('real WASM engine switches between Crazyhouse and Bughouse in the same worker and restarts', async () => {
    const engine = new FairyStockfish();
    const g = new CrazyhouseGame(false, '6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1'); g.pocketOf(0, 'w').n = 1;
    try {
      const candidates = await engine.search(g.engineFen(0), 12, 200, 'kaissa-crazyhouse');
      expect(candidates[0].uci.toLowerCase()).toBe('n@f7');
      expect((await engine.search(new BughouseGame().engineFen(0), 2, 30)).length).toBeGreaterThan(0);
      engine.quit();
      expect((await engine.search(g.engineFen(0), 12, 200, 'kaissa-crazyhouse'))[0].uci.toLowerCase()).toBe('n@f7');
    } finally { engine.quit(); }
  }, 20_000);
});
