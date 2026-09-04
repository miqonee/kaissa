import { randomBytes } from 'crypto';
import type { Server as SocketServer } from 'socket.io';
import type {
  ChatMessage,
  CreateLobbyPayload,
  GameMode,
  LobbyPlayer,
  LobbySummary,
  ServerToClientEvents,
  TimeControl,
} from 'shared';
import { presence } from '../socket/presence.js';
import { prisma } from '../prisma.js';
import type { GamesManager } from '../game/manager.js';

// ============================================================
// Лобби: в памяти сервера. Жизненный цикл:
//  - create (код 6 символов, приватность)
//  - join по коду (или transition от старого лобби при реванше)
//  - ready toggle, kick (хост), chat, summon (призыв офлайн-игроков)
//  - start: авто-распределение по Elo (змейка), создание игры
//  - закрытие: хост ушёл / все ушли / старт
// ============================================================

const MAX_SLOTS = 4;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // без похожих символов

export interface LobbyMember {
  uid: number;
  username: string;
  rating: number;
  ready: boolean;
  host: boolean;
  joinedAt: number;
}

export class Lobby {
  id: string;
  code: string;
  name: string;
  mode: GameMode;
  timeControl: TimeControl;
  private: boolean;
  members: Map<number, LobbyMember> = new Map();
  chatIdSeq = 1;
  createdAt = Date.now();
  started = false;
  /** откуда пришло лобби (реванш от игры) */
  rematchOf: number | null = null;

  constructor(data: CreateLobbyPayload & { id: string; code: string }, host: LobbyMember, rematchOf?: number | null) {
    this.id = data.id;
    this.code = data.code;
    this.name = data.name;
    this.mode = data.mode;
    this.timeControl = data.timeControl;
    this.private = data.private;
    this.rematchOf = rematchOf ?? null;
    this.members.set(host.uid, { ...host });
  }

  summary(): LobbySummary {
    const players: LobbyPlayer[] = [...this.members.values()].map((m) => ({
      userId: m.uid,
      username: m.username,
      rating: m.rating,
      ready: m.ready,
      online: presence.isOnline(m.uid),
      host: m.host,
    }));
    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      timeControl: this.timeControl,
      players,
      code: this.code,
      started: this.started,
    };
  }
}

function genCode(): string {
  let s = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return s;
}

export class LobbiesManager {
  private lobbies = new Map<string, Lobby>();
  private idSeq = 1;
  private io: SocketServer<never, ServerToClientEvents> | null = null;
  private games: GamesManager | null = null;

  attach(io: SocketServer<never, ServerToClientEvents>, games: GamesManager): void {
    this.io = io;
    this.games = games;
  }

  /** Список неприватных нестартованных лобби */
  publicList(): Lobby[] {
    return [...this.lobbies.values()].filter((l) => !l.started && !l.private);
  }

