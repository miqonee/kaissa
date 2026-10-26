import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import type { NextFunction, Request, Response } from "express";
import {
  GAME_MODES,
  emptyModeRating,
  type PublicUser,
  type GameMode,
} from "shared";
import { env } from "../env.js";
import { prisma } from "../prisma.js";

const COOKIE_NAME = "kaissa_token";
const TOKEN_TTL_S = 60 * 60 * 24 * 30;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
export const authEvents = new EventEmitter();
export interface JwtPayload {
  uid: number;
  username: string;
  sv: number;
}

function credentials(
  body: unknown,
): { name: string; password: string } | string {
  const { username, password } = (body ?? {}) as Record<string, unknown>;
  const name = typeof username === "string" ? username.trim() : "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{1,28}[a-zA-Z0-9]$/.test(name))
    return "Ник: 3–30 символов, латиница, цифры, дефис, точка или подчёркивание";
  if (/^guest_/i.test(name)) return "Префикс Guest_ зарезервирован для гостей";
  if (
    typeof password !== "string" ||
    password.length < 8 ||
    Buffer.byteLength(password, "utf8") > 72
  )
    return "Пароль: от 8 символов, не более 72 байт";
  return { name, password };
}

export async function register(req: Request, res: Response): Promise<void> {
  const existing = await currentUser(req);
  if (existing?.isGuest) return claim(req, res);
  if (existing) {
    res.status(409).json({ error: "Вы уже вошли в аккаунт" });
    return;
  }
  const parsed = credentials(req.body);
  if (typeof parsed === "string") {
    res.status(400).json({ error: parsed });
    return;
  }
  if (
    await prisma.user.findFirst({
      where: { username: { equals: parsed.name, mode: "insensitive" } },
    })
  ) {
    res.status(409).json({ error: "Это имя уже занято" });
    return;
  }
  try {
    const user = await prisma.user.create({
      data: {
        username: parsed.name,
        passwordHash: await bcrypt.hash(parsed.password, 10),
      },
    });
    issue(res, user.id, user.username, user.sessionVersion);
    res.status(201).json({ user: toPublic(user) });
  } catch (e) {
    if (isConflict(e)) {
      res.status(409).json({ error: "Это имя уже занято" });
      return;
    }
    throw e;
  }
}

export async function guest(req: Request, res: Response): Promise<void> {
  const existing = await currentUser(req);
  if (existing) {
    res.json({ user: toPublic(existing) });
    return;
  }
  const user = await prisma.user.create({
    data: {
      username: `Guest_${randomBytes(8).toString("hex")}`,
      isGuest: true,
      passwordHash: null,
    },
  });
  issue(res, user.id, user.username, user.sessionVersion);
  res.status(201).json({ user: toPublic(user) });
}

