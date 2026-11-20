import { Router } from 'express';
import type {
  AdminUserRow,
  BotLevelMetric,
  BotPersonalityMetric,
  PlatformMetrics,
} from 'shared';
import { BOT_LEVELS, BOT_PERSONALITIES, eloToLevel } from 'shared';
import { currentUser, requireAdmin } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';
import { botStatsTracker } from '../ai/botStats.js';
import { calculatePlatformDurationMetrics } from './durationStats.js';
import { botOutcome } from './botResults.js';
import { parseActivityPeriod, readActivity } from './activityStats.js';
import { readAccountCounts } from './accountCounts.js';
import { adminReadViews } from './readViews.js';
import { asyncRoute } from '../http/asyncRoute.js';

// ============================================================
// Админка: список игроков, удаление аккаунтов, сброс рейтинга.
// Права выдаются через переменную окружения ADMIN_USERNAMES.
// ============================================================

export const adminRouter = Router();

adminRouter.use(requireAdmin);
adminRouter.use(adminReadViews);

/** Общие метрики платформы и балансировки ботов */
adminRouter.get('/metrics', asyncRoute(async (req, res) => {
  if (req.query.scope !== undefined && (typeof req.query.scope !== 'string' || !['overview', 'all'].includes(req.query.scope))) {
    return void res.status(400).json({ error: 'Некорректная область метрик' });
  }
  // The normal dashboard must not load the entire bot participation archive.
  // Full historical bot metrics remain available through the unchanged default request.
  if (req.query.scope === 'overview') {
    const period = parseActivityPeriod(req.query.period);
    if (!period) return void res.status(400).json({ error: 'Некорректный период метрик' });
    // Lifetime saved rows are independent of the selected cohort, even if a
    // stored match has a future start timestamp and is excluded from activity.
    const [accounts, finishedGames, activity, totalGames, totalMoves] = await Promise.all([
      readAccountCounts(),
      prisma.game.findMany({
        where: { status: 'finished', endedAt: { not: null } },
        orderBy: { endedAt: 'desc' }, take: 200,
        select: { id: true, mode: true, baseMin: true, incSec: true, noClock: true,
          startedAt: true, endedAt: true, _count: { select: { moves: true } } },
      }),
      readActivity(period),
      prisma.game.count(), prisma.gameMove.count(),
    ]);
    const { avgGameDurationSec, durationStats } = calculatePlatformDurationMetrics(finishedGames);
    const payload: PlatformMetrics = {
      accounts, totalUsers: accounts.registered + accounts.guests, onlineUsers: accounts.online,
      totalGames, totalMoves, avgGameDurationSec, durationStats,
      botMetrics: [], botMetricsVsHuman: [], botMetricsVsBot: [],
      personalityMetricsVsHuman: [], personalityMetricsVsBot: [],
      bestPair: null, worstPair: null, topLevel: null, topPersonality: null,
    };
    res.json({ ...payload, activity });
    return;
  }
  const [accounts, totalGames, totalMoves, finishedGames, botParts] = await Promise.all([
    readAccountCounts(),
    prisma.game.count(),
    prisma.gameMove.count(),
    prisma.game.findMany({
      where: { status: 'finished', endedAt: { not: null } },
      orderBy: { endedAt: 'desc' },
      select: {
        id: true,
        mode: true,
        baseMin: true,
        incSec: true,
        noClock: true,
        startedAt: true,
        endedAt: true,
        _count: { select: { moves: true } },
      },
      take: 200,
    }),
    prisma.gameParticipant.findMany({
      where: { user: { isBot: true }, game: { status: 'finished' } },
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

  const { avgGameDurationSec, durationStats } = calculatePlatformDurationMetrics(finishedGames);

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
    const outcome = botOutcome(p);
    if (!outcome) return;
    const g = p.game;
    acc.totalGames++;
    acc.totalMovesInGames += g._count.moves;
    if (outcome === 'win') acc.wins++;
    else if (outcome === 'loss') acc.losses++;
    if (g.reason === 'checkmate') acc.checkmateCount++;
    else if (g.reason === 'timeout') acc.timeoutCount++;
    else if (g.reason === 'stalemate') acc.stalemateCount++;
  };

  // 1. Метрики по 12 уровням сложности (BOT_LEVELS)
  const botMetricsVsHuman: BotLevelMetric[] = [];
  const botMetricsVsBot: BotLevelMetric[] = [];

  for (const lvl of BOT_LEVELS) {
    const matchingParts = botParts.filter((p) => {
      const effectiveLevel = p.ratingBefore ? eloToLevel(p.ratingBefore) : (p.user.botLevel || 1);
      return effectiveLevel === lvl.level;
    });
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
      // Score: ничья = пол-очка
      const winRate = acc.totalGames ? Math.round(((acc.wins + 0.5 * draws) / acc.totalGames) * 100) : 0;
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

    const bestEloForHumans = (): string => {
      const vsHumanParts = matchingParts.filter((p) => p.game.participants.some((x) => !x.user.isBot));
      if (!vsHumanParts.length) return `${persona.defaultElo} (Номинал)`;
      const map = new Map<number, { games: number; wins: number; draws: number }>();
      for (const p of vsHumanParts) {
        const outcome = botOutcome(p);
        if (!outcome) continue;
        const elo = p.ratingBefore || persona.defaultElo;
        let entry = map.get(elo);
        if (!entry) { entry = { games: 0, wins: 0, draws: 0 }; map.set(elo, entry); }
        entry.games++;
        if (outcome === 'win') entry.wins++;
        else if (outcome === 'draw') entry.draws++;
      }
      if (!map.size) return `${persona.defaultElo} (Номинал)`;
      const list = [...map.entries()].map(([elo, stat]) => ({ elo, ...stat, winRate: stat.games ? Math.round(((stat.wins + 0.5 * stat.draws) / stat.games) * 100) : 0 }));
      const withScore = list.filter((x) => x.winRate > 0);
      if (withScore.length > 0) {
        withScore.sort((a, b) => b.winRate - a.winRate || b.games - a.games);
        return `${withScore[0].elo} (${withScore[0].winRate}% очков)`;
      }
      return `${list[0].elo} (0% очков)`;
    };

    const finalizePersona = (acc: typeof combinedBotAcc, isHuman: boolean): BotPersonalityMetric => {
      const draws = acc.totalGames - acc.wins - acc.losses;
      // Score: ничья = пол-очка
      const winRate = acc.totalGames ? Math.round(((acc.wins + 0.5 * draws) / acc.totalGames) * 100) : 0;
      const avgMoves = acc.totalGames ? Math.round(acc.totalMovesInGames / acc.totalGames) : 0;
      const bestEloText = isHuman
        ? bestEloForHumans()
        : botStatsTracker.getBestEloText(persona.username, persona.defaultElo);

      return {
        username: persona.username,
        name: persona.name,
        title: persona.title,
        badge: persona.badge,
        description: persona.description,
        defaultElo: persona.defaultElo,
        bestEloText,
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

    personalityMetricsVsHuman.push(finalizePersona(humanAcc, true));
    personalityMetricsVsBot.push(finalizePersona(combinedBotAcc, false));
  }

  // 3. Дуэты и топ-уровни / персоналии (по очкам: ничья = 0.5)
  const { best: bestPair, worst: worstPair } = botStatsTracker.getBestAndWorstPairs();

  const activeLevelList = botMetricsVsBot.concat(botMetricsVsHuman);
  const playedLevels = activeLevelList.filter((l) => l.totalGames >= 1 && l.winRate > 0);
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
  const playedPersonas = activePersonaList.filter((p) => p.totalGames >= 1 && p.winRate > 0);
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
    accounts,
    onlineUsers: accounts.online,
    totalUsers: accounts.registered + accounts.guests,
    totalGames,
    totalMoves,
    avgGameDurationSec,
    durationStats,
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
}));

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
    isGuest: u.isGuest,
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
    prisma.modeRating.deleteMany({ where: { userId: id } }),
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
  if (target.isBot || target.isGuest) return void res.status(400).json({ error: 'Боты не могут быть администраторами' });
  await prisma.user.update({ where: { id }, data: { isAdmin } });
  res.json({ ok: true });
});

/** Explicit existing user IDs only; account names never confer privileges. */
export async function promoteConfiguredAdmins(ids: number[]): Promise<void> {
  if (!ids.length) return;
  await prisma.user.updateMany({ where: { id: { in: ids }, isBot: false, isGuest: false }, data: { isAdmin: true } });
}
