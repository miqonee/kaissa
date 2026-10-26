import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../src/ratings/service.js', async importOriginal => ({
  ...await importOriginal<typeof import('../src/ratings/service.js')>(),
  loadPlayerRatings: vi.fn(async players => players),
  saveGameResult: vi.fn(async (game, result, reason) => {
    const { prisma } = await import('../src/prisma.js');
    await prisma.game.update({ where: { id: game.id }, data: { status: 'finished', result, reason } });
    return game.participants.map((p: {uid:number; ratingBefore:number}) => ({uid:p.uid, before:p.ratingBefore, after:p.ratingBefore}));
  }),
}));
import { BughouseGame, type AnyMove } from 'shared/bughouse';
vi.mock('../src/ai/engine.js', () => ({ chooseBotMove: vi.fn(), getBotThinkingDelayMs: () => 1 }));
vi.mock('../src/ai/bughouse.js', () => ({ chooseBughouseMove: vi.fn(), bughouseThinkingDelay: () => 1 }));
vi.mock('../src/prisma.js', () => ({ prisma: {
  game: { create: vi.fn(), update: vi.fn() }, gameMove: { create: vi.fn() },
  gameParticipant: { update: vi.fn() }, user: { update: vi.fn() }, ratingHistory: { create: vi.fn() },
} }));
import { GamesManager } from '../src/game/manager.js';
import { prisma } from '../src/prisma.js';
import { chooseBughouseMove } from '../src/ai/bughouse.js';

