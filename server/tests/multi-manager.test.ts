import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ratings/service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ratings/service.js')>()),
  loadPlayerRatings: vi.fn(async (players) => players),
  saveGameResult: vi.fn(async (game, result, reason) => {
    const { prisma } = await import('../src/prisma.js');
    await prisma.game.update({
      where: { id: game.id },
      data: { status: 'finished', result, reason },
    });
    return game.participants.map((p: { uid: number; ratingBefore: number }) => ({
      uid: p.uid,
      before: p.ratingBefore,
      after: p.ratingBefore,
    }));
  }),
}));

vi.mock('../src/prisma.js', () => ({
  prisma: {
    game: { create: vi.fn(), update: vi.fn() },
    gameMove: { create: vi.fn() },
    gameParticipant: { update: vi.fn() },
    user: { update: vi.fn() },
    ratingHistory: { create: vi.fn() },
  },
}));

import { GamesManager } from '../src/game/manager.js';
import { prisma } from '../src/prisma.js';
import { MultiChess } from 'shared';

const player = (uid: number, isBot = false) => ({
  uid,
  username: `p${uid}`,
  rating: 1200,
  isBot,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  vi.mocked(prisma.game.create).mockResolvedValue({ id: 99 } as never);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('GamesManager multiplayer FFA modes', () => {
  it('enforces seat turn order, rejects out-of-turn moves, and continues after one player resigns', async () => {
    const m = new GamesManager();
    const id = await m.createGame({
      mode: 'four-player',
      timeControl: { kind: 'clock', baseMin: 5, incSec: 3 },
      team1: [],
      team2: [],
      seats: [player(1), player(2), player(3), player(4)],
    });

    const g = m.getActive(id)!;
    expect(g.engine).toBeInstanceOf(MultiChess);
    expect(m.toGameState(g).turnUserIds).toEqual([1]);

    // Player 2 cannot move on seat 0's turn
    expect((await m.applyMultiMove(id, 2, { from: 'b7', to: 'd7' })).ok).toBe(false);

    // Player 1 makes a legal move
    expect(await m.applyMultiMove(id, 1, { from: 'g2', to: 'g4' })).toEqual({ ok: true });
    expect(m.toGameState(g).turnUserIds).toEqual([2]);

    // Player 2 resigns -> game continues for the remaining 3 players, turn advances to Player 3
    await m.resign(id, 2);
    expect(g.status).toBe('active');
    expect((g.engine as MultiChess).seatStatus(1)).toBe('resigned');
    expect(m.toGameState(g).turnUserIds).toEqual([3]);
    // Resigned player is no longer blocked by activeGameOf and can join a new table
    expect(m.activeGameOf(2)).toBeNull();
    expect(m.activeGameOf(3)).toBe(id);
  });

  it('enforces 5-minute per-turn limit when timeControl is none and eliminates AFK player after 5 minutes', async () => {
    const m = new GamesManager();
    const id = await m.createGame({
      mode: 'four-player',
      timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
      team1: [],
      team2: [],
      seats: [player(1), player(2), player(3), player(4)],
    });

    // Player 1 makes the first move within 30s -> starts 5-minute turn timer for Player 2
    expect(await m.applyMultiMove(id, 1, { from: 'g2', to: 'g4' })).toEqual({ ok: true });
    const g = m.getActive(id)!;
    expect(m.toGameState(g).multi?.clocksMs[1]).toBe(5 * 60_000);

    // Advance 5 minutes + 1s -> Player 2 times out and is eliminated, turn passes to Player 3 with fresh 5 minutes
    await vi.advanceTimersByTimeAsync(5 * 60_000 + 1000);
    await m.checkFlags();
    expect((g.engine as MultiChess).seatStatus(1)).toBe('timeout');
    expect(m.activeGameOf(2)).toBeNull();
    expect(m.toGameState(g).turnUserIds).toEqual([3]);
    expect(m.toGameState(g).multi?.clocksMs[2]).toBeGreaterThan(4 * 60_000);
  });

  it('rolls back board and clocks if prisma.gameMove.create fails', async () => {
    const m = new GamesManager();
    const id = await m.createGame({
      mode: 'three-player',
      timeControl: { kind: 'clock', baseMin: 5, incSec: 3 },
      team1: [],
      team2: [],
      seats: [player(1), player(2), player(3)],
    });
    const g = m.getActive(id)!;
    const before = (g.engine as MultiChess).snapshot();
    vi.mocked(prisma.gameMove.create).mockRejectedValueOnce(new Error('DB write error'));

    const res = await m.applyMultiMove(id, 1, { from: '0e2', to: '0e4' });
    expect(res.ok).toBe(false);
    expect((g.engine as MultiChess).snapshot()).toEqual(before);
    expect(g.ply).toBe(0);
  });

  it('triggers AI bot move automatically on bot seat turn', async () => {
    const m = new GamesManager();
    const id = await m.createGame({
      mode: 'three-player',
      timeControl: { kind: 'clock', baseMin: 5, incSec: 3 },
      team1: [],
      team2: [],
      seats: [player(1, false), player(2, true), player(3, false)],
    });

    expect(await m.applyMultiMove(id, 1, { from: '0e2', to: '0e4' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1500);
    const g = m.getActive(id)!;
    expect(g.ply).toBe(2);
    expect(m.toGameState(g).turnUserIds).toEqual([3]);
  });
});

describe('GamesManager Double Chess teams', () => {
  it('keeps allies in seats 0/2 and 1/3 and saves one shared result', async () => {
    const m = new GamesManager();
    const id = await m.createGame({ mode: 'double', timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
      team1: [player(1), player(3)], team2: [player(2), player(4)] });
    const g = m.getActive(id)!;
    expect(g.ratingKind).toBe('rated');
    expect(g.participants.map(p => [p.uid, p.seat, p.team, p.multiColor])).toEqual([
      [1, 0, 1, 'yellow'], [2, 1, 2, 'green'], [3, 2, 1, 'red'], [4, 3, 2, 'blue'],
    ]);
    expect(await m.applyMultiMove(id, 1, { from: 'm2', to: 'm4' })).toEqual({ ok: true });
    expect(m.toGameState(g).turnUserIds).toEqual([2]);
    await m.resign(id, 3);
    expect(g).toMatchObject({ status: 'finished', result: '0-1', reason: 'resign' });
    expect(g.participants.every(p => p.score === undefined && p.place === undefined)).toBe(true);
    expect(prisma.game.update).toHaveBeenCalledTimes(1);
  });

  it('makes a flag end the match for both teammates', async () => {
    const m = new GamesManager();
    const id = await m.createGame({ mode: 'double', timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
      team1: [player(1), player(3)], team2: [player(2), player(4)] });
    await m.applyMultiMove(id, 1, { from: 'm2', to: 'm4' });
    await vi.advanceTimersByTimeAsync(301_000);
    await m.checkFlags();
    expect(m.getActive(id)).toMatchObject({ status: 'finished', result: '1-0', reason: 'timeout' });
  });
});
