import type { CastlingDef, Cell, Role, Topology } from './topology.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'] as const;
const CELL_SIZE = 60;
const VIEW_SIZE = 14 * CELL_SIZE; // 840

function isValidCoord(f: number, r: number): boolean {
  if (f < 0 || f >= 14 || r < 1 || r > 14) return false;
  const inLeftCorner = f < 3;
  const inRightCorner = f > 10;
  const inBottomCorner = r <= 3;
  const inTopCorner = r >= 12;
  if ((inLeftCorner || inRightCorner) && (inBottomCorner || inTopCorner)) return false;
  return true;
}

function sqId(f: number, r: number): string {
  return `${FILES[f]}${r}`;
}

function parseSq(id: string): [number, number] | null {
  const m = /^([a-n])(\d{1,2})$/.exec(id);
  if (!m) return null;
  const f = FILES.indexOf(m[1] as typeof FILES[number]);
  const r = parseInt(m[2], 10);
  if (!isValidCoord(f, r)) return null;
  return [f, r];
}

class CrossTopologyImpl implements Topology {
  readonly variant = 'four-player' as const;
  readonly seats = 4;
  readonly viewSize = VIEW_SIZE;
  readonly cells: readonly Cell[];
  readonly cellById: ReadonlyMap<string, Cell>;

  private orthMap = new Map<string, string[][]>();
  private diagMap = new Map<string, string[][]>();
  private knightMap = new Map<string, string[]>();
  private kingMap = new Map<string, string[]>();

  constructor() {
    const cells: Cell[] = [];
    const byId = new Map<string, Cell>();

    for (let r = 14; r >= 1; r--) {
      for (let f = 0; f < 14; f++) {
        if (!isValidCoord(f, r)) continue;
        const id = sqId(f, r);
        const x0 = f * CELL_SIZE;
        const y0 = (14 - r) * CELL_SIZE;
        const x1 = x0 + CELL_SIZE;
        const y1 = y0 + CELL_SIZE;
        const light = (f + r) % 2 !== 0;
        const cell: Cell = {
          id,
          polygon: [
            [x0, y0],
            [x1, y0],
            [x1, y1],
            [x0, y1],
          ],
          center: [x0 + CELL_SIZE / 2, y0 + CELL_SIZE / 2],
          light,
        };
        cells.push(cell);
        byId.set(id, cell);
      }
    }
    this.cells = cells;
    this.cellById = byId;

    // Precompute rays & targets
    const orthDirs: [number, number][] = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    const diagDirs: [number, number][] = [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ];
    const knightJumps: [number, number][] = [
      [1, 2],
      [2, 1],
      [2, -1],
      [1, -2],
      [-1, -2],
      [-2, -1],
      [-2, 1],
      [-1, 2],
    ];

    for (const c of cells) {
      const [f, r] = parseSq(c.id)!;

      const oRays: string[][] = [];
      for (const [df, dr] of orthDirs) {
        const ray: string[] = [];
        let nf = f + df;
        let nr = r + dr;
        while (isValidCoord(nf, nr)) {
          ray.push(sqId(nf, nr));
          nf += df;
          nr += dr;
        }
        if (ray.length > 0) oRays.push(ray);
      }
      this.orthMap.set(c.id, oRays);

      const dRays: string[][] = [];
      for (const [df, dr] of diagDirs) {
        const ray: string[] = [];
        let nf = f + df;
        let nr = r + dr;
        while (isValidCoord(nf, nr)) {
          ray.push(sqId(nf, nr));
          nf += df;
          nr += dr;
        }
        if (ray.length > 0) dRays.push(ray);
      }
      this.diagMap.set(c.id, dRays);

      const kt: string[] = [];
      for (const [df, dr] of knightJumps) {
        if (isValidCoord(f + df, r + dr)) kt.push(sqId(f + df, r + dr));
      }
      this.knightMap.set(c.id, kt);

      const kgt: string[] = [];
      for (const [df, dr] of [...orthDirs, ...diagDirs]) {
        if (isValidCoord(f + df, r + dr)) kgt.push(sqId(f + df, r + dr));
      }
      this.kingMap.set(c.id, kgt);
    }
  }

  rotationForSeat(seat: number): number {
    // Seat 0: Red (bottom, rank 1) -> 0 deg
    // Seat 1: Blue (left, file a) -> -90 deg (270 deg) so left moves to bottom
    // Seat 2: Yellow (top, rank 14) -> 180 deg
    // Seat 3: Green (right, file n) -> 90 deg
    return ([0, 270, 180, 90][seat] ?? 0);
  }

  orthRays(id: string): string[][] {
    return this.orthMap.get(id) ?? [];
  }

  diagRays(id: string): string[][] {
    return this.diagMap.get(id) ?? [];
  }

  knightTargets(id: string): string[] {
    return this.knightMap.get(id) ?? [];
  }

  kingTargets(id: string): string[] {
    return this.kingMap.get(id) ?? [];
  }

  pawnForward(id: string, seat: number): string | null {
    const coord = parseSq(id);
    if (!coord) return null;
    const [f, r] = coord;
    const [df, dr] = (
      [
        [0, 1], // 0 Red: +rank
        [1, 0], // 1 Blue: +file
        [0, -1], // 2 Yellow: -rank
        [-1, 0], // 3 Green: -file
      ] as [number, number][]
    )[seat];
    return isValidCoord(f + df, r + dr) ? sqId(f + df, r + dr) : null;
  }

