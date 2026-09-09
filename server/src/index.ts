import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { Server as SocketServer } from 'socket.io';
import { env } from './env.js';
import { prisma } from './prisma.js';
import { register, login, logout, me } from './auth/auth.js';
import { requireAuth } from './auth/auth.js';
import { adminRouter, promoteConfiguredAdmins } from './admin/adminRouter.js';
import { lobbyRouter } from './lobby/lobbyRouter.js';
import { gamesRouter, usersRouter } from './users/usersRouter.js';
import { registerSocketHandlers } from './socket/router.js';
import { gamesManager } from './state.js';
import { seedBots } from './ai/botsSeed.js';
import { demoShowcase } from './ai/demoShowcase.js';

function createRateLimiter(windowMs: number, maxRequests: number, errorMsg: string) {
  const requests = new Map<string, { count: number; resetAt: number }>();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, rec] of requests.entries()) {
      if (now > rec.resetAt) requests.delete(ip);
    }
  }, windowMs);

  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rec = requests.get(ip);
    if (!rec || now > rec.resetAt) {
      requests.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }
    rec.count++;
    if (rec.count > maxRequests) {
      res.status(429).json({ error: errorMsg });
      return;
    }
    next();
  };
}

async function main(): Promise<void> {
  await prisma.$connect();
  await gamesManager.cleanupOnBoot();
  await seedBots();
  await promoteConfiguredAdmins(env.adminUsernames);

  const app = express();
  app.set('trust proxy', 1);

  // Базовые заголовки безопасности
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // In-memory rate limiting для авторизации (10 запросов в минуту на IP)
  const authLimiter = createRateLimiter(60_000, 10, 'Слишком много попыток. Подождите минуту.');

  // Auth
  app.post('/api/auth/register', authLimiter, register);
  app.post('/api/auth/login', authLimiter, login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', me);

  // REST
  app.use('/api/lobbies', lobbyRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/games', gamesRouter);
  app.use('/api/admin', requireAuth, adminRouter);

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  // Неизвестный API-роут — всегда JSON (чтобы фронт не получал HTML)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Не найдено' });
  });

  // Единый обработчик ошибок: битый JSON в теле, необработанные исключения
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const isSyntax = err instanceof SyntaxError;
    if (!isSyntax) console.error('[kaissa] unhandled error:', err);
    res.status(isSyntax ? 400 : 500).json({
      error: isSyntax ? 'Некорректный JSON в запросе' : 'Внутренняя ошибка сервера',
    });
  });

  const httpServer = createServer(app);
  const io = new SocketServer(httpServer, {
    cors: { origin: env.corsOrigin, credentials: true },
    // Мягче к мобильным сетям: чаще пинг, дольше ждём ответ
    pingInterval: 20_000,
    pingTimeout: 25_000,
  });
  registerSocketHandlers(io);
  demoShowcase.start(gamesManager);

  httpServer.listen(env.port, '0.0.0.0', () => {
    console.log(`[kaissa] server listening on 0.0.0.0:${env.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
