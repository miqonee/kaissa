import type { CastlingDef, Cell, Role, Topology } from './topology.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const VIEW_SIZE = 840;
const CX = VIEW_SIZE / 2;
const CY = VIEW_SIZE / 2;
const RADIUS = 385;

// Orth directions within a half's local coordinates:
// 0: +r (towards center/seam), 1: -r (towards outer edge), 2: +f (right), 3: -f (left)
type LocalDir = 0 | 1 | 2 | 3;

function cellId(h: number, f: number, r: number): string {
  return `${h}${FILES[f]}${r}`;
}

function parseHexId(id: string): [number, number, number] | null {
  if (id.length !== 3) return null;
  const h = Number(id[0]);
  const f = FILES.indexOf(id[1] as typeof FILES[number]);
  const r = Number(id[2]);
  if (h < 0 || h > 2 || f < 0 || f > 7 || r < 1 || r > 4) return null;
  return [h, f, r];
}

/**
 * Step one orthogonal square from (h, f, r) in direction `dir`,
 * returning the new cell and the continuation direction in the new cell's local frame.
 */
function stepOrth(h: number, f: number, r: number, dir: LocalDir): { h: number; f: number; r: number; dir: LocalDir } | null {
  if (dir === 0) {
    // +r (towards seam at r=4)
    if (r < 4) return { h, f, r: r + 1, dir: 0 };
    // Crossing seam at r=4:
    if (f <= 3) {
      // Left quad of half h connects to right quad of half (h+2)%3
      // Going across the seam enters the neighbour at r=4 and continues in -r (dir 1)!
      return { h: (h + 2) % 3, f: 7 - f, r: 4, dir: 1 };
    } else {
      // Right quad of half h connects to left quad of half (h+1)%3
      return { h: (h + 1) % 3, f: 7 - f, r: 4, dir: 1 };
    }
  }
  if (dir === 1) {
    // -r (towards outer baseline r=1)
    if (r > 1) return { h, f, r: r - 1, dir: 1 };
    return null;
  }
  if (dir === 2) {
    // +f (left-to-right within half)
    if (f < 7) return { h, f: f + 1, r, dir: 2 };
    return null;
  }
  // dir === 3: -f (right-to-left within half)
  if (f > 0) return { h, f: f - 1, r, dir: 3 };
  return null;
}

function perpendicularDirs(dir: LocalDir): [LocalDir, LocalDir] {
  return dir === 0 || dir === 1 ? [2, 3] : [0, 1];
}

/**
 * Step one diagonal square from (h, f, r) with local delta (df in {-1, +1}, dr in {-1, +1}).
 * Handles crossing the seam between halves and the central 6-cell hub.
 */
