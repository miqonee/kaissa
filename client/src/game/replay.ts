import { Chess, type Square } from 'chess.js';
import { BughouseGame } from 'shared/bughouse';
import type { DropPieceType } from 'shared';
import { DEFAULT_POCKET, type GameSummary, type MoveRecord, type PieceType, type Pocket } from 'shared';

// ============================================================
// Построение кадров партии для плеера.
//
// Сервер хранит только ходы (from/to/promotion/dropPiece/fenAfter),
// поэтому позиция и карманы восстанавливаются симуляцией:
//   • обычный ход  — через chess.js, SAN берём у движка;
//   • дроп         — chess.js не умеет, ставим фигуру руками и
//                    переключаем очередь хода (то же, что делает
//                    сервер в game/bughouse.ts и games/pgn.ts);
//   • взятие       — фигура уходит в карман ПАРТНЁРА: другая доска,
//                    противоположный цвет (см. partnerOf на сервере).
//
// Расчёт идёт один раз при загрузке партии, дальше плеер просто
// двигает курсор по готовым кадрам.
// ============================================================

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export interface ReplayBoardFrame {
  fen: string;
  lastMove: [string | null, string | null];
  /** клетка короля под шахом или null */
  check: string | null;
}

export interface ReplayFrame {
  /** индекс полухода в общей ленте: 0 — начальная позиция, i+1 — после moves[i] */
  ply: number;
  boards: [ReplayBoardFrame] | [ReplayBoardFrame, ReplayBoardFrame];
  /** карманы по доскам и цветам: pockets[board][0='w',1='b'] (только bughouse) */
  pockets: [Pocket, Pocket][] | null;
}

export interface ReplayMoveView {
  /** индекс в массиве moves */
  index: number;
  boardIndex: 0 | 1;
  ply: number;
  userId: number;
  /** SAN: e4, Nf3, O-O, P@e4 — либо fallback «e2–e4», если SAN не построился */
  san: string;
  dropPiece?: PieceType;
  from: string;
  to: string;
  /** ход сделан в результате симуляции (для отладки/подсветки) */
  ok: boolean;
}

export interface ReplayData {
  game: GameSummary;
  moves: ReplayMoveView[];
  /** кадра на один больше, чем ходов (нулевой — начальная позиция) */
  frames: ReplayFrame[];
  boardsCount: 1 | 2;
}

type SideColor = 'w' | 'b';

function emptyPocket(): Pocket {
  return DEFAULT_POCKET();
}

function clonePocket(p: Pocket): Pocket {
  return { ...p };
}

/** Партнёр по команде: другая доска, противоположный цвет */
function partnerOf(board: 0 | 1, color: SideColor): { board: 0 | 1; color: SideColor } {
  return { board: board === 0 ? 1 : 0, color: color === 'w' ? 'b' : 'w' };
}

function kingSquare(chess: Chess): string | null {
  try {
    const color = chess.turn();
    const kings = chess.findPiece({ type: 'k', color });
    return kings.length ? String(kings[0]) : null;
  } catch {
    return null;
  }
}

/** Переключить очередь хода вручную (для дропов) */
function forceTurn(chess: Chess): void {
  const parts = chess.fen().split(' ');
  parts[1] = parts[1] === 'w' ? 'b' : 'w';
  parts[3] = '-';
  parts[4] = '0';
  chess.load(parts.join(' '));
}

function fallbackSan(mv: MoveRecord): string {
  if (mv.dropPiece) return `${mv.dropPiece.toUpperCase()}@${mv.to}`;
  return `${mv.from}–${mv.to}`;
}

/**
 * Собрать кадры и SAN-список по записям ходов.
 * Никогда не бросает: битые/расходящиеся ходы помечаются ok=false
 * и плеер просто показывает их как есть, не падая.
 */
