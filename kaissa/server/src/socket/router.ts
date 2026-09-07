import type { Server, Socket } from 'socket.io';
import type { Ack, ClientToServerEvents, ServerToClientEvents } from 'shared';
import { gamesManager, lobbies } from '../state.js';
import { presence } from './presence.js';
import { socketAuth } from './authSocket.js';
import { env } from '../env.js';

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
    if (!auth) {
      socket.emit('lobby:closed', 'Не авторизован');
      socket.disconnect(true);
      return;
    }
    const ctx: SocketCtx = { ...auth, lobbyId: null, gameId: null };

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

    // ---------- LOBBY ----------

    socket.on('lobby:join', async (codeOrId, cb) => {
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
      if (ctx.lobbyId) {
        socket.leave(`lobby:${ctx.lobbyId}`);
        lobbies.leave(ctx.lobbyId, ctx.uid);
        ctx.lobbyId = null;
      }
    });

    socket.on('lobby:ready', (ready) => {
      if (ctx.lobbyId) lobbies.setReady(ctx.lobbyId, ctx.uid, Boolean(ready));
    });

    socket.on('lobby:kick', (targetUid) => {
      if (ctx.lobbyId) lobbies.kick(ctx.lobbyId, ctx.uid, Number(targetUid));
    });

    socket.on('lobby:chat', (text) => {
      if (ctx.lobbyId) lobbies.chat(ctx.lobbyId, ctx.uid, String(text));
    });

    socket.on('lobby:summon', () => {
      if (ctx.lobbyId) lobbies.summon(ctx.lobbyId, ctx.uid);
    });

    socket.on('lobby:start', async (cb) => {
      if (!ctx.lobbyId) {
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
      void gamesManager.resign(Number(gameId), ctx.uid);
    });

    socket.on('game:chat', (gameId, text) => {
      gamesManager.chat(Number(gameId), ctx.uid, String(text));
    });

    // ---------- Комнаты игры / трансляции ----------

    socket.on('game:watch', (gameId: number) => {
      const id = Number(gameId);
      const g = gamesManager.getActive(id);
      if (g) {
        ctx.gameId = id;
        socket.join(gamesManager.gameRoom(id));
        gamesManager.onPlayerReconnect(id, ctx.uid);
        socket.emit('game:state', gamesManager.toGameState(g));
      } else {
        socket.emit('lobby:closed', 'Партия не найдена или завершена');
      }
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
