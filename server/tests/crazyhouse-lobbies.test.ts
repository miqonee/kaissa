import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/ratings/service.js', async importOriginal => ({ ...await importOriginal<typeof import('../src/ratings/service.js')>(), loadPlayerRatings: vi.fn(async players => players) }));
import { LobbiesManager } from '../src/lobby/lobbies.js';
import { prisma } from '../src/prisma.js';
const bots = Array.from({ length: 6 }, (_, i) => ({ id: 100 + i, username: `bot_${i}`, isBot: true, rating: 1200 }));
beforeEach(() => { vi.useFakeTimers(); vi.spyOn(prisma.user, 'findMany').mockResolvedValue(bots as any); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('Crazyhouse lobbies and mode switch', () => {
  it('switches the existing quick lobby, resizes bots, restarts countdown and restores the default table', async () => {
    const m = new LobbiesManager(); await m.ensureAutoLobby(); const lobby = m.publicList().find(l => l.mode === 'team')!;
    m.join(lobby, { uid: 1, username: 'human', rating: 1200 });
    expect(await m.setMode(lobby.id, 1, 'crazyhouse')).toEqual({ ok: true });
    expect(lobby.members.size).toBe(2); expect(lobby.members.has(1)).toBe(true); expect(lobby.isQuick).toBe(true); expect(lobby.isAuto).toBe(false); expect(lobby.autoCountdown).toBe(10); expect(lobby.timeControl.kind).toBe('none');
    await m.ensureAutoLobby(); expect(m.publicList().filter(l => l.mode === 'team' && l.isAuto)).toHaveLength(1);
    expect((await m.setMode(lobby.id, 1, 'crazyhouse-team')).ok).toBe(true); expect(lobby.members.size).toBe(4);
    const createGame = vi.fn().mockResolvedValue(77); (m as any).games = { createGame, gameRoom: () => 'game:77', getActive: () => undefined };
    expect((await m.setMode(lobby.id, 1, 'crazyhouse')).ok).toBe(true); expect((await m.start(lobby.id, 1)).ok).toBe(true);
    const opts = createGame.mock.calls[0][0]; expect(opts.team1).toHaveLength(1); expect(opts.team2).toHaveLength(1);
  });
  it('does not evict people or let a non-host change the mode', async () => {
    const m = new LobbiesManager(); await m.ensureAutoLobby(); const l = m.publicList().find(l => l.mode === 'team')!;
    for (let uid = 1; uid <= 3; uid++) m.join(l, { uid, username: `h${uid}`, rating: 1200 });
    const before = l.summary(); expect((await m.setMode(l.id, 1, 'crazyhouse')).ok).toBe(false); expect(l.summary()).toEqual(before);
    expect((await m.setMode(l.id, 2, 'bughouse')).ok).toBe(false); expect(l.mode).toBe('team');
  });
  it('starts a 1v1 rematch with exactly the same two seats and strength', async () => {
    const m = new LobbiesManager(); const createGame = vi.fn().mockResolvedValue(78); (m as any).games = { createGame, gameRoom: () => 'game:78', getActive: () => undefined };
    const rematch = await m.rematch(1, [{ uid: 1, username: 'human', rating: 1200, team: 2, seat: 0 }, { uid: 100, username: 'bot', rating: 950, isBot: true, team: 1, seat: 0 }], { gameId: 77, mode: 'crazyhouse', timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
    const l = m.getById(rematch!.lobbyId)!; expect(l.members.size).toBe(2); expect(l.autoCountdown).toBe(10);
    await vi.advanceTimersByTimeAsync(10_000); expect(createGame).toHaveBeenCalledTimes(1);
    expect(createGame.mock.calls[0][0].team1[0]).toMatchObject({ uid: 100, rating: 950 }); expect(createGame.mock.calls[0][0].team2[0].uid).toBe(1);
  });
  it('preserves Wait when editing settings and closes a switched quick table after its last human leaves', async () => {
    const m = new LobbiesManager(); await m.ensureAutoLobby(); const l = m.publicList().find(l => l.mode === 'team')!;
    m.join(l, { uid: 1, username: 'human', rating: 1200 }); m.pauseToggle(l.id, 1);
    expect(l.isPaused).toBe(true); await m.setMode(l.id, 1, 'crazyhouse');
    expect(l.isPaused).toBe(true); expect(l.pausedBy.has(1)).toBe(true);
    m.setTimeControl(l.id, 1, { kind: 'clock', baseMin: 5, incSec: 3 });
    expect(l.isPaused).toBe(true); await vi.advanceTimersByTimeAsync(20_000); expect(l.autoCountdown).toBe(10);
    m.leave(l.id, 1); expect(m.getById(l.id)).toBeUndefined();
  });
  it('rejects mode changes after a countdown starts the game while bots are loading', async () => {
    const m = new LobbiesManager(); await m.ensureAutoLobby(); const l = m.publicList().find(l => l.mode === 'team')!;
    m.join(l, { uid: 1, username: 'human', rating: 1200 });
    let release!: (value: any) => void;
    vi.mocked(prisma.user.findMany).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }) as any);
    const change = m.setMode(l.id, 1, 'crazyhouse'); l.started = true; release(bots);
    expect((await change).ok).toBe(false); expect(l.mode).toBe('team'); expect(l.members.size).toBe(4);
  });
});
