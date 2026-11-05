export type Role = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type MultiVariant = 'four-player' | 'three-player';

export interface Cell {
  id: string;
  polygon: [number, number][];
  center: [number, number];
  light: boolean;
  label?: { text: string; x: number; y: number };
}

export interface CastlingDef {
  side: 'k' | 'q';
  king: string;
  rook: string;
  kingTo: string;
  rookTo: string;
  between: string[];
  pass: string[];
}

export interface Topology {
  readonly variant: MultiVariant;
  readonly seats: number;
  readonly cells: readonly Cell[];
  readonly cellById: ReadonlyMap<string, Cell>;
  /** Viewbox size (square, 0..viewSize) */
  readonly viewSize: number;
  /** Default rotation degrees so that a given seat is at the bottom */
  rotationForSeat(seat: number): number;
  orthRays(id: string): string[][];
  diagRays(id: string): string[][];
  knightTargets(id: string): string[];
  kingTargets(id: string): string[];
  pawnForward(id: string, seat: number): string | null;
  pawnCaptures(id: string, seat: number): string[];
  isPawnStart(id: string, seat: number): boolean;
  isPromotion(id: string, seat: number): boolean;
  castling(seat: number): CastlingDef[];
  initialSetup(): Record<string, { seat: number; role: Role }>;
  pieceValues(): Record<Role, number>;
}
