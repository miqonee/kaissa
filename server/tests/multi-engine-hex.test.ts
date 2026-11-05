import { describe, expect, it } from 'vitest';
import { HEX_TOPOLOGY, MultiChess, type MultiSnapshot } from 'shared';

function customHexGame(setup: Partial<MultiSnapshot> & { board: MultiSnapshot['board'] }): MultiChess {
  const base = MultiChess.create('three-player').snapshot();
  return MultiChess.fromSnapshot({
    ...base,
    ...setup,
  });
}

describe('3-player hexagonal board engine (HEX_TOPOLOGY + MultiChess)', () => {
  it('has 96 cells and 20 initial legal moves per seat', () => {
    expect(HEX_TOPOLOGY.cells).toHaveLength(96);
    const g = MultiChess.create('three-player');
    for (const seat of [0, 1, 2]) {
      let count = 0;
      for (const tos of g.legalMoves(seat).values()) count += tos.length;
      expect(count).toBe(20);
    }
  });

  it('connects orthogonal rays across the seam with file inversion (f -> 7-f)', () => {
    // From 0e1 (f=4, r=1) moving +r goes: 0e2, 0e3, 0e4, then crosses right seam into half 1 at f = 7-4 = 3 ('d'): 1d4, 1d3, 1d2, 1d1
    const rays = HEX_TOPOLOGY.orthRays('0e1');
    const forwardRay = rays.find((r) => r[0] === '0e2');
    expect(forwardRay).toEqual(['0e2', '0e3', '0e4', '1d4', '1d3', '1d2', '1d1']);
  });

  it('connects diagonal rays straight through the central 6-cell hub', () => {
    // From 0c3 (f=2, r=3) moving (+1, +1) -> 0d4 (f=3, r=4) -> crosses center into half 1 at 1e4 (f=4, r=4) -> 1f3 -> 1g2 -> 1h1
    const rays = HEX_TOPOLOGY.diagRays('0c3');
    const centerRay = rays.find((r) => r[0] === '0d4');
    expect(centerRay).toEqual(['0d4', '1e4', '1f3', '1g2', '1h1']);
  });

  it('promotes pawns when reaching rank 1 of any opponent half', () => {
    const g = customHexGame({
      turn: 0,
      board: {
        '0e1': { seat: 0, role: 'k' },
        '1c2': { seat: 0, role: 'p' },
        '1e1': { seat: 1, role: 'k' },
        '2e1': { seat: 2, role: 'k' },
      },
    });

    const out = g.move(0, '1c2', '1c1');
    expect(out.promoted).toBe(true);
    expect(g.pieceAt('1c1')).toEqual({ seat: 0, role: 'q', promoted: true });
  });
});
