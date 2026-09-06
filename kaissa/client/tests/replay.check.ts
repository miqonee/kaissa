// Быстрая самопроверка логики плеера без фреймворков:
// node --experimental-strip-types client/tests/replay.check.ts
import { buildReplay, buildMoveRows } from '../src/game/replay.ts';
import type { GameSummary, MoveRecord } from 'shared';

const game: GameSummary = {
  id: 1,
  mode: 'team',
  status: 'finished',
  result: '1-0',
  reason: 'checkmate',
  timeControl: { kind: 'clock', baseMin: 5, incSec: 3 },
  participants: [
    { userId: 1, username: 'a', team: 1, color: 'w', boardIndex: 0, moveSlot: 0, ratingBefore: 1200, ratingAfter: 1216 },
    { userId: 2, username: 'b', team: 1, color: 'w', boardIndex: 0, moveSlot: 1, ratingBefore: 1200, ratingAfter: 1216 },
    { userId: 3, username: 'c', team: 2, color: 'b', boardIndex: 0, moveSlot: 0, ratingBefore: 1200, ratingAfter: 1184 },
    { userId: 4, username: 'd', team: 2, color: 'b', boardIndex: 0, moveSlot: 1, ratingBefore: 1200, ratingAfter: 1184 },
  ],
  startedAt: '2026-01-01T00:00:00Z',
  endedAt: '2026-01-01T00:10:00Z',
};

// Дурацкий мат (scholar's mate): 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6 4.Qxf7#
const moves: MoveRecord[] = [
  { boardIndex: 0, ply: 1, userId: 1, from: 'e2', to: 'e4', fenAfter: '' },
  { boardIndex: 0, ply: 2, userId: 3, from: 'e7', to: 'e5', fenAfter: '' },
  { boardIndex: 0, ply: 3, userId: 2, from: 'f1', to: 'c4', fenAfter: '' },
  { boardIndex: 0, ply: 4, userId: 4, from: 'b8', to: 'c6', fenAfter: '' },
  { boardIndex: 0, ply: 5, userId: 1, from: 'd1', to: 'h5', fenAfter: '' },
  { boardIndex: 0, ply: 6, userId: 3, from: 'g8', to: 'f6', fenAfter: '' },
  { boardIndex: 0, ply: 7, userId: 2, from: 'h5', to: 'f7', fenAfter: '' },
];

const r = buildReplay(game, moves);
console.assert(r.frames.length === 8, `frames=${r.frames.length} должно быть 8`);
console.assert(r.moves.length === 7, `moves=${r.moves.length}`);
console.assert(r.moves[6].san === 'Qxf7#', `последний SAN: ${r.moves[6].san}`);
console.assert(r.moves.every((m) => m.ok), 'все ходы должны распознаться');
console.assert(r.frames[7].boards[0].check === 'e8', `шах на e8, а не ${r.frames[7].boards[0].check}`);
console.assert(r.frames[3].boards[0].lastMove[1] === 'c4', 'lastMove после 2.Bc4');

const rows = buildMoveRows(r, 0);
console.assert(rows.length === 4, `rows=${rows.length} должно быть 4`);
console.assert(rows[0].white?.san === 'e4' && rows[0].black?.san === 'e5', 'первая пара');
console.assert(rows[3].black === null && rows[3].white?.san === 'Qxf7#', 'последняя строка неполная');

// --- Багхаус с дропом ---
const bGame: GameSummary = { ...game, mode: 'bughouse' };
// Доска 0: 1.e4 d5 2.exd5 — белые бьют пешку, она уходит чёрному игроку доски 1.
// Доска 1: 1.e4 e5 2.Nf3 — затем чёрные ставят выбитую пешку обратно.
const bMoves: MoveRecord[] = [
  { boardIndex: 0, ply: 1, userId: 1, from: 'e2', to: 'e4', fenAfter: '' },
  { boardIndex: 1, ply: 2, userId: 4, from: 'e2', to: 'e4', fenAfter: '' },
  { boardIndex: 0, ply: 3, userId: 3, from: 'd7', to: 'd5', fenAfter: '' },
  { boardIndex: 1, ply: 4, userId: 3, from: 'e7', to: 'e5', fenAfter: '' },
  { boardIndex: 0, ply: 5, userId: 1, from: 'e4', to: 'd5', fenAfter: '' }, // взятие → в карман board1 'b'
  { boardIndex: 1, ply: 6, userId: 4, from: 'g1', to: 'f3', fenAfter: '' },
  { boardIndex: 1, ply: 7, userId: 2, from: '-', to: 'c5', dropPiece: 'p', fenAfter: '' }, // дроп чёрной пешки
];
const rb = buildReplay(bGame, bMoves);
console.assert(rb.boardsCount === 2, 'bughouse = 2 доски');
console.assert(rb.moves[4].san === 'exd5', `взятие: ${rb.moves[4].san}`);
console.assert(rb.moves[6].san === 'P@c5', `дроп: ${rb.moves[6].san}`);
// Карман чёрных доски 1: после взятия p=1, после дропа снова 0
console.assert(rb.frames[5].pockets?.[1]?.[1].p === 1, `карман после взятия: ${rb.frames[5].pockets?.[1]?.[1].p}`);
const lastFrame = rb.frames[7];
console.assert(lastFrame.pockets?.[1]?.[1].p === 0, `карман после дропа: ${lastFrame.pockets?.[1]?.[1].p}`);
// Доска 1 после дропа: чёрная пешка на c5
console.assert(lastFrame.boards[1].fen.startsWith('rnbqkbnr/pppp1ppp/8/2p1p3/4P3/5N2/PPPP1PPP/RNBQKB1R'), 'доска 1: ' + lastFrame.boards[1].fen);

console.log('OK: replay.check пройден');
