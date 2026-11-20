import { eloToLevel, levelToElo } from 'shared';
import { prisma } from '../prisma.js';

export const NEWCOMER_FINISHED_GAMES = 3;

/** Both counters and kept history matter: one may outlive the other. Claim
 * keeps the same account ID, so it does not grant another introductory run. */
export async function isNewcomer(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isBot: true, wins: true, losses: true, draws: true,
      modeRatings: {
        select: {
          wins: true, losses: true, draws: true,
          trainingWins: true, trainingLosses: true, trainingDraws: true,
          carriedWins: true, carriedLosses: true, carriedDraws: true, carriedRating: true,
        },
      },
      participations: {
        where: { game: { status: 'finished' } },
        take: NEWCOMER_FINISHED_GAMES,
        select: { gameId: true },
      },
    },
  });
  if (!user || user.isBot || user.participations.length >= NEWCOMER_FINISHED_GAMES) return false;
  if (user.wins + user.losses + user.draws >= NEWCOMER_FINISHED_GAMES) return false;
  if (user.modeRatings.some(rating => rating.carriedRating !== null)) return false;
  const counted = user.modeRatings.reduce((total, rating) => total
    + rating.wins + rating.losses + rating.draws
    + rating.trainingWins + rating.trainingLosses + rating.trainingDraws
    + rating.carriedWins + rating.carriedLosses + rating.carriedDraws, 0);
  return counted < NEWCOMER_FINISHED_GAMES;
}

export function newcomerOpponentRating(rating: number): number {
  const level = eloToLevel(rating);
  // chooseBotMove already subtracts one tier and floors it at level 1.
  // Nominal levels 1 and 2 are therefore already at the effective floor.
  return level <= 2 ? rating : levelToElo(level - 1);
}
