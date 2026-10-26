import {
  eloDelta,
  START_RATING,
  type GameMode,
  type GameResult,
  type EndReason,
  type RatingKind,
} from "shared";
import { prisma } from "../prisma.js";

export interface RatingPlayer {
  uid: number;
  team: number;
  ratingBefore: number;
  ratingAfter: number | null;
  isBot?: boolean;
  isGuest?: boolean;
}
export function ratingKind(
  players: Pick<RatingPlayer, "team" | "isBot" | "isGuest">[],
): RatingKind {
  if (players.some((p) => p.isGuest)) return "guest";
  return [1, 2].every((team) =>
    players.some((p) => p.team === team && !p.isBot),
  )
    ? "rated"
    : "bots";
}
export async function loadPlayerRatings<
  T extends {
    uid: number;
    rating: number;
    username: string;
    isBot?: boolean;
    isGuest?: boolean;
  },
>(players: T[], mode: GameMode): Promise<T[]> {
  const humans = players.filter((p) => !p.isBot);
  if (!humans.length) return players;
  const users = await prisma.user.findMany({
    where: { id: { in: humans.map((p) => p.uid) } },
    include: { modeRatings: { where: { mode } } },
  });
  return players.map((p) => {
    if (p.isBot) return p;
    const user = users.find((u) => u.id === p.uid);
    if (!user) throw new Error("Участник больше не существует");
    return {
      ...p,
      username: user.username,
      isGuest: user.isGuest,
      rating: user.modeRatings[0]?.rating ?? START_RATING,
    };
  });
}

/** One transaction owns the result, all counters and all rating history rows. */
export async function saveGameResult(
  game: {
    id: number;
    mode: GameMode;
    ratingKind: RatingKind;
    participants: RatingPlayer[];
  },
  result: GameResult,
  reason: EndReason,
  endBoardIndex?: number,
): Promise<{ uid: number; before: number; after: number }[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const won = result === "1-0" ? 1 : result === "0-1" ? 2 : null;
          const changed = await tx.game.updateMany({
            where: { id: game.id, status: "active" },
            data: {
              status: "finished",
              result,
              reason,
              endBoardIndex,
              endedAt: new Date(),
            },
          });
          if (!changed.count) {
            const rows = await tx.gameParticipant.findMany({
              where: { gameId: game.id },
            });
            return rows.map((p) => ({
              uid: p.userId,
              before: p.ratingBefore,
              after: p.ratingAfter ?? p.ratingBefore,
            }));
          }
          const ratings = [];
          for (const p of game.participants) {
            let before = p.ratingBefore,
              after = before;
            if (!p.isBot) {
              const key = { userId: p.uid, mode: game.mode };
              await tx.modeRating.upsert({
                where: { userId_mode: key },
                create: key,
                update: {},
              });
              const rated = game.ratingKind === "rated";
              const win = won === p.team ? 1 : 0,
                loss = won !== null && won !== p.team ? 1 : 0,
                draw = won === null ? 1 : 0;
              // ratingBefore is the immutable snapshot taken when this match started.
              let delta = 0;
              if (rated) {
                const opponents = game.participants.filter(
                  (o) => o.team !== p.team && !o.isBot,
                );
                const average =
                  opponents.reduce((sum, o) => sum + o.ratingBefore, 0) /
                  opponents.length;
                delta = eloDelta(before, average, draw ? 0.5 : win ? 1 : 0);
              }
              after = Math.max(100, before + delta);
              await tx.modeRating.update({
                where: { userId_mode: key },
                data: rated
                  ? {
                      rating: after,
                      wins: { increment: win },
                      losses: { increment: loss },
                      draws: { increment: draw },
                    }
                  : {
                      trainingWins: { increment: win },
                      trainingLosses: { increment: loss },
                      trainingDraws: { increment: draw },
                    },
              });
              await tx.user.update({
                where: { id: p.uid },
                data: {
                  wins: { increment: win },
                  losses: { increment: loss },
                  draws: { increment: draw },
                },
              });
              if (rated)
                await tx.ratingHistory.create({
                  data: {
                    userId: p.uid,
                    mode: game.mode,
                    gameId: game.id,
                    value: after,
                    delta: after - before,
                  },
                });
            }
            await tx.gameParticipant.update({
              where: { gameId_userId: { gameId: game.id, userId: p.uid } },
              data: { ratingBefore: before, ratingAfter: after },
            });
            ratings.push({ uid: p.uid, before, after });
          }
          return ratings;
        },
        { isolationLevel: "Serializable" },
      );
    } catch (e) {
      if (
        attempt < 2 &&
        typeof e === "object" &&
        e !== null &&
        "code" in e &&
        e.code === "P2034"
      )
        continue;
      throw e;
    }
  }
}
