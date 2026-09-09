import { Router } from 'express';
import { currentUser, requireAuth, toPublic } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { gamesManager, lobbies } from '../state.js';
import { presence } from '../socket/presence.js';
import { buildPgn } from '../games/pgn.js';
import type { GameSummary, LeaderboardRow, ProfilePayload } from 'shared';

export const usersRouter = Router();

/** Лидерборд */
usersRouter.get('/leaderboard', async (_req, res) => {
  const rows = await prisma.user.findMany({
    where: { isBot: false },
    orderBy: [{ rating: 'desc' }],
    take: 20,
  });
  res.json({
    leaderboard: rows.map<LeaderboardRow>((u) => ({
      userId: u.id,
      username: u.username,
      rating: u.rating,
      wins: u.wins,
      losses: u.losses,
      draws: u.draws,
    })),
  });
});

/** Поиск игроков (для сравнения и UI) */
usersRouter.get('/search', async (req, res) => {
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return void res.json({ users: [] });
  const users = await prisma.user.findMany({
    where: { username: { contains: q, mode: 'insensitive' } },
    take: 10,
    orderBy: { rating: 'desc' },
  });
  res.json({ users: users.map(toPublic) });
});

/** Профиль + история рейтинга + недавние партии */
usersRouter.get('/:username', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { username: String(req.params.username) },
  });
  if (!user) return void res.status(404).json({ error: 'Игрок не найден' });

  const [history, parts] = await Promise.all([
    prisma.ratingHistory.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    }),
    prisma.gameParticipant.findMany({
      where: { userId: user.id },
      orderBy: { game: { startedAt: 'desc' } },
      take: 20,
      include: { game: { include: { participants: { include: { user: true } } } } },
    }),
  ]);

  const recentGames = parts.map((part) => dbGameToSummary(part.game));
  const payload: ProfilePayload = {
    user: toPublic(user),
    ratingHistory: history.map((h) => ({ at: h.createdAt.toISOString(), rating: h.value })),
    recentGames,
  };
  res.json(payload);
});

// ---------------- Games ----------------

export const gamesRouter = Router();

/** Мои партии */
gamesRouter.get('/mine', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const parts = await prisma.gameParticipant.findMany({
    where: { userId: user.id },
    orderBy: { game: { startedAt: 'desc' } },
    take: 50,
    include: { game: { include: { participants: { include: { user: true } } } } },
  });
  res.json({ games: parts.map((p) => dbGameToSummary(p.game)) });
});

/** Архив клуба: все завершённые партии */
gamesRouter.get('/archive', requireAuth, async (req, res) => {
  const take = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? '100'), 10) || 100));
  const games = await prisma.game.findMany({
    where: { status: { in: ['finished', 'abandoned'] } },
    orderBy: { startedAt: 'desc' },
    take,
    include: { participants: { include: { user: true } } },
  });
  res.json({ games: games.map(dbGameToSummary) });
});

/** PGN партии: скачивание/анализ во внешних движках */
gamesRouter.get('/:id/pgn', requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      moves: { orderBy: [{ ply: 'asc' }] },
    },
  });
  if (!game) return void res.status(404).json({ error: 'Партия не найдена' });

  const boardQuery = req.query.board !== undefined ? parseInt(String(req.query.board), 10) : undefined;
  const pgn = buildPgn(
    {
      id: game.id,
      mode: game.mode as 'team' | 'bughouse',
      result: game.result,
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
    game.moves.map((m) => ({
      boardIndex: m.boardIndex,
      ply: m.ply,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      dropPiece: m.dropPiece,
    })),
    boardQuery,
  );

  if (String(req.query.download ?? '') === '1') {
    const filename = boardQuery !== undefined ? `kaissa-game-${id}-board-${boardQuery + 1}.pgn` : `kaissa-game-${id}.pgn`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  }
  res.type('application/x-chess-pgn').send(pgn);
});

/** Мгновенное получение актуального состояния активной игры (HTTP fallback / initial render) */
gamesRouter.get('/:id/state', requireAuth, (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const g = gamesManager.getActive(id);
  if (!g) return void res.status(404).json({ error: 'Партия не активна' });
  res.json({ state: gamesManager.toGameState(g) });
});

/** Прокси для анализа на Lichess через их API https://lichess.org/api/import */
gamesRouter.post('/:id/lichess-import', requireAuth, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  const game = await prisma.game.findUnique({
    where: { id },
    include: {
      participants: { include: { user: true } },
      moves: { orderBy: [{ ply: 'asc' }] },
    },
  });
  if (!game) return void res.status(404).json({ error: 'Партия не найдена' });

  const pgn = buildPgn(
    {
      id: game.id,
      mode: game.mode as 'team' | 'bughouse',
      result: game.result,
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
    game.moves.map((m) => ({
      boardIndex: m.boardIndex,
      ply: m.ply,
      from: m.from,
      to: m.to,
      promotion: m.promotion,
      dropPiece: m.dropPiece,
    })),
  );

  try {
    const boardIdx = parseInt(String(req.query.board ?? '0'), 10);
    // Для багхауса в PGN две партии, разделенные \n\n[Event
    let pgnToSend = pgn;
    if (game.mode === 'bughouse') {
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
});

/** Одна партия (для replay) */
gamesRouter.get('/:id', requireAuth, async (req, res) => {
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
});

/** Реванш: создать лобби реванша */
gamesRouter.post('/:id/rematch', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const id = parseInt(String(req.params.id), 10);
  const game = await prisma.game.findUnique({ where: { id }, include: { participants: true } });
  if (!game) return void res.status(404).json({ error: 'Партия не найдена' });
  if (!game.participants.some((p) => p.userId === user.id)) {
    return void res.status(403).json({ error: 'Вы не участник партии' });
  }  const players = await gamesManager.rematchPlayers(id);
  const r = await lobbies.rematch(
    user.id,
    players,
    {
      gameId: id,
      mode: game.mode as 'team' | 'bughouse',
      timeControl: game.noClock
        ? { kind: 'none', baseMin: 0, incSec: 0 }
        : { kind: 'clock', baseMin: game.baseMin, incSec: game.incSec },
    },
  );
  if (!r) return void res.status(500).json({ error: 'Не удалось создать лобби' });

  // Разослать событие реванша в комнату партии (всех в партии перекинет в лобби)
  gamesManager.broadcastRematch(id, r.lobbyId);

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
});

// ---------------- Вспомогательные ----------------

type DbGame = {
  id: number;
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
    userId: number;
    team: number;
    color: string;
    boardIndex: number;
    moveSlot: number;
    ratingBefore: number;
    ratingAfter: number | null;
    user: { username: string };
  }[];
};

function dbGameToSummary(game: DbGame): GameSummary {
  return {
    id: game.id,
    mode: game.mode as 'team' | 'bughouse',
    status: game.status as 'active' | 'finished' | 'abandoned',
    result: game.result as '1-0' | '0-1' | '*',
    reason: (game.reason as GameSummary['reason']) ?? null,
    timeControl: game.noClock
      ? { kind: 'none', baseMin: 0, incSec: 0 }
      : { kind: 'clock', baseMin: game.baseMin, incSec: game.incSec },
    participants: game.participants.map((p) => ({
      userId: p.userId,
      username: p.user.username,
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
