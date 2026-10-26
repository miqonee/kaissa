import { GAME_MODES, normalizedResult, PROVISIONAL_GAMES, type GameMode } from 'shared';
import type { Prisma } from '@prisma/client';
import { asyncRoute } from '../http/asyncRoute.js';
import { Router } from 'express';
import { currentUser, requireAuth, toPublic } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { gamesManager, lobbies } from '../state.js';
import { presence } from '../socket/presence.js';
import { buildPgn, type PgnGame, type PgnMove } from '../games/pgn.js';
import { TeamGame } from '../game/teamGame.js';
import type { GameSummary, LeaderboardRow, ProfilePayload } from 'shared';

export const usersRouter = Router();

function selectedMode(value: unknown): GameMode {
  return GAME_MODES.includes(value as GameMode) ? value as GameMode : 'team';
}
usersRouter.get('/leaderboard', asyncRoute(async (req, res) => {
  const mode = selectedMode(req.query.mode);
  const rows = await prisma.modeRating.findMany({
    where: { mode, user: { isBot: false, isGuest: false }, OR: [{ wins: { gt: 0 } }, { losses: { gt: 0 } }, { draws: { gt: 0 } }] },
    orderBy: [{ rating: 'desc' }, { userId: 'asc' }], take: 50, include: { user: true },
  });
  res.json({ mode, leaderboard: rows.map<LeaderboardRow>(r => ({ userId: r.userId, username: r.user.username, rating: r.rating,
    wins: r.wins, losses: r.losses, draws: r.draws, provisional: r.wins + r.losses + r.draws < PROVISIONAL_GAMES })) });
}));
usersRouter.get('/search', asyncRoute(async (req, res) => {
  const q = String(req.query.q ?? '').trim().slice(0, 30);
  if (q.length < 2) return void res.json({ users: [] });
  const users = await prisma.user.findMany({ where: { isBot: false, username: { contains: q, mode: 'insensitive' } }, take: 10, include: { modeRatings: true } });
  res.json({ users: users.map(toPublic) });
}));
usersRouter.get('/:username', asyncRoute(async (req, res) => {
  const mode = selectedMode(req.query.mode);
  const user = await prisma.user.findUnique({ where: { username: String(req.params.username) }, include: { modeRatings: true } });
  if (!user) return void res.status(404).json({ error: 'Игрок не найден' });
  const [history, games] = await Promise.all([
    prisma.ratingHistory.findMany({ where: { userId: user.id, mode }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 100 }),
    prisma.game.findMany({ where: { mode, participants: { some: { userId: user.id } } }, orderBy: { id: 'desc' }, take: 10, include: { participants: { include: { user: true } } } }),
  ]);
  const payload: ProfilePayload = { user: toPublic(user), mode, ratingHistory: history.reverse().map(h => ({ at: h.createdAt.toISOString(), rating: h.value })), recentGames: games.map(dbGameToSummary) };
  res.json(payload);
}));

export const gamesRouter = Router();
async function listGames(req: import('express').Request, res: import('express').Response, mine: boolean) {
  const user = mine ? await currentUser(req) : null;
  if (mine && !user) return void res.status(401).json({ error: 'Не авторизован' });
  const and: Prisma.GameWhereInput[] = [{ participants: { some: { user: { isBot: false } } } }];
  if (user) and.push({ participants: { some: { userId: user.id } } });
  if (req.query.mode && GAME_MODES.includes(req.query.mode as GameMode)) and.push({ mode: String(req.query.mode) });
  const q = String(req.query.player ?? '').trim().slice(0, 30);
  if (q) and.push({ participants: { some: { user: { username: { contains: q, mode: 'insensitive' } } } } });
  if (req.query.kind === 'rated') and.push({ ratingKind: 'rated' });
  if (req.query.kind === 'training') and.push({ ratingKind: { in: ['bots', 'guest'] } });
  if (req.query.opponents === 'humans') for (const team of [1, 2]) and.push({ participants: { some: { team, user: { isBot: false } } } });
  if (req.query.opponents === 'bots') and.push({ OR: [1, 2].map(team => ({ participants: { none: { team, user: { isBot: false } } } })) });
  if (req.query.result === 'draw') and.push({ status: 'finished', OR: [{ result: '1/2-1/2' }, { result: '*', reason: { in: ['stalemate', 'material', 'repetition', 'fifty'] } }] });
  if (req.query.result === 'abandoned') and.push({ status: 'abandoned' });
  if (user && ['win', 'loss'].includes(String(req.query.result))) and.push({ status: 'finished', OR: [1, 2].map(team => ({ result: (req.query.result === 'win' ? team === 1 : team === 2) ? '1-0' : '0-1', participants: { some: { userId: user.id, team } } })) });
  const cursor = Number(req.query.cursor);
  if (Number.isSafeInteger(cursor) && cursor > 0) and.push({ id: { lt: cursor } });
  const games = await prisma.game.findMany({ where: { AND: and }, orderBy: { id: 'desc' }, take: 31, include: { participants: { include: { user: true } } } });
  const page = games.slice(0, 30);
  res.json({ games: page.map(dbGameToSummary), nextCursor: games.length > 30 ? page[page.length - 1].id : null });
}
gamesRouter.get('/mine', requireAuth, asyncRoute(async (req, res) => { await listGames(req, res, true); }));
gamesRouter.get('/archive', asyncRoute(async (req, res) => { await listGames(req, res, false); }));

