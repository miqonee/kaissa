import { describe, expect, it } from 'vitest';
import { CROSS_TOPOLOGY, MultiChess, type MultiSnapshot } from 'shared';

function customGame(setup: Partial<MultiSnapshot> & { board: MultiSnapshot['board'] }): MultiChess {
  const base = MultiChess.create('four-player').snapshot();
  return MultiChess.fromSnapshot({
    ...base,
    ...setup,
  });
}

describe('4-player cross board engine (CROSS_TOPOLOGY + MultiChess)', () => {
  it('has 160 cells (14x14 minus four 3x3 corners) and 20 initial moves per seat', () => {
    expect(CROSS_TOPOLOGY.cells).toHaveLength(160);
    expect(CROSS_TOPOLOGY.cellById.has('a1')).toBe(false);
    expect(CROSS_TOPOLOGY.cellById.has('c3')).toBe(false);
    expect(CROSS_TOPOLOGY.cellById.has('d1')).toBe(true);
    expect(CROSS_TOPOLOGY.cellById.has('a4')).toBe(true);
    expect(CROSS_TOPOLOGY.cellById.has('n11')).toBe(true);
    expect(CROSS_TOPOLOGY.cellById.has('n14')).toBe(false);

    const g = MultiChess.create('four-player');
    for (const seat of [0, 1, 2, 3]) {
      let count = 0;
      for (const tos of g.legalMoves(seat).values()) count += tos.length;
      expect(count).toBe(20);
    }
  });

  it('rotates turns clockwise 0 -> 1 -> 2 -> 3 -> 0', () => {
    const g = MultiChess.create('four-player');
    expect(g.turn()).toBe(0);
    g.move(0, 'g2', 'g4');
    expect(g.turn()).toBe(1);
    g.move(1, 'b7', 'd7');
    expect(g.turn()).toBe(2);
    g.move(2, 'g13', 'g11');
    expect(g.turn()).toBe(3);
    g.move(3, 'm7', 'k7');
    expect(g.turn()).toBe(0);
  });

  it('supports castling for all 4 seats', () => {
    const g = customGame({
      turn: 0,
      board: {
        h1: { seat: 0, role: 'k' },
        k1: { seat: 0, role: 'r' },
        a7: { seat: 1, role: 'k' },
        a4: { seat: 1, role: 'r' },
        g14: { seat: 2, role: 'k' },
        d14: { seat: 2, role: 'r' },
        n8: { seat: 3, role: 'k' },
        n11: { seat: 3, role: 'r' },
      },
    });

    g.move(0, 'h1', 'j1');
    expect(g.pieceAt('j1')?.role).toBe('k');
    expect(g.pieceAt('i1')?.role).toBe('r');

    g.move(1, 'a7', 'a5');
    expect(g.pieceAt('a5')?.role).toBe('k');
    expect(g.pieceAt('a6')?.role).toBe('r');

    g.move(2, 'g14', 'e14');
    expect(g.pieceAt('e14')?.role).toBe('k');
    expect(g.pieceAt('f14')?.role).toBe('r');

    g.move(3, 'n8', 'n10');
    expect(g.pieceAt('n10')?.role).toBe('k');
    expect(g.pieceAt('n9')?.role).toBe('r');
  });

  it('promotes pawns on the 8th rank from their starting edge into a 1-point queen', () => {
    const g = customGame({
      turn: 0,
      board: {
        h1: { seat: 0, role: 'k' },
        e7: { seat: 0, role: 'p' },
        a7: { seat: 1, role: 'k' },
        e9: { seat: 1, role: 'r' },
        g14: { seat: 2, role: 'k' },
        n8: { seat: 3, role: 'k' },
      },
    });

    const out = g.move(0, 'e7', 'e8');
    expect(out.promoted).toBe(true);
    expect(g.pieceAt('e8')).toEqual({ seat: 0, role: 'q', promoted: true });

    // Seat 1 captures the promoted queen -> awards only 1 point
    const cap = g.move(1, 'e9', 'e8');
    expect(cap.pointsAwarded).toBe(1);
    expect(g.scoreOf(1)).toBe(1);
  });

  it('awards +20 points for checkmate, greys out the mated player pieces, and gives 0 points for capturing grey pieces', () => {
    // Seat 1 (Blue) king trapped at a7; Seat 0 has rooks on b4 and c10, moves c10 -> a10 for ladder mate along files a and b
    const g = customGame({
      turn: 0,
      board: {
        h1: { seat: 0, role: 'k' },
        b4: { seat: 0, role: 'r' },
        c10: { seat: 0, role: 'r' },
        a7: { seat: 1, role: 'k' },
        d5: { seat: 1, role: 'n' },
        g14: { seat: 2, role: 'k' },
        d9: { seat: 2, role: 'r' },
        n8: { seat: 3, role: 'k' },
      },
    });

    // Seat 0 moves rook c10 -> a10 checking a7; file a is covered by a10 and file b is covered by b4
    const res = g.move(0, 'c10', 'a10');
    expect(res.eliminated).toEqual([
      { seat: 1, status: 'checkmated', bySeat: 0, points: 20 },
    ]);
    expect(g.scoreOf(0)).toBe(20);
    expect(g.seatStatus(1)).toBe('checkmated');
    expect(g.pieceAt('d5')?.dead).toBe(true);
    // Turn skips eliminated seat 1 and lands on seat 2
    expect(g.turn()).toBe(2);

    // Seat 2 captures the dead knight at d5 -> 0 points
    const capDead = g.move(2, 'd9', 'd5');
    expect(capDead.pointsAwarded).toBe(0);
    expect(g.scoreOf(2)).toBe(0);
  });

  it('serializes and deserializes board state cleanly', () => {
    const g = MultiChess.create('four-player');
    g.move(0, 'e2', 'e4');
    const s = g.serialize();
    const parsed = MultiChess.deserializeBoard(s);
    expect(parsed).not.toBeNull();
    expect(parsed!.variant).toBe('four-player');
    expect(parsed!.turn).toBe(1);
    expect(parsed!.board['e4']).toEqual({ seat: 0, role: 'p' });
  });
});
