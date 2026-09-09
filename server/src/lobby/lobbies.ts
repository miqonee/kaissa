import { randomBytes } from 'crypto';
import type { Server as SocketServer } from 'socket.io';
import type {
  ChatMessage,
  CreateLobbyPayload,
  GameMode,
  LobbyPlayer,
  LobbySummary,
  ServerToClientEvents,
  TeamMode,
  TimeControl,
} from 'shared';
import { presence } from '../socket/presence.js';
import { prisma } from '../prisma.js';
import type { GamesManager } from '../game/manager.js';

const MAX_SLOTS = 4;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface LobbyMember {
  uid: number;
  username: string;
  rating: number;
  ready: boolean;
  host: boolean;
  joinedAt: number;
  isBot?: boolean;
  botLevel?: number | null;
  teamChoice?: 1 | 2 | null;
}

export class Lobby {
  id: string;
  code: string;
  name: string;
  mode: GameMode;
  timeControl: TimeControl;
  private: boolean;
  teamMode: TeamMode = 'auto';
  isAuto = false;
  autoCountdown: number | null = null;
  isPaused = false;
  countdownTimer: NodeJS.Timeout | null = null;
  pausedBy: Set<number> = new Set();
  members: Map<number, LobbyMember> = new Map();
  chatIdSeq = 1;
  createdAt = Date.now();
  started = false;
  rematchOf: number | null = null;

  constructor(
    data: CreateLobbyPayload & { id: string; code: string },
    host: LobbyMember,
    rematchOf?: number | null,
  ) {
    this.id = data.id;
    this.code = data.code;
    this.name = data.name;
    this.mode = data.mode;
    this.timeControl = data.timeControl;
    this.private = data.private;
    this.teamMode = data.teamMode || 'auto';
    this.rematchOf = rematchOf ?? null;
    this.members.set(host.uid, { ...host });
  }

  clearCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.autoCountdown = null;
    this.isPaused = false;
    this.pausedBy.clear();
  }

  summary(): LobbySummary {
    const players: LobbyPlayer[] = [...this.members.values()].map((m) => ({
      userId: m.uid,
      username: m.username,
      rating: m.rating,
      ready: m.ready,
      online: m.isBot ? true : presence.isOnline(m.uid),
      host: m.host,
      isBot: m.isBot,
      botLevel: m.botLevel,
      teamChoice: m.teamChoice,
    }));
    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      timeControl: this.timeControl,
      players,
      code: this.code,
      started: this.started,
      isAuto: this.isAuto,
      teamMode: this.teamMode,
      autoCountdown: this.autoCountdown,
      pausedBy: [...this.pausedBy],
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
    void this.ensureAutoLobby();
  }

  publicList(): Lobby[] {
    return [...this.lobbies.values()].filter((l) => !l.started && !l.private);
  }

  async ensureAutoLobby(): Promise<void> {
    const existing = [...this.lobbies.values()].find((l) => l.isAuto && !l.started);
    if (existing) return;

    const botUsers = await prisma.user.findMany({
      where: { isBot: true },
      take: 4,
      orderBy: { botLevel: 'asc' },
    });
    if (botUsers.length < 4) return;

    const id = `AUTO_${this.idSeq++}`;
    const code = genCode();
    const host = botUsers[0];

    const lobby = new Lobby(
      {
        id,
        code,
        name: 'Быстрый стол 2х2',
        mode: 'team',
        timeControl: { kind: 'clock', baseMin: 3, incSec: 0 },
        private: false,
        teamMode: 'auto',
      },
      {
        uid: host.id,
        username: host.username,
        rating: host.rating,
        ready: true,
        host: true,
        joinedAt: Date.now(),
        isBot: true,
        botLevel: host.botLevel,
      },
    );
    lobby.isAuto = true;

    for (let i = 1; i < 4; i++) {
      const b = botUsers[i];
      lobby.members.set(b.id, {
        uid: b.id,
        username: b.username,
        rating: b.rating,
        ready: true,
        host: false,
        joinedAt: Date.now(),
        isBot: true,
        botLevel: b.botLevel,
      });
    }

    this.lobbies.set(id, lobby);
    this.broadcastList();
  }

  async refillAutoBots(lobby: Lobby): Promise<void> {
    if (!lobby.isAuto || lobby.started) return;
    const botUsers = await prisma.user.findMany({
      where: { isBot: true },
      take: 5,
      orderBy: { botLevel: 'asc' },
    });
    for (const b of botUsers) {
      if (lobby.members.size >= MAX_SLOTS) break;
      if (!lobby.members.has(b.id)) {
        lobby.members.set(b.id, {
          uid: b.id,
          username: b.username,
          rating: b.rating,
          ready: true,
          host: lobby.members.size === 0,
          joinedAt: Date.now(),
          isBot: true,
          botLevel: b.botLevel,
        });
      }
    }
  }

  async joinWithUser(lobbyId: string, uid: number): Promise<{ ok: true } | { ok: false; error: string }> {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, error: 'Лобби не найдено' };
    const user = await prisma.user.findUnique({ where: { id: uid } });
    if (!user) return { ok: false, error: 'Пользователь не найден' };
    return this.join(lobby, {
      uid: user.id,
      username: user.username,
      rating: user.rating,
      isBot: user.isBot,
      botLevel: user.botLevel,
    });
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

  join(
    lobby: Lobby,
    member: { uid: number; username: string; rating: number; isBot?: boolean; botLevel?: number | null; host?: boolean },
  ): { ok: true } | { ok: false; error: string } {
    if (lobby.started) return { ok: false, error: 'Игра уже началась' };
    if (lobby.members.has(member.uid)) return { ok: true };

    if (lobby.isAuto && !member.isBot) {
      // Человек вытесняет первого бота
      if (lobby.members.size >= MAX_SLOTS) {
        const botEntry = [...lobby.members.values()].find((m) => m.isBot);
        if (botEntry) {
          lobby.members.delete(botEntry.uid);
          if (botEntry.host) {
            member.host = true;
          }
        }
      }
    } else {
      if (lobby.members.size >= MAX_SLOTS) return { ok: false, error: 'Лобби заполнено' };
    }

    const isHost = lobby.members.size === 0 || (!member.isBot && ![...lobby.members.values()].some((m) => !m.isBot && m.host));
    if (isHost) {
      for (const m of lobby.members.values()) m.host = false;
    }

    lobby.members.set(member.uid, {
      uid: member.uid,
      username: member.username,
      rating: member.rating,
      ready: lobby.isAuto ? true : false,
      host: isHost,
      joinedAt: Date.now(),
      isBot: member.isBot,
      botLevel: member.botLevel,
    });

    if (lobby.isAuto && !member.isBot) {
      this.resetAutoCountdown(lobby);
    }

    this.broadcastState(lobby);
    this.broadcastList();
    return { ok: true };
  }

  resetAutoCountdown(lobby: Lobby): void {
    if (!lobby.isAuto || lobby.started) return;
    const humans = [...lobby.members.values()].filter((m) => !m.isBot);
    if (!humans.length) {
      lobby.clearCountdown();
      return;
    }

    lobby.pausedBy.clear();
    lobby.autoCountdown = 10;
    lobby.isPaused = false;

    if (lobby.countdownTimer) clearInterval(lobby.countdownTimer);

    this.broadcastCountdown(lobby);

    lobby.countdownTimer = setInterval(async () => {
      if (lobby.isPaused) return;

      if (lobby.autoCountdown !== null && lobby.autoCountdown > 0) {
        lobby.autoCountdown -= 1;
        this.broadcastCountdown(lobby);
      }

      if (lobby.autoCountdown === 0) {
        lobby.clearCountdown();
        const host = [...lobby.members.values()].find((m) => m.host) || lobby.members.values().next().value;
        if (host) {
          await this.start(lobby.id, host.uid);
        }
      }
    }, 1000);
  }

  broadcastCountdown(lobby: Lobby): void {
    const humans = [...lobby.members.values()].filter((m) => !m.isBot);
    this.io?.to(this.room(lobby.id)).emit('lobby:countdown', {
      lobbyId: lobby.id,
      seconds: lobby.autoCountdown,
      paused: lobby.isPaused,
      pausedCount: lobby.pausedBy.size,
      neededCount: humans.length,
    });
  }

  pauseToggle(lobbyId: string, uid: number): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || !lobby.isAuto || lobby.autoCountdown === null) return;
    const m = lobby.members.get(uid);
    if (!m || m.isBot) return;

    if (lobby.pausedBy.has(uid)) {
      lobby.pausedBy.delete(uid);
    } else {
      lobby.pausedBy.add(uid);
    }

    const humans = [...lobby.members.values()].filter((x) => !x.isBot);
    const isPaused = humans.length === 1 ? lobby.pausedBy.has(uid) : lobby.pausedBy.size === humans.length;
    lobby.isPaused = isPaused;

    this.broadcastCountdown(lobby);
    this.broadcastState(lobby);
  }

  setTeamChoice(lobbyId: string, uid: number, team: 1 | 2 | null): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby || lobby.teamMode !== 'manual') return;
    const m = lobby.members.get(uid);
    if (!m) return;
    m.teamChoice = team;
    this.broadcastState(lobby);
  }

  setTeamMode(lobbyId: string, uid: number, teamMode: TeamMode): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    const m = lobby.members.get(uid);
    if (!m?.host) return;
    lobby.teamMode = teamMode;
    this.broadcastState(lobby);
  }

  leave(lobbyId: string, uid: number): void {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return;
    lobby.members.delete(uid);
    lobby.pausedBy.delete(uid);

    if (lobby.isAuto) {
      const humans = [...lobby.members.values()].filter((m) => !m.isBot);
      if (humans.length === 0) {
        lobby.clearCountdown();
        void this.refillAutoBots(lobby);
      } else {
        const isPaused = humans.length === 1 ? lobby.pausedBy.size === 1 : lobby.pausedBy.size === humans.length;
        lobby.isPaused = isPaused;
        this.broadcastCountdown(lobby);
      }
      this.broadcastState(lobby);
      this.broadcastList();
      return;
    }

    if (lobby.members.size === 0) {
      this.lobbies.delete(lobbyId);
      this.broadcastList();
      return;
    }

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
    if (!lobby || lobby.isAuto) return;
    const kicker = lobby.members.get(uid);
    const target = lobby.members.get(targetUid);
    if (!kicker?.host || !target) return;
    lobby.members.delete(targetUid);
    this.broadcastState(lobby);
    this.broadcastList();
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

  summon(lobbyId: string, uid: number): { sentTo: number[] } {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { sentTo: [] };
    const caller = lobby.members.get(uid);
    if (!caller) return { sentTo: [] };
    const sentTo: number[] = [];
    for (const m of lobby.members.values()) {
      if (m.uid === uid || m.isBot) continue;
      if (presence.isOnline(m.uid)) continue;
      presence.emitToUser(m.uid, 'user:notif', {
        type: 'lobby_invite',
        lobbyId: lobby.id,
        lobbyName: lobby.name,
      });
      sentTo.push(m.uid);
    }
    return { sentTo };
  }

  async start(lobbyId: string, uid: number): Promise<{ ok: true; gameId: number } | { ok: false; error: string }> {
    const lobby = this.lobbies.get(lobbyId);
    if (!lobby) return { ok: false, error: 'Лобби не найдено' };
    const host = lobby.members.get(uid);
    if (!host?.host && !lobby.isAuto) return { ok: false, error: 'Только хост может начать игру' };
    if (lobby.members.size !== MAX_SLOTS) return { ok: false, error: 'Нужно 4 игрока' };

    for (const m of lobby.members.values()) {
      if (!m.ready) return { ok: false, error: 'Не все готовы' };
    }

    lobby.clearCountdown();

    const membersList = [...lobby.members.values()];
    const humans = membersList.filter((m) => !m.isBot);
    const bots = membersList.filter((m) => m.isBot);

    let team1: LobbyMember[];
    let team2: LobbyMember[];

    if (lobby.teamMode === 'manual') {
      const chosenT1 = membersList.filter((m) => m.teamChoice === 1);
      const chosenT2 = membersList.filter((m) => m.teamChoice === 2);
      const unassigned = membersList.filter((m) => !m.teamChoice);

      team1 = [...chosenT1];
      team2 = [...chosenT2];

      for (const u of unassigned) {
        if (team1.length < 2) team1.push(u);
        else team2.push(u);
      }
    } else if (lobby.teamMode === 'random') {
      const shuffled = [...membersList].sort(() => Math.random() - 0.5);
      team1 = [shuffled[0], shuffled[1]];
      team2 = [shuffled[2], shuffled[3]];
    } else {
      // 'auto' mode
      if (humans.length === 2 && bots.length === 2) {
        // Балансировка 2 игроков: Человек А против Человека Б
        const [humanA, humanB] = humans.sort((a, b) => b.rating - a.rating);
        const [botA, botB] = bots.sort((a, b) => b.rating - a.rating);
        // humanA (выше) получает botB (ниже), humanB (ниже) получает botA (выше)
        team1 = [humanA, botB];
        team2 = [humanB, botA];
      } else {
        // Змейка по Elo p1+p4 vs p2+p3
        const sorted = [...membersList].sort((a, b) => b.rating - a.rating);
        team1 = [sorted[0], sorted[3]];
        team2 = [sorted[1], sorted[2]];
      }
    }

    const gameId = await this.games!.createGame({
      mode: lobby.mode,
      timeControl: lobby.timeControl,
      team1: team1.map((m) => ({
        uid: m.uid,
        username: m.username,
        rating: m.rating,
        isBot: m.isBot,
        botLevel: m.botLevel,
      })),
      team2: team2.map((m) => ({
        uid: m.uid,
        username: m.username,
        rating: m.rating,
        isBot: m.isBot,
        botLevel: m.botLevel,
      })),
    });

    lobby.started = true;
    const gameRoom = this.games!.gameRoom(gameId);
    this.io?.in(this.room(lobbyId)).socketsJoin(gameRoom);
    const activeGame = this.games!.getActive(gameId);
    if (activeGame) {
      this.io?.to(gameRoom).emit('game:state', this.games!.toGameState(activeGame));
    }

    this.io?.to(this.room(lobbyId)).emit('lobby:started', { gameId });
    this.broadcastList();

    if (lobby.isAuto) {
      void this.ensureAutoLobby();
    }

    setTimeout(() => {
      this.lobbies.delete(lobbyId);
    }, 2000);

    return { ok: true, gameId };
  }

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
