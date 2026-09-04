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

async function main(): Promise<void> {
  await prisma.$connect();
  await gamesManager.cleanupOnBoot();
  await promoteConfiguredAdmins(env.adminUsernames);

  const app = express();
  app.use(cors({ origin: env.corsOrigin, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Auth
  app.post('/api/auth/register', register);
  app.post('/api/auth/login', login);
  app.post('/api/auth/logout', logout);
  app.get('/api/auth/me', me);

  // REST
  app.use('/api/lobbies', requireAuth, lobbyRouter);
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
  });
  registerSocketHandlers(io);

  httpServer.listen(env.port, () => {
    console.log(`[kaissa] server listening on :${env.port}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
