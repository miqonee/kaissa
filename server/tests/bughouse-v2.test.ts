import { describe, expect, it } from 'vitest';
import { BughouseGame, isDrop, type AnyMove } from 'shared/bughouse';
import type { DropPieceType } from 'shared';

describe('Bughouse v2 rules', () => {
  it.each(['q', 'r', 'b', 'n'] as const)('demotes a captured promoted %s to a pawn', promotion => {
    const game = new BughouseGame(['1r5k/P7/8/8/8/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.apply({ board: 0, from: 'a7', to: 'a8', promotion });
    expect(game.promoted[0].has('a8')).toBe(true);
    game.apply({ board: 0, from: 'b8', to: 'a8' });
    expect(game.pocketOf(1, 'w').p).toBe(1);
    expect(game.pocketOf(1, 'w')[promotion]).toBe(0);
  });
  it('keeps promotion provenance when the promoted piece moves and snapshots are cloned', () => {
    const game = new BughouseGame(['Q6k/8/6r1/8/8/8/8/4K3 w - - 0 1', new BughouseGame().fen(1)]);
    game.promoted[0].add('a8');
    game.apply({ board: 0, from: 'a8', to: 'a6' });
    const copy = BughouseGame.fromSnapshot(game.snapshot());
    expect(copy.engineFen(0)).toContain('Q~');
    copy.apply({ board: 0, from: 'g6', to: 'a6' });
    expect(copy.pocketOf(1, 'w').p).toBe(1);
    expect(game.pocketOf(1, 'w').p).toBe(0);
  });
  it.each([
    { board: 0, to: 'z9', piece: 'n' }, { board: 2, to: 'd4', piece: 'n' },
    { board: 0, to: 'd4', piece: 'k' }, { board: 0, to: 'd4', piece: 'x' },
    { board: 0, to: 'd4', from: 'e2', promotion: 'k' },
  ])('rejects malformed actions without changing any state: %j', move => {
    const game = new BughouseGame(); game.pocketOf(0, 'w').n = 1;
    const before = game.snapshot();
    expect(() => game.apply(move as AnyMove)).toThrow();
    expect(game.snapshot()).toEqual(before);
  });
  it('increments the fullmove number after a black drop and clears en passant', () => {
    const game = new BughouseGame(); game.apply({ board: 0, from: 'e2', to: 'e4' });
    game.pocketOf(0, 'b').n = 1; game.apply({ board: 0, to: 'd5', piece: 'n' });
    expect(game.fen(0).split(' ').slice(1)).toEqual(['w', 'KQkq', '-', '0', '2']);
  });
  it('does not mutate live FEN, castling rights, history or pockets during legal move generation', () => {
    const game = new BughouseGame(); game.pocketOf(0, 'w').r = 1;
    game.apply({ board: 0, from: 'e2', to: 'e4' });
    const before = game.snapshot(); const history = game.boards[0].history();
    game.legalMoves(0, 'b'); game.legalDrops(0);
    expect(game.snapshot()).toEqual(before); expect(game.boards[0].history()).toEqual(history);
  });
  it('allows a defensive drop in a classical mate and rejects all drops under double check', () => {
    const game = new BughouseGame();
    for (const [from, to] of [['f2','f3'], ['e7','e5'], ['g2','g4'], ['d8','h4']]) game.apply({ board: 0, from, to });
    game.pocketOf(0, 'w').n = 1;
    expect(game.boards[0].isCheckmate()).toBe(true);
    expect(game.isBughouseCheckmate(0)).toBe(false);
    expect(game.legalDrops(0).n).toContain('g3');
    expect(game.legalDrops(0).n).not.toContain('a3');
    const double = new BughouseGame(['4r1k1/8/8/8/1b6/8/8/4K3 w - - 0 1', game.fen(1)]);
    double.pocketOf(0, 'w').q = 1; expect(double.legalDrops(0).q).toEqual([]);
  });
  it('counts drops for stalemate and supports a mating drop', () => {
    const game = new BughouseGame(['7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', new BughouseGame().fen(1)]);
    expect(game.isBughouseStalemate(0)).toBe(true);
    game.pocketOf(0, 'b').n = 1; expect(game.isBughouseStalemate(0)).toBe(false);
    const mate = new BughouseGame(['6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1', game.fen(1)]);
    mate.pocketOf(0, 'w').n = 1; mate.apply({ board: 0, to: 'f7', piece: 'n' });
    expect(mate.isBughouseCheckmate(0)).toBe(true);
  });
  it('transfers an en passant capture to the partner', () => {
    const game = new BughouseGame(['4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 2', new BughouseGame().fen(1)]);
    game.apply({ board: 0, from: 'e5', to: 'd6' });
    expect(game.pocketOf(1, 'b').p).toBe(1); expect(game.boards[0].get('d5')).toBeUndefined();
  });
  it('does not restore castling rights by dropping a rook', () => {
    const game = new BughouseGame(['4k3/8/8/8/8/8/8/4K2R w - - 0 1', new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w').r = 1; game.apply({ board: 0, to: 'a1', piece: 'r' });
    game.apply({ board: 0, from: 'e8', to: 'f8' });
    expect(() => game.apply({ board: 0, from: 'e1', to: 'c1' })).toThrow();
  });
  it('preserves material across a seeded sequence of moves and drops', () => {
    const game = new BughouseGame(); let seed = 31;
    for (let i = 0; i < 160; i++) {
      const board = i % 2 as 0 | 1;
      const legal = game.legalMoves(board, game.turn(board)); if (!legal.length) break;
      seed = (seed * 1664525 + 1013904223) >>> 0;
      game.apply(legal[seed % legal.length]);
      const material = game.boards.reduce((n, chess) => n + chess.board().flat().filter(Boolean).length, 0)
        + Object.values(game.pockets).reduce((n, pocket) => n + Object.values(pocket).reduce((a, b) => a + b, 0), 0);
      expect(material).toBe(64);
      expect(game.legalMoves(board, game.turn(board)).filter(isDrop).every(m => (m.piece as DropPieceType) !== ('k' as DropPieceType))).toBe(true);
    }
  });
});
