import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../prisma.js';
import { buildTeamRepairPlan, TEAM_REPAIR_KEY } from './teamRepairPlan.js';

/** Called before accepting connections. The lock and marker serialize all instances. */
export async function repairTeamRatings(apply = false, db: PrismaClient = prisma) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '10s'`);
    // Freeze the complete source data until the repair and its audit record commit together.
    await tx.$executeRawUnsafe('LOCK TABLE "DataPatch", "User", "ModeRating", "Game", "GameParticipant", "RatingHistory" IN SHARE ROW EXCLUSIVE MODE');
    const existing = await tx.dataPatch.findUnique({ where: { key: TEAM_REPAIR_KEY } });
    if (existing) return { status: 'already-applied' as const, appliedAt: existing.appliedAt, players: [] };
    const users = await tx.user.findMany({ select: { id: true, username: true, rating: true, wins: true, losses: true, draws: true, isBot: true, isGuest: true } });
    const ratings = await tx.modeRating.findMany();
    const games = await tx.game.findMany({ where: { OR: [{ mode: 'team' }, { ratingKind: null, status: 'finished' }] },
      select: { id: true, mode: true, status: true, result: true, reason: true, ratingKind: true, startedAt: true, endedAt: true,
        participants: { select: { id: true, userId: true, team: true, wasGuest: true, ratingBefore: true, ratingAfter: true } } } });
    const history = await tx.ratingHistory.findMany({ where: { mode: 'team' } });
    const input = { users, ratings, games, history };
    const plan = buildTeamRepairPlan(input);
    if (!apply) return { status: 'preview' as const, players: plan.summary };

    for (const { userId, ...data } of plan.modeUpdates) {
      await tx.modeRating.upsert({ where: { userId_mode: { userId, mode: 'team' } },
        create: { userId, mode: 'team', ...data }, update: data });
    }
    for (const { id, ...data } of plan.participantUpdates) await tx.gameParticipant.update({ where: { id }, data });
    for (const { id, ...data } of plan.historyUpdates) await tx.ratingHistory.update({ where: { id }, data });
    const baselineIds: number[] = [];
    for (const r of plan.modeUpdates.filter(r => r.carriedRating !== null)) {
      const h = await tx.ratingHistory.create({ data: { userId: r.userId, mode: 'team', value: r.carriedRating!, delta: 0, createdAt: plan.baselineAt } });
      baselineIds.push(h.id);
    }
    await tx.dataPatch.create({ data: { key: TEAM_REPAIR_KEY,
      details: JSON.parse(JSON.stringify({ version: 1, before: input, plan, baselineIds })) as Prisma.InputJsonValue } });
    return { status: 'applied' as const, players: plan.summary };
  }, { isolationLevel: 'ReadCommitted', maxWait: 15_000, timeout: 120_000 });
}