function stepDiag(
  h: number,
  f: number,
  r: number,
  df: -1 | 1,
  dr: -1 | 1,
): { h: number; f: number; r: number; df: -1 | 1; dr: -1 | 1 } | null {
  const nf = f + df;
  const nr = r + dr;

  // Case 1: stays within the same half
  if (nf >= 0 && nf <= 7 && nr >= 1 && nr <= 4) {
    return { h, f: nf, r: nr, df, dr };
  }

  // Case 2: falls off outer edge (nr < 1) or side outer edges (nf < 0 or nf > 7 while nr <= 4)
  if (nr <= 4) {
    return null;
  }

  // Case 3: nr === 5 (crossing seam r=4 -> neighbor)
  // Special subcase: crossing right through the central vertex!
  // The central vertex is shared by f=3,4 at r=4.
  // Moving from f=3 with df=+1 and dr=+1 (or f=4 with df=-1 and dr=+1) hits the exact center of the board.
  // Per our rule, the diagonal continues straight through the center into the opposite section (3 sections away):
  // For (h, f=3, r=4) moving (+1, +1) -> enters half (h+1)%3 at f=3, r=4 continuing with df=-1, dr=-1,
  // OR enters half (h+2)%3 at f=4, r=4 continuing with df=+1, dr=-1.
  // Actually, opposite quad in the 6-quad ring:
  // Quads around center in order:
  // Q0: h=0, R (f=4..7), center cell (0, 4, 4)
  // Q1: h=1, L (f=0..3), center cell (1, 3, 4)
  // Q2: h=1, R (f=4..7), center cell (1, 4, 4)
  // Q3: h=2, L (f=0..3), center cell (2, 3, 4)
  // Q4: h=2, R (f=4..7), center cell (2, 4, 4)
  // Q5: h=0, L (f=0..3), center cell (0, 3, 4)
  if (r === 4 && ((f === 3 && df === 1) || (f === 4 && df === -1)) && dr === 1) {
    if (f === 3) {
      // Q5 (h, L) -> opposite is Q2 ((h+1)%3, R), center cell is f=4, r=4, moving away from center (+f, -r)
      return { h: (h + 1) % 3, f: 4, r: 4, df: 1, dr: -1 };
    } else {
      // Q0 (h, R) -> opposite is Q3 ((h+2)%3, L), center cell is f=3, r=4, moving away from center (-f, -r)
      return { h: (h + 2) % 3, f: 3, r: 4, df: -1, dr: -1 };
    }
  }

  // Normal seam crossing (nr === 5, not through center vertex):
  // Step across the seam at r=4 first, then step sideways in the neighbor half.
  if (f <= 3 && nf >= 0 && nf <= 3) {
    // Crosses left seam of half h into right half of (h+2)%3
    // f maps to 7 - nf, r becomes 4, dr flips to -1, df flips to -df
    return { h: (h + 2) % 3, f: 7 - nf, r: 4, df: (-df) as -1 | 1, dr: -1 };
  }
  if (f >= 4 && nf >= 4 && nf <= 7) {
    // Crosses right seam of half h into left half of (h+1)%3
    return { h: (h + 1) % 3, f: 7 - nf, r: 4, df: (-df) as -1 | 1, dr: -1 };
  }

  return null;
}