async function getPgnData(id: number): Promise<{ game: PgnGame; moves: PgnMove[]; mode: string } | null> {
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      moves: { orderBy: [{ ply: 'asc' }] },
    },
  });

  if (game) {
    return {
      mode: game.mode,
      game: {
        id: game.id,
        mode: game.mode as GameMode,
        rulesVersion: game.rulesVersion,
        result: normalizedResult({status:game.status as GameSummary['status'],result:game.result as GameSummary['result'],reason:game.reason as GameSummary['reason']}),
        reason: game.reason,
        baseMin: game.baseMin,
        incSec: game.incSec,
        noClock: game.noClock,
        startedAt: game.startedAt,
        endedAt: game.endedAt,
        participants: game.participants.map((p) => ({
          username: p.user.username,
          team: p.team,
          color: p.color,
          boardIndex: p.boardIndex,
          moveSlot: p.moveSlot,
          ratingBefore: p.ratingBefore,
        })),
      },
      moves: game.moves.map((m) => ({
        boardIndex: m.boardIndex,
        ply: m.ply,
        from: m.from,
        to: m.to,
        promotion: m.promotion,
        dropPiece: m.dropPiece,
      })),
    };
  }

  // Если партии нет в БД (например, in-memory демо-партия ботов на TV), берём из памяти
  const active = gamesManager.getActive(id);
  if (!active) return null;
  const tg = active.engine as TeamGame;
  const historyMoves = tg.chess ? tg.chess.history({ verbose: true }) : [];

  return {
    mode: active.mode,
    game: {
      id: active.id,
      mode: active.mode,
      result: active.result,
      reason: active.reason,
      baseMin: active.timeControl.baseMin,
      incSec: active.timeControl.incSec,
      noClock: active.timeControl.kind === 'none',
      startedAt: new Date(active.startedAt),
      endedAt: new Date(),
      participants: active.participants.map((p) => ({
        username: p.username,
        team: p.team,
        color: p.color,
        boardIndex: p.boardIndex,
        moveSlot: p.moveSlot,
        ratingBefore: p.ratingBefore,
      })),
    },
    moves: historyMoves.map((m, i) => ({
      boardIndex: 0,
      ply: i + 1,
      from: m.from,
      to: m.to,
      promotion: (m.promotion as string) ?? null,
      dropPiece: null,
    })),
  };
}

/** PGN партии: скачивание/анализ во внешних движках */
gamesRouter.get('/:id/pgn', asyncRoute(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const data = await getPgnData(id);
  if (!data) return void res.status(404).json({ error: 'Партия не найдена' });

  const boardQuery = req.query.board !== undefined ? parseInt(String(req.query.board), 10) : undefined;
  const pgn = buildPgn(data.game, data.moves, boardQuery);

  if (String(req.query.download ?? '') === '1') {
    const filename = boardQuery !== undefined ? `kaissa-game-${id}-board-${boardQuery + 1}.pgn` : `kaissa-game-${id}.pgn`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.type('application/x-chess-pgn').send(pgn);
}));

/** Мгновенное получение актуального состояния активной игры (HTTP fallback / initial render) */
gamesRouter.get('/:id/state', asyncRoute((req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const g = gamesManager.getActive(id);
  if (!g) return void res.status(404).json({ error: 'Партия не активна' });
  res.json({ state: gamesManager.toGameState(g) });
}));

/** Прокси для анализа на Lichess через их API https://lichess.org/api/import */
gamesRouter.post('/:id/lichess-import', requireAuth, asyncRoute(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const data = await getPgnData(id);
  if (!data) return void res.status(404).json({ error: 'Партия не найдена' });

  if (data.mode === 'bughouse') return void res.status(400).json({ error: 'Для багхауса используйте встроенный плеер обеих досок' });

  const pgn = buildPgn(data.game, data.moves);

  try {
    const boardIdx = parseInt(String(req.query.board ?? '0'), 10);
    // Для багхауса в PGN две партии, разделенные \n\n[Event
    let pgnToSend = pgn;
    if (data.mode === 'bughouse') {
      const parts = pgn.split(/\n(?=\[Event )/);
      pgnToSend = parts[boardIdx] || parts[0];
    }
    const form = new URLSearchParams();
    form.append('pgn', pgnToSend);

    const lichessRes = await fetch('https://lichess.org/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!lichessRes.ok) {
      const errTxt = await lichessRes.text();
      return void res.status(502).json({ error: 'Lichess API import error', details: errTxt });
    }
    const lichessData = (await lichessRes.json()) as { url: string };
    res.json({ url: lichessData.url });
  } catch (e: any) {
    res.status(500).json({ error: 'Ошибка отправки на Lichess: ' + e.message });
  }
}));