export function buildReplay(game: GameSummary, rawMoves: MoveRecord[]): ReplayData {
  if (game.mode === 'bughouse' && (game.rulesVersion ?? 0) >= 2) return buildBughouseReplay(game, rawMoves);
  const boardsCount: 1 | 2 = game.mode === 'bughouse' ? 2 : 1;
  const moves = [...rawMoves].sort((a, b) => a.ply - b.ply);

  const chesses: Chess[] = [];
  for (let b = 0; b < boardsCount; b++) chesses.push(new Chess(START_FEN));

  // Карманы: [board][colorIdx] — colorIdx 0 = 'w', 1 = 'b'
  let pockets: [Pocket, Pocket][] | null = null;
  if (game.mode === 'bughouse') {
    pockets = [
      [emptyPocket(), emptyPocket()],
      [emptyPocket(), emptyPocket()],
    ];
  }

  const lastMoves: [string | null, string | null][] = [];
  for (let b = 0; b < boardsCount; b++) lastMoves.push([null, null]);

  const snapshot = (): ReplayFrame => {
    const boards = chesses.map((c) => ({
      fen: c.fen(),
      lastMove: [null, null] as [string | null, string | null],
      check: c.isCheck() ? kingSquare(c) : null,
    })) as [ReplayBoardFrame] | [ReplayBoardFrame, ReplayBoardFrame];

    for (let b = 0; b < boardsCount; b++) {
      boards[b].lastMove = [lastMoves[b][0], lastMoves[b][1]];
    }

    return {
      ply: 0,
      boards,
      pockets: pockets ? pockets.map((p) => [clonePocket(p[0]), clonePocket(p[1])]) : null,
    };
  };

  const frames: ReplayFrame[] = [];
  const first = snapshot();
  first.ply = 0;
  frames.push(first);

  const moveViews: ReplayMoveView[] = [];

  moves.forEach((mv, index) => {
    const b = (mv.boardIndex === 1 && boardsCount === 2 ? 1 : 0) as 0 | 1;
    const chess = chesses[b];
    let san = fallbackSan(mv);
    let ok = true;

    try {
      if (mv.dropPiece) {
        const color = chess.turn() as SideColor;
        const pocket = pockets?.[b]?.[color === 'w' ? 0 : 1];
        if (pocket) {
          // Карман может быть пуст из-за неполных исторических данных —
          // в этом случае всё равно ставим фигуру, но не уводим счёт в минус.
          pocket[mv.dropPiece] = Math.max(0, (pocket[mv.dropPiece] ?? 0) - 1);
        }
        chess.put({ type: mv.dropPiece, color }, mv.to as Square);
        forceTurn(chess);
        lastMoves[b] = [null, mv.to];
        san = `${mv.dropPiece.toUpperCase()}@${mv.to}`;
      } else {
        const m = chess.move({
          from: mv.from as Square,
          to: mv.to as Square,
          ...(mv.promotion ? { promotion: mv.promotion as 'q' } : {}),
        });
        san = m.san;
        if (m.captured && pockets) {
          const partner = partnerOf(b, chess.turn() === 'w' ? 'b' : 'w');
          const piece = m.captured as PieceType;
          const target = pockets[partner.board][partner.color === 'w' ? 0 : 1];
          target[piece] = (target[piece] ?? 0) + 1;
        }
        lastMoves[b] = [mv.from, mv.to];
      }

      // Если сервер прислал fenAfter и он разошёлся с симуляцией —
      // доверяем серверу: это защита от неточностей в дропах.
      if (mv.fenAfter && mv.fenAfter !== chess.fen()) {
        try {
          chess.load(mv.fenAfter);
        } catch {
          // оставляем как есть
        }
      }
    } catch {
      ok = false;
      lastMoves[b] = mv.dropPiece ? [null, mv.to] : [mv.from, mv.to];
    }

    moveViews.push({
      index,
      boardIndex: b,
      ply: mv.ply,
      userId: mv.userId,
      san,
      ...(mv.dropPiece ? { dropPiece: mv.dropPiece } : {}),
      from: mv.from,
      to: mv.to,
      ok,
    });

    const frame = snapshot();
    frame.ply = index + 1;
    frames.push(frame);
  });

  return { game, moves: moveViews, frames, boardsCount };
}

/** v2 uses exactly the same transfer, promotion and drop rules as live play. */
function buildBughouseReplay(game: GameSummary, records: MoveRecord[]): ReplayData {
  const engine = new BughouseGame();
  const views: ReplayMoveView[] = [];
  const last: [string | null, string | null][] = [[null, null], [null, null]];
  function frame(ply: number): ReplayFrame {
    return {
      ply,
      boards: ([0, 1] as const).map(board => ({ fen: engine.fen(board), lastMove: [...last[board]], check: engine.isCheck(board) ? kingSquare(engine.boards[board]) : null })) as [ReplayBoardFrame, ReplayBoardFrame],
      pockets: ([0, 1] as const).map(board => [{ ...engine.pocketOf(board, 'w') }, { ...engine.pocketOf(board, 'b') }]),
    };
  }
  const frames = [frame(0)];
  [...records].sort((a, b) => a.ply - b.ply).forEach((record, index) => {
    let ok = true;
    let san = fallbackSan(record);
    try {
      if (record.dropPiece) engine.apply({ board: record.boardIndex, to: record.to, piece: record.dropPiece as DropPieceType });
      else {
        const move = engine.boards[record.boardIndex].moves({ verbose: true }).find(m => m.from === record.from && m.to === record.to && m.promotion === record.promotion);
        san = move?.san.replace(/[+#]$/, '') ?? san;
        engine.apply({ board: record.boardIndex, from: record.from, to: record.to, ...(record.promotion ? { promotion: record.promotion } : {}) });
      }
      if (engine.isCheck(record.boardIndex)) san += engine.isBughouseCheckmate(record.boardIndex) ? '#' : '+';
    } catch { ok = false; }
    last[record.boardIndex] = record.dropPiece ? [null, record.to] : [record.from, record.to];
    views.push({ index, ...record, san, ok });
    frames.push(frame(index + 1));
  });
  return { game, moves: views, frames, boardsCount: 2 };
}

/** «1. e4 e5» — сгруппировать ходы по парам для списка */
export interface MoveRow {
  /** номер хода (1-based) */
  no: number;
  /** отображаемый номер: в багхаусе ходы считаются по доскам */
  label: string;
  white: ReplayMoveView | null;
  black: ReplayMoveView | null;
}

export function buildMoveRows(data: ReplayData, boardIndex: 0 | 1): MoveRow[] {
  const rows: MoveRow[] = [];
  const moves = data.moves.filter((m) => m.boardIndex === boardIndex);

  for (let i = 0; i < moves.length; i += 2) {
    const white = moves[i] ?? null;
    const black = moves[i + 1] ?? null;
    const no = i / 2 + 1;
    rows.push({
      no,
      label: data.boardsCount === 2 ? `Д${boardIndex + 1} · ${no}.` : `${no}.`,
      white,
      black,
    });
  }
  return rows;
}