export async function claim(req: Request, res: Response): Promise<void> {
  const guestUser = await currentUser(req);
  if (!guestUser) {
    res.status(401).json({ error: "Гостевая сессия истекла. Войдите снова" });
    return;
  }
  if (!guestUser.isGuest) {
    res.status(409).json({ error: "Аккаунт уже сохранён" });
    return;
  }
  const parsed = credentials(req.body);
  if (typeof parsed === "string") {
    res.status(400).json({ error: parsed });
    return;
  }
  const passwordHash = await bcrypt.hash(parsed.password, 10);
  try {
    const user = await prisma.$transaction(async (tx) => {
      if (
        await tx.user.findFirst({
          where: { username: { equals: parsed.name, mode: "insensitive" } },
        })
      )
        throw new Error("NAME_TAKEN");
      const updated = await tx.user.updateMany({
        where: {
          id: guestUser.id,
          isGuest: true,
          sessionVersion: guestUser.sessionVersion,
        },
        data: {
          username: parsed.name,
          passwordHash,
          isGuest: false,
          sessionVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new Error("ALREADY_CLAIMED");
      return tx.user.findUniqueOrThrow({
        where: { id: guestUser.id },
        include: { modeRatings: true },
      });
    });
    authEvents.emit("changed", user.id, user.username);
    issue(res, user.id, user.username, user.sessionVersion);
    res.json({ user: toPublic(user) });
  } catch (e) {
    if (isConflict(e) || (e instanceof Error && e.message === "NAME_TAKEN")) {
      res.status(409).json({ error: "Это имя уже занято" });
      return;
    }
    if (e instanceof Error && e.message === "ALREADY_CLAIMED") {
      res
        .status(409)
        .json({
          error: "Аккаунт уже сохранён в другой вкладке. Войдите с паролем",
        });
      return;
    }
    throw e;
  }
}
function isConflict(e: unknown): boolean {
  return (
    typeof e === "object" && e !== null && "code" in e && e.code === "P2002"
  );
}

export async function login(req: Request, res: Response): Promise<void> {
  const name = String(req.body?.username ?? "").trim();
  const password = req.body?.password;
  const user = await prisma.user.findUnique({
    where: { username: name },
    include: { modeRatings: true },
  });
  if (
    !user ||
    user.isGuest ||
    !user.passwordHash ||
    typeof password !== "string" ||
    Buffer.byteLength(password) > 72 ||
    !(await bcrypt.compare(password, user.passwordHash))
  ) {
    res.status(401).json({ error: "Неверное имя или пароль" });
    return;
  }
  issue(res, user.id, user.username, user.sessionVersion);
  res.json({ user: toPublic(user) });
}
export async function logout(req: Request, res: Response): Promise<void> {
  const user = await currentUser(req);
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { sessionVersion: { increment: 1 } },
    });
    authEvents.emit("changed", user.id);
  }
  res.clearCookie(COOKIE_NAME, cookieOptions);
  res.json({ ok: true });
}
export async function me(req: Request, res: Response): Promise<void> {
  const user = await currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Не авторизован" });
    return;
  }
  res.json({ user: toPublic(user) });
}
export function issue(
  res: Response,
  uid: number,
  username: string,
  sv = 0,
): void {
  res.cookie(
    COOKIE_NAME,
    jwt.sign({ uid, username, sv } satisfies JwtPayload, env.jwtSecret, {
      expiresIn: TOKEN_TTL_S,
    }),
    { ...cookieOptions, maxAge: TOKEN_TTL_S * 1000 },
  );
}
export function verifyToken(token: string): JwtPayload | null {
  try {
    const p = jwt.verify(token, env.jwtSecret, { algorithms: ["HS256"] });
    if (
      typeof p === "string" ||
      !Number.isSafeInteger(p.uid) ||
      typeof p.username !== "string" ||
      !Number.isSafeInteger(p.sv)
    )
      return null;
    return p as JwtPayload;
  } catch {
    return null;
  }
}
export function currentPayload(req: Request): JwtPayload | null {
  const token = req.cookies?.[COOKIE_NAME];
  return typeof token === "string" ? verifyToken(token) : null;
}
export async function currentUser(req: Request) {
  const p = currentPayload(req);
  if (!p) return null;
  const user = await prisma.user.findUnique({
    where: { id: p.uid },
    include: { modeRatings: true },
  });
  return user && user.sessionVersion === p.sv ? user : null;
}
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!(await currentUser(req))) {
      res.status(401).json({ error: "Не авторизован" });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
export function toPublic(user: {
  id: number;
  username: string;
  rating: number;
  wins: number;
  losses: number;
  draws: number;
  isAdmin: boolean;
  isGuest?: boolean;
  isBot?: boolean;
  botLevel?: number | null;
  createdAt: Date;
  modeRatings?: {
    mode: string;
    rating: number;
    wins: number;
    losses: number;
    draws: number;
    trainingWins: number;
    trainingLosses: number;
    trainingDraws: number;
  }[];
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    rating: user.rating,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
    isAdmin: user.isAdmin,
    isGuest: Boolean(user.isGuest),
    isBot: Boolean(user.isBot),
    botLevel: user.botLevel ?? null,
    createdAt: user.createdAt.toISOString(),
    modeRatings: GAME_MODES.map((mode) => {
      const row = user.modeRatings?.find((r) => r.mode === mode);
      return row
        ? { ...row, mode: row.mode as GameMode }
        : emptyModeRating(mode);
    }),
  };
}
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await currentUser(req);
    if (!user?.isAdmin || user.isGuest) {
      res.status(403).json({ error: "Доступ только для администратора" });
      return;
    }
    next();
  } catch (e) {
    next(e);
  }
}
