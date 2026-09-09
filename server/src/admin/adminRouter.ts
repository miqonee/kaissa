import { Router } from 'express';
import type { AdminUserRow, BotLevelMetric, PlatformMetrics } from 'shared';
import { BOT_PRESETS } from 'shared';
import { currentUser, requireAdmin } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';

// ============================================================
// Админка: список игроков, удаление аккаунтов, сброс рейтинга.
// Права выдаются через переменную окружения ADMIN_USERNAMES.
// ============================================================

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/** Общие метрики платформы и балансировки ботов */
adminRouter.get('/metrics', async (_req, res) => {
  const [totalUsers, totalGames, totalMoves, finishedGames, users] = await Promise.all([
    prisma.user.count({ where: { isBot: false } }),
    prisma.game.count(),
    prisma.gameMove.count(),
    prisma.game.findMany({
      where: { status: 'finished', endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
      take: 200,
    }),
    prisma.user.findMany({ select: { id: true } }),
  ]);

  let totalDurationSec = 0;
  for (const g of finishedGames) {
    if (g.endedAt) {
      totalDurationSec += Math.max(0, (g.endedAt.getTime() - g.startedAt.getTime()) / 1000);
    }
  }
  const avgGameDurationSec = finishedGames.length ? Math.round(totalDurationSec / finishedGames.length) : 0;
  const onlineUsers = users.filter((u) => presence.isOnline(u.id)).length;

  const botMetricsVsHuman: BotLevelMetric[] = [];
  const botMetricsVsBot: BotLevelMetric[] = [];

  for (const preset of BOT_PRESETS) {
    const parts = await prisma.gameParticipant.findMany({
      where: { user: { isBot: true, botLevel: preset.level } },
      include: {
        game: {
          include: {
            _count: { select: { moves: true } },
            participants: { select: { user: { select: { isBot: true } } } },
          },
        },
      },
    });

    const createAcc = () => ({
      totalGames: 0,
      wins: 0,
      losses: 0,
      checkmateCount: 0,
      timeoutCount: 0,
      stalemateCount: 0,
      totalMovesInGames: 0,
    });

    const humanAcc = createAcc();
    const botAcc = createAcc();

    for (const p of parts) {
      const g = p.game;
      const isVsHuman = g.participants.some((x) => !x.user.isBot);
      const acc = isVsHuman ? humanAcc : botAcc;

      acc.totalGames++;
      acc.totalMovesInGames += g._count.moves;
      const isWinner = (g.result === '1-0' && p.team === 1) || (g.result === '0-1' && p.team === 2);
      const isLoser = (g.result === '1-0' && p.team === 2) || (g.result === '0-1' && p.team === 1);
      if (isWinner) acc.wins++;
      else if (isLoser) acc.losses++;

      if (g.reason === 'checkmate') acc.checkmateCount++;
      else if (g.reason === 'timeout') acc.timeoutCount++;
      else if (g.reason === 'stalemate') acc.stalemateCount++;
    }

    const finalize = (acc: ReturnType<typeof createAcc>): BotLevelMetric => {
      const draws = acc.totalGames - acc.wins - acc.losses;
      const winRate = acc.totalGames ? Math.round((acc.wins / acc.totalGames) * 100) : 0;
      const avgMoves = acc.totalGames ? Math.round(acc.totalMovesInGames / acc.totalGames) : 0;
      return {
        level: preset.level,
        name: preset.name,
        elo: preset.elo,
        totalGames: acc.totalGames,
        wins: acc.wins,
        losses: acc.losses,
        draws,
        winRate,
        checkmateCount: acc.checkmateCount,
        timeoutCount: acc.timeoutCount,
        stalemateCount: acc.stalemateCount,
        avgMoves,
      };
    };

    botMetricsVsHuman.push(finalize(humanAcc));
    botMetricsVsBot.push(finalize(botAcc));
  }

  const payload: PlatformMetrics = {
    onlineUsers,
    totalUsers,
    totalGames,
    totalMoves,
    avgGameDurationSec,
    botMetrics: botMetricsVsHuman,
    botMetricsVsHuman,
    botMetricsVsBot,
  };

  res.json(payload);
});

/** Список всех игроков */
adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: 'desc' }, { rating: 'desc' }],
    include: { _count: { select: { participations: true } } },
  });
  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    rating: u.rating,
    wins: u.wins,
    losses: u.losses,
    games: u._count.participations,
    isAdmin: u.isAdmin,
    online: presence.isOnline(u.id),
    createdAt: u.createdAt.toISOString(),
  }));
  res.json({ users: rows });
});

/** Удалить аккаунт вместе с его партиями */
adminRouter.delete('/users/:id', async (req, res) => {
  const me = await currentUser(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  if (me?.id === id) return void res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return void res.status(404).json({ error: 'Игрок не найден' });

  // Партии, в которых он участвовал, теряют смысл без него — удаляем целиком
  const parts = await prisma.gameParticipant.findMany({ where: { userId: id }, select: { gameId: true } });
  const gameIds = [...new Set(parts.map((p) => p.gameId))];
  if (gameIds.length) await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.user.delete({ where: { id } });

  res.json({ ok: true, deletedGames: gameIds.length, username: target.username });
});

/** Сбросить рейтинг и статистику (удобно при тестах) */
adminRouter.post('/users/:id/reset', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  await prisma.$transaction([
    prisma.ratingHistory.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: { rating: 1200, wins: 0, losses: 0, draws: 0 },
    }),
  ]);
  res.json({ ok: true });
});

/** Выдать/снять права администратора */
adminRouter.post('/users/:id/admin', async (req, res) => {
  const me = await currentUser(req);
  const id = parseInt(String(req.params.id), 10);
  const isAdmin = Boolean(req.body?.isAdmin);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  if (me?.id === id) return void res.status(400).json({ error: 'Нельзя менять свои права' });
  await prisma.user.update({ where: { id }, data: { isAdmin } });
  res.json({ ok: true });
});

/** Выдать права по имени пользователя из ADMIN_USERNAMES при старте сервера */
export async function promoteConfiguredAdmins(usernames: string[]): Promise<void> {
  const clean = usernames.map((u) => u.trim()).filter(Boolean);
  if (!clean.length) return;
  const users = await prisma.user.findMany({ select: { id: true, username: true, isAdmin: true } });
  const toPromote = users.filter(
    (u) => !u.isAdmin && clean.some((c) => c.toLowerCase() === u.username.toLowerCase()),
  );
  if (toPromote.length) {
    await prisma.user.updateMany({
      where: { id: { in: toPromote.map((u) => u.id) } },
      data: { isAdmin: true },
    });
    console.log(`[kaissa] выданы права администратора: ${toPromote.map((u) => u.username).join(', ')}`);
  }
}