  /** Присоединиться по userId (рейтинг берём из БД) */
  async joinWithUser(lobbyId: string, uid: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, error: 'Лобби не найдено' };
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return { ok: false, error: 'Пользователь не найден' };
    return this.join(lobby, { uid: user.id, username: user.username, rating: user.rating });
  }

  private room(lobbyId: string): string {
    return `lobby:${lobbyId}`;
  }

  broadcastList(): void {
    if (!this.io) return;
    const list = [...this.lobbies.values()]
      .filter((l) => !l.started && !l.private)
      .map((l) => l.summary());
    this.io.to('lobby-list').emit('lobby:list:update', list);
  }

  broadcastState(lobby: Lobby): void {
    this.io?.to(this.room(lobby.id)).emit('lobby:state', lobby.summary());
  }

  /** Создать лобби; вызывается REST-контроллером */
  create(
    host: { uid: number; username: string; rating: number },
    payload: CreateLobbyPayload,
  ): { lobby: Lobby; code: string } {
    const id = `L${this.idSeq++}`;
    const code = genCode();
    const lobby = new Lobby(
      { ...payload, id, code },
      { uid: host.uid, username: host.username, rating: host.rating, ready: true, host: true, joinedAt: Date.now() },
    );
    this.lobbies.set(id, lobby);
    this.broadcastList();
    return { lobby, code };
  }

  getByCode(code: string): Lobby | undefined {
    const c = code.trim().toUpperCase();
    return [...this.lobbies.values()].find((l) => l.code === c && !l.started);
  }

  getById(id: string): Lobby | undefined {
    return this.lobbies.get(id);
  }

  join(lobby: Lobby, member: { uid: number; username: string; rating: number }): { ok: true } | { ok: false; error: string } {
    if (lobby.started) return { ok: false, error: 'Игра уже началась' };
    if (lobby.members.has(member.uid)) return { ok: true };
    if (lobby.members.size >= MAX_SLOTS) return { ok: false, error: 'Лобби заполнено' };
    lobby.members.set(member.uid, {
      uid: member.uid,
      username: member.username,
      rating: member.rating,
      ready: false,
      host: false,
      joinedAt: Date.now(),
    });
    this.broadcastState(lobby);
    this.broadcastList();
    return { ok: true };
  }

  leave(lobbyId: string, uid: number): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.members.delete(uid);
    if (lobby.members.size === 0) {
      this.lobbies.delete(lobbyId);
      this.broadcastList();
      return;
    }
    // передать хостство первому оставшемуся
    if (!lobby.members.values().next().value?.host) {
      const first = lobby.members.values().next().value;
      if (first) first.host = true;
    }
    this.broadcastState(lobby);
    this.broadcastList();
  }

  setReady(lobbyId: string, uid: number, ready: boolean): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const m = lobby.members.get(uid);
    if (!m) return;
    m.ready = ready;
    this.broadcastState(lobby);
  }

  kick(lobbyId: string, uid: number, targetUid: number): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const kicker = lobby.members.get(uid);
    const target = lobby.members.get(targetUid);
    if (!kicker?.host || !target) return;
    lobby.members.delete(targetUid);
    this.broadcastState(lobby);
    this.broadcastList();
    // уведомить исключённого через личную комнату
    presence.emitToUser(targetUid, 'user:notif', {
      type: 'lobby_invite',
      lobbyId: lobby.id,
      lobbyName: lobby.name,
    });
  }

  chat(lobbyId: string, uid: number, text: string): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const m = lobby.members.get(uid);
    if (!m) return;
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    const msg: ChatMessage = {
      id: lobby.chatIdSeq++,
      userId: uid,
      username: m.username,
      text: clean,
      at: Date.now(),
    };
    this.io?.to(this.room(lobbyId)).emit('lobby:chat', msg);
  }

  /** Призыв офлайн-участников. Возвращает, кому отправлено. */
  summon(lobbyId: string, uid: number): { sentTo: number[] } {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { sentTo: [] };
    const caller = lobby.members.get(uid);
    if (!caller) return { sentTo: [] };
    const sentTo: number[] = [];
    for (const m of lobby.members.values()) {
      if (m.uid === uid) continue;
      if (presence.isOnline(m.uid)) continue;
      // online = есть WS-коннект. Но игрок может быть «в лобби» но не онлайн?
      // online проверяем по presence — сюда попадают только офлайн
      presence.emitToUser(m.uid, 'user:notif', {
        type: 'lobby_invite',
        lobbyId: lobby.id,
        lobbyName: lobby.name,
      });
      sentTo.push(m.uid);
    }
    return { sentTo };
  }

  /**
   * Старт игры: авто-распределение по Elo (змейка 1-4-2-3 ... p1+p4 vs p2+p3),
   * создание игры через GamesManager, рассылка redirect.
   */
  async start(lobbyId: string, uid: number): Promise<{ ok: true; gameId: number } | { ok: false; error: string }> {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, error: 'Лобби не найдено' };
    const host = lobby.members.get(uid);
    if (!host?.host) return { ok: false, error: 'Только хост может начать игру' };
    if (lobby.members.size !== MAX_SLOTS) return { ok: false, error: 'Нужно 4 игрока' };
    for (const m of lobby.members.values()) {
      if (!m.ready) return { ok: false, error: 'Не все готовы' };
    }
    // распределение: сортировка по Elo, змейка p1+p4 vs p2+p3
    const sorted = [...lobby.members.values()].sort((a, b) => b.rating - a.rating);
    const team1: LobbyMember[] = [sorted[0], sorted[3]];
    const team2: LobbyMember[] = [sorted[1], sorted[2]];
    const gameId = await this.games!.createGame({
      mode: lobby.mode,
      timeControl: lobby.timeControl,
      team1: team1.map((m) => ({ uid: m.uid, username: m.username, rating: m.rating })),
      team2: team2.map((m) => ({ uid: m.uid, username: m.username, rating: m.rating })),
    });
    lobby.started = true;
    // рассылка redirect
    this.io?.to(this.room(lobbyId)).emit('lobby:started', { gameId });
    this.broadcastList();
    // удалить лобби из памяти после старта (сокеты подпишутся на игру)
    setTimeout(() => {
      this.lobbies.delete(lobbyId);
    }, 2000);
    return { ok: true, gameId };
  }

  /** Реванш: новое приватное лобби с теми же игроками.
   *  Параметры (режим/контроль) берутся из исходной игры.
   *  Распределение по рейтингу произойдёт при старте как обычно.
   */
  async rematch(
    callerUid: number,
    players: { uid: number; username: string; rating: number }[],
    opts: { gameId: number; mode: GameMode; timeControl: TimeControl },
  ): Promise<{ lobbyId: string; code: string } | null> {
    const me = players.find((p) => p.uid === callerUid);
    if (!me) return null;
    const id = `L${this.idSeq++}`;
    const code = genCode();
    const lobby = new Lobby(
      {
        id,
        code,
        name: `Реванш #${opts.gameId}`,
        mode: opts.mode,
        timeControl: opts.timeControl,
        private: true,
      },
      { uid: me.uid, username: me.username, rating: me.rating, ready: true, host: true, joinedAt: Date.now() },
      opts.gameId,
    );
    this.lobbies.set(id, lobby);
    return { lobbyId: id, code };
  }
}
