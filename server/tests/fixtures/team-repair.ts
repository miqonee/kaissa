import type { TeamRepairInput, RepairRating } from '../../src/ratings/teamRepairPlan.js';
export function fixture(): TeamRepairInput {
  const row = (userId: number, data: Partial<RepairRating>): RepairRating => ({ userId, mode: 'team', rating: 1200,
    wins: 0, losses: 0, draws: 0, trainingWins: 0, trainingLosses: 0, trainingDraws: 0,
    carriedWins: 0, carriedLosses: 0, carriedDraws: 0, carriedRating: null, ...data });
  const game = (id: number, result: string, kind: string, ratings: [number, number, number, number]) => ({
    id, mode: 'team', status: 'finished', result, reason: 'resign', ratingKind: kind,
    startedAt: new Date(`2026-10-26T${10 + id}:00:00Z`), endedAt: new Date(`2026-10-26T${10 + id}:05:00Z`),
    participants: [1, 2, 3, 4].map(userId => ({ id: id * 10 + userId, userId, team: userId % 2 ? 1 : 2, wasGuest: false,
      ratingBefore: userId === 1 ? ratings[0] : userId === 2 ? ratings[1] : 1200,
      ratingAfter: userId === 1 ? ratings[2] : userId === 2 ? ratings[3] : 1200 })) });
  const games = [game(1, '1-0', 'rated', [1200, 1200, 1216, 1184]), game(2, '1/2-1/2', 'rated', [1216, 1184, 1215, 1185]),
    game(3, '1-0', 'guest', [1215, 1185, 1215, 1185])];
  return {
    users: [
      { id: 1, username: 'old_winner', rating: 1500, wins: 12, losses: 5, draws: 1, isBot: false, isGuest: false },
      { id: 2, username: 'old_opponent', rating: 1000, wins: 8, losses: 10, draws: 1, isBot: false, isGuest: false },
      ...[3, 4].map(id => ({ id, username: `bot_${id}`, rating: 1200, wins: 0, losses: 0, draws: 0, isBot: true, isGuest: false })),
    ],
    ratings: [row(1, { rating: 1215, wins: 1, draws: 1, trainingWins: 1 }), row(2, { rating: 1185, losses: 1, draws: 1, trainingLosses: 1 })],
    games,
    history: games.slice(0, 2).flatMap(g => g.participants.slice(0, 2).map(p => ({ id: p.id, userId: p.userId, gameId: g.id,
      mode: 'team', value: p.ratingAfter!, delta: p.ratingAfter! - p.ratingBefore, createdAt: g.endedAt }))),
  };
}

