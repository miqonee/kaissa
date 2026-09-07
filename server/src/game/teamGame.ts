import { Chess, type Square } from 'chess.js';
import type { PieceType } from 'shared';

// ============================================================
// Командная игра на одной доске (2 на 2, чередование ходов).
// Команда 1 — белые (игроки A/B чередуются), команда 2 — чёрные.
// Порядок внутри команды задаётся moveSlot (0/1), «белые начинают»:
//   ход 1 — team1 slot0, ход 3 — team1 slot1, ход 5 — team1 slot0 ...
// ============================================================

export type SideColor = 'w' | 'b';

export class TeamGameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TeamGameError';
  }
}

export class TeamGame {
  chess: Chess;
  /** moveSlot игрока, который должен ходить сейчас (для стороны с правом хода) */
  private turnSlotByColor: Record<SideColor, 0 | 1>;
  halfmoves: number;
  lastMoveSquares: [string | null, string | null];
  constructor() {
    this.chess = new Chess();
    this.turnSlotByColor = { w: 0, b: 0 };
    this.halfmoves = 0;
    this.lastMoveSquares = [null, null];
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): SideColor {
    return this.chess.turn() as SideColor;
  }

  /** Какой слот команды должен делать следующий ход */
  currentSlot(): 0 | 1 {
    return this.turnSlotByColor[this.turn()];
  }

  /** Чей слот будет ходить у цвета color (порядок чередуется после каждого хода команды) */
  nextSlotFor(color: SideColor): 0 | 1 {
    return this.turnSlotByColor[color];
  }

  isCheck(): boolean {
    return this.chess.isCheck();
  }

  /**
   * Ход: игрок должен быть за правильную сторону и правильный слот.
   * color/slot — параметры игрока, делающего ход.
   */
  applyMove(
    playerColor: SideColor,
    playerSlot: 0 | 1,
    from: string,
    to: string,
    promotion?: PieceType,
  ): { fen: string; check: boolean } {
    if (this.chess.turn() !== playerColor) {
      throw new TeamGameError('Сейчас ход другой стороны');
    }
    if (this.currentSlot() !== playerSlot) {
      throw new TeamGameError('Сейчас ход вашего партнёра по команде');
    }
    let m;
    try {
      m = this.chess.move({
        from: from as Square,
        to: to as Square,
        ...(promotion ? { promotion } : {}),
      });
    } catch {
      throw new TeamGameError('Недопустимый ход');
    }
    // Чередование: следующий ход этой команды — другой слот
    this.turnSlotByColor[playerColor] = (playerSlot === 0 ? 1 : 0) as 0 | 1;
    if (m.captured) this.halfmoves = 0;
    else this.halfmoves += 1;
    this.lastMoveSquares = [from, to];
    return { fen: this.chess.fen(), check: this.chess.isCheck() };
  }

  // ---- Условия завершения (только автоматические, ничьих по согласию нет) ----

  isCheckmate(): boolean {
    return this.chess.isCheckmate();
  }

  isStalemate(): boolean {
    return this.chess.isStalemate();
  }

  isInsufficientMaterial(): boolean {
    return this.chess.isInsufficientMaterial();
  }

  isThreefoldRepetition(): boolean {
    return this.chess.isThreefoldRepetition();
  }

  isFiftyMoves(): boolean {
    // chess.js >= 1.0: half-move счётчик в FEN — используем его напрямую
    const fen = this.chess.fen();
    const halfmoveClock = parseInt(fen.split(' ')[4] || '0', 10);
    return halfmoveClock >= 100;
  }
}
