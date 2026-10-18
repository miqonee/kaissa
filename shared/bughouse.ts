import { Chess, type Square } from 'chess.js';
import type { PieceType, Pocket, DropPieceType } from './index.js';

export type Board = 0 | 1;
export type SideColor = 'w' | 'b';
export interface PlayerRef { board: Board; color: SideColor }
export interface DropMove { board: Board; to: string; piece: DropPieceType }
export interface RegularMove { board: Board; from: string; to: string; promotion?: PieceType }
export type AnyMove = RegularMove | DropMove;
export type Pockets = Record<string, Pocket>;
export type LegalDrops = Partial<Record<DropPieceType, string[]>>;
export interface BughouseSnapshot { fens: [string, string]; pockets: Pockets; promoted: [string[], string[]] }
export const DROP_PIECES: DropPieceType[] = ['p', 'n', 'b', 'r', 'q'];
export const ALL_SQUARES = [...'abcdefgh'].flatMap(f => Array.from({ length: 8 }, (_, i) => `${f}${i + 1}`));
const emptyPocket = (): Pocket => ({ p: 0, n: 0, b: 0, r: 0, q: 0, k: 0 });
export const opposite = (c: SideColor): SideColor => c === 'w' ? 'b' : 'w';
export const pocketKey = (board: Board, color: SideColor): string => `${board}:${color}`;
export const partnerOf = (p: PlayerRef): PlayerRef => ({ board: p.board === 0 ? 1 : 0, color: opposite(p.color) });
export function isDrop(mv: AnyMove): mv is DropMove { return 'piece' in mv; }
export class BughouseError extends Error {
  constructor(message: string) { super(message); this.name = 'BughouseError'; }
}

/** Ordinary FEN stays compatible with Chessground. Pockets and promotion
 * provenance are included in snapshots and in the engine FEN dialect. */
