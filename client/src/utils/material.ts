import type { DropPieceType, Pocket } from 'shared';

export const MATERIAL_ORDER: readonly DropPieceType[] = ['q', 'r', 'b', 'n', 'p'];
export const MATERIAL_VALUES: Record<DropPieceType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export type MaterialCounts = Record<DropPieceType, number>;
export interface MaterialBalance {
  surplus: Record<'w' | 'b', MaterialCounts>;
  /** Positive means white has more material; kings have no material value. */
  score: number;
}

const empty = (): MaterialCounts => ({ p: 0, n: 0, b: 0, r: 0, q: 0 });

/** Count the current position, not capture history. Explicit pockets are counted once. */
export function calculateMaterial(fen: string, pockets?: readonly [Pocket | null, Pocket | null]): MaterialBalance {
  const counts = { w: empty(), b: empty() };
  const placement = fen.split(' ')[0]?.split('[')[0] ?? '';
  for (const char of placement) {
    const type = char.toLowerCase() as DropPieceType;
    if (!Object.hasOwn(MATERIAL_VALUES, type)) continue;
    counts[char === type ? 'b' : 'w'][type]++;
  }
  const surplus = { w: empty(), b: empty() };
  let score = 0;
  for (const type of MATERIAL_ORDER) {
    const diff = counts.w[type] + (pockets?.[0]?.[type] ?? 0)
      - counts.b[type] - (pockets?.[1]?.[type] ?? 0);
    surplus.w[type] = Math.max(0, diff);
    surplus.b[type] = Math.max(0, -diff);
    score += diff * MATERIAL_VALUES[type];
  }
  return { surplus, score };
}