const setups = { mode: 'bughouse' as const, timeControl: { kind: 'none' as const, baseMin: 0, incSec: 0 }, team1: [{ uid: 1, username: 'one', rating: 1200 }, { uid: 2, username: 'two', rating: 1200 }], team2: [{ uid: 3, username: 'three', rating: 1200 }, { uid: 4, username: 'four', rating: 1200 }] };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(prisma.game.create).mockResolvedValue({ id: 41 } as never); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('Bughouse manager concurrency', () => {
  it('serializes simultaneous board moves and persists matching, unique sequence numbers', async () => {
    const manager = new GamesManager();
    const id = await manager.createGame(setups);
    let release!: () => void;
    vi.mocked(prisma.gameMove.create).mockImplementationOnce(() => new Promise(resolve => { release = () => resolve({} as never); }) as never);
    const events: { event: string; data: any }[] = [];
    (manager as any).io = { to: () => ({ emit: (event: string, data: any) => events.push({ event, data }) }) };
    const first = manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' });
    const second = manager.applyMove(id, 4, { boardIndex: 1, from: 'd2', to: 'd4' });
    await Promise.resolve(); await Promise.resolve();
    expect(prisma.gameMove.create).toHaveBeenCalledTimes(1);
    expect((manager.getActive(id)!.engine as BughouseGame).turn(1)).toBe('w');
    release();
    expect(await Promise.all([first, second])).toEqual([{ ok: true }, { ok: true }]);
    expect(vi.mocked(prisma.gameMove.create).mock.calls.map(([args]) => args.data.ply)).toEqual([1, 2]);
    expect(events.filter(e => e.event === 'game:move').map(e => e.data.ply)).toEqual([1, 2]);
  });
  it('rolls back a move, pockets and clocks if persistence fails', async () => {
    const manager = new GamesManager(); const id = await manager.createGame(setups);
    const before = (manager.getActive(id)!.engine as BughouseGame).snapshot();
    vi.mocked(prisma.gameMove.create).mockRejectedValueOnce(new Error('write failed'));
    expect((await manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' })).ok).toBe(false);
    expect((manager.getActive(id)!.engine as BughouseGame).snapshot()).toEqual(before);
    expect(manager.getActive(id)!.ply).toBe(0);
    expect(manager.getActive(id)!.boardsStarted).toEqual([false, false]);
  });
  it('finishes once on a flag and never applies a late move', async () => {
    const manager = new GamesManager(); const id = await manager.createGame({ ...setups, timeControl: { kind: 'clock', baseMin: 5, incSec: 3 } });
    const game = manager.getActive(id)!; game.clocks[0] = { ...game.clocks[0], whiteMs: 0, active: 'w', sinceMs: Date.now() - 1000 };
    const result = await manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' });
    await Promise.all([manager.checkFlags(), manager.resign(id, 3)]);
    expect(result.ok).toBe(false); expect(game.reason).toBe('timeout');
    expect(prisma.game.update).toHaveBeenCalledTimes(1); expect(prisma.gameMove.create).not.toHaveBeenCalled();
  });
  it('discards an in-flight bot decision after a partner capture changes its pocket, then reschedules', async () => {
    const manager = new GamesManager();
    let resolve!: (move: AnyMove) => void;
    vi.mocked(chooseBughouseMove).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const id = await manager.createGame({ ...setups, team1: [{ ...setups.team1[0], isBot: true }, setups.team1[1]] });
    const game = manager.getActive(id)!;
    (game.engine as BughouseGame).boards[1].load('4k3/8/8/8/8/8/N7/r3K3 b - - 0 1');
    await vi.advanceTimersByTimeAsync(1);
    manager.triggerBotTurn(id); expect(chooseBughouseMove).toHaveBeenCalledTimes(1);
    expect(await manager.applyMove(id, 2, { boardIndex: 1, from: 'a1', to: 'a2' })).toEqual({ ok: true });
    resolve({ board: 0, from: 'e2', to: 'e4' });
    await vi.advanceTimersByTimeAsync(0);
    expect((game.engine as BughouseGame).turn(0)).toBe('w'); expect(game.ply).toBe(1);
    vi.mocked(chooseBughouseMove).mockResolvedValueOnce({ board: 0, from: 'e2', to: 'e4' });
    await vi.advanceTimersByTimeAsync(1);
    expect((game.engine as BughouseGame).turn(0)).toBe('b'); expect(game.ply).toBe(2);
  });
});

function withHumans(ids: number[]) {
  const convert = (p: typeof setups.team1[0]) => ({ ...p, isBot: !ids.includes(p.uid) });
  return { ...setups, team1: setups.team1.map(convert), team2: setups.team2.map(convert) };
}
function legalBot() {
  vi.mocked(chooseBughouseMove).mockImplementation(async (snapshot, board) => {
    const game = BughouseGame.fromSnapshot(snapshot);
    return game.legalMoves(board, game.turn(board))[0] ?? null;
  });
}

describe('Human-paced bughouse', () => {
  it('waits for white, plays two neighbouring plies per round and stops during a long human think', async () => {
    legalBot(); const manager = new GamesManager(); const id = await manager.createGame(withHumans([1]));
    expect(manager.toGameState(manager.getActive(id)!).botPacing).toMatchObject({ controlledBoard: 1, waiting: true, pauseAllowed: true });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(chooseBughouseMove).not.toHaveBeenCalled();
    expect(await manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(6000);
    expect(manager.getActive(id)!.ply).toBe(4);
    expect(manager.toGameState(manager.getActive(id)!).turnUserIds[0]).toBe(1);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(manager.getActive(id)!.ply).toBe(4);
  });
  it('opens correctly for a human playing black, then waits', async () => {
    legalBot(); const manager = new GamesManager(); const id = await manager.createGame(withHumans([3]));
    await vi.advanceTimersByTimeAsync(6000);
    expect(manager.getActive(id)!.ply).toBe(2);
    expect(manager.toGameState(manager.getActive(id)!).turnUserIds[0]).toBe(3);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getActive(id)!.ply).toBe(2);
    expect(await manager.applyMove(id, 3, { boardIndex: 0, from: 'e7', to: 'e5' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(6000);
    expect(manager.getActive(id)!.ply).toBe(6);
  });
  it('also paces two human opponents and caps a backlog at two bot moves', async () => {
    legalBot(); const manager = new GamesManager(); const id = await manager.createGame(withHumans([1, 3]));
    expect((await manager.setPaused(id, 1, true)).ok).toBe(false);
    expect((await manager.applyMove(id, 4, { boardIndex: 1, from: 'e2', to: 'e4' })).ok).toBe(false);
    for (const [uid, from, to] of [[1, 'e2', 'e4'], [3, 'e7', 'e5'], [1, 'd2', 'd4'], [3, 'd7', 'd5']] as const) {
      expect((await manager.applyMove(id, uid, { boardIndex: 0, from, to })).ok).toBe(true);
    }
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getActive(id)!.ply).toBe(6);
    expect(chooseBughouseMove).toHaveBeenCalledTimes(2);
  });
  it('does not spend credits on an invalid move or persistence failure', async () => {
    const manager = new GamesManager(); const id = await manager.createGame(withHumans([1, 3]));
    await manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' });
    const before = manager.getActive(id)!.pacing!.credits;
    expect((await manager.applyMove(id, 4, { boardIndex: 1, from: 'e2', to: 'e9' })).ok).toBe(false);
    vi.mocked(prisma.gameMove.create).mockRejectedValueOnce(new Error('offline'));
    expect((await manager.applyMove(id, 4, { boardIndex: 1, from: 'e2', to: 'e4' })).ok).toBe(false);
    expect(manager.getActive(id)!.pacing!.credits).toBe(before);
    expect((await manager.applyMove(id, 4, { boardIndex: 1, from: 'e2', to: 'e4' })).ok).toBe(true);
    expect(manager.getActive(id)!.pacing!.credits).toBe(0);
  });
  it('rejects a pre-pause calculation even after resume and does not duplicate it', async () => {
    legalBot(); let resolve!: (move: AnyMove) => void;
    vi.mocked(chooseBughouseMove).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const manager = new GamesManager(); const id = await manager.createGame(withHumans([3]));
    await vi.advanceTimersByTimeAsync(1200);
    expect(chooseBughouseMove).toHaveBeenCalledTimes(1);
    expect((await manager.setPaused(id, 99, true)).ok).toBe(false);
    expect((await manager.setPaused(id, 1, true)).ok).toBe(false);
    expect((await manager.setPaused(id, 3, true)).ok).toBe(true);
    expect((await manager.applyMove(id, 3, { boardIndex: 0, from: 'e7', to: 'e5' })).ok).toBe(false);
    expect((await manager.setPaused(id, 3, false)).ok).toBe(true);
    manager.triggerBotTurn(id);
    expect(chooseBughouseMove).toHaveBeenCalledTimes(1);
    resolve({ board: 0, from: 'e2', to: 'e4' });
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.getActive(id)!.ply).toBe(0);
    await vi.advanceTimersByTimeAsync(6000);
    expect(manager.getActive(id)!.ply).toBe(2);
  });
  it('pauses on disconnect, stays paused after reconnect and resumes only on request', async () => {
    legalBot(); const manager = new GamesManager(); const id = await manager.createGame(withHumans([1]));
    await manager.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' });
    manager.onPlayerDisconnect(id, 1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getActive(id)!.ply).toBe(1);
    manager.onPlayerReconnect(id, 1);
    expect(manager.toGameState(manager.getActive(id)!).botPacing?.paused).toBe(true);
    expect((await manager.setPaused(id, 1, false)).ok).toBe(true);
    await vi.advanceTimersByTimeAsync(6000);
    expect(manager.getActive(id)!.ply).toBe(4);
    await manager.resign(id, 1);
    const ply = manager.getActive(id)!.ply;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(manager.getActive(id)!.ply).toBe(ply);
  });
  it('leaves timed games, people on both boards and demonstrations independent', async () => {
    const manager = new GamesManager();
    const id = await manager.createGame({ ...withHumans([1]), timeControl: { kind: 'clock', baseMin: 5, incSec: 3 } });
    expect(manager.toGameState(manager.getActive(id)!).botPacing).toBeUndefined(); manager.cancelBotTimers(id);
    const independent = new GamesManager();
    const independentId = await independent.createGame(withHumans([1, 2]));
    expect(independent.toGameState(independent.getActive(independentId)!).botPacing).toBeUndefined(); independent.cancelBotTimers(independentId);
    const demo = await manager.createGame({ ...withHumans([]), isDemo: true, fixedId: -1 });
    expect(manager.toGameState(manager.getActive(demo)!).botPacing).toBeUndefined();
    expect(manager.getActive(id)).toBeDefined();
  });
  it('does not delete a newer demo when the old instance cleanup fires', async () => {
    const manager = new GamesManager();
    const opts = { ...withHumans([]), isDemo: true, fixedId: -1 };
    await manager.createGame(opts); await manager.resign(-1, 1);
    await manager.createGame(opts); manager.cancelBotTimers(-1);
    const next = manager.getActive(-1);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(manager.getActive(-1)).toBe(next);
    expect(next!.status).toBe('active');
  });
});

describe('Result persistence failures', () => {
  it('freezes play and retries the same result without abandoning the game', async () => {
    const { saveGameResult } = await import('../src/ratings/service.js');
    const manager = new GamesManager(); const id = await manager.createGame(setups);
    vi.mocked(saveGameResult).mockRejectedValueOnce(new Error('database offline'));
    await manager.resign(id, 1);
    const game = manager.getActive(id)!;
    expect(game.status).toBe('active');
    expect(game.pendingFinish?.reason).toBe('resign');
    expect((await manager.applyMove(id, 1, {boardIndex:0,from:'e2',to:'e4'})).ok).toBe(false);
    await manager.abortUnrated(game);
    expect(game.status).toBe('active');
    await manager.checkFlags();
    expect(game.status).toBe('finished');
    expect(game.result).toBe('0-1');
    expect(saveGameResult).toHaveBeenCalledTimes(2);
    await manager.checkFlags();
    expect(saveGameResult).toHaveBeenCalledTimes(2);
  });
});

describe('One active match per human', () => {
  it('reserves participants during creation and rejects a second concurrent match', async () => {
    const manager = new GamesManager();
    const results = await Promise.allSettled([manager.createGame(setups), manager.createGame(setups)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(r => r.status === 'rejected')).toHaveLength(1);
    expect(prisma.game.create).toHaveBeenCalledTimes(1);
  });
});


describe('Disconnect and first move after persistence failure', () => {
  it('does not count a rejected first move on a human board as played', async () => {
    const manager = new GamesManager(); const id = await manager.createGame(withHumans([1]));
    const game = manager.getActive(id)!;
    // The other board has moved; the human board still has not.
    game.ply = 1; game.boardsStarted[1] = true;
    vi.mocked(prisma.gameMove.create).mockRejectedValueOnce(new Error('disk unavailable'));
    await manager.applyMove(id,1,{boardIndex:0,from:'e2',to:'e4'});
    expect(game.boardsStarted).toEqual([false,true]);
    expect(manager.isFirstMovePending(game)).toBe(true);
  });
  it('abandons a timed bot game when its only human has disconnected', async () => {
    const manager = new GamesManager(); const id = await manager.createGame({...withHumans([1]),timeControl:{kind:'clock',baseMin:3,incSec:0}});
    await manager.applyMove(id,1,{boardIndex:0,from:'e2',to:'e4'});
    manager.onPlayerDisconnect(id,1);
    await vi.advanceTimersByTimeAsync(0);
    expect(manager.getActive(id)!.status).toBe('abandoned');
  });
});
