import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import type { Prisma } from '@prisma/client';
import { eloToLevel, type GameMode } from 'shared';
import { LobbiesManager } from '../src/lobby/lobbies.js';
import { isNewcomer, newcomerOpponentRating } from '../src/lobby/newcomer.js';
import { prisma } from '../src/prisma.js';

vi.mock('../src/ratings/service.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/ratings/service.js')>(),
  loadPlayerRatings: vi.fn(async players => players),
}));

const bots = Array.from({ length: 6 }, (_, i) => ({ id: 100+i, username: `bot_${i}`, isBot: true, rating: 1200 }));
const modeRating = {
  wins: 0, losses: 0, draws: 0, trainingWins: 0, trainingLosses: 0, trainingDraws: 0,
  carriedWins: 0, carriedLosses: 0, carriedDraws: 0, carriedRating: null,
};
const newUser = { isBot: false, wins: 0, losses: 0, draws: 0, modeRatings: [], participations: [] };
const player = { uid: 1, username: 'human', rating: 1200 };
const effective = (elo: number) => Math.max(1, eloToLevel(elo) - 1);
const userLookup = prisma.user as unknown as { findUnique(args: Prisma.UserFindUniqueArgs): Promise<unknown> };
let lookup: MockInstance<typeof userLookup.findUnique>;
beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(prisma.user, 'findMany').mockResolvedValue(bots as any);
  lookup = vi.spyOn(userLookup, 'findUnique').mockResolvedValue(newUser);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function setup(mode: GameMode = 'team', humans = [player]) {
  const manager = new LobbiesManager();
  const createGame = vi.fn().mockResolvedValue(1);
  (manager as any).games = { createGame, gameRoom: () => 'game:1', getActive: () => undefined };
  await manager.ensureAutoLobby();
  const lobby = manager.publicList().find(l => l.mode === mode)!;
  for (const p of humans) manager.join(lobby, p);
  // The baseline Elo snake is [highest, lowest] vs [middle, middle].
  // Use distinct values and reorder the human away from the highest seat.
  if (humans.length === 1 && mode === 'team') [...lobby.members.values()].filter(m => m.isBot)
    .forEach((m, i) => { m.rating = [1450, 1130, 990][i]; m.botLevel = eloToLevel(m.rating); });
  return { manager, lobby, createGame };
}

