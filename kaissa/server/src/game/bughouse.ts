import { Chess, type Square } from 'chess.js';
import { DEFAULT_POCKET, type PieceType, type Pocket } from 'shared';

// ============================================================
// Bughouse-движок: две доски, 4 игрока, карманы по игрокам.
//
// Доска 0: команда 1 — белые, команда 2 — чёрные.
// Доска 1: команда 2 — белые, команда 1 — чёрные.
//
// Сбитая фигура меняет цвет и попадает в карман ПАРТНЁРА взявшего
// (партнёр = противоположный цвет на другой доске).
// Дроп: игрок кладёт фигуру из своего кармана на пустую клетку
// своей доски вместо обычного хода. Пешки не на 1/8 горизонтали.
// ============================================================

export type Board = 0 | 1;
export type SideColor = 'w' | 'b';

export interface PlayerRef {
  board: Board;
  color: SideColor;
}

export function partnerOf(p: PlayerRef): PlayerRef {
  return { board: (p.board === 0 ? 1 : 0) as Board, color: opposite(p.color) };
}

export class BughouseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BughouseError';
  }
}

export interface DropMove {
  board: Board;
  to: string;
  piece: PieceType;
}

export interface RegularMove {
  board: Board;
  from: string;
  to: string;
  promotion?: PieceType;
}

export type AnyMove = RegularMove | DropMove;

export function isDrop(mv: AnyMove): mv is DropMove {
  return (mv as DropMove).piece !== undefined;
}

export const ALL_SQUARES: string[] = [];
for (const f of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) {
  for (let r = 1; r <= 8; r++) ALL_SQUARES.push(`${f}${r}`);
}

export function opposite(c: SideColor): SideColor {
  return c === 'w' ? 'b' : 'w';
}

export type Pockets = Record<string, Pocket>;

export function pocketKey(board: Board, color: SideColor): string {
  return `${board}:${color}`;
}

export class BughouseGame {
  boards: [Chess, Chess];
  pockets: Pockets;
  lastMoveSquares: [[string | null, string | null], [string | null, string | null]];

  constructor(fens?: [string, string]) {
    this.boards = [
      fens?.[0] ? new Chess(fens[0]) : new Chess(),
      fens?.[1] ? new Chess(fens[1]) : new Chess(),
    ];
    this.pockets = {
      '0:w': DEFAULT_POCKET(),
      '0:b': DEFAULT_POCKET(),
      '1:w': DEFAULT_POCKET(),
      '1:b': DEFAULT_POCKET(),
    };
    this.lastMoveSquares = [[null, null], [null, null]];
  }

  fen(board: Board): string {
    return this.boards[board].fen();
  }

  turn(board: Board): SideColor {
    return this.boards[board].turn() as SideColor;
  }

  isCheck(board: Board): boolean {
    return this.boards[board].isCheck();
  }

  pocketOf(board: Board, color: SideColor): Pocket {
    return this.pockets[pocketKey(board, color)];
  }

  /** Все легальные ходы игрока (board, color): обычные + дропы.
   *  ВАЖНО: не опираемся на isGameOver() chess.js — мат/пат в классическом
   *  смысле не окончание в багхаусе, если в кармане есть фигуры для дропа.
   */
  legalMoves(board: Board, color: SideColor): AnyMove[] {
    const chess = this.boards[board];
    if (chess.turn() !== color) return [];
    const moves: AnyMove[] = chess
      .moves({ verbose: true })
      .map((m) => ({
        board,
        from: m.from,
        to: m.to,
        ...(m.promotion ? { promotion: m.promotion as PieceType } : {}),
      }));
    const pocket = this.pocketOf(board, color);
    const emptySquares: string[] = [];
    for (const sq of ALL_SQUARES) {
      if (chess.get(sq as Square) === undefined) emptySquares.push(sq);
    }
    for (const t of Object.keys(pocket) as PieceType[]) {
      if (pocket[t] <= 0) continue;
      for (const sq of emptySquares) {
        if (t === 'p' && (sq[1] === '1' || sq[1] === '8')) continue;
        moves.push({ board, to: sq, piece: t });
      }
    }
    return moves;
  }

  /** Есть ли у игрока хоть какой-то ход, включая дропы */
  canDefend(board: Board, color: SideColor): boolean {
    return this.legalMoves(board, color).length > 0;
  }

  /** Мат по правилам багхауса: шах + нельзя защититься даже дропом */
  isBughouseCheckmate(board: Board): boolean {
    const chess = this.boards[board];
    if (!chess.isCheck()) return false;
    const color = chess.turn() as SideColor;
    return !this.canDefend(board, color);
  }

  /** Зажатость без шаха: поражение стороны без ходов (партия всегда результативна) */
  isBughouseStalemate(board: Board): boolean {
    const chess = this.boards[board];
    if (chess.isCheck()) return false;
    const color = chess.turn() as SideColor;
    return !this.canDefend(board, color);
  }

  /**
   * Применить ход. Бросает BughouseError при нелегальности.
   */
  apply(mv: AnyMove): {
    fen: string;
    check: boolean;
    /** фигура, ушедшая в карман партнёра ходящего */
    captured?: { piece: PieceType; toBoard: Board; toColor: SideColor };
  } {
    const board = mv.board;
    const chess = this.boards[board];
    const moverColor = chess.turn() as SideColor;

    if (isDrop(mv)) {
      const pocket = this.pocketOf(board, moverColor);
      if (pocket[mv.piece] <= 0) throw new BughouseError('В кармане нет такой фигуры');
      if (chess.get(mv.to as Square) !== undefined) throw new BughouseError('Клетка занята');
      if (mv.piece === 'p' && (mv.to[1] === '1' || mv.to[1] === '8')) {
        throw new BughouseError('Пешку нельзя ставить на 1/8 горизонталь');
      }
      pocket[mv.piece] -= 1;
      chess.put({ type: mv.piece, color: moverColor }, mv.to as Square);
      this.forceTurn(chess);
      this.lastMoveSquares[board] = [null, mv.to];
      const check = chess.isCheck();
      return { fen: chess.fen(), check };
    }

    let m;
    try {
      m = chess.move({
        from: mv.from as Square,
        to: mv.to as Square,
        ...(mv.promotion ? { promotion: mv.promotion } : {}),
      });
    } catch {
      throw new BughouseError('Недопустимый ход');
    }
    let captured: { piece: PieceType; toBoard: Board; toColor: SideColor } | undefined;
    if (m.captured) {
      const partner = partnerOf({ board, color: moverColor });
      const piece = m.captured as PieceType;
      this.pockets[pocketKey(partner.board, partner.color)][piece] += 1;
      captured = { piece, toBoard: partner.board, toColor: partner.color };
    }
    this.lastMoveSquares[board] = [mv.from, mv.to];
    const check = chess.isCheck();
    return { fen: chess.fen(), check, captured };
  }

  /** Переключить сторону хода (для дропов, которых chess.js не знает) */
  private forceTurn(chess: Chess): void {
    const parts = chess.fen().split(' ');
    parts[1] = parts[1] === 'w' ? 'b' : 'w';
    parts[3] = '-';
    parts[4] = '0';
    chess.load(parts.join(' '));
  }
}
