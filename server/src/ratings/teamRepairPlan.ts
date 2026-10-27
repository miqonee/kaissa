import { eloDelta, START_RATING } from 'shared';

export const TEAM_REPAIR_KEY = 'team-rating-continuity-v1';
type Results = { wins: number; losses: number; draws: number };
export interface RepairUser extends Results { id: number; username: string; rating: number; isBot: boolean; isGuest: boolean }
export interface RepairRating extends Results {
  userId: number; mode: string; rating: number;
  trainingWins: number; trainingLosses: number; trainingDraws: number;
  carriedWins: number; carriedLosses: number; carriedDraws: number; carriedRating: number | null;
}
export interface RepairParticipant { id: number; userId: number; team: number; wasGuest: boolean; ratingBefore: number; ratingAfter: number | null }
export interface RepairGame {
  id: number; mode: string; status: string; result: string; reason: string | null;
  ratingKind: string | null; startedAt: Date; endedAt: Date | null;
  participants: RepairParticipant[];
}
export interface RepairHistory { id: number; userId: number; gameId: number | null; mode: string | null; value: number; delta: number; createdAt: Date }
export interface TeamRepairInput { users: RepairUser[]; ratings: RepairRating[]; games: RepairGame[]; history: RepairHistory[] }
const empty = (): Results => ({ wins: 0, losses: 0, draws: 0 });
const keys = ['wins', 'losses', 'draws'] as const;
const total = (r: Results) => r.wins + r.losses + r.draws;
function outcome(g: RepairGame, team: number): keyof Results {
  if (g.result === '1-0' || g.result === '0-1') return (g.result === '1-0' ? 1 : 2) === team ? 'wins' : 'losses';
  if (g.result === '1/2-1/2' || (g.result === '*' && ['stalemate', 'material', 'repetition', 'fifty'].includes(g.reason ?? ''))) return 'draws';
  throw new Error(`Неизвестный результат партии #${g.id}; перенос остановлен`);
}
function requireValid(ok: boolean, message: string): asserts ok { if (!ok) throw new Error(message); }

