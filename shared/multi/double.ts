import type { CastlingDef, Cell, Role, Topology } from './topology.js';

const FILES = 'abcdefghijklmnop';
const SIZE = 60;
const PAD = 24;
const square = (x: number, y: number): string | null =>
  x >= 0 && x < 16 && y >= 0 && y < 8 ? `${FILES[x]}${y + 1}` : null;
const coords = (id: string): [number, number] => [FILES.indexOf(id[0]), Number(id.slice(1)) - 1];

/** Two adjoining 8×8 boards, with no barrier on the central seam. */
class DoubleTopology implements Topology {
  readonly variant = 'double' as const;
  readonly seats = 4;
  readonly viewWidth = 16 * SIZE + PAD * 2;
  readonly viewHeight = 8 * SIZE + PAD * 2;
  readonly viewSize = this.viewWidth;
  readonly cells: Cell[] = [];
  readonly cellById: ReadonlyMap<string, Cell>;

  constructor() {
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
      const left = PAD + x * SIZE;
      const top = PAD + (7 - y) * SIZE;
      this.cells.push({
        id: square(x, y)!,
        polygon: [[left, top], [left + SIZE, top], [left + SIZE, top + SIZE], [left, top + SIZE]],
        center: [left + SIZE / 2, top + SIZE / 2],
        light: (x + y) % 2 === 1,
      });
    }
    this.cellById = new Map(this.cells.map(c => [c.id, c]));
  }

  rotationForSeat(seat: number): number { return seat % 2 === 0 ? 0 : 180; }
  private targets(id: string, steps: [number, number][]): string[] {
    const [x, y] = coords(id);
    return steps.map(([dx, dy]) => square(x + dx, y + dy)).filter((s): s is string => s !== null);
  }
  private rays(id: string, steps: [number, number][]): string[][] {
    const [x, y] = coords(id);
    return steps.map(([dx, dy]) => {
      const ray: string[] = [];
      for (let n = 1; ; n++) {
        const next = square(x + dx * n, y + dy * n);
        if (!next) break;
        ray.push(next);
      }
      return ray;
    });
  }
  orthRays(id: string): string[][] { return this.rays(id, [[1, 0], [-1, 0], [0, 1], [0, -1]]); }
  diagRays(id: string): string[][] { return this.rays(id, [[1, 1], [1, -1], [-1, 1], [-1, -1]]); }
  knightTargets(id: string): string[] { return this.targets(id, [[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]]); }
  kingTargets(id: string): string[] { return this.targets(id, [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]); }
  pawnForward(id: string, seat: number): string | null {
    const [x, y] = coords(id);
    return square(x, y + (seat % 2 === 0 ? 1 : -1));
  }
  pawnCaptures(id: string, seat: number): string[] {
    const dy = seat % 2 === 0 ? 1 : -1;
    return this.targets(id, [[1, dy], [-1, dy]]);
  }
  isPawnStart(id: string, seat: number): boolean { return coords(id)[1] === (seat % 2 === 0 ? 1 : 6); }
  isPromotion(id: string, seat: number): boolean { return coords(id)[1] === (seat % 2 === 0 ? 7 : 0); }
  castling(seat: number): CastlingDef[] {
    const offset = seat < 2 ? 8 : 0;
    const y = seat % 2 === 0 ? 0 : 7;
    const sq = (x: number) => square(offset + x, y)!;
    return [
      { side: 'k', king: sq(4), rook: sq(7), kingTo: sq(6), rookTo: sq(5), between: [sq(5), sq(6)], pass: [sq(4), sq(5), sq(6)] },
      { side: 'q', king: sq(4), rook: sq(0), kingTo: sq(2), rookTo: sq(3), between: [sq(1), sq(2), sq(3)], pass: [sq(4), sq(3), sq(2)] },
    ];
  }
  initialSetup(): Record<string, { seat: number; role: Role }> {
    const board: Record<string, { seat: number; role: Role }> = {};
    const back: Role[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let seat = 0; seat < 4; seat++) {
      const offset = seat < 2 ? 8 : 0;
      const y = seat % 2 === 0 ? 0 : 7;
      for (let x = 0; x < 8; x++) {
        board[square(offset + x, y)!] = { seat, role: back[x] };
        board[square(offset + x, y + (seat % 2 === 0 ? 1 : -1))!] = { seat, role: 'p' };
      }
    }
    return board;
  }
  pieceValues(): Record<Role, number> { return { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }; }
}

export const DOUBLE_TOPOLOGY: Topology = new DoubleTopology();
