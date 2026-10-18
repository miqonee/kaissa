import { describe, expect, it } from 'vitest';
import { CrazyhouseGame } from 'shared/crazyhouse';
import { buildPgn } from '../src/games/pgn.js';

describe('Crazyhouse rules, shared by live games and replay', () => {
  it.each([false, true])('returns captures to the mover and spends their shared reserve (team=%s)', alternating => {
    const g = new CrazyhouseGame(alternating);
    for (const [from, to] of [['e2', 'e4'], ['d7', 'd5'], ['e4', 'd5'], ['d8', 'd5']]) g.apply({ board: 0, from, to });
    expect(g.pocketOf(0, 'w').p).toBe(1); expect(g.pocketOf(0, 'b').p).toBe(1);
    expect(g.pocketOf(1, 'w').p + g.pocketOf(1, 'b').p).toBe(0);
    g.apply({ board: 0, piece: 'p', to: 'e4' });
    expect(g.pocketOf(0, 'w').p).toBe(0);
    expect(g.boards[0].get('e4')).toEqual({ type: 'p', color: 'w' });
    expect(g.currentSlot()).toBe(0);
    expect(g.nextSlotFor('w')).toBe(alternating ? 1 : 0);
  });
  it.each(['q', 'r', 'b', 'n'] as const)('demotes a captured promoted %s after it moves', piece => {
    const g = new CrazyhouseGame(false, `7k/1${piece}6/8/8/8/8/8/KR6 b - - 0 1`);
    g.promoted[0].add('b7');
    g.apply({ board: 0, from: 'b7', to: piece === 'n' ? 'd6' : piece === 'r' ? 'c7' : 'c6' });
    // Put the capturing rook on the same file without changing provenance.
    const target = piece === 'n' ? 'd6' : piece === 'r' ? 'c7' : 'c6';
    g.boards[0].remove('b1'); g.boards[0].put({ color: 'w', type: 'r' }, `${target[0]}1` as 'c1');
    g.apply({ board: 0, from: `${target[0]}1`, to: target });
    expect(g.pocketOf(0, 'w').p).toBe(1); expect(g.pocketOf(0, 'w')[piece]).toBe(0);
    expect(g.promoted[0].size).toBe(0);
  });
  it('captures en passant into the same colour reserve', () => {
    const g = new CrazyhouseGame(false, '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1');
    g.apply({ board: 0, from: 'e5', to: 'd6' });
    expect(g.boards[0].get('d5')).toBeUndefined(); expect(g.pocketOf(0, 'w').p).toBe(1);
  });
  it('allows a defensive drop and keeps all rejected actions atomic', () => {
    const g = new CrazyhouseGame(true, '3rrr1k/8/8/8/8/8/8/4K3 w - - 0 1'); g.pocketOf(0, 'w').n = 1;
    expect(g.boards[0].isCheckmate()).toBe(true); expect(g.isBughouseCheckmate(0)).toBe(false);
    for (const move of [{ board: 1, piece: 'n', to: 'e2' }, { board: 0, piece: 'n', to: 'z9' }, { board: 0, piece: 'n', to: 'a2' }, { board: 0, piece: 'q', to: 'e2' }]) {
      const before = g.snapshot(); expect(() => g.apply(move as any)).toThrow(); expect(g.snapshot()).toEqual(before);
    }
    g.apply({ board: 0, piece: 'n', to: 'e2' }); expect(g.isCheck(0)).toBe(false); expect(g.nextSlotFor('w')).toBe(1);
  });
  it('detects stalemate with reserves, and allows mate by a drop', () => {
    const stale = new CrazyhouseGame(false, '7k/5Q2/5K2/8/8/8/8/8 b - - 0 1');
    expect(stale.isBughouseStalemate(0)).toBe(true); stale.pocketOf(0, 'b').p = 1;
    expect(stale.isBughouseStalemate(0)).toBe(false);
    const mate = new CrazyhouseGame(false, '6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1'); mate.pocketOf(0, 'w').n = 1;
    mate.apply({ board: 0, piece: 'n', to: 'f7' }); expect(mate.isBughouseCheckmate(0)).toBe(true);
  });
  it.each([false, true])('counts repetition with pockets, provenance and turn slots, survives snapshots (team=%s)', alternating => {
    let g = new CrazyhouseGame(alternating);
    const cycle = () => { for (const [from, to] of [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']]) g.apply({ board: 0, from, to }); };
    cycle(); expect(g.isThreefoldRepetition()).toBe(false); g = CrazyhouseGame.fromSnapshot(g.snapshot()); cycle();
    expect(g.isThreefoldRepetition()).toBe(true);
    g.pocketOf(0, 'w').n = 1; expect(g.isThreefoldRepetition()).toBe(false);
    g.pocketOf(0, 'w').n = 0; g.promoted[0].add('d1'); expect(g.isThreefoldRepetition()).toBe(false);
  });
  it('exports both formats as Crazyhouse PGN with drops, full team names and draw result', () => {
    const moves = [['e2','e4'],['d7','d5'],['e4','d5'],['d8','d5'],['-','e4']].map(([from,to],i) => ({ boardIndex: 0, ply: i+1, from, to, promotion: null, dropPiece: i === 4 ? 'p' : null }));
    const pgn = buildPgn({ id: 1, mode: 'crazyhouse-team', rulesVersion: 2, result: '1/2-1/2', reason: 'repetition', baseMin: 0, incSec: 0, noClock: true, startedAt: new Date(), endedAt: new Date(), participants: [{ username: 'A', team: 1, color: 'w', boardIndex: 0, moveSlot: 0, ratingBefore: 1200 }, { username: 'B', team: 1, color: 'w', boardIndex: 0, moveSlot: 1, ratingBefore: 1200 }] }, moves);
    expect(pgn).toContain('[Variant "Crazyhouse"]'); expect(pgn).toContain('[White "A / B"]'); expect(pgn).toContain('3. P@e4 1/2-1/2'); expect(pgn).not.toContain('invalid');
  });
});
