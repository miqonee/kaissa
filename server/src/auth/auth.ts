import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import type { PublicUser } from 'shared';
import { env } from '../env.js';
import { prisma } from '../prisma.js';

const COOKIE_NAME = 'kaissa_token';
const TOKEN_TTL_S = 60 * 60 * 24 * 30; // 30 дней

export interface JwtPayload {
  uid: number;
  username: string;
}

export function isConfiguredAdmin(username: string): boolean {
  const norm = username.trim().toLowerCase();
  return env.adminUsernames.some((u) => u.trim().toLowerCase() === norm);
}

export async function register(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};
  const name = String(username ?? '').trim();
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,28}[a-zA-Z0-9]$/.test(name)) {
    res.status(400).json({ error: 'Ник: 3-30 символов, латиница, цифры, дефис, точка или подчеркивание' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    res.status(400).json({ error: 'Пароль: от 8 до 72 символов' });
    return;
  }
  const exists = await prisma.user.findUnique({ where: { username: name } });
  if (exists) {
    res.status(409).json({ error: 'Это имя уже занято' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { username: name, passwordHash, rating: 1200, isAdmin: false },
  });
  issue(res, user.id, user.username);
  res.status(201).json({ user: toPublic(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body ?? {};
  const name = String(username ?? '').trim();
  const user = await prisma.user.findUnique({ where: { username: name } });
  if (!user || !(await bcrypt.compare(String(password ?? ''), user.passwordHash))) {
    res.status(401).json({ error: 'Неверное имя или пароль' });
    return;
  }
  if (!user.isAdmin && isConfiguredAdmin(user.username)) {
    user.isAdmin = true;
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  issue(res, user.id, user.username);
  res.json({ user: toPublic(user) });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: 'lax' });
  res.json({ ok: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  res.json({ user: toPublic(user) });
}

export function issue(res: Response, uid: number, username: string): void {
  const token = jwt.sign({ uid, username } satisfies JwtPayload, env.jwtSecret, {
    expiresIn: TOKEN_TTL_S,
  });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TOKEN_TTL_S * 1000,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function currentPayload(req: Request): JwtPayload | null {
  const token = (req as Request & { cookies?: Record<string, string> }).cookies?.[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}

export async function currentUser(req: Request) {
  const payload = currentPayload(req);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.uid } });
  if (!user) return null;
  if (!user.isAdmin && isConfiguredAdmin(user.username)) {
    user.isAdmin = true;
    await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  }
  return user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!currentPayload(req)) {
    res.status(401).json({ error: 'Не авторизован' });
    return;
  }
  next();
}

export function toPublic(user: {
  id: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isAdmin: boolean;
  isBot?: boolean;
  botLevel?: number | null;
  createdAt: Date;
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    isAdmin: user.isAdmin,
    isBot: Boolean(user.isBot),
    botLevel: user.botLevel ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

/** Только для администраторов */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await currentUser(req);
  if (!user?.isAdmin) {
    res.status(403).json({ error: 'Доступ только для администратора' });
    return;
  }
  next();
}