  pawnCaptures(id: string, seat: number): string[] {
    const coord = parseSq(id);
    if (!coord) return [];
    const [f, r] = coord;
    const deltas: [number, number][] = (
      [
        [
          [-1, 1],
          [1, 1],
        ], // 0 Red
        [
          [1, -1],
          [1, 1],
        ], // 1 Blue
        [
          [-1, -1],
          [1, -1],
        ], // 2 Yellow
        [
          [-1, -1],
          [-1, 1],
        ], // 3 Green
      ] as [number, number][][]
    )[seat];
    const out: string[] = [];
    for (const [df, dr] of deltas) {
      if (isValidCoord(f + df, r + dr)) out.push(sqId(f + df, r + dr));
    }
    return out;
  }

  isPawnStart(id: string, seat: number): boolean {
    const coord = parseSq(id);
    if (!coord) return false;
    const [f, r] = coord;
    if (seat === 0) return r === 2 && f >= 3 && f <= 10;
    if (seat === 1) return f === 1 && r >= 4 && r <= 11;
    if (seat === 2) return r === 13 && f >= 3 && f <= 10;
    if (seat === 3) return f === 12 && r >= 4 && r <= 11;
    return false;
  }

  isPromotion(id: string, seat: number): boolean {
    const coord = parseSq(id);
    if (!coord) return false;
    const [f, r] = coord;
    // 8th rank from player's starting edge (1st line past the 8x8 center)
    if (seat === 0) return r === 8;
    if (seat === 1) return f === 7; // file h (index 7, 8th file from 'a')
    if (seat === 2) return r === 7;
    if (seat === 3) return f === 6; // file g (index 6, 8th file from 'n')
    return false;
  }

  castling(seat: number): CastlingDef[] {
    // Each player has Queen on their left, King on their right (viewed from their side):
    // Seat 0 (Red, rank 1, d..k): d1=R, e1=N, f1=B, g1=Q, h1=K, i1=B, j1=N, k1=R
    if (seat === 0) {
      return [
        { side: 'k', king: 'h1', rook: 'k1', kingTo: 'j1', rookTo: 'i1', between: ['i1', 'j1'], pass: ['h1', 'i1', 'j1'] },
        { side: 'q', king: 'h1', rook: 'd1', kingTo: 'f1', rookTo: 'g1', between: ['e1', 'f1', 'g1'], pass: ['h1', 'g1', 'f1'] },
      ];
    }
    // Seat 1 (Blue, file a, 4..11, viewed from left: 11 is left, 4 is right):
    // a11=R, a10=N, a9=B, a8=Q, a7=K, a6=B, a5=N, a4=R
    if (seat === 1) {
      return [
        { side: 'k', king: 'a7', rook: 'a4', kingTo: 'a5', rookTo: 'a6', between: ['a5', 'a6'], pass: ['a7', 'a6', 'a5'] },
        { side: 'q', king: 'a7', rook: 'a11', kingTo: 'a9', rookTo: 'a8', between: ['a8', 'a9', 'a10'], pass: ['a7', 'a8', 'a9'] },
      ];
    }
    // Seat 2 (Yellow, rank 14, d..k, viewed from top: k is left, d is right):
    // k14=R, j14=N, i14=B, h14=Q, g14=K, f14=B, e14=N, d14=R
    if (seat === 2) {
      return [
        { side: 'k', king: 'g14', rook: 'd14', kingTo: 'e14', rookTo: 'f14', between: ['e14', 'f14'], pass: ['g14', 'f14', 'e14'] },
        { side: 'q', king: 'g14', rook: 'k14', kingTo: 'i14', rookTo: 'h14', between: ['h14', 'i14', 'j14'], pass: ['g14', 'h14', 'i14'] },
      ];
    }
    // Seat 3 (Green, file n, 4..11, viewed from right: 4 is left, 11 is right):
    // n4=R, n5=N, n6=B, n7=Q, n8=K, n9=B, n10=N, n11=R
    return [
      { side: 'k', king: 'n8', rook: 'n11', kingTo: 'n10', rookTo: 'n9', between: ['n9', 'n10'], pass: ['n8', 'n9', 'n10'] },
      { side: 'q', king: 'n8', rook: 'n4', kingTo: 'n6', rookTo: 'n7', between: ['n5', 'n6', 'n7'], pass: ['n8', 'n7', 'n6'] },
    ];
  }

  initialSetup(): Record<string, { seat: number; role: Role }> {
    const out: Record<string, { seat: number; role: Role }> = {};
    const row0: Role[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    const row2: Role[] = ['r', 'n', 'b', 'k', 'q', 'b', 'n', 'r'];

    for (let i = 0; i < 8; i++) {
      // Seat 0 Red (bottom: d1..k1, pawns d2..k2)
      out[sqId(3 + i, 1)] = { seat: 0, role: row0[i] };
      out[sqId(3 + i, 2)] = { seat: 0, role: 'p' };

      // Seat 1 Blue (left: a4..a11, pawns b4..b11; a7=K, a8=Q)
      out[sqId(0, 4 + i)] = { seat: 1, role: row2[i] };
      out[sqId(1, 4 + i)] = { seat: 1, role: 'p' };

      // Seat 2 Yellow (top: d14..k14, pawns d13..k13; g14=K, h14=Q)
      out[sqId(3 + i, 14)] = { seat: 2, role: row2[i] };
      out[sqId(3 + i, 13)] = { seat: 2, role: 'p' };

      // Seat 3 Green (right: n4..n11, pawns m4..m11; n7=Q, n8=K)
      out[sqId(13, 4 + i)] = { seat: 3, role: row0[i] };
      out[sqId(12, 4 + i)] = { seat: 3, role: 'p' };
    }
    return out;
  }

  pieceValues(): Record<Role, number> {
    // Chess.com 4-player values: Bishop = 5
    return { p: 1, n: 3, b: 5, r: 5, q: 9, k: 20 };
  }
}

export const CROSS_TOPOLOGY: Topology = new CrossTopologyImpl();
