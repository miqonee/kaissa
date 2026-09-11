import type { Server, Socket } from 'socket.io';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from 'shared';
import { Chess } from 'chess.js';
import { gamesManager, lobbies } from '../state.js';
import { presence } from './presence.js';
import { socketAuth } from './authSocket.js';
import { env } from '../env.js';
import { prisma } from '../prisma.js';

// ============================================================
// Socket-роутер: связывает события клиентов с менеджерами.
// Сокет авторизуется JWT-cookie из handshake.
// ============================================================

interface SocketCtx {
  uid: number;
  username: string;
  lobbyId: string | null;
  /** id активной партии, где пользователь участник */
  gameId: number | null;
}

/** uid -> таймер льготного периода: отключение не сразу помечает игрока ушедшим */
const graceTimers = new Map<number, ReturnType<typeof setTimeout>>();
/** uid -> timestamp последнего призыва (защита от спама) */
const lastSummon = new Map<number, number>();

function cancelGrace(uid: number): void {
  const t = graceTimers.get(uid);
  if (t) {
    clearTimeout(t);
    graceTimers.delete(uid);
  }
}

export function registerSocketHandlers(io: Server<ClientToServerEvents, ServerToClientEvents>): void {
  presence.attach(io as never);
  gamesManager.attach(io as never);
  lobbies.attach(io as never, gamesManager);

  io.on('connection', (socket) => {
    const auth = socketAuth(socket);
    const ctx: SocketCtx | null = auth ? { ...auth, lobbyId: null, gameId: null } : null;

    if (ctx) {
      // Личные комнаты + presence
      cancelGrace(ctx.uid);
      socket.join(presence.userRoom(ctx.uid));
      presence.onConnect(ctx.uid, socket.id);

      // Найти активную партию игрока (реконнект)
      const activeGame = gamesManager.activeGameOf(ctx.uid);
      if (activeGame) {
        ctx.gameId = activeGame;
        socket.join(gamesManager.gameRoom(activeGame));
        gamesManager.onPlayerReconnect(activeGame, ctx.uid);
        socket.emit('game:state', gamesManager.toGameState(gamesManager.getActive(activeGame)!));
      }
    }

    // ---------- LOBBY ----------

    socket.on('lobby:join', async (codeOrId, cb) => {
      if (!ctx) {
        cb({ ok: false, error: 'Требуется авторизация' });
        return;
      }
      let lobby = lobbies.getByCode(String(codeOrId)) ?? lobbies.getById(String(codeOrId));
      if (!lobby) {
        cb({ ok: false, error: 'Лобби не найдено' });
        return;
      }
      if (!lobby.members.has(ctx.uid)) {
        const r = await lobbies.joinWithUser(lobby.id, ctx.uid);
        if (!r.ok) {
          cb({ ok: false, error: r.error });
          return;
        }
      }
      ctx.lobbyId = lobby.id;
      socket.join(`lobby:${lobby.id}`);
      cb({ ok: true, data: { lobby: lobby.summary() } });
      lobbies.broadcastState(lobby);
    });

    socket.on('lobby:leave', () => {
      if (ctx?.lobbyId) {
        socket.leave(`lobby:${ctx.lobbyId}`);
        lobbies.leave(ctx.lobbyId, ctx.uid);
        ctx.lobbyId = null;
      }
    });

    socket.on('lobby:ready', (ready) => {
      if (ctx?.lobbyId) lobbies.setReady(ctx.lobbyId, ctx.uid, Boolean(ready));
    });

    socket.on('lobby:kick', (targetUid) => {
      if (ctx?.lobbyId) lobbies.kick(ctx.lobbyId, ctx.uid, Number(targetUid));
    });

    socket.on('lobby:chat', (text) => {
      if (ctx?.lobbyId) lobbies.chat(ctx.lobbyId, ctx.uid, String(text));
    });

    socket.on('lobby:summon', () => {
      if (!ctx?.lobbyId) return;
      const now = Date.now();
      const last = lastSummon.get(ctx.uid) ?? 0;
      if (now - last < 10_000) return; // 10 сек кулдаун
      lastSummon.set(ctx.uid, now);
      lobbies.summon(ctx.lobbyId, ctx.uid);
    });

    socket.on('lobby:pause-toggle', () => {
      if (ctx?.lobbyId) lobbies.pauseToggle(ctx.lobbyId, ctx.uid);
    });

    socket.on('lobby:set-team', (team) => {
      if (ctx?.lobbyId) lobbies.setTeamChoice(ctx.lobbyId, ctx.uid, team);
    });

    socket.on('lobby:set-team-mode', (mode) => {
      if (ctx?.lobbyId) lobbies.setTeamMode(ctx.lobbyId, ctx.uid, mode);
    });

    socket.on('lobby:set-time-control', (payload: any) => {
      const lobbyId = (payload && typeof payload === 'object' && 'lobbyId' in payload) ? payload.lobbyId : ctx?.lobbyId;
      const tc = (payload && typeof payload === 'object' && 'tc' in payload) ? payload.tc : payload;
      if (lobbyId && ctx?.uid) lobbies.setTimeControl(lobbyId, ctx.uid, tc);
    });

    socket.on('lobby:add-bot', async (cb) => {
      if (!ctx?.lobbyId) return cb?.({ ok: false, error: 'Вы не в лобби' });
      const r = await lobbies.addBot(ctx.lobbyId, ctx.uid);
      cb?.(r.ok ? { ok: true, data: null } : { ok: false, error: r.error });
    });

    socket.on('lobby:start', async (cb) => {
      if (!ctx?.lobbyId) {
        cb({ ok: false, error: 'Вы не в лобби' });
        return;
      }
      const r = await lobbies.start(ctx.lobbyId, ctx.uid);
      if (r.ok) {
        ctx.lobbyId = null;
      }
      cb(r.ok ? { ok: true, data: { gameId: r.gameId } } : { ok: false, error: r.error });
    });

    // ---------- GAME ----------

    socket.on('game:move', async (data, cb) => {
      if (!ctx) {
        cb({ ok: false, error: 'Требуется авторизация' });
        return;
      }
      if (typeof data?.gameId !== 'number') {
        cb({ ok: false, error: 'Некорректные данные' });
        return;
      }
      const r = await gamesManager.applyMove(data.gameId, ctx.uid, {
        boardIndex: data.boardIndex,
        from: String(data.from),
        to: String(data.to),
        promotion: data.promotion,
        dropPiece: data.dropPiece,
      });
      if (!r.ok) {
        cb({ ok: false, error: r.error });
        return;
      }
      cb({ ok: true });
    });

    socket.on('game:resign', (gameId) => {
      if (ctx) void gamesManager.resign(Number(gameId), ctx.uid);
    });

    socket.on('game:chat', (gameId, text) => {
      if (ctx) gamesManager.chat(Number(gameId), ctx.uid, String(text));
    });

    // ---------- Комнаты игры / трансляции ----------

    socket.on('game:watch', async (gameId: number) => {
      const id = Number(gameId);
      const g = gamesManager.getActive(id);
      if (g) {
        if (ctx) {
          ctx.gameId = id;
          gamesManager.onPlayerReconnect(id, ctx.uid);
        }
        socket.join(gamesManager.gameRoom(id));
        socket.emit('game:state', gamesManager.toGameState(g));
        return;
      }
      const dbGame = await prisma.game.findUnique({
        where: { id },
        include: { participants: { include: { user: true } }, moves: { orderBy: [{ boardIndex: 'asc' }, { ply: 'asc' }] } },
      });
      if (dbGame) {
        const lastFen0 = dbGame.moves.filter((m: { boardIndex: number; fenAfter: string }) => m.boardIndex === 0).at(-1)?.fenAfter || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        const lastFen1 = dbGame.moves.filter((m: { boardIndex: number; fenAfter: string }) => m.boardIndex === 1).at(-1)?.fenAfter || 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
        let moves: string[] | undefined;
        if (dbGame.mode !== 'bughouse') {
          try {
            const c = new Chess();
            const b0Moves = dbGame.moves.filter((m: any) => m.boardIndex === 0).sort((a: any, b: any) => a.ply - b.ply);
            for (const m of b0Moves) {
              c.move({ from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion as any } : {}) });
            }
            moves = c.history();
          } catch {
            moves = [];
          }
        }
        socket.emit('game:state', {
          gameId: dbGame.id,
          mode: dbGame.mode as any,
          timeControl: { kind: dbGame.noClock ? 'none' : 'clock', baseMin: dbGame.baseMin, incSec: dbGame.incSec },
          fens: dbGame.mode === 'bughouse' ? [lastFen0, lastFen1] : [lastFen0],
          turns: ['w'],
          clocks: [[0, 0]],
          clocksActive: [null],
          turnUserIds: [0],
          participants: dbGame.participants.map((p: any) => ({
            userId: p.userId,
            username: p.user.username,
            team: p.team as any,
            color: p.color as any,
            boardIndex: p.boardIndex as any,
            moveSlot: p.moveSlot as any,
            ratingBefore: p.ratingBefore,
            ratingAfter: p.ratingAfter,
          })),
          pockets: null,
          status: dbGame.status as any,
          result: dbGame.result as any,
          reason: dbGame.reason as any,
          moveNumber: Math.floor(dbGame.moves.length / 2) + 1,
          moves,
          startedAt: dbGame.startedAt.getTime(),
        });
      }
    });

    socket.on('game:leave', (gameId: number) => {
      socket.leave(gamesManager.gameRoom(Number(gameId)));
    });

    socket.on('live:subscribe', () => {
      socket.join('live');
      socket.emit('live:snapshot', gamesManager.liveSnapshot());
    });

    socket.on('lobby-list:subscribe', () => {
      socket.join('lobby-list');
      socket.emit('lobby:list:update', lobbies.publicList().map((l) => l.summary()));
    });

    // ---------- Отключение ----------
    // Льготный период: моргание сети/переход на другой Wi-Fi не должен
    // выбрасывать игрока из лобби и помечать его «вышел из партии».
    // Реальное отсутствие ABANDON_SECONDS секунд = игрок ушёл.

    socket.on('disconnect', () => {
      if (!ctx) return;
      presence.onDisconnect(ctx.uid, socket.id);
      if (presence.isOnline(ctx.uid)) return; // осталась другая вкладка

      cancelGrace(ctx.uid);
      const timer = setTimeout(() => {
        graceTimers.delete(ctx.uid);
        if (presence.isOnline(ctx.uid)) return; // успел вернуться
        if (ctx.lobbyId) {
          lobbies.leave(ctx.lobbyId, ctx.uid);
          ctx.lobbyId = null;
        }
        if (ctx.gameId) {
          gamesManager.onPlayerDisconnect(ctx.gameId, ctx.uid);
        }
      }, env.abandonSeconds * 1000);
      graceTimers.set(ctx.uid, timer);
    });
  });
}
