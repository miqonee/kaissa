import { describe, expect, it } from 'vitest';
import { DOUBLE_TOPOLOGY, MultiChess, type MPiece, type MultiSnapshot } from 'shared';

const piece = (seat: number, role: MPiece['role']): MPiece => ({ seat, role });
function position(board: Record<string, MPiece>, turn = 0, patch: Partial<MultiSnapshot> = {}): MultiChess {
  const state = new MultiChess('double').snapshot();
  return MultiChess.fromSnapshot({ ...state, board, turn, history: [], castling: [[false, false], [false, false], [false, false], [false, false]], ...patch });
}
const kings = () => ({ a1: piece(0, 'k'), p8: piece(1, 'k'), h1: piece(2, 'k'), a8: piece(3, 'k') });

describe('Double Chess: one shared board, two teams', () => {
  it('starts with 128 cells, 64 pieces and Yellow, Green, Red, Blue turns', () => {
    const g = new MultiChess('double');
    expect(DOUBLE_TOPOLOGY.cells).toHaveLength(128);
    expect(Object.keys(g.snapshot().board)).toHaveLength(64);
    for (const [seat, from, to] of [[0, 'm2', 'm4'], [1, 'm7', 'm5'], [2, 'e2', 'e4'], [3, 'e7', 'e5']] as const) {
      expect(g.turn()).toBe(seat);
      expect(g.move(seat, from, to).over).toBe(false);
    }
    expect(g.turn()).toBe(0);
    expect(g.scoresList()).toEqual([0, 0, 0, 0]);
    expect(() => g.move(1, 'n7', 'n6')).toThrow();
  });

  it('crosses the central seam, blocks allied captures and ignores allied attacks', () => {
    const g = position({ ...kings(), h4: piece(0, 'r'), j4: piece(1, 'n'), h5: piece(2, 'b') });
    expect(g.legalMoves(0).get('h4')).toContain('j4');
    expect(g.legalMoves(0).get('h4')).not.toContain('h5');
    const capture = g.move(0, 'h4', 'j4');
    expect(capture.captured?.seat).toBe(1);
    expect(capture.pointsAwarded).toBe(0);
    const adjacentKings = position({ e4: piece(0, 'k'), f4: piece(2, 'k'), p8: piece(1, 'k'), a8: piece(3, 'k') });
    expect(adjacentKings.isSeatInCheck(0)).toBe(false);
    expect(adjacentKings.isSeatInCheck(2)).toBe(false);
  });

  it('allows an ally to rescue an apparent mate before the victim’s turn', () => {
    const g = position({ ...kings(), b6: piece(0, 'q'), c6: piece(0, 'b'), p7: piece(1, 'r') });
    expect(g.move(0, 'b6', 'b7').over).toBe(false);
    expect(g.isSeatInCheck(3)).toBe(true);
    expect(g.legalMoves(3).size).toBe(0);
    expect(g.move(1, 'p7', 'b7').over).toBe(false);
    expect(g.move(2, 'h1', 'g1').over).toBe(false);
    expect(g.turn()).toBe(3);
    expect(g.isSeatInCheck(3)).toBe(false);
  });

  it('ends on the victim’s turn if its ally does not rescue it', () => {
    const g = position({ ...kings(), b6: piece(0, 'q'), c6: piece(0, 'b') });
    expect(g.move(0, 'b6', 'b7').over).toBe(false);
    expect(g.move(1, 'p8', 'o8').over).toBe(false);
    const result = g.move(2, 'h1', 'g1');
    expect(result).toMatchObject({ over: true, endReason: 'checkmate' });
    expect(g.turn()).toBe(3);
    expect(g.teamResult()).toBe('1-0');
    expect(MultiChess.fromSnapshot(g.snapshot()).teamResult()).toBe('1-0');
  });

  it('permits an earlier counter-mate to win for the other team', () => {
    const g = position({ a1: piece(0, 'k'), p8: piece(1, 'k'), p1: piece(2, 'k'), a8: piece(3, 'k'), b6: piece(0, 'q'), c6: piece(0, 'b'), n2: piece(1, 'q'), n3: piece(3, 'b') });
    expect(g.move(0, 'b6', 'b7').over).toBe(false);
    expect(g.isSeatInCheck(3)).toBe(true);
    const mate = g.move(1, 'n2', 'o2');
    expect(mate.over).toBe(true);
    expect(g.turn()).toBe(2);
    expect(g.teamResult()).toBe('0-1');
  });

  it('resolves a legally capturable king at the start of the attacker’s turn', () => {
    const g = position({ a1: piece(0, 'k'), p8: piece(1, 'k'), p1: piece(2, 'k'), a8: piece(3, 'k'), p7: piece(1, 'r'), b2: piece(0, 'p') });
    expect(g.move(0, 'b2', 'b3').over).toBe(true);
    expect(g.turn()).toBe(1);
    expect(g.teamResult()).toBe('0-1');
  });

  it('treats stalemate, repetition and fifty quiet rounds as team draws', () => {
    const g = position({ c6: piece(0, 'k'), b6: piece(0, 'q'), p8: piece(1, 'k'), h1: piece(2, 'k'), a8: piece(3, 'k') }, 2);
    expect(g.move(2, 'h1', 'g1')).toMatchObject({ over: true, endReason: 'stalemate' });
    expect(g.teamResult()).toBe('1/2-1/2');
    const repeated = new MultiChess('double');
    const cycle = [[0, 'j1', 'k3'], [1, 'j8', 'k6'], [2, 'b1', 'c3'], [3, 'b8', 'c6'], [0, 'k3', 'j1'], [1, 'k6', 'j8'], [2, 'c3', 'b1'], [3, 'c6', 'b8']] as const;
    for (let n = 0; n < 2; n++) for (const [seat, from, to] of cycle) repeated.move(seat, from, to);
    expect(repeated.isOver()).toEqual({ over: true, reason: 'repetition' });
    const quiet = position({ ...kings(), j1: piece(0, 'n') }, 0, { quietPlies: 199 });
    expect(quiet.move(0, 'j1', 'k3')).toMatchObject({ over: true, endReason: 'fifty' });
  });

  it('handles castling, underpromotion and immediate en passant', () => {
    const castle = position({ ...kings(), a1: piece(0, 'r'), m1: piece(0, 'k'), p1: piece(0, 'r') }, 0,
      { castling: [[true, true], [false, false], [false, false], [false, false]] });
    castle.move(0, 'm1', 'o1');
    expect(castle.pieceAt('n1')).toEqual(piece(0, 'r'));
    const promote = position({ ...kings(), h7: piece(0, 'p') });
    promote.move(0, 'h7', 'h8', 'n');
    expect(promote.pieceAt('h8')).toMatchObject({ role: 'n', promoted: true });
    const ep = position({ ...kings(), i7: piece(1, 'p'), h5: piece(2, 'p') }, 1);
    ep.move(1, 'i7', 'i5');
    expect(ep.legalMoves(2).get('h5')).toContain('i6');
    ep.move(2, 'h5', 'i6');
    expect(ep.pieceAt('i5')).toBeUndefined();
    expect(ep.pieceAt('i6')).toEqual(piece(2, 'p'));
  });

  it('makes resignation and timeout a shared team loss', () => {
    for (const reason of ['resigned', 'timeout'] as const) {
      const g = new MultiChess('double');
      expect(g.eliminate(2, reason).over).toBe(true);
      expect(g.teamResult()).toBe('0-1');
    }
  });
});