/** Pure plan: no writes, no guessed opponents, no second import of lifetime totals. */
export function buildTeamRepairPlan(input: TeamRepairInput) {
  const { users, ratings, games, history } = input;
  requireValid(!ratings.some(r => r.carriedRating !== null || r.carriedWins || r.carriedLosses || r.carriedDraws),
    'Перенесённые данные уже есть, но отметки патча нет. Требуется проверка резервной копии');
  const byUser = new Map(users.map(u => [u.id, u]));
  const teamRows = new Map(ratings.filter(r => r.mode === 'team').map(r => [r.userId, r]));
  const humans = users.filter(u => !u.isBot);
  requireValid(!games.some(g => g.mode === 'team' && g.status === 'active' && g.participants.some(p => !byUser.get(p.userId)?.isBot)),
    'Есть активные партии 2×2. Завершите их и остановите игровые серверы перед переносом рейтинга');

  const modeUpdates: { userId: number; rating: number; carriedRating: number | null; carriedWins: number; carriedLosses: number; carriedDraws: number }[] = [];
  const current = new Map<number, number>();
  const original = new Map<number, number>();
  for (const u of humans) {
    const post = empty(), otherLegacy = empty(), teamLegacy = empty();
    for (const r of ratings.filter(r => r.userId === u.id)) {
      post.wins += r.wins + r.trainingWins;
      post.losses += r.losses + r.trainingLosses;
      post.draws += r.draws + r.trainingDraws;
    }
    for (const g of games.filter(g => g.ratingKind === null && g.status === 'finished')) {
      const p = g.participants.find(p => p.userId === u.id);
      if (p) (g.mode === 'team' ? teamLegacy : otherLegacy)[outcome(g, p.team)]++;
    }
    const carry = empty();
    for (const key of keys) {
      carry[key] = u[key] - post[key] - otherLegacy[key];
      requireValid(carry[key] >= teamLegacy[key], `Итоги ${u.username} (${key}) противоречат записям партий; автоматический перенос остановлен`);
    }
    const inherited = !u.isGuest && (total(carry) > 0 || u.rating !== START_RATING);
    const seed = inherited ? u.rating : START_RATING;
    requireValid(Number.isSafeInteger(seed) && seed >= 100, `Некорректный исходный Elo у ${u.username}`);
    current.set(u.id, seed); original.set(u.id, START_RATING);
    if (!u.isGuest && (teamRows.has(u.id) || inherited)) modeUpdates.push({ userId: u.id, rating: seed,
      carriedRating: inherited ? seed : null, carriedWins: carry.wins, carriedLosses: carry.losses, carriedDraws: carry.draws });
  }

  const replay = games.filter(g => g.mode === 'team' && g.ratingKind !== null && g.status !== 'active')
    .sort((a, b) => (a.endedAt ?? a.startedAt).getTime() - (b.endedAt ?? b.startedAt).getTime() || a.id - b.id);
  const participantUpdates: { id: number; ratingBefore: number; ratingAfter: number | null }[] = [];
  const historyUpdates: { id: number; value: number; delta: number }[] = [];
  const consumedHistory = new Set<number>();
  const counted = new Map(humans.map(u => [u.id, { rated: empty(), training: empty() }]));
  for (const g of replay) {
    const people = g.participants.filter(p => !byUser.get(p.userId)?.isBot);
    if (!people.length) continue;
    requireValid(['rated', 'bots', 'guest'].includes(g.ratingKind!), `Неизвестный тип партии #${g.id}`);
    requireValid(['finished', 'abandoned'].includes(g.status), `Неизвестный статус партии #${g.id}`);
    const rated = g.status === 'finished' && g.ratingKind === 'rated';
    if (rated) {
      requireValid(g.participants.length === 4 && new Set(g.participants.map(p => p.userId)).size === 4,
        `В партии #${g.id} отсутствует полный состав; пересчёт Elo невозможен`);
      requireValid([1, 2].every(t => people.some(p => p.team === t)) && people.every(p => !p.wasGuest && !byUser.get(p.userId)?.isGuest),
        `Некорректный состав рейтинговой партии #${g.id}`);
    }
    // Snapshot all ratings before the game: player iteration must not affect an opponent's delta.
    const before = new Map(people.map(p => [p.userId, current.get(p.userId)!]));
    const oldBefore = new Map(people.map(p => [p.userId, original.get(p.userId)!]));
    for (const p of people) {
      const u = byUser.get(p.userId)!;
      requireValid(p.ratingBefore === oldBefore.get(p.userId), `Разрыв истории Elo у ${u.username}, партия #${g.id}; перенос остановлен`);
      let after = before.get(p.userId)!, oldAfter = oldBefore.get(p.userId)!;
      if (g.status === 'finished') {
        const result = outcome(g, p.team);
        counted.get(p.userId)![rated ? 'rated' : 'training'][result]++;
        if (rated) {
          const opponents = people.filter(o => o.team !== p.team);
          const score = result === 'wins' ? 1 : result === 'draws' ? 0.5 : 0;
          const average = (values: Map<number, number>) => opponents.reduce((sum, o) => sum + values.get(o.userId)!, 0) / opponents.length;
          after = Math.max(100, after + eloDelta(after, average(before), score));
          oldAfter = Math.max(100, oldAfter + eloDelta(oldAfter, average(oldBefore), score));
          const rows = history.filter(h => h.userId === p.userId && h.gameId === g.id && h.mode === 'team');
          requireValid(rows.length === 1 && rows[0].value === oldAfter && rows[0].delta === oldAfter - p.ratingBefore,
            `Неполная или противоречивая история рейтинга ${u.username}, партия #${g.id}`);
          historyUpdates.push({ id: rows[0].id, value: after, delta: after - before.get(p.userId)! });
          consumedHistory.add(rows[0].id);
        }
        requireValid(p.ratingAfter === oldAfter, `Некорректный итог Elo в партии #${g.id}, ${u.username}`);
      }
      current.set(p.userId, after); original.set(p.userId, oldAfter);
      if (!u.isGuest) participantUpdates.push({ id: p.id, ratingBefore: before.get(p.userId)!, ratingAfter: p.ratingAfter === null ? null : after });
    }
  }
  for (const u of humans) {
    const r = teamRows.get(u.id), counts = counted.get(u.id)!;
    for (const key of keys) {
      const trainingKey = `training${key[0].toUpperCase()}${key.slice(1)}` as 'trainingWins' | 'trainingLosses' | 'trainingDraws';
      requireValid((r?.[key] ?? 0) === counts.rated[key] && (r?.[trainingKey] ?? 0) === counts.training[key],
        `Для ${u.username} не хватает записей новых партий 2×2; перенос остановлен`);
    }
    requireValid((r?.rating ?? START_RATING) === original.get(u.id), `Текущий Elo ${u.username} не совпадает с историей; перенос остановлен`);
  }
  requireValid(history.filter(h => h.mode === 'team' && !byUser.get(h.userId)?.isBot).every(h => consumedHistory.has(h.id)),
    'Найдена история рейтинга 2×2 без соответствующей партии; перенос остановлен');
  for (const r of modeUpdates) r.rating = current.get(r.userId)!;
  const baselineAt = new Date(Math.min(Date.now(), ...replay.map(g => g.startedAt.getTime())) - 1);
  return { modeUpdates, participantUpdates, historyUpdates, baselineAt,
    summary: modeUpdates.map(r => ({ userId: r.userId, username: byUser.get(r.userId)!.username,
      before: teamRows.get(r.userId)?.rating ?? START_RATING, after: r.rating,
      importedGames: r.carriedWins + r.carriedLosses + r.carriedDraws })) };
}
