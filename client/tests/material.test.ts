import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { CrazyhouseGame } from 'shared/crazyhouse';
import { BughouseGame } from 'shared/bughouse';
import { calculateMaterial } from '../src/utils/material';

describe('material balance', () => {
  it('cancels equal pieces and counts an ordinary capture and recapture', () => {
    const chess = new Chess();
    expect(calculateMaterial(chess.fen()).score).toBe(0);
    chess.move('e4'); chess.move('d5'); chess.move('exd5');
    expect(calculateMaterial(chess.fen()).surplus.w.p).toBe(1);
    expect(calculateMaterial(chess.fen()).score).toBe(1);
    chess.move('Qxd5');
    expect(calculateMaterial(chess.fen()).score).toBe(0);
  });

  it('keeps different equally valued minor pieces in the composition', () => {
    const balance = calculateMaterial('4k3/8/8/8/8/8/8/2B1K1n1 w - - 0 1');
    expect(balance.score).toBe(0);
    expect(balance.surplus.w.b).toBe(1);
    expect(balance.surplus.b.n).toBe(1);
  });

  it('counts en passant and promotion from the resulting position', () => {
    const chess = new Chess('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    chess.move('exd6');
    expect(calculateMaterial(chess.fen()).score).toBe(1);
    const promotion = new Chess('7k/P7/8/8/8/8/8/4K3 w - - 0 1');
    promotion.move({ from: 'a7', to: 'a8', promotion: 'q' });
    expect(calculateMaterial(promotion.fen()).surplus.w.q).toBe(1);
    expect(calculateMaterial(promotion.fen()).score).toBe(9);
  });

  it.each(['crazyhouse', 'crazyhouse-team'] as const)('counts shared reserves once in %s and keeps drops neutral', (mode) => {
    const game = new CrazyhouseGame(mode === 'crazyhouse-team');
    for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5']] as const) game.apply({ board: 0, from, to });
    const before = calculateMaterial(game.fen(0), [game.pocketOf(0, 'w'), game.pocketOf(0, 'b')]);
    expect(before.score).toBe(0);
    game.apply({ board: 0, piece: 'p', to: 'e4' });
    expect(calculateMaterial(game.fen(0), [game.pocketOf(0, 'w'), game.pocketOf(0, 'b')])).toEqual(before);
  });

  it('counts incoming material on the partner board in bughouse', () => {
    const game = new BughouseGame();
    game.apply({ board: 0, from: 'e2', to: 'e4' });
    game.apply({ board: 0, from: 'd7', to: 'd5' });
    game.apply({ board: 0, from: 'e4', to: 'd5' });
    expect(calculateMaterial(game.fen(0), [game.pocketOf(0, 'w'), game.pocketOf(0, 'b')]).score).toBe(1);
    expect(calculateMaterial(game.fen(1), [game.pocketOf(1, 'w'), game.pocketOf(1, 'b')]).score).toBe(-1);
  });

  it('ignores promoted markers, kings, and pocket notation already supplied explicitly', () => {
    const pocket = { p: 1, n: 0, b: 0, r: 0, q: 0, k: 0 };
    const balance = calculateMaterial('7k/Q~7/8/8/8/8/8/4K3[P] w - - 0 1', [pocket, null]);
    expect(balance.score).toBe(10);
    expect(balance.surplus.w).toEqual({ p: 1, n: 0, b: 0, r: 0, q: 1 });
  });
});
