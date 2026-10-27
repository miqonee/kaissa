import { describe, expect, it } from 'vitest';
import { buildTeamRepairPlan } from '../src/ratings/teamRepairPlan.js';

import { fixture } from './fixtures/team-repair.js';

describe('one-time 2×2 rating continuity', () => {
  it('restores the old baseline and recalculates subsequent games rather than adding old deltas', () => {
    const input = fixture(), before = structuredClone(input), plan = buildTeamRepairPlan(input);
    expect(input).toEqual(before);
    expect(plan.modeUpdates[0]).toMatchObject({ userId: 1, rating: 1488, carriedRating: 1500, carriedWins: 10, carriedLosses: 5, carriedDraws: 0 });
    expect(plan.modeUpdates[1]).toMatchObject({ rating: 1012, carriedWins: 8, carriedLosses: 8 });
    expect(plan.historyUpdates[0]).toEqual({ id: 11, value: 1502, delta: 2 });
    expect(plan.historyUpdates[1]).toEqual({ id: 12, value: 998, delta: -2 });
    expect(plan.participantUpdates.find(p => p.id === 31)).toMatchObject({ ratingBefore: 1488, ratingAfter: 1488 });
    expect(plan.baselineAt.getTime()).toBeLessThan(input.games[0].startedAt.getTime());
  });
  it('takes both teams from the same starting snapshot', () => {
    const input = fixture(), normal = buildTeamRepairPlan(input);
    input.games.forEach(g => g.participants.reverse());
    expect(buildTeamRepairPlan(input).modeUpdates).toEqual(normal.modeUpdates);
  });
  it('subtracts known other-mode results without transferring their Elo or modifying those rows', () => {
    const input = fixture();
    input.games.push({ ...structuredClone(input.games[0]), id: 4, mode: 'bughouse', ratingKind: null });
    const result = buildTeamRepairPlan(input);
    expect(result.modeUpdates[0].carriedWins).toBe(9);
    expect(result.modeUpdates[1].carriedLosses).toBe(7);
  });
  it('keeps new users on 1200 with no inherited results', () => {
    const input = fixture();
    input.users[0] = { ...input.users[0], rating: 1200, wins: 2, losses: 0, draws: 1 };
    input.users[1] = { ...input.users[1], rating: 1200, wins: 0, losses: 2, draws: 1 };
    expect(buildTeamRepairPlan(input).modeUpdates[0]).toMatchObject({ rating: 1215, carriedRating: null, carriedWins: 0, carriedLosses: 0 });
  });
  it('does not count abandoned games or convert null final ratings into results', () => {
    const input = fixture(), abandoned = structuredClone(input.games[2]);
    abandoned.id = 4; abandoned.status = 'abandoned'; abandoned.result = '*';
    abandoned.participants.forEach(p => { p.id += 10; p.ratingAfter = null; });
    input.games.push(abandoned);
    const plan = buildTeamRepairPlan(input);
    expect(plan.participantUpdates.find(p => p.id === 41)).toEqual({ id: 41, ratingBefore: 1488, ratingAfter: null });
    expect(plan.modeUpdates[0].rating).toBe(1488);
  });
  it.each(['active', 'missing-player', 'missing-history', 'missing-game', 'double-import', 'broken-total', 'rating-gap'])(
    'refuses %s instead of guessing', reason => {
      const input = fixture();
      if (reason === 'active') input.games[0].status = 'active';
      if (reason === 'missing-player') input.games[0].participants.pop();
      if (reason === 'missing-history') input.history.pop();
      if (reason === 'missing-game') input.games.pop();
      if (reason === 'double-import') input.ratings[0].carriedRating = 1500;
      if (reason === 'broken-total') input.users[0].wins = 0;
      if (reason === 'rating-gap') input.games[1].participants[0].ratingBefore = 1300;
      expect(() => buildTeamRepairPlan(input)).toThrow();
    });
});
