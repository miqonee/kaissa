import { Prisma } from '@prisma/client';
import { PROVISIONAL_GAMES, type GameMode, type LeaderboardRow } from 'shared';
import { prisma } from '../prisma.js';

type StoredRow = Omit<LeaderboardRow, 'provisional' | 'unarchivedGames'> & {
  archivedGames: number; storedWins: number; storedLosses: number; storedDraws: number;
  modeWins: number; modeLosses: number; modeDraws: number; hasCarriedRating: boolean;
};

/** Old lifetime counters may outlive archived games. Never infer their mode or Elo. */
export async function leaderboard(mode: GameMode | 'all'): Promise<LeaderboardRow[]> {
  const rows = await prisma.$queryRaw<StoredRow[]>(Prisma.sql`
    WITH stats AS (SELECT u.id AS "userId", u.username, u.rating AS "legacyRating",
      u.wins AS "storedWins", u.losses AS "storedLosses", u.draws AS "storedDraws",
      COALESCE(MAX(r.rating), 1200)::int AS rating,
      COUNT(g.id)::int AS "archivedGames",
      COALESCE(MAX(r.wins + r."trainingWins" + r."carriedWins"), 0)::int AS "modeWins",
      COALESCE(MAX(r.losses + r."trainingLosses" + r."carriedLosses"), 0)::int AS "modeLosses",
      COALESCE(MAX(r.draws + r."trainingDraws" + r."carriedDraws"), 0)::int AS "modeDraws",
      COALESCE(BOOL_OR(r."carriedRating" IS NOT NULL), false) AS "hasCarriedRating",
      GREATEST(COALESCE(MAX(r.wins + r.losses + r.draws), 0), COUNT(g.id) FILTER (WHERE g."ratingKind" = 'rated'))::int AS "ratedGames",
      COUNT(g.id) FILTER (WHERE g."ratingKind" IN ('bots', 'guest'))::int AS "trainingGames",
      COUNT(g.id) FILTER (WHERE g."ratingKind" IS NULL)::int AS "legacyGames",
      COUNT(g.id) FILTER (WHERE (g.result = '1-0' AND p.team = 1) OR (g.result = '0-1' AND p.team = 2))::int AS wins,
      COUNT(g.id) FILTER (WHERE (g.result = '1-0' AND p.team = 2) OR (g.result = '0-1' AND p.team = 1))::int AS losses,
      COUNT(g.id) FILTER (WHERE g.result = '1/2-1/2' OR (g.result = '*' AND g.reason IN ('stalemate', 'material', 'repetition', 'fifty')))::int AS draws
    FROM "User" u
    LEFT JOIN "GameParticipant" p ON p."userId" = u.id
    LEFT JOIN "Game" g ON g.id = p."gameId" AND g.status = 'finished'
      AND (${mode} = 'all' OR g.mode = ${mode})
    LEFT JOIN "ModeRating" r ON r."userId" = u.id AND r.mode = ${mode}
    WHERE NOT u."isBot" AND NOT u."isGuest"
    GROUP BY u.id
    )
    SELECT *, CASE WHEN ${mode} = 'all' THEN GREATEST("storedWins" + "storedLosses" + "storedDraws", "archivedGames")
      ELSE GREATEST("modeWins" + "modeLosses" + "modeDraws", "archivedGames") END::int AS "totalGames"
    FROM stats
    WHERE "archivedGames" > 0 OR (${mode} = 'all' AND "storedWins" + "storedLosses" + "storedDraws" > 0)
      OR (${mode} <> 'all' AND ("modeWins" + "modeLosses" + "modeDraws" > 0 OR "hasCarriedRating"))
    ORDER BY ${mode} <> 'all' AND ("hasCarriedRating" OR "ratedGames" > 0) DESC,
      CASE WHEN ${mode} = 'all' THEN 0 ELSE rating END DESC,
      "totalGames" DESC, "userId" ASC
    LIMIT 50
  `);
  return rows.map(({ storedWins, storedLosses, storedDraws, modeWins, modeLosses, modeDraws, hasCarriedRating, archivedGames, ...r }) => {
    const chosen = mode === 'all' ? { wins: storedWins, losses: storedLosses, draws: storedDraws } : { wins: modeWins, losses: modeLosses, draws: modeDraws };
    const useStored = chosen.wins + chosen.losses + chosen.draws > archivedGames;
    return { ...r,
      ...(useStored ? chosen : {}),
      hasRating: hasCarriedRating || r.ratedGames > 0,
      unarchivedGames: r.totalGames - archivedGames,
      provisional: !hasCarriedRating && r.ratedGames < PROVISIONAL_GAMES,
    };
  });
}
