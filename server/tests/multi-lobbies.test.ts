import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/ratings/service.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/ratings/service.js')>()),
  loadPlayerRatings: vi.fn(async (players) => players),
}));

import { LobbiesManager } from '../src/lobby/lobbies.js';
import { prisma } from '../src/prisma.js';

const bots = Array.from({ length: 6 }, (_, i) => ({
  id: 200 + i,
  username: `bot_${i}`,
  isBot: true,
  rating: 1200,
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(prisma.user, 'findMany').mockResolvedValue(bots as any);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Multiplayer lobbies (four-player and three-player)', () => {
  it('preserves Double Chess partners and seat order on rematch', async () => {
    const m = new LobbiesManager();
    const players = [
      { uid: 1, username: 'one', rating: 1200, team: 1, seat: 0 },
      { uid: 2, username: 'two', rating: 1200, team: 2, seat: 1 },
      { uid: 200, username: 'bot_a', rating: 950, isBot: true, team: 1, seat: 2 },
      { uid: 201, username: 'bot_b', rating: 1300, isBot: true, team: 2, seat: 3 },
    ];
    const createGame = vi.fn().mockResolvedValue(90);
    (m as any).games = { createGame, gameRoom: () => 'game:90', getActive: () => undefined };
    const rematch = await m.rematch(1, players, { gameId: 89, mode: 'double', timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
    const lobby = m.getById(rematch!.lobbyId)!;
    m.join(lobby, players[1]);
    m.setReady(lobby.id, 2, true);
    expect((await m.start(lobby.id, 1)).ok).toBe(true);
    expect(createGame.mock.calls[0][0].seats.map((p: any) => [p.uid, p.rating])).toEqual([[1, 1200], [2, 1200], [200, 950], [201, 1300]]);
  });
  it('creates auto lobbies for four-player (capacity 4) and three-player (capacity 3) with default no-clock (5 min per move limit)', async () => {
    const m = new LobbiesManager();
    await m.ensureAutoLobby();
    const list = m.publicList();
    const four = list.find((l) => l.mode === 'four-player' && l.isAuto);
    const three = list.find((l) => l.mode === 'three-player' && l.isAuto);

    expect(four).toBeDefined();
    expect(four!.members.size).toBe(4);
    expect(four!.timeControl.kind).toBe('none');

    expect(three).toBeDefined();
    expect(three!.members.size).toBe(3);
    expect(three!.timeControl.kind).toBe('none');
  });

  it('switches a quick lobby to three-player, resizes bots to 3, and allows both none and clock time controls', async () => {
    const m = new LobbiesManager();
    await m.ensureAutoLobby();
    const l = m.publicList().find((x) => x.mode === 'bughouse' && x.isAuto)!;
    m.join(l, { uid: 1, username: 'human', rating: 1200 });
    expect(l.timeControl.kind).toBe('none');

    expect(await m.setMode(l.id, 1, 'three-player')).toEqual({ ok: true });
    expect(l.members.size).toBe(3);
    expect(l.timeControl.kind).toBe('none');

    // Allows switching between clock and none in multiplayer
    m.setTimeControl(l.id, 1, { kind: 'clock', baseMin: 5, incSec: 3 });
    expect(l.timeControl.kind).toBe('clock');
    m.setTimeControl(l.id, 1, { kind: 'none', baseMin: 0, incSec: 0 });
    expect(l.timeControl.kind).toBe('none');
  });
});
