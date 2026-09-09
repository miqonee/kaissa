import { Router } from 'express';
import { z } from 'zod';
import type { CreateLobbyPayload, GameMode } from 'shared';
import { currentUser, requireAuth } from '../auth/auth.js';
import { lobbies } from '../state.js';

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  mode: z.enum(['team', 'bughouse']),
  timeControl: z.union([
    z.object({ kind: z.literal('none'), baseMin: z.literal(0), incSec: z.literal(0) }),
    z.object({ kind: z.literal('clock'), baseMin: z.number().int().min(1).max(120), incSec: z.number().int().min(0).max(60) }),
  ]),
  private: z.boolean().optional().default(false),
  teamMode: z.enum(['auto', 'random', 'manual']).optional().default('auto'),
});

export const lobbyRouter = Router();

/** Список открытых лобби */
lobbyRouter.get('/', (_req, res) => {
  const list = lobbies
    .publicList()
    .map((l) => l.summary());
  res.json({ lobbies: list });
});

/** Создать лобби */
lobbyRouter.post('/', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return void res.status(400).json({ error: 'Некорректные данные' });
  const payload = parsed.data as CreateLobbyPayload;
  const { lobby, code } = lobbies.create(
    { uid: user.id, username: user.username, rating: user.rating },
    payload,
  );
  res.status(201).json({ lobby: lobby.summary(), code });
});

/** Войти по коду (получить lobbyId) */
lobbyRouter.post('/join', requireAuth, async (req, res) => {
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!code) return void res.status(400).json({ error: 'Укажите код' });
  const lobby = lobbies.getByCode(code);
  if (!lobby) return void res.status(404).json({ error: 'Лобби с таким кодом не найдено' });
  const r = lobbies.join(lobby, { uid: user.id, username: user.username, rating: user.rating });
  if (!r.ok) return void res.status(409).json({ error: r.error });
  res.json({ lobby: lobby.summary() });
});

/** Инфо о лобби по id (только чтение) */
lobbyRouter.get('/:id', (req, res) => {
  const lobby = lobbies.getById(String(req.params.id));
  if (!lobby || lobby.started) return void res.status(404).json({ error: 'Лобби не найдено' });
  res.json({ lobby: lobby.summary() });
});

/** Войти в лобби по id */
lobbyRouter.post('/:id/join', requireAuth, async (req, res) => {
  const lobby = lobbies.getById(String(req.params.id));
  if (!lobby || lobby.started) return void res.status(404).json({ error: 'Лобби не найдено' });
  const user = await currentUser(req);
  if (!user) return void res.status(401).json({ error: 'Не авторизован' });
  const r = lobbies.join(lobby, { uid: user.id, username: user.username, rating: user.rating });
  if (!r.ok) return void res.status(409).json({ error: r.error });
  res.json({ lobby: lobby.summary() });
});