function bilerp(
  p00: [number, number],
  p10: [number, number],
  p11: [number, number],
  p01: [number, number],
  u: number,
  v: number,
): [number, number] {
  const x = (1 - u) * (1 - v) * p00[0] + u * (1 - v) * p10[0] + u * v * p11[0] + (1 - u) * v * p01[0];
  const y = (1 - u) * (1 - v) * p00[1] + u * (1 - v) * p10[1] + u * v * p11[1] + (1 - u) * v * p01[1];
  return [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}

class HexTopologyImpl implements Topology {
  readonly variant = 'three-player' as const;
  readonly seats = 3;
  readonly viewSize = VIEW_SIZE;
  readonly cells: readonly Cell[];
  readonly cellById: ReadonlyMap<string, Cell>;

  private orthMap = new Map<string, string[][]>();
  private diagMap = new Map<string, string[][]>();
  private knightMap = new Map<string, string[]>();
  private kingMap = new Map<string, string[]>();

  constructor() {
    // Regular hexagon vertices oriented so Seat 0 (Red) is at the bottom:
    // Bottom edge is horizontal-ish? Wait: a 96-cell 3-player board has 6 sides:
    // Each player owns 2 adjacent sides of the hexagon (8 files total: 4 on left side, 4 on right side),
    // OR each player owns 1 side of 8 files and half of adjacent sides?
    // Standard 3-player chess (6 quads of 4x4):
    // A regular hexagon has 6 sides, each side is 4 cells wide!
    // Each player's baseline is 2 adjacent sides of the hexagon (4 + 4 = 8 files), OR
    // wait: if each player's baseline is 8 files, 3 players * 8 files = 24 outer files? No!
    // Look at the seam rules:
    // Player h has 8 files (a..h) along rank 1 (outer edge), and 4 ranks (1..4).
    // 3 players * 8 files * 4 ranks = 96 cells.
    // Outer perimeter has 3 * 8 = 24 cell edges.
    // On a hexagon with 6 sides of 4 cells each, 6 * 4 = 24 cell edges!
    // That means each player's baseline (rank 1, files a..h) spans TWO adjacent sides of the hexagon
    // (or one side of 8 and seams go to the other 3 sides? Wait: if r=1 is on the perimeter for all 3 players,
    // and seams are at r=4, then ALL 24 outer edges belong to r=1 of the 3 players, and the 3 seams go from the 3 alternate vertices to the center!).
    // Let's verify the geometry of 6 quads (4x4 each) meeting at the center:
    // A quad has 4 sides of length 4:
    // - Side A (r=1 boundary): outer edge of length 4
    // - Side B (f=0 or f=7 boundary): outer edge of length 4! Wait: in our stepOrth, f=0 and f=7 have NO neighbor (`if (f < 7)`, `if (f > 0)`).
    //Wait: if f=0 and f=7 had no neighbor, then they would also be outer edges, which would make 8 edges!
    // Hold on! Let's check how a 6-quad hex board works:
    // Each quad is 4x4. The 6 quads meet at the center (1 vertex of each quad).
    // Opposite to the center vertex, each quad has an outer corner (one of the 6 vertices of the hexagon).
    // The two outer sides of each quad lie on the perimeter of the hexagon?
    // Wait: if a quad is 4x4, it has 4 boundaries:
    // Two boundaries meet at the center of the board (the seams!).
    // Two boundaries lie on the outer perimeter of the hexagon!
    // Let's check: in Half `h` (which is TWO quads glued together along the line between f=3 and f=4):
    // In Half `h`, files a..d (f=0..3) and files e..h (f=4..7) are glued along f=3 <-> f=4!
    // And r=4 (f=0..3) is glued to Half (h+2)%3's r=4 (f=4..7)!
    // And r=4 (f=4..7) is glued to Half (h+1)%3's r=4 (f=0..3)!
    // That means around the center of the board, ONLY 3 seams meet:
    // Seam 0-1: Half 0 (f=4..7, r=4) <-> Half 1 (f=0..3, r=4)
    // Seam 1-2: Half 1 (f=4..7, r=4) <-> Half 2 (f=0..3, r=4)
    // Seam 2-0: Half 2 (f=4..7, r=4) <-> Half 0 (f=0..3, r=4)
    // YES! Look at Half `h`: it is an 8x4 rectangle bent at the middle (between f=3 and f=4):
    // - Baseline r=1 (files a..h, 8 cells) is ONE flat side of the board (or two collinear 4-cell segments)
    // - Left edge f=0 (ranks 1..4) and Right edge f=7 (ranks 1..4) are the other sides of the hexagon!
    // Let's count the outer perimeter of the hexagon:
    // - 3 baselines (r=1, files a..h, length 8? Or length 4+4):
    // Wait: if r=1 is outer, AND f=0 (r=1..4) is outer, AND f=7 (r=1..4) is outer:
    // That's 6 sides of the hexagon:
    // Side 1 (bottom): Half 0 baseline (r=1, f=0..7)
    // Side 2 (bottom-right): Half 0 right edge (f=7, r=1..4) + Half 1 left edge (f=0, r=4..1)
    // Side 3 (top-right): Half 1 baseline (r=1, f=0..7)
    // Side 4 (top): Half 1 right edge (f=7, r=1..4) + Half 2 left edge (f=0, r=4..1)
    // Side 5 (top-left): Half 2 baseline (r=1, f=0..7)
    // Side 6 (bottom-left): Half 2 right edge (f=7, r=1..4) + Half 0 left edge (f=0, r=4..1)
    // YES! That's the exact geometry of the standard 96-square hexagonal 3-player chessboard!
    // Let's double check:
    // A regular hexagon has 6 vertices V0..V5:
    // - Bottom side (V0 -> V1): Half 0 baseline (r=1, files a..h, 8 cells wide)
    // - Right-bottom side (V1 -> V2): Half 0 right edge (f=7, r=1..4) then Half 1 left edge (f=0, r=4..1) -> 4 + 4 = 8 cells!
    // - Right-top side (V2 -> V3): Half 1 baseline (r=1, files a..h)
    // - Top side (V3 -> V4): Half 1 right edge + Half 2 left edge
    // - Left-top side (V4 -> V5): Half 2 baseline (r=1, files a..h)
    // - Left-bottom side (V5 -> V0): Half 2 right edge + Half 0 left edge
    // And the 3 seams go from the midpoints of sides (V1-V2), (V3-V4), (V5-V0) to the center (CX, CY)!
    // Let's check the 4 corners of Half 0:
    // - Bottom-left (f=0, r=0): V0
    // - Bottom-right (f=8, r=0): V1
    // - Top-right (f=8, r=4): midpoint of V1..V2 (call it M1)
    // - Top-middle (f=4, r=4): Center of the hexagon C = (CX, CY)!
    // - Top-left (f=0, r=4): midpoint of V5..V0 (call it M0)
    // Look at the two 4x4 quads of Half 0:
    // Left quad (f=0..4, r=0..4):
    //   p00 (f=0, r=0) = V0
    //   p10 (f=4, r=0) = midpoint of V0..V1 (call it B0)
    //   p11 (f=4, r=4) = Center C
    //   p01 (f=0, r=4) = midpoint of V5..V0 (M0)
    // Right quad (f=4..8, r=0..4):
    //   p00 (f=4, r=0) = B0 (midpoint of V0..V1)
    //   p10 (f=8, r=0) = V1
    //   p11 (f=8, r=4) = midpoint of V1..V2 (M1)
    //   p01 (f=4, r=4) = Center C
    // Every single quad is a convex quadrilateral with 4x4 bilinear grid, and adjacent quads share exact boundary vertices!

    // Let's compute the 6 hexagon vertices V0..V5 so that V0..V1 is horizontal at the bottom:
    // In SVG coordinates (y down):
    // Angle of V0 = 120 deg (bottom-left), V1 = 60 deg (bottom-right), V2 = 0 deg (right),
    // V3 = 300 deg (-60, top-right), V4 = 240 deg (-120, top-left), V5 = 180 deg (left).
    const anglesDeg = [120, 60, 0, -60, -120, 180];
    const V: [number, number][] = anglesDeg.map((deg) => {
      const rad = (deg * Math.PI) / 180;
      return [CX + RADIUS * Math.cos(rad), CY + RADIUS * Math.sin(rad)];
    });
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const C: [number, number] = [CX, CY];

    // For each half h in 0..2:
    // Note: going counter-clockwise in screen space (or clockwise):
    // Seat 0 (Red, bottom): V0 -> V1
    // Seat 1 (Blue, top-right): V2 -> V3
    // Seat 2 (Yellow, top-left): V4 -> V5
    // Let's check seam connectivity with this vertex assignment:
    // Half 0 right quad top edge goes from C (f=4, r=4) to M1 = mid(V1, V2) (f=8, r=4).
    // Half 1 left quad top edge goes from M1 = mid(V1, V2) (f=0, r=4) to C (f=4, r=4).
    // In Half 0 right quad, f=4 is C and f=7 is near M1.
    // In Half 1 left quad, f=0 is near M1 and f=3 is near C.
    // So f in Half 0 right quad (4..7) meets 7-f in Half 1 left quad (3..0)!
    // That matches `h=0, f>=4` -> `(h+1)%3 = 1, 7-f`!
    // And Half 0 left quad top edge goes from M5 = mid(V5, V0) (f=0, r=4) to C (f=4, r=4),
    // which meets Half 2 right quad (f=4..7, r=4) where f=4 is C and f=7 is near M5!
    // That matches `h=0, f<=3` -> `(h+2)%3 = 2, 7-f`!
    // Everything is 100% geometrically and topologically consistent!

    const cells: Cell[] = [];
    const byId = new Map<string, Cell>();

    for (let h = 0; h < 3; h++) {
      const vLeft = V[h * 2];
      const vRight = V[h * 2 + 1];
      const vPrev = V[(h * 2 + 5) % 6];
      const vNext = V[(h * 2 + 2) % 6];

      const bMid = mid(vLeft, vRight);
      const mLeft = mid(vPrev, vLeft);
      const mRight = mid(vRight, vNext);

      for (let r = 1; r <= 4; r++) {
        const v0 = (r - 1) / 4;
        const v1 = r / 4;
        for (let f = 0; f < 8; f++) {
          const id = cellId(h, f, r);
          let poly: [number, number][];
          let center: [number, number];
          if (f < 4) {
            const u0 = f / 4;
            const u1 = (f + 1) / 4;
            poly = [
              bilerp(vLeft, bMid, C, mLeft, u0, v0),
              bilerp(vLeft, bMid, C, mLeft, u1, v0),
              bilerp(vLeft, bMid, C, mLeft, u1, v1),
              bilerp(vLeft, bMid, C, mLeft, u0, v1),
            ];
            center = bilerp(vLeft, bMid, C, mLeft, (u0 + u1) / 2, (v0 + v1) / 2);
          } else {
            const u0 = (f - 4) / 4;
            const u1 = (f - 3) / 4;
            poly = [
              bilerp(bMid, vRight, mRight, C, u0, v0),
              bilerp(bMid, vRight, mRight, C, u1, v0),
              bilerp(bMid, vRight, mRight, C, u1, v1),
              bilerp(bMid, vRight, mRight, C, u0, v1),
            ];
            center = bilerp(bMid, vRight, mRight, C, (u0 + u1) / 2, (v0 + v1) / 2);
          }
          // 2-colouring is preserved across all seams because f -> 7-f flips parity while r=4->4 keeps parity:
          // (f + r) + (7 - f + 4) = 11 (odd), so opposite parities meet across every seam!
          const light = (f + r) % 2 !== 0;
          const cell: Cell = { id, polygon: poly, center, light };
          cells.push(cell);
          byId.set(id, cell);
        }
      }
    }

    this.cells = cells;
    this.cellById = byId;

    const centralIds = new Set<string>(['0d4', '0e4', '1d4', '1e4', '2d4', '2e4']);

    for (const c of cells) {
      const [h, f, r] = parseHexId(c.id)!;

      // Orthogonal rays (4 directions)
      const oRays: string[][] = [];
      for (const initDir of [0, 1, 2, 3] as LocalDir[]) {
        const ray: string[] = [];
        let cur = { h, f, r, dir: initDir };
        while (true) {
          const next = stepOrth(cur.h, cur.f, cur.r, cur.dir);
          if (!next) break;
          ray.push(cellId(next.h, next.f, next.r));
          cur = next;
        }
        if (ray.length > 0) oRays.push(ray);
      }
      this.orthMap.set(c.id, oRays);

      // Diagonal rays (4 directions)
      const dRays: string[][] = [];
      for (const [initDf, initDr] of [
        [-1, 1],
        [1, 1],
        [-1, -1],
        [1, -1],
      ] as [-1 | 1, -1 | 1][]) {
        const ray: string[] = [];
        let cur: { h: number; f: number; r: number; df: -1 | 1; dr: -1 | 1 } = {
          h,
          f,
          r,
          df: initDf,
          dr: initDr,
        };
        while (true) {
          const next = stepDiag(cur.h, cur.f, cur.r, cur.df, cur.dr);
          if (!next) break;
          ray.push(cellId(next.h, next.f, next.r));
          cur = next;
        }
        if (ray.length > 0) dRays.push(ray);
      }
      this.diagMap.set(c.id, dRays);

      // Knight targets: 2 orth steps then 1 perpendicular orth step
      const kt = new Set<string>();
      for (const initDir of [0, 1, 2, 3] as LocalDir[]) {
        const s1 = stepOrth(h, f, r, initDir);
        if (!s1) continue;
        const s2 = stepOrth(s1.h, s1.f, s1.r, s1.dir);
        if (!s2) continue;
        for (const pDir of perpendicularDirs(s2.dir)) {
          const s3 = stepOrth(s2.h, s2.f, s2.r, pDir);
          if (s3) kt.add(cellId(s3.h, s3.f, s3.r));
        }
      }
      this.knightMap.set(c.id, [...kt]);

      // King targets: 1 orth step + 1 diag step + if in central 6 cells, any of the other 5 central cells
      const kgt = new Set<string>();
      for (const ray of oRays) kgt.add(ray[0]);
      for (const ray of dRays) kgt.add(ray[0]);
      if (centralIds.has(c.id)) {
        for (const cid of centralIds) {
          if (cid !== c.id) kgt.add(cid);
        }
      }
      this.kingMap.set(c.id, [...kgt]);
    }
  }

  rotationForSeat(seat: number): number {
    // Seat 0 is at bottom (90 deg normal).
    // Seat 1 is at top-right (-30 deg normal, rotated +120 deg brings it to bottom).
    // Seat 2 is at top-left (-150 deg normal, rotated +240 deg brings it to bottom).
    return ([0, 120, 240][seat] ?? 0);
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
    const parsed = parseHexId(id);
    if (!parsed) return null;
    const [h, f, r] = parsed;
    // On own half, pawns move towards r=4 (dir 0); on enemy half, towards r=1 (dir 1)
    const dir: LocalDir = h === seat ? 0 : 1;
    const next = stepOrth(h, f, r, dir);
    return next ? cellId(next.h, next.f, next.r) : null;
  }

  pawnCaptures(id: string, seat: number): string[] {
    const parsed = parseHexId(id);
    if (!parsed) return [];
    const [h, f, r] = parsed;
    const dr: -1 | 1 = h === seat ? 1 : -1;
    const out: string[] = [];
    for (const df of [-1, 1] as (-1 | 1)[]) {
      const next = stepDiag(h, f, r, df, dr);
      if (next) out.push(cellId(next.h, next.f, next.r));
    }
    return out;
  }

  isPawnStart(id: string, seat: number): boolean {
    const parsed = parseHexId(id);
    if (!parsed) return false;
    const [h, , r] = parsed;
    return h === seat && r === 2;
  }

  isPromotion(id: string, seat: number): boolean {
    const parsed = parseHexId(id);
    if (!parsed) return false;
    const [h, , r] = parsed;
    return h !== seat && r === 1;
  }

  castling(seat: number): CastlingDef[] {
    const p = `${seat}`;
    return [
      {
        side: 'k',
        king: `${p}e1`,
        rook: `${p}h1`,
        kingTo: `${p}g1`,
        rookTo: `${p}f1`,
        between: [`${p}f1`, `${p}g1`],
        pass: [`${p}e1`, `${p}f1`, `${p}g1`],
      },
      {
        side: 'q',
        king: `${p}e1`,
        rook: `${p}a1`,
        kingTo: `${p}c1`,
        rookTo: `${p}d1`,
        between: [`${p}b1`, `${p}c1`, `${p}d1`],
        pass: [`${p}e1`, `${p}d1`, `${p}c1`],
      },
    ];
  }

  initialSetup(): Record<string, { seat: number; role: Role }> {
    const out: Record<string, { seat: number; role: Role }> = {};
    const backRank: Role[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let h = 0; h < 3; h++) {
      for (let f = 0; f < 8; f++) {
        out[cellId(h, f, 1)] = { seat: h, role: backRank[f] };
        out[cellId(h, f, 2)] = { seat: h, role: 'p' };
      }
    }
    return out;
  }

  pieceValues(): Record<Role, number> {
    return { p: 1, n: 3, b: 3, r: 5, q: 9, k: 20 };
  }
}

export const HEX_TOPOLOGY: Topology = new HexTopologyImpl();
