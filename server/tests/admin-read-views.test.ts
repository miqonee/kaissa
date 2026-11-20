import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  user: { count: vi.fn(), findMany: vi.fn() },
  game: { count: vi.fn(), findMany: vi.fn() },
  gameMove: { count: vi.fn() },
  gameParticipant: { findMany: vi.fn() },
}));
const runtime = vi.hoisted(() => ({ getActive: vi.fn(), activeGameOf: vi.fn() }));
vi.mock('../src/prisma.js', () => ({ prisma: db }));
vi.mock('../src/state.js', () => ({ gamesManager: runtime }));
vi.mock('../src/socket/presence.js', () => ({ presence: { onlineUids: () => [2] } }));
vi.mock('../src/auth/auth.js', () => ({
  currentUser: vi.fn(),
  requireAdmin: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers['x-test-admin'] !== 'yes') return res.status(403).json({ error: 'Forbidden' });
    next();
  },
}));
import { BOT_LEVELS, BOT_PERSONALITIES } from 'shared';
import { adminRouter } from '../src/admin/adminRouter.js';

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use('/api/admin', adminRouter);
  app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => res.status(500).json({ error: 'Failed' }));
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/admin`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => {
  vi.resetAllMocks();
  db.$queryRaw.mockResolvedValue([{
    started: 0n, finished: 0n, active: 0n, abandoned: 0n,
    abandonedWithMoves: 0n, abandonedWithoutMoves: 0n, recordedMoves: 0n, distinctHumanMovers: 0n,
  }]);
  db.user.count.mockResolvedValue(0); db.user.findMany.mockResolvedValue([]);
  db.game.count.mockResolvedValue(0); db.game.findMany.mockResolvedValue([]);
  db.gameMove.count.mockResolvedValue(0); db.gameParticipant.findMany.mockResolvedValue([]);
  runtime.getActive.mockReturnValue(undefined); runtime.activeGameOf.mockReturnValue(null);
});
function get(path: string) { return fetch(url + path, { headers: { 'x-test-admin': 'yes' } }); }

describe('Read-only admin views', () => {
  it.each(['/users/search', '/games', '/metrics?scope=overview'])('requires admin before querying %s', async path => {
    expect((await fetch(url + path)).status).toBe(403);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.game.findMany).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('loads bounded overview metrics without reading the bot archive or all users', async () => {
    db.user.count.mockResolvedValueOnce(30).mockResolvedValueOnce(1);
    // Stored totals can include rows whose recorded start is later than asOf.
    db.game.count.mockResolvedValue(501);
    db.gameMove.count.mockResolvedValue(3001);
    db.$queryRaw.mockResolvedValue([{
      started: 500n, finished: 400n, active: 10n, abandoned: 90n,
      abandonedWithMoves: 12n, abandonedWithoutMoves: 78n, recordedMoves: 3000n, distinctHumanMovers: 25n,
    }]);
    const response = await get('/metrics?scope=overview');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ totalUsers: 30, onlineUsers: 1, totalGames: 501, totalMoves: 3001, botMetrics: [],
      activity: { period: 'all', from: null, started: 500, finished: 400, active: 10, abandoned: 90,
        abandonedWithMoves: 12, abandonedWithoutMoves: 78, recordedMoves: 3000, distinctHumanMovers: 25 },
    });
    expect(db.$queryRaw.mock.calls[0][0].values).toHaveLength(1);
    expect(db.game.findMany.mock.calls[0][0].take).toBe(200);
    expect(db.gameParticipant.findMany).not.toHaveBeenCalled();
    expect(db.user.findMany).not.toHaveBeenCalled();
  });
  it.each(['7', '30'])('uses a rolling %s day started-at cohort without replacing legacy totals', async period => {
    db.game.count.mockResolvedValue(500);
    db.gameMove.count.mockResolvedValue(3000);
    const response = await get('/metrics?scope=overview&period=' + period);
    const data = await response.json() as { activity: { from: string; asOf: string } };
    expect(data).toMatchObject({ totalGames: 500, totalMoves: 3000, activity: { period, started: 0, recordedMoves: 0 } });
    const { from, asOf } = data.activity;
    expect(Date.parse(asOf) - Date.parse(from)).toBe(Number(period) * 86_400_000);
    const sql = db.$queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual([new Date(asOf), new Date(from)]);
    expect(sql.sql).toContain('"startedAt" >=');
    expect(sql.sql).toContain('COUNT(DISTINCT m."userId")');
  });
  it('counts only classified finished bot seats in both level and personality metrics', async () => {
    const persona = Object.values(BOT_PERSONALITIES)[0];
    const level = BOT_LEVELS[0];
    const part = (status: string, result: string, place: number | null = null, reason: string | null = null) => ({
      team: 1, place, ratingBefore: level.nominalElo, user: { username: persona.username, botLevel: level.level },
      game: { status, result, reason, _count: { moves: 20 }, participants: [{ user: { isBot: false } }] },
    });
    db.gameParticipant.findMany.mockResolvedValue([
      part('finished', 'ffa', 1), part('finished', 'ffa', 3), part('finished', '*', null, 'stalemate'),
      part('finished', 'ffa'), part('finished', '*'), part('active', '*'), part('abandoned', '*'),
    ]);
    const response = await get('/metrics');
    expect(response.status).toBe(200);
    const payload = await response.json() as { botMetricsVsHuman: unknown[]; personalityMetricsVsHuman: unknown[] };
    const score = { totalGames: 3, wins: 1, losses: 1, draws: 1, winRate: 50 };
    expect(payload.botMetricsVsHuman).toContainEqual(expect.objectContaining(score));
    expect(payload.personalityMetricsVsHuman).toContainEqual(expect.objectContaining({ ...score, bestEloText: expect.stringContaining('50%') }));
    expect(db.gameParticipant.findMany.mock.calls[0][0].where).toEqual({ user: { isBot: true }, game: { status: 'finished' } });
  });
  it('paginates and filters human users without selecting credentials', async () => {
    db.user.count.mockResolvedValue(80);
    db.user.findMany.mockResolvedValue([{
      id: 2, username: 'Guest_test', rating: 1200, wins: 0, losses: 0, isAdmin: false, isGuest: true,
      createdAt: new Date(0), lastSeenAt: new Date(1000), _count: { participations: 3 },
      modeRatings: [{ mode: 'double', rating: 1200, wins: 0, losses: 0, draws: 0, trainingWins: 1, trainingLosses: 2, trainingDraws: 0 }],
    }]);
    runtime.activeGameOf.mockReturnValue(155);
    const response = await get('/users/search?kind=guest&online=online&q=Guest&page=2&pageSize=10');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ page: 2, pageSize: 10, total: 80, totalPages: 8,
      users: [{ id: 2, online: true, activeGameId: 155, games: 3, lastSeenAt: new Date(1000).toISOString() }],
    });
    const query = db.user.findMany.mock.calls[0][0];
    expect(query).toMatchObject({ skip: 10, take: 10, where: { isBot: false, isGuest: true, id: { in: [2] } } });
    expect(query.select.passwordHash).toBeUndefined();
    expect(query.select.sessionVersion).toBeUndefined();
    expect(db.user.count).toHaveBeenCalledWith({ where: query.where });
  });
  it.each([
    ['/users/search?kind=registered&online=offline', { isGuest: false, id: { notIn: [2] } }],
    ['/users/search?kind=admin', { isAdmin: true }],
  ])('applies filters %s', async (path, where) => {
    expect((await get(path)).status).toBe(200);
    expect(db.user.findMany.mock.calls[0][0].where).toMatchObject({ isBot: false, ...where });
  });
  it('supports exact user ID search alongside names', async () => {
    await get('/users/search?q=%232');
    expect(db.user.findMany.mock.calls[0][0].where.OR).toContainEqual({ id: 2 });
  });
  it('treats numeric queries outside the PostgreSQL Int range as names, not IDs', async () => {
    await get('/users/search?q=2147483648');
    await get('/games?q=999999999999999999999');
    expect(db.user.findMany.mock.calls[0][0].where.OR).toHaveLength(1);
    expect(db.game.findMany.mock.calls[0][0].where.OR).toHaveLength(1);
  });
  it.each([
    '/users/search?page=0', '/users/search?page=1.2', '/users/search?pageSize=101',
    '/users/search?kind=bot', '/users/search?online=perhaps', '/users/search?q[]=x',
    '/users/search?q=' + 'x'.repeat(101), '/games?mode=unknown', '/games?status=paused',
    '/games?clock=maybe', '/games?page=1000001', '/games?pageSize=-1',
    '/metrics?scope=wrong', '/metrics?scope[]=overview',
    '/metrics?scope=overview&period=1', '/metrics?scope=overview&period[]=7',
  ])('rejects invalid or unbounded queries %s', async path => {
    expect((await get(path)).status).toBe(400);
    expect(db.user.findMany).not.toHaveBeenCalled();
    expect(db.game.findMany).not.toHaveBeenCalled();
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('filters games and reports runtime diagnostics without serializing or mutating state', async () => {
    const active = { status: 'active', pacing: { paused: true, credits: 0 }, disconnected: new Set([5]), pendingFinish: undefined };
    runtime.getActive.mockReturnValue(active);
    db.game.count.mockResolvedValue(1);
    db.game.findMany.mockResolvedValue([{
      id: 155, mode: 'bughouse', status: 'active', result: '*', reason: null, ratingKind: 'guest',
      baseMin: 0, incSec: 0, noClock: true, startedAt: new Date(0), endedAt: null, _count: { moves: 0 }, moves: [],
      participants: [
        { team: 1, wasGuest: true, user: { id: 5, username: 'Guest_5', isGuest: false, isBot: false } },
        { team: 2, user: { id: 7, username: 'Bot', isGuest: false, isBot: true } },
      ],
    }]);
    const response = await get('/games?status=active&mode=bughouse&clock=untimed&q=%23155');
    expect(await response.json()).toMatchObject({ total: 1, games: [{ id: 155, moves: 0, participants: [expect.objectContaining({ wasGuest: true, isGuest: false }), expect.any(Object)], diagnostics: {
      inMemory: true, paused: true, waitingForHuman: true, disconnectedUserIds: [5], offlineUserIds: [5], lastMove: null, pendingResult: false,
      warnings: ['paused_with_bots', 'offline_participant'],
    } }] });
    expect(db.game.findMany.mock.calls[0][0]).toMatchObject({ take: 25, skip: 0, where: { status: 'active', mode: 'bughouse', noClock: true } });
    expect(db.game.findMany.mock.calls[0][0].where.OR).toContainEqual({ id: 155 });
    expect(active.pacing).toEqual({ paused: true, credits: 0 });
    expect([...active.disconnected]).toEqual([5]);
  });
  it('labels a persisted active match missing from this process, without treating it as cancelled', async () => {
    db.game.count.mockResolvedValue(1);
    db.game.findMany.mockResolvedValue([{
      id: 9, mode: 'double', status: 'active', result: '*', reason: null, ratingKind: null,
      baseMin: 5, incSec: 0, noClock: false, startedAt: new Date(0), endedAt: null,
      _count: { moves: 10 }, participants: [], moves: [{ ply: 10, boardIndex: 1, userId: 4 }],
    }]);
    const data = await (await get('/games?clock=timed')).json() as { games: unknown[] };
    expect(data.games[0]).toMatchObject({ status: 'active', diagnostics: { inMemory: false, lastMove: { ply: 10, boardIndex: 1, userId: 4 }, warnings: ['active_not_in_memory'] } });
    expect(db.game.findMany.mock.calls[0][0].where.noClock).toBe(false);
    expect(db.game.findMany.mock.calls[0][0].select.moves).toEqual({
      take: 1, orderBy: [{ ply: 'desc' }, { id: 'desc' }], select: { ply: true, boardIndex: true, userId: true },
    });
  });
  it('returns an empty bounded page and propagates database errors', async () => {
    expect(await (await get('/games?page=9')).json()).toEqual({ games: [], page: 9, pageSize: 25, total: 0, totalPages: 0 });
    db.game.findMany.mockRejectedValueOnce(new Error('Database down'));
    expect((await get('/games')).status).toBe(500);
  });
});