export class BughouseGame {
  boards: [Chess, Chess];
  pockets: Pockets = { '0:w': emptyPocket(), '0:b': emptyPocket(), '1:w': emptyPocket(), '1:b': emptyPocket() };
  promoted: [Set<string>, Set<string>] = [new Set(), new Set()];
  lastMoveSquares: [[string | null, string | null], [string | null, string | null]] = [[null, null], [null, null]];
  constructor(fens?: [string, string]) { this.boards = [new Chess(fens?.[0]), new Chess(fens?.[1])]; }
  static fromSnapshot(s: BughouseSnapshot): BughouseGame {
    const game = new BughouseGame(s.fens);
    game.pockets = Object.fromEntries(Object.entries(s.pockets).map(([k, p]) => [k, { ...p }]));
    game.promoted = [new Set(s.promoted[0]), new Set(s.promoted[1])];
    return game;
  }
  snapshot(): BughouseSnapshot {
    return { fens: [this.fen(0), this.fen(1)], pockets: Object.fromEntries(Object.entries(this.pockets).map(([k, p]) => [k, { ...p }])), promoted: [[...this.promoted[0]], [...this.promoted[1]]] };
  }
  fen(board: Board): string { return this.boards[board].fen(); }
  turn(board: Board): SideColor { return this.boards[board].turn(); }
  isCheck(board: Board): boolean { return this.boards[board].isCheck(); }
  pocketOf(board: Board, color: SideColor): Pocket { return this.pockets[pocketKey(board, color)]; }
  legalDrops(board: Board, color = this.turn(board)): LegalDrops {
    if (this.turn(board) !== color) return {};
    const chess = this.boards[board];
    const pocket = this.pocketOf(board, color);
    const result: LegalDrops = {};
    // put/remove affects chess.js bookkeeping: probe a separate board.
    const probe = chess.isCheck() ? new Chess(chess.fen()) : null;
    for (const piece of DROP_PIECES) {
      if (pocket[piece] <= 0) continue;
      result[piece] = ALL_SQUARES.filter(to => {
        if (chess.get(to as Square) || (piece === 'p' && /[18]$/.test(to))) return false;
        if (!probe) return true;
        probe.load(chess.fen());
        return probe.put({ type: piece, color }, to as Square) && !probe.isCheck();
      });
    }
    return result;
  }
  legalMoves(board: Board, color: SideColor): AnyMove[] {
    if (this.turn(board) !== color) return [];
    const regular: AnyMove[] = this.boards[board].moves({ verbose: true }).map(m => ({ board, from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }));
    for (const [piece, squares] of Object.entries(this.legalDrops(board, color))) for (const to of squares) regular.push({ board, to, piece: piece as DropPieceType });
    return regular;
  }
  canDefend(board: Board, color: SideColor): boolean { return this.legalMoves(board, color).length > 0; }
  isBughouseCheckmate(board: Board): boolean { return this.isCheck(board) && !this.canDefend(board, this.turn(board)); }
  isBughouseStalemate(board: Board): boolean { return !this.isCheck(board) && !this.canDefend(board, this.turn(board)); }
  engineFen(board: Board): string {
    const parts = this.fen(board).split(' ');
    let placement = '';
    const ranks = parts[0].split('/');
    for (let r = 0; r < 8; r++) {
      let file = 0;
      for (const ch of ranks[r]) {
        placement += ch;
        if (/\d/.test(ch)) file += Number(ch);
        else { if (this.promoted[board].has(`${'abcdefgh'[file]}${8 - r}`)) placement += '~'; file++; }
      }
      if (r < 7) placement += '/';
    }
    let hand = '';
    for (const color of ['w', 'b'] as const) for (const piece of DROP_PIECES) hand += (color === 'w' ? piece.toUpperCase() : piece).repeat(this.pocketOf(board, color)[piece]);
    parts[0] = `${placement}[${hand}]`;
    return parts.join(' ');
  }
  apply(mv: AnyMove): { fen: string; check: boolean; captured?: { piece: DropPieceType; toBoard: Board; toColor: SideColor } } {
    if (!mv || (mv.board !== 0 && mv.board !== 1) || typeof mv.to !== 'string' || !/^[a-h][1-8]$/.test(mv.to)) throw new BughouseError('Некорректная доска или клетка');
    const board = mv.board;
    const chess = this.boards[board];
    const color = chess.turn();
    if (isDrop(mv)) {
      if (!DROP_PIECES.includes(mv.piece)) throw new BughouseError('Недопустимая фигура кармана');
      const pocket = this.pocketOf(board, color);
      if (pocket[mv.piece] <= 0) throw new BughouseError('В кармане нет такой фигуры');
      if (chess.get(mv.to as Square)) throw new BughouseError('Клетка занята');
      if (mv.piece === 'p' && /[18]$/.test(mv.to)) throw new BughouseError('Пешку нельзя ставить на 1/8 горизонталь');
      const next = new Chess(chess.fen());
      if (!next.put({ type: mv.piece, color }, mv.to as Square)) throw new BughouseError('Недопустимый дроп');
      if (next.isCheck()) throw new BughouseError('Король остаётся под шахом');
      const parts = next.fen().split(' ');
      parts[1] = opposite(color);
      parts[3] = '-';
      parts[4] = '0';
      if (color === 'b') parts[5] = String(Number(parts[5]) + 1);
      next.load(parts.join(' '));
      this.boards[board] = next;
      pocket[mv.piece]--;
      this.lastMoveSquares[board] = [null, mv.to];
      return { fen: next.fen(), check: next.isCheck() };
    }
    if (typeof mv.from !== 'string' || !/^[a-h][1-8]$/.test(mv.from) || (mv.promotion !== undefined && !['q', 'r', 'b', 'n'].includes(mv.promotion))) throw new BughouseError('Недопустимый ход');
    const wasPromoted = this.promoted[board].has(mv.from);
    const capturedPromoted = this.promoted[board].has(mv.to);
    let move;
    try { move = chess.move({ from: mv.from, to: mv.to, ...(mv.promotion ? { promotion: mv.promotion } : {}) }); }
    catch { throw new BughouseError('Недопустимый ход'); }
    this.promoted[board].delete(mv.from);
    this.promoted[board].delete(mv.to);
    if (wasPromoted || move.promotion) this.promoted[board].add(mv.to);
    let captured: { piece: DropPieceType; toBoard: Board; toColor: SideColor } | undefined;
    if (move.captured) {
      const partner = partnerOf({ board, color });
      const piece = capturedPromoted ? 'p' : move.captured as DropPieceType;
      this.pocketOf(partner.board, partner.color)[piece]++;
      captured = { piece, toBoard: partner.board, toColor: partner.color };
    }
    this.lastMoveSquares[board] = [mv.from, mv.to];
    return { fen: chess.fen(), check: chess.isCheck(), captured };
  }
}
