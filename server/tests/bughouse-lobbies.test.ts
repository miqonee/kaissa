import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/ratings/service.js', async importOriginal => ({ ...await importOriginal<typeof import('../src/ratings/service.js')>(), loadPlayerRatings: vi.fn(async players => players) }));
import { lobbyCapacity } from 'shared';
import { LobbiesManager } from '../src/lobby/lobbies.js';
import { prisma } from '../src/prisma.js';
const bots = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, username: `bot_${i}`, isBot: true, rating: 1200 }));
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(prisma.user, 'findMany').mockResolvedValue(bots as any); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Bughouse quick tables', () => {
  it('preserves rematch seats and strength, waits for the second human to be ready', async () => {
    const manager = new LobbiesManager();
    const players = [
      { uid: 1, username: 'first', rating: 1200, team: 1, seat: 0 },
      { uid: 2, username: 'second', rating: 1200, team: 2, seat: 0 },
      { uid: 100, username: 'bot_a', rating: 950, isBot: true, team: 1, seat: 2 },
      { uid: 101, username: 'bot_b', rating: 1300, isBot: true, team: 2, seat: 2 },
    ];
    const createGame = vi.fn().mockResolvedValue(90);
    (manager as any).games = { createGame, gameRoom: () => 'game:90', getActive: () => undefined };
    const result = await manager.rematch(1, players, { gameId: 89, mode: 'bughouse', timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
    const lobby = manager.getById(result!.lobbyId)!;
    expect(lobby.autoCountdown).toBeNull();
    manager.join(lobby, players[1]);
    expect((await manager.start(lobby.id, 1)).ok).toBe(false);
    manager.setReady(lobby.id, 2, true);
    expect((await manager.start(lobby.id, 1)).ok).toBe(true);
    const { team1, team2 } = createGame.mock.calls[0][0];
    expect(team1.map((p: any) => [p.uid, p.rating])).toEqual([[1, 1200], [100, 950]]);
    expect(team2.map((p: any) => [p.uid, p.rating])).toEqual([[2, 1200], [101, 1300]]);
  });
  it('cancels a solo rematch countdown when its human leaves', async () => {
    const manager = new LobbiesManager();
    const players = [{ uid: 1, username: 'human', rating: 1200 }, ...bots.slice(0, 3).map(p => ({ uid: p.id, username: p.username, rating: p.rating, isBot: true }))];
    const result = await manager.rematch(1, players, { gameId: 88, mode: 'bughouse', timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
    const lobby = manager.getById(result!.lobbyId)!;
    expect(lobby.autoCountdown).toBe(10);
    manager.leave(lobby.id, 1);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(manager.getById(lobby.id)).toBeUndefined();
  });
  it('starts a table only once when countdown and a manual start overlap', async () => {
    const manager = new LobbiesManager(); await manager.ensureAutoLobby();
    const lobby = manager.publicList().find(l => l.mode === 'bughouse')!;
    manager.join(lobby, { uid: 1, username: 'human', rating: 1200 });
    let release!: (id: number) => void;
    const createGame = vi.fn(() => new Promise<number>(r => { release = r; }));
    (manager as any).games = { createGame, gameRoom: () => 'game:99', getActive: () => undefined };
    const first = manager.start(lobby.id, 1);
    expect((await manager.start(lobby.id, 1)).ok).toBe(false);
    release(99); expect((await first).ok).toBe(true);
    expect(createGame).toHaveBeenCalledTimes(1);
  });
  it('creates exactly one table per mode even with concurrent creation requests', async () => {
    const manager = new LobbiesManager();
    await Promise.all([manager.ensureAutoLobby(), manager.ensureAutoLobby()]);
    const tables = manager.publicList();
    expect(tables).toHaveLength(4);
    expect(tables.find(l => l.mode === 'bughouse')?.timeControl).toEqual({ kind: 'none', baseMin: 0, incSec: 0 });
    expect(tables.find(l => l.mode === 'team')?.timeControl).toEqual({ kind: 'clock', baseMin: 3, incSec: 0 });
    expect(tables.every(l => l.members.size === lobbyCapacity(l.mode) && l.autoCountdown === null)).toBe(true);
  });
  it.each([1, 2, 3, 4])('starts with %i humans and bot-filled seats, creates a replacement and supports rematch', async count => {
    const manager = new LobbiesManager(); await manager.ensureAutoLobby();
    const lobby = manager.publicList().find(l => l.mode === 'bughouse')!;
    for (let i = 0; i < count; i++) {
      expect(manager.join(lobby, { uid: i + 1, username: `human_${i}`, rating: 1200 }).ok).toBe(true);
    }
    expect([...lobby.members.values()].filter(m => !m.isBot)).toHaveLength(count);
    expect(lobby.autoCountdown).toBe(10);
    const createGame = vi.fn().mockResolvedValue(55);
    (manager as any).games = { createGame, gameRoom: () => 'game:55', getActive: () => undefined };
    expect(await manager.start(lobby.id, 1)).toEqual({ ok: true, gameId: 55 });
    await manager.ensureAutoLobby();
    expect(manager.publicList().filter(l => l.mode === 'bughouse')).toHaveLength(1);
    const { team1, team2 } = createGame.mock.calls[0][0];
    const players = [...team1, ...team2];
    expect(players.filter(p => p.isBot)).toHaveLength(4 - count);
    const rematch = await manager.rematch(1, players, { gameId: 55, mode: 'bughouse', timeControl: lobby.timeControl });
    expect(rematch).not.toBeNull();
    const table = manager.getById(rematch!.lobbyId)!;
    expect([...table.members.values()].filter(m => m.isBot)).toHaveLength(4 - count);
    expect(table.timeControl).toEqual(lobby.timeControl);
    expect(table.autoCountdown).toBe(count === 1 ? 10 : null);
  });
});
