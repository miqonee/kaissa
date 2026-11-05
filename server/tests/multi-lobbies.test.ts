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
  it('creates auto lobbies for four-player (capacity 4) and three-player (capacity 3) with mandatory clocks', async () => {
    const m = new LobbiesManager();
    await m.ensureAutoLobby();
    const list = m.publicList();
    const four = list.find((l) => l.mode === 'four-player' && l.isAuto);
    const three = list.find((l) => l.mode === 'three-player' && l.isAuto);

    expect(four).toBeDefined();
    expect(four!.members.size).toBe(4);
    expect(four!.timeControl.kind).toBe('clock');

    expect(three).toBeDefined();
    expect(three!.members.size).toBe(3);
    expect(three!.timeControl.kind).toBe('clock');
  });

  it('switches a quick lobby to three-player, resizes bots to 3, and enforces clock time control', async () => {
    const m = new LobbiesManager();
    await m.ensureAutoLobby();
    const l = m.publicList().find((x) => x.mode === 'bughouse' && x.isAuto)!;
    m.join(l, { uid: 1, username: 'human', rating: 1200 });
    expect(l.timeControl.kind).toBe('none');

    expect(await m.setMode(l.id, 1, 'three-player')).toEqual({ ok: true });
    expect(l.members.size).toBe(3);
    expect(l.timeControl.kind).toBe('clock');

    // Disallows setting timeControl to kind: 'none' in multiplayer
    m.setTimeControl(l.id, 1, { kind: 'none', baseMin: 0, incSec: 0 });
    expect(l.timeControl.kind).toBe('clock');
  });
});
