import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CrazyhouseGame } from 'shared/crazyhouse';
vi.mock('../src/ai/engine.js', () => ({ chooseBotMove: vi.fn(), getBotThinkingDelayMs: () => 1 }));
vi.mock('../src/ai/crazyhouse.js', () => ({ chooseCrazyhouseMove: vi.fn() }));
vi.mock('../src/prisma.js', () => ({ prisma: { game: { create: vi.fn(), update: vi.fn() }, gameMove: { create: vi.fn() }, gameParticipant: { update: vi.fn() }, user: { update: vi.fn() }, ratingHistory: { create: vi.fn() } } }));
import { GamesManager } from '../src/game/manager.js';
import { prisma } from '../src/prisma.js';
import { chooseCrazyhouseMove } from '../src/ai/crazyhouse.js';
const player = (uid: number) => ({ uid, username: `p${uid}`, rating: 1200 });
const setup = { mode: 'crazyhouse' as const, timeControl: { kind: 'none' as const, baseMin: 0, incSec: 0 }, team1: [player(1)], team2: [player(3)] };
beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); vi.mocked(prisma.game.create).mockResolvedValue({ id: 42 } as never); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });
describe('Crazyhouse manager', () => {
  it.each(['crazyhouse', 'crazyhouse-team'] as const)('plays capture → own reserve → drop with correct participants in %s', async mode => {
    const m = new GamesManager(); const id = await m.createGame({ ...setup, mode, ...(mode === 'crazyhouse-team' ? { team1: [player(1), player(2)], team2: [player(3), player(4)] } : {}) });
    const g = m.getActive(id)!;
    expect(m.toGameState(g).fens).toHaveLength(1); expect(m.toGameState(g).pockets).toHaveLength(mode === 'crazyhouse' ? 2 : 4);
    expect((await m.applyMove(id, 1, { boardIndex: 1, from: 'e2', to: 'e4' })).ok).toBe(false);
    for (const [uid, from, to] of [[1, 'e2', 'e4'], [3, 'd7', 'd5'], [mode === 'crazyhouse' ? 1 : 2, 'e4', 'd5'], [mode === 'crazyhouse' ? 3 : 4, 'd8', 'd5']] as const) expect(await m.applyMove(id, uid, { boardIndex: 0, from, to })).toEqual({ ok: true });
    expect(m.toGameState(g).legalDrops?.[0].p).toContain('e4');
    if (mode === 'crazyhouse-team') expect((await m.applyMove(id, 2, { boardIndex: 0, from: '-', to: 'e4', dropPiece: 'p' })).ok).toBe(false);
    expect(await m.applyMove(id, 1, { boardIndex: 0, from: '-', to: 'e4', dropPiece: 'p' })).toEqual({ ok: true });
    expect(g.ply).toBe(5); expect(m.toGameState(g).pockets?.[0].p).toBe(0);
    expect(vi.mocked(prisma.gameMove.create).mock.calls.map(([args]) => args.data.ply)).toEqual([1, 2, 3, 4, 5]);
  });
  it('rolls back reserve, repetition and team turn order if saving fails', async () => {
    const m = new GamesManager(); const id = await m.createGame({ ...setup, mode: 'crazyhouse-team', team1: [player(1), player(2)], team2: [player(3), player(4)] });
    const before = (m.getActive(id)!.engine as CrazyhouseGame).snapshot();
    vi.mocked(prisma.gameMove.create).mockRejectedValueOnce(new Error('database failed'));
    expect((await m.applyMove(id, 1, { boardIndex: 0, from: 'e2', to: 'e4' })).ok).toBe(false);
    expect(m.getActive(id)!.engine).toBeInstanceOf(CrazyhouseGame); expect((m.getActive(id)!.engine as CrazyhouseGame).snapshot()).toEqual(before);
    expect(m.toGameState(m.getActive(id)!).turnUserIds).toEqual([1]);
  });
  it('a scheduled bot really captures a knight and then drops that knight after the human reply', async () => {
    const m = new GamesManager(); const id = await m.createGame({ ...setup, team2: [{ ...player(3), isBot: true }] });
    const g = m.getActive(id)!; g.engine = new CrazyhouseGame(false, '4k3/8/8/8/8/8/N7/r3K3 b - - 0 1');
    vi.mocked(chooseCrazyhouseMove).mockResolvedValueOnce({ board: 0, from: 'a1', to: 'a2' }).mockResolvedValueOnce({ board: 0, piece: 'n', to: 'e4' });
    m.triggerBotTurn(id); m.triggerBotTurn(id); await vi.advanceTimersByTimeAsync(1300);
    expect(chooseCrazyhouseMove).toHaveBeenCalledTimes(1); expect((g.engine as CrazyhouseGame).pocketOf(0, 'b').n).toBe(1);
    await vi.advanceTimersByTimeAsync(30_000); expect(g.ply).toBe(1);
    expect(await m.applyMove(id, 1, { boardIndex: 0, from: 'e1', to: 'f1' })).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(1300);
    expect((g.engine as CrazyhouseGame).boards[0].get('e4')).toEqual({ color: 'b', type: 'n' });
    expect((g.engine as CrazyhouseGame).pocketOf(0, 'b').n).toBe(0); expect(g.ply).toBe(3);
    expect(vi.mocked(prisma.gameMove.create).mock.calls.at(-1)?.[0].data.dropPiece).toBe('n');
    await m.resign(id, 1); await vi.advanceTimersByTimeAsync(5000); expect(g.ply).toBe(3);
  });
  it('draws on stalemate; kings alone and a high halfmove count do not end Crazyhouse', async () => {
    const m = new GamesManager(); const id = await m.createGame(setup); const g = m.getActive(id)!;
    g.engine = new CrazyhouseGame(false, '7k/8/5KQ1/8/8/8/8/8 w - - 0 1');
    expect(await m.applyMove(id, 1, { boardIndex: 0, from: 'g6', to: 'f7' })).toEqual({ ok: true });
    expect(g.result).toBe('1/2-1/2'); expect(g.reason).toBe('stalemate');
    await m.createGame(setup); const next = m.getActive(id)!; next.engine = new CrazyhouseGame(false, '7k/8/8/8/8/8/8/K7 w - - 101 1');
    expect((await m.applyMove(id, 1, { boardIndex: 0, from: 'a1', to: 'a2' })).ok).toBe(true); expect(next.status).toBe('active');
  });
  it('broadcasts a finished position after mate instead of inviting a nonexistent next move', async () => {
    const m = new GamesManager(); const id = await m.createGame(setup); const g = m.getActive(id)!;
    g.engine = new CrazyhouseGame(false, '6rk/6pp/8/8/2B5/8/8/4K3 w - - 0 1');
    (g.engine as CrazyhouseGame).pocketOf(0, 'w').n = 1;
    const states: any[] = [];
    (m as any).io = { to: () => ({ emit: (event: string, value: any) => { if (event === 'game:state') states.push(value); } }) };
    expect((await m.applyMove(id, 1, { boardIndex: 0, from: '-', to: 'f7', dropPiece: 'n' })).ok).toBe(true);
    expect(states).toHaveLength(1); expect(states[0].status).toBe('finished'); expect(states[0].turnUserIds).toEqual([0]);
  });
});
