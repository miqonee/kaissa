import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { GAME_MODES, type AdminPageInfo, type AdminUserDetail, type AdminUserSearchResult } from 'shared';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';
import { gamesManager } from '../state.js';
import { readAccountCounts } from './accountCounts.js';
import { asyncRoute } from '../http/asyncRoute.js';

/** Mounted behind requireAdmin. All handlers are read-only, including diagnostics. */
export const adminReadViews = Router();

function scalar(value: unknown, fallback = ''): string {
  if (value === undefined) return fallback;
  if (typeof value !== 'string') throw new Error('Некорректный параметр запроса');
  return value.trim();
}
function choice(value: unknown, allowed: readonly string[], fallback = 'all'): string {
  const parsed = scalar(value, fallback);
  if (!allowed.includes(parsed)) throw new Error('Некорректный фильтр');
  return parsed;
}
function pageNumber(value: unknown, fallback: number, max: number): number {
  const raw = scalar(value, String(fallback));
  if (!/^\d+$/.test(raw)) throw new Error('Некорректная страница');
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw new Error('Некорректная страница');
  return parsed;
}
function common(query: Record<string, unknown>) {
  const q = scalar(query.q);
  if (q.length > 100) throw new Error('Поисковый запрос слишком длинный');
  const page = pageNumber(query.page, 1, 1_000_000);
  const pageSize = pageNumber(query.pageSize, 25, 100);
  return { q, page, pageSize, skip: (page - 1) * pageSize };
}
function pageInfo(page: number, pageSize: number, total: number): AdminPageInfo {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}
function queryId(q: string): number | null {
  const raw = q.replace(/^#/, '');
  const id = Number(raw);
  return /^\d+$/.test(raw) && Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647 ? id : null;
}

adminReadViews.get('/users/search', asyncRoute(async (req, res) => {
  let options;
  try {
    options = {
      ...common(req.query),
      kind: choice(req.query.kind, ['all', 'registered', 'guest', 'admin']),
      online: choice(req.query.online, ['all', 'online', 'offline']),
    };
  } catch (error) {
    return void res.status(400).json({ error: (error as Error).message });
  }
  const { q, page, pageSize, skip, kind, online } = options;
  const onlineIds = presence.onlineUids();
  const onlineSet = new Set(onlineIds);
  const where: Prisma.UserWhereInput = { isBot: false };
  if (kind === 'guest') where.isGuest = true;
  if (kind === 'registered') where.isGuest = false;
  if (kind === 'admin') where.isAdmin = true;
  if (online !== 'all') where.id = online === 'online' ? { in: onlineIds } : { notIn: onlineIds };
  if (q) {
    const id = queryId(q);
    where.OR = [{ username: { contains: q, mode: 'insensitive' } }, ...(id ? [{ id }] : [])];
  }
  const [total, found, accounts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where, skip, take: pageSize, orderBy: [{ id: 'desc' }],
      select: {
        id: true, username: true, rating: true, wins: true, losses: true,
        isAdmin: true, isGuest: true, createdAt: true, lastSeenAt: true,
        _count: { select: { participations: true } },
        modeRatings: { orderBy: { mode: 'asc' }, select: {
          mode: true, rating: true, wins: true, losses: true, draws: true,
          trainingWins: true, trainingLosses: true, trainingDraws: true,
        } },
      },
    }),
    readAccountCounts(onlineIds),
  ]);
  const users: AdminUserDetail[] = found.map(u => ({
    id: u.id, username: u.username, rating: u.rating, wins: u.wins, losses: u.losses,
    games: u._count.participations, isAdmin: u.isAdmin, isGuest: u.isGuest, isBot: false,
    online: onlineSet.has(u.id), createdAt: u.createdAt.toISOString(),
    lastSeenAt: u.lastSeenAt.toISOString(), activeGameId: gamesManager.activeGameOf(u.id),
    modeRatings: u.modeRatings,
  }));
  const payload: AdminUserSearchResult = { users, accounts, ...pageInfo(page, pageSize, total) };
  res.json(payload);
}));

adminReadViews.get('/games', asyncRoute(async (req, res) => {
  let options;
  try {
    options = {
      ...common(req.query),
      status: choice(req.query.status, ['all', 'active', 'finished', 'abandoned']),
      mode: choice(req.query.mode, ['all', ...GAME_MODES]),
      clock: choice(req.query.clock, ['all', 'timed', 'untimed']),
    };
  } catch (error) {
    return void res.status(400).json({ error: (error as Error).message });
  }
  const { q, page, pageSize, skip, status, mode, clock } = options;
  const where: Prisma.GameWhereInput = {};
  if (status !== 'all') where.status = status;
  if (mode !== 'all') where.mode = mode;
  if (clock !== 'all') where.noClock = clock === 'untimed';
  if (q) {
    const id = queryId(q);
    where.OR = [
      { participants: { some: { user: { username: { contains: q, mode: 'insensitive' } } } } },
      ...(id ? [{ id }] : []),
    ];
  }
  const [total, found] = await Promise.all([
    prisma.game.count({ where }),
    prisma.game.findMany({
      where, skip, take: pageSize, orderBy: [{ id: 'desc' }],
      select: {
        id: true, mode: true, status: true, result: true, reason: true, ratingKind: true,
        baseMin: true, incSec: true, noClock: true, startedAt: true, endedAt: true,
        _count: { select: { moves: true } },
        moves: { orderBy: [{ ply: 'desc' }, { id: 'desc' }], take: 1,
          select: { ply: true, boardIndex: true, userId: true } },
        participants: { orderBy: [{ team: 'asc' }, { moveSlot: 'asc' }, { id: 'asc' }], select: {
          team: true, wasGuest: true, user: { select: { id: true, username: true, isGuest: true, isBot: true } },
        } },
      },
    }),
  ]);
  const online = new Set(presence.onlineUids());
  const games = found.map(g => {
    const runtime = gamesManager.getActive(g.id);
    const active = g.status === 'active' && runtime?.status === 'active' ? runtime : undefined;
    const participants = g.participants.map(p => ({ ...p.user, team: p.team, wasGuest: p.wasGuest, online: online.has(p.user.id) }));
    const paused = Boolean(active?.pacing?.paused);
    const pendingResult = Boolean(active?.pendingFinish);
    const disconnectedUserIds = active ? [...active.disconnected] : [];
    const offlineUserIds = g.status === 'active'
      ? participants.filter(p => !p.isBot && !p.online).map(p => p.id)
      : [];
    const warnings: string[] = [];
    if (g.status === 'active' && !active) warnings.push('active_not_in_memory');
    if (paused && participants.some(p => p.isBot)) warnings.push('paused_with_bots');
    if (offlineUserIds.length) warnings.push('offline_participant');
    if (pendingResult) warnings.push('result_pending');
    return {
      id: g.id, mode: g.mode, status: g.status, result: g.result, reason: g.reason, ratingKind: g.ratingKind,
      baseMin: g.baseMin, incSec: g.incSec, noClock: g.noClock,
      startedAt: g.startedAt.toISOString(), endedAt: g.endedAt?.toISOString() ?? null,
      moves: g._count.moves, participants,
      diagnostics: { inMemory: Boolean(active), paused,
        waitingForHuman: Boolean(active?.pacing && active.pacing.credits === 0),
        disconnectedUserIds, offlineUserIds, lastMove: g.moves[0] ?? null, pendingResult, warnings },
    };
  });
  res.json({ games, ...pageInfo(page, pageSize, total) });
}));