describe('introductory assistance for the final Quick 2×2 roster', () => {
  it.each([true, false])('reduces exactly the two actual opponents, not the bot partners or clock (guest=%s)', async isGuest => {
    const { manager, lobby, createGame } = await setup('team', [{ ...player, isGuest } as typeof player]);
    const before = new Map([...lobby.members.values()].map(m => [m.uid, m.rating]));
    expect(await manager.start(lobby.id, player.uid)).toEqual({ ok: true, gameId: 1 });
    const options = createGame.mock.calls[0][0];
    expect(options.timeControl).toEqual({ kind: 'clock', baseMin: 3, incSec: 0 });
    // Human is on team 2; Elo snake paired them with the 1130 bot, not bots[0].
    expect(options.team2.map((p: any) => p.rating)).toEqual([1200, 1130]);
    expect(options.team2[0].isGuest).toBe(isGuest);
    for (const p of options.team1) {
      expect(effective(p.rating)).toBe(effective(before.get(p.uid)!) - 1);
      expect(p.botLevel).toBe(eloToLevel(p.rating));
    }
    expect([...lobby.members.values()].map(m => [m.uid, m.rating])).toEqual([...before]);
  });
  it('still applies to a quick-origin table switched back to Team, without changing selected clock', async () => {
    const { manager, lobby, createGame } = await setup();
    lobby.isAuto = false;
    lobby.quickStart = true;
    manager.setTimeControl(lobby.id, player.uid, { kind: 'clock', baseMin: 5, incSec: 3 });
    expect((await manager.start(lobby.id, player.uid)).ok).toBe(true);
    expect(lookup).toHaveBeenCalledOnce();
    expect(createGame.mock.calls[0][0].timeControl).toEqual({ kind: 'clock', baseMin: 5, incSec: 3 });
  });
  it.each(['multi', 'other-mode', 'manual', 'manual-assignment', 'rematch'])('does not look up or modify %s', async kind => {
    const { manager, lobby, createGame } = await setup(kind === 'other-mode' ? 'bughouse' : 'team',
      kind === 'multi' ? [player, { ...player, uid: 2 }] : [player]);
    if (kind === 'manual') lobby.isAuto = false;
    if (kind === 'manual-assignment') lobby.teamMode = 'manual';
    if (kind === 'rematch') lobby.rematchOf = 45;
    const ratings = [...lobby.members.values()].map(m => m.rating).sort();
    expect((await manager.start(lobby.id, player.uid)).ok).toBe(true);
    expect(lookup).not.toHaveBeenCalled();
    const { team1, team2 } = createGame.mock.calls[0][0];
    expect([...team1, ...team2].map(p => p.rating).sort()).toEqual(ratings);
  });
  it('does not stack the reduction when starting is retried after a game creation error', async () => {
    const { manager, lobby, createGame } = await setup();
    createGame.mockRejectedValueOnce(new Error('fixture write failure'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await manager.start(lobby.id, player.uid)).ok).toBe(false);
    expect((await manager.start(lobby.id, player.uid)).ok).toBe(true);
    expect(createGame.mock.calls[1][0]).toEqual(createGame.mock.calls[0][0]);
  });
  it('does not start a player who left while eligibility was being checked', async () => {
    const { manager, lobby, createGame } = await setup();
    let resolve!: (user: typeof newUser) => void;
    lookup.mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const starting = manager.start(lobby.id, player.uid);
    manager.leave(lobby.id, player.uid);
    resolve(newUser);
    expect((await starting).ok).toBe(false);
    expect(createGame).not.toHaveBeenCalled();
    expect(lobby.members.has(player.uid)).toBe(false);
  });
  it('preserves established ratings and does not add a new start failure on eligibility lookup failure', async () => {
    const ordinary = await setup();
    lookup.mockResolvedValueOnce({ ...newUser, wins: 3 });
    expect((await ordinary.manager.start(ordinary.lobby.id, player.uid)).ok).toBe(true);
    const fallback = await setup();
    lookup.mockRejectedValueOnce(new Error('offline fixture'));
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await fallback.manager.start(fallback.lobby.id, player.uid)).ok).toBe(true);
    expect(fallback.createGame.mock.calls[0][0]).toEqual(ordinary.createGame.mock.calls[0][0]);
  });
});
describe('newcomer cutoff and tier floor', () => {
  it('counts finished saved matches across modes, independent of guest claim and copied history', async () => {
    lookup.mockResolvedValueOnce({ ...newUser, participations: [{ gameId: 8 }, { gameId: 9 }] });
    expect(await isNewcomer(1)).toBe(true);
    expect(lookup.mock.calls[0][0].select?.participations).toEqual({
      where: { game: { status: 'finished' } }, take: 3, select: { gameId: true },
    });
    lookup.mockResolvedValueOnce({ ...newUser, participations: [1, 2, 3] });
    expect(await isNewcomer(1)).toBe(false);
    lookup.mockResolvedValueOnce({ ...newUser, modeRatings: [
      { ...modeRating, trainingWins: 2 }, { ...modeRating, draws: 1 },
    ] });
    expect(await isNewcomer(1)).toBe(false);
    lookup.mockResolvedValueOnce({ ...newUser, modeRatings: [{ ...modeRating, carriedRating: 1325 }] });
    expect(await isNewcomer(1)).toBe(false);
  });
  it('drops exactly one engine tier, or does nothing at the floor', () => {
    for (const elo of [500, 699, 700, 899]) expect(newcomerOpponentRating(elo)).toBe(elo);
    for (const elo of [900, 1074, 1075, 1249, 1425, 2400, 2550]) {
      const adjusted = newcomerOpponentRating(elo);
      expect(effective(adjusted)).toBe(effective(elo) - 1);
      expect(adjusted).toBeLessThan(elo);
    }
  });
});
