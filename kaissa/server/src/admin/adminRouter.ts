import { Router } from 'express';
import type { AdminUserRow } from 'shared';
import { currentUser, requireAdmin } from '../auth/auth.js';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';

// ============================================================
// Админка: список игроков, удаление аккаунтов, сброс рейтинга.
// Права выдаются через переменную окружения ADMIN_USERNAMES.
// ============================================================

export const adminRouter = Router();

adminRouter.use(requireAdmin);

/** Список всех игроков */
adminRouter.get('/users', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: 'desc' }, { rating: 'desc' }],
    include: { _count: { select: { participations: true } } },
  });
  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    username: u.username,
    rating: u.rating,
    wins: u.wins,
    losses: u.losses,
    games: u._count.participations,
    isAdmin: u.isAdmin,
    online: presence.isOnline(u.id),
    createdAt: u.createdAt.toISOString(),
  }));
  res.json({ users: rows });
});

/** Удалить аккаунт вместе с его партиями */
adminRouter.delete('/users/:id', async (req, res) => {
  const me = await currentUser(req);
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  if (me?.id === id) return void res.status(400).json({ error: 'Нельзя удалить свой аккаунт' });

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return void res.status(404).json({ error: 'Игрок не найден' });

  // Партии, в которых он участвовал, теряют смысл без него — удаляем целиком
  const parts = await prisma.gameParticipant.findMany({ where: { userId: id }, select: { gameId: true } });
  const gameIds = [...new Set(parts.map((p) => p.gameId))];
  if (gameIds.length) await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  await prisma.user.delete({ where: { id } });

  res.json({ ok: true, deletedGames: gameIds.length, username: target.username });
});

/** Сбросить рейтинг и статистику (удобно при тестах) */
adminRouter.post('/users/:id/reset', async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  await prisma.$transaction([
    prisma.ratingHistory.deleteMany({ where: { userId: id } }),
    prisma.user.update({
      where: { id },
      data: { rating: 1200, wins: 0, losses: 0, draws: 0 },
    }),
  ]);
  res.json({ ok: true });
});

/** Выдать/снять права администратора */
adminRouter.post('/users/:id/admin', async (req, res) => {
  const me = await currentUser(req);
  const id = parseInt(String(req.params.id), 10);
  const isAdmin = Boolean(req.body?.isAdmin);
  if (!Number.isFinite(id)) return void res.status(400).json({ error: 'Некорректный id' });
  if (me?.id === id) return void res.status(400).json({ error: 'Нельзя менять свои права' });
  await prisma.user.update({ where: { id }, data: { isAdmin } });
  res.json({ ok: true });
});

/** Выдать права по имени пользователя из ADMIN_USERNAMES при старте сервера */
export async function promoteConfiguredAdmins(usernames: string[]): Promise<void> {
  const clean = usernames.map((u) => u.trim()).filter(Boolean);
  if (!clean.length) return;
  const res = await prisma.user.updateMany({
    where: { username: { in: clean } },
    data: { isAdmin: true },
  });
  if (res.count) console.log(`[kaissa] выданы права администратора: ${clean.join(', ')}`);
}