/** Одна партия (для replay) */
gamesRouter.get('/:id', asyncRoute(async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      moves: { orderBy: [{ boardIndex: 'asc' }, { ply: 'asc' }] },
    },
  });
  if (!game) return void res.status(404).json({ error: 'Партия не найдена' });
  res.json({
    game: dbGameToSummary(game),
    moves: game.moves.map((m) => ({
      boardIndex: m.boardIndex as 0 | 1,
      ply: m.ply,
      userId: m.userId,
      from: m.from,
      to: m.to,
      promotion: (m.promotion as string | null) ?? undefined,
      dropPiece: (m.dropPiece as string | null) ?? undefined,
      fenAfter: m.fenAfter,
      clocksAfter: m.clocksAfter ? (JSON.parse(m.clocksAfter) as [number, number]) : null,
    })),
  });
}));

/** Реванш: создать лобби реванша */
gamesRouter.post('/:id/rematch', requireAuth, asyncRoute(async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const id = parseInt(String(req.params.id), 10);
  const game = await prisma.game.findUnique({ where: { id }, include: { participants: true } });
  if (!game) return void res.status(404).json({ error: 'Партия не найдена' });
  if (!game.participants.some((p) => p.userId === user.id)) {
    return void res.status(403).json({ error: 'Вы не участник партии' });
  }
  if (game.status === 'active') return void res.status(409).json({ error: 'Дождитесь завершения партии' });
  const activeId = gamesManager.activeGameOf(user.id);
  if (activeId !== null) return void res.status(409).json({ error: 'Сначала завершите текущую партию' });
  const players = await gamesManager.rematchPlayers(id);
  const r = await lobbies.rematch(
    user.id,
    players,
    {
      gameId: id,
      mode: game.mode as GameMode,
      timeControl: game.noClock
        ? { kind: 'none', baseMin: 0, incSec: 0 }
        : { kind: 'clock', baseMin: game.baseMin, incSec: game.incSec },
    },
  );
  if (!r) return void res.status(500).json({ error: 'Не удалось создать лобби' });

  // Разослать событие реванша в комнату партии (всех в партии перекинет в лобби)
  for (const p of game.participants) if (p.userId !== user.id) presence.emitToUser(p.userId, 'game:rematch', { gameId: id, lobbyId: r.lobbyId });

  // Уведомить остальных участников через личные сокеты (если уже вышли из комнаты игры)
  for (const p of game.participants) {
    if (p.userId === user.id) continue;
    presence.emitToUser(p.userId, 'user:notif', {
      type: 're_match',
      lobbyId: r.lobbyId,
      lobbyName: `Реванш #${id}`,
    });
  }
  res.json({ lobbyId: r.lobbyId, code: r.code });
}));

// ---------------- Вспомогательные ----------------

type DbGame = {
  ratingKind?: string | null;
  endBoardIndex?: number | null;
  id: number;
  rulesVersion?: number | null;
  mode: string;
  status: string;
  result: string;
  reason: string | null;
  baseMin: number;
  incSec: number;
  noClock: boolean;
  startedAt: Date;
  endedAt: Date | null;
  participants: {
    wasGuest?: boolean;
    userId: number;
    team: number;
    color: string;
    boardIndex: number;
    moveSlot: number;
    ratingBefore: number;
    ratingAfter: number | null;
    user: { username: string; isBot?: boolean; botLevel?: number | null };
  }[];
};

function dbGameToSummary(game: DbGame): GameSummary {
  return {
    id: game.id,
    rulesVersion: game.rulesVersion,
    ratingKind: game.ratingKind as GameSummary['ratingKind'],
    endBoardIndex: game.endBoardIndex,
    mode: game.mode as GameMode,
    status: game.status as 'active' | 'finished' | 'abandoned',
    result: normalizedResult({ status: game.status as GameSummary['status'], result: game.result as GameSummary['result'], reason: game.reason as GameSummary['reason'] }),
    reason: (game.reason as GameSummary['reason']) ?? null,
    timeControl: game.noClock
      ? { kind: 'none', baseMin: 0, incSec: 0 }
      : { kind: 'clock', baseMin: game.baseMin, incSec: game.incSec },
    participants: game.participants.map((p) => ({
      userId: p.userId,
      username: p.user.username,
      isGuest: p.wasGuest,
      isBot: p.user.isBot,
      botLevel: p.user.botLevel,
      team: p.team as 1 | 2,
      color: p.color as 'w' | 'b',
      boardIndex: p.boardIndex as 0 | 1,
      moveSlot: p.moveSlot as 0 | 1,
      ratingBefore: p.ratingBefore,
      ratingAfter: p.ratingAfter,
    })),
    startedAt: game.startedAt.toISOString(),
    endedAt: game.endedAt?.toISOString() ?? null,
  };
}
