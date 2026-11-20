import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

export type ActivityPeriod = '7' | '30' | 'all';

export function parseActivityPeriod(value: unknown): ActivityPeriod | null {
  if (value === undefined) return 'all';
  return value === '7' || value === '30' || value === 'all' ? value : null;
}

type ActivityCounts = {
  started: bigint;
  finished: bigint;
  abandoned: bigint;
  active: bigint;
  abandonedWithMoves: bigint;
  abandonedWithoutMoves: bigint;
  recordedMoves: bigint;
  distinctHumanMovers: bigint;
};

export async function readActivity(period: ActivityPeriod, asOf = new Date()) {
  // Cohort by match start, not exit date. Moves have no timestamp and belong
  // to the cohort of their match. Current status counts are not event counts.
  const from = period === 'all' ? null : new Date(asOf.getTime() - Number(period) * 86_400_000);
  const [counts] = await prisma.$queryRaw<ActivityCounts[]>(Prisma.sql`
    WITH cohort AS (
      SELECT id, status FROM "Game"
      WHERE "startedAt" <= ${asOf}
        ${from ? Prisma.sql`AND "startedAt" >= ${from}` : Prisma.empty}
    ),
    matches AS (
      SELECT COUNT(*) AS started,
        COUNT(*) FILTER (WHERE status = 'finished') AS finished,
        COUNT(*) FILTER (WHERE status = 'abandoned') AS abandoned,
        COUNT(*) FILTER (WHERE status = 'active') AS active,
        COUNT(*) FILTER (WHERE status = 'abandoned' AND EXISTS (
          SELECT 1 FROM "GameMove" m WHERE m."gameId" = cohort.id
        )) AS "abandonedWithMoves"
      FROM cohort
    ),
    moves AS (
      SELECT COUNT(*) AS "recordedMoves",
        COUNT(DISTINCT m."userId") FILTER (WHERE NOT u."isBot") AS "distinctHumanMovers"
      FROM cohort c
      JOIN "GameMove" m ON m."gameId" = c.id
      JOIN "User" u ON u.id = m."userId"
    )
    SELECT matches.*, (abandoned - "abandonedWithMoves") AS "abandonedWithoutMoves", moves.*
    FROM matches CROSS JOIN moves
  `);
  return {
    period, from: from?.toISOString() ?? null, asOf: asOf.toISOString(),
    started: Number(counts.started), finished: Number(counts.finished),
    abandoned: Number(counts.abandoned), active: Number(counts.active),
    abandonedWithMoves: Number(counts.abandonedWithMoves),
    abandonedWithoutMoves: Number(counts.abandonedWithoutMoves),
    recordedMoves: Number(counts.recordedMoves),
    distinctHumanMovers: Number(counts.distinctHumanMovers),
  };
}
