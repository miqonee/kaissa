import { Router } from 'express';
import type {
  AdminUserRow,
  BotLevelMetric,
  BotPersonalityMetric,
  PlatformMetrics,
} from 'shared';
import { BOT_LEVELS, BOT_PERSONALITIES } from 'shared';
import { currentUser, requireAdmin } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';
import { botStatsTracker } from '../ai/botStats.js';

// ============================================================
// Админка: список игроков, удаление аккаунтов, сброс рейтинга.
// Права выдаются через переменную окружения ADMIN_USERNAMES.
// ============================================================

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/** Общие метрики платформы и балансировки ботов */
adminRouter.get('/metrics', async (_req, res) => {
  const [totalUsers, totalGames, totalMoves, finishedGames, users, botParts] = await Promise.all([
    prisma.user.count({ where: { isBot: false } }),
    prisma.game.count(),
    prisma.gameMove.count(),
    prisma.game.findMany({
      where: { status: 'finished', endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
      take: 200,
    }),
    prisma.user.findMany({ select: { id: true } }),
    prisma.gameParticipant.findMany({
      where: { user: { isBot: true } },
      include: {
        user: { select: { id: true, username: true, botLevel: true } },
        game: {
          include: {
            _count: { select: { moves: true } },
            participants: { select: { user: { select: { isBot: true } } } },
          },
        },
      },
    }),
  ]);

  let totalDurationSec = 0;
  for (const g of finishedGames) {
    if (g.endedAt) {
      totalDurationSec += Math.max(0, (g.endedAt.getTime() - g.startedAt.getTime()) / 1000);
    }
  }
  const avgGameDurationSec = finishedGames.length ? Math.round(totalDurationSec / finishedGames.length) : 0;
  const onlineUsers = users.filter((u) => presence.isOnline(u.id)).length;

  const createAcc = () => ({
    totalGames: 0,
    wins: 0,
    losses: 0,
    checkmateCount: 0,
    timeoutCount: 0,
    stalemateCount: 0,
    totalMovesInGames: 0,
  });

  const processGamePart = (p: typeof botParts[0], acc: ReturnType<typeof createAcc>) => {
    const g = p.game;
    acc.totalGames++;
    acc.totalMovesInGames += g._count.moves;
    const isWinner = (g.result === '1-0' && p.team === 1) || (g.result === '0-1' && p.team === 2);
    const isLoser = (g.result === '1-0' && p.team === 2) || (g.result === '0-1' && p.team === 1);
    if (isWinner) acc.wins++;
    else if (isLoser) acc.losses++;

    if (g.reason === 'checkmate') acc.checkmateCount++;
    else if (g.reason === 'timeout') acc.timeoutCount++;
    else if (g.reason === 'stalemate') acc.stalemateCount++;
  };

  // 1. Метрики по 12 уровням сложности (BOT_LEVELS)
  const botMetricsVsHuman: BotLevelMetric[] = [];
  const botMetricsVsBot: BotLevelMetric[] = [];

  for (const lvl of BOT_LEVELS) {
    const matchingParts = botParts.filter((p) => p.user.botLevel === lvl.level);
    const humanAcc = createAcc();
    const botAcc = createAcc();

    for (const p of matchingParts) {
      const isVsHuman = p.game.participants.some((x) => !x.user.isBot);
      processGamePart(p, isVsHuman ? humanAcc : botAcc);
    }

    const tracked = botStatsTracker.getStatsForLevel(lvl.level);
    const combinedBotAcc = {
      totalGames: botAcc.totalGames + tracked.totalGames,
      wins: botAcc.wins + tracked.wins,
      losses: botAcc.losses + tracked.losses,
      checkmateCount: botAcc.checkmateCount + tracked.checkmateCount,
      timeoutCount: botAcc.timeoutCount + tracked.timeoutCount,
      stalemateCount: botAcc.stalemateCount + tracked.stalemateCount,
      totalMovesInGames: botAcc.totalMovesInGames + tracked.totalMoves,
    };

    const finalizeLevel = (acc: typeof combinedBotAcc): BotLevelMetric => {
      const draws = acc.totalGames - acc.wins - acc.losses;
      const winRate = acc.totalGames ? Math.round((acc.wins / acc.totalGames) * 100) : 0;
      const avgMoves = acc.totalGames ? Math.round(acc.totalMovesInGames / acc.totalGames) : 0;
      return {
        level: lvl.level,
        name: lvl.name,
        elo: lvl.nominalElo,
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

    botMetricsVsHuman.push(finalizeLevel(humanAcc));
    botMetricsVsBot.push(finalizeLevel(combinedBotAcc));
  }

  // 2. Метрики по 12 персоналиям (BOT_PERSONALITIES)
  const personalityMetricsVsHuman: BotPersonalityMetric[] = [];
  const personalityMetricsVsBot: BotPersonalityMetric[] = [];

  for (const persona of Object.values(BOT_PERSONALITIES)) {
    const matchingParts = botParts.filter(
      (p) => p.user.username.toLowerCase() === persona.username.toLowerCase(),
    );
    const humanAcc = createAcc();
    const botAcc = createAcc();

    for (const p of matchingParts) {
      const isVsHuman = p.game.participants.some((x) => !x.user.isBot);
      processGamePart(p, isVsHuman ? humanAcc : botAcc);
    }

    const tracked = botStatsTracker.getStatsForUsername(persona.username);
    const combinedBotAcc = {
      totalGames: botAcc.totalGames + tracked.totalGames,
      wins: botAcc.wins + tracked.wins,
      losses: botAcc.losses + tracked.losses,
      checkmateCount: botAcc.checkmateCount + tracked.checkmateCount,
      timeoutCount: botAcc.timeoutCount + tracked.timeoutCount,
      stalemateCount: botAcc.stalemateCount + tracked.stalemateCount,
      totalMovesInGames: botAcc.totalMovesInGames + tracked.totalMoves,
    };

    const finalizePersona = (acc: typeof combinedBotAcc): BotPersonalityMetric => {
      const draws = acc.totalGames - acc.wins - acc.losses;
      const winRate = acc.totalGames ? Math.round((acc.wins / acc.totalGames) * 100) : 0;
      const avgMoves = acc.totalGames ? Math.round(acc.totalMovesInGames / acc.totalGames) : 0;
      return {
        username: persona.username,
        name: persona.name,
        title: persona.title,
        badge: persona.badge,
        description: persona.description,
        defaultElo: persona.defaultElo,
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

    personalityMetricsVsHuman.push(finalizePersona(humanAcc));
    personalityMetricsVsBot.push(finalizePersona(combinedBotAcc));
  }

  // 3. Дуэты и топ-уровни / персоналии
  const { best: bestPair, worst: worstPair } = botStatsTracker.getBestAndWorstPairs();

  const activeLevelList = botMetricsVsBot.concat(botMetricsVsHuman);
  const playedLevels = activeLevelList.filter((l) => l.totalGames >= 1);
  playedLevels.sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames);
  const topLevel = playedLevels[0]
    ? {
        level: playedLevels[0].level,
        name: playedLevels[0].name,
        elo: playedLevels[0].elo,
        winRate: playedLevels[0].winRate,
        totalGames: playedLevels[0].totalGames,
      }
    : null;

  const activePersonaList = personalityMetricsVsBot.concat(personalityMetricsVsHuman);
  const playedPersonas = activePersonaList.filter((p) => p.totalGames >= 1);
  playedPersonas.sort((a, b) => b.winRate - a.winRate || b.totalGames - a.totalGames);
  const topPersonality = playedPersonas[0]
    ? {
        username: playedPersonas[0].username,
        name: playedPersonas[0].name,
        badge: playedPersonas[0].badge,
        winRate: playedPersonas[0].winRate,
        totalGames: playedPersonas[0].totalGames,
      }
    : null;

  const payload: PlatformMetrics = {
    onlineUsers,
    totalUsers,
    totalGames,
    totalMoves,
    avgGameDurationSec,
    botMetrics: botMetricsVsHuman,
    botMetricsVsHuman,
    botMetricsVsBot,
    personalityMetricsVsHuman,
    personalityMetricsVsBot,
    bestPair,
    worstPair,
    topLevel,
    topPersonality,
  };

  res.json(payload);
});

/** Список всех игроков */
adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { isBot: false },
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
  if (target.isBot) return void res.status(400).json({ error: 'Нельзя удалить системного бота' });

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
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return void res.status(404).json({ error: 'Игрок не найден' });
  if (target.isBot) return void res.status(400).json({ error: 'Нельзя сбросить системного бота' });

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
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return void res.status(404).json({ error: 'Игрок не найден' });
  if (target.isBot) return void res.status(400).json({ error: 'Боты не могут быть администраторами' });
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
