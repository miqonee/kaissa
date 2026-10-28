import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), findMany: vi.fn(), delete: vi.fn(), update: vi.fn() },
  gameParticipant: { findMany: vi.fn() },
  game: { deleteMany: vi.fn() },
  ratingHistory: { deleteMany: vi.fn() },
  modeRating: { deleteMany: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('../src/prisma.js', () => ({ prisma: db }));
vi.mock('../src/auth/auth.js', () => ({
  currentUser: vi.fn(async () => ({ id: 1, isAdmin: true })),
  requireAdmin: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import { adminRouter } from '../src/admin/adminRouter.js';

let server: Server;
let url: string;
beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/admin', adminRouter);
  server = await new Promise<Server>(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const address = server.address() as { port: number };
  url = `http://127.0.0.1:${address.port}/api/admin/users`;
});
afterAll(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ id: 2, username: 'Guest_example', isBot: false, isGuest: true });
  db.gameParticipant.findMany.mockResolvedValue([{ gameId: 7 }, { gameId: 7 }, { gameId: 8 }]);
});

describe('Guest account administration', () => {
  it('deletes a guest and their games without treating them as a bot', async () => {
    const response = await fetch(`${url}/2`, { method: 'DELETE' });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, deletedGames: 2 });
    expect(db.game.deleteMany).toHaveBeenCalledWith({ where: { id: { in: [7, 8] } } });
    expect(db.user.delete).toHaveBeenCalledWith({ where: { id: 2 } });
  });
  it('resets a guest’s statistics', async () => {
    const response = await fetch(`${url}/2/reset`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 2 }, data: { rating: 1200, wins: 0, losses: 0, draws: 0 } });
  });
  it.each(['DELETE', 'POST'])('still protects actual system bots (%s)', async method => {
    db.user.findUnique.mockResolvedValue({ id: 2, isBot: true, isGuest: false });
    const response = await fetch(`${url}/2${method === 'POST' ? '/reset' : ''}`, { method });
    expect(response.status).toBe(400);
    expect(db.user.delete).not.toHaveBeenCalled();
    expect(db.game.deleteMany).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('includes the guest marker in the account list', async () => {
    db.user.findMany.mockResolvedValue([{ id: 2, isGuest: true, createdAt: new Date(), _count: { participations: 0 } }]);
    const response = await fetch(url);
    expect(await response.json()).toMatchObject({ users: [{ id: 2, isGuest: true }] });
  });
});
