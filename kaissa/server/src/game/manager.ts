import type { Server as SocketServer } from 'socket.io';
import type {
  ChatMessage,
  EndReason,
  GameMode,
  GameState,
  LiveGameInfo,
  PieceType,
  Pocket,
  Team,
  TimeControl,
} from 'shared';
import { DEFAULT_POCKET, eloDelta } from 'shared';
import { prisma } from '../prisma.js';
import { presence } from '../socket/presence.js';
import { BughouseGame, type Board, type SideColor } from './bughouse.js';
import { TeamGame } from './teamGame.js';
import { clockOnMove, clockSnapshot, initClock, type ClockState } from './clock.js';

// ============================================================
// GamesManager: активные партии в памяти + запись ходов в БД.
//
// Багхаус: обе доски активны одновременно, ходы независимы.
//   Доска 0: team1 — белые, team2 — чёрные.
//   Доска 1: team2 — белые, team1 — чёрные.
// Team 2v2: одна доска, члены команды чередуются (moveSlot).
// ============================================================

export interface ParticipantSetup {
  uid: number;
  username: string;
  rating: number;
}

export interface CreateGameOpts {
  mode: GameMode;
  timeControl: TimeControl;
  team1: ParticipantSetup[];
  team2: ParticipantSetup[];
}

interface ActiveParticipant {
  uid: number;
  username: string;
  team: Team;
  color: SideColor;
  boardIndex: 0 | 1;
  moveSlot: 0 | 1;
  ratingBefore: number;
  ratingAfter: number | null;
}

interface ActiveGame {
  id: number;
  mode: GameMode;
  timeControl: TimeControl;
  participants: ActiveParticipant[];
  engine: TeamGame | BughouseGame;
  clocks: ClockState[];
  ply: number;
  startedAt: number;
  status: 'active' | 'finished' | 'abandoned';
  result: '*' | '1-0' | '0-1';
  reason: EndReason | null;
  disconnected: Set<number>;
  chatIdSeq: number;
}

const TEAM_COLORS_BUGHOUSE: Record<Team, Record<Board, SideColor>> = {
  1: { 0: 'w', 1: 'b' },
  2: { 0: 'b', 1: 'w' },
};

export class GamesManager {
  private games = new Map<number, ActiveGame>();
  private io: SocketServer | null = null;
  private chatGlobalSeq = 1;
  private flagInterval: NodeJS.Timeout | null = null;

  attach(io: SocketServer): void {
    this.io = io;
    if (!this.flagInterval) {
      this.flagInterval = setInterval(() => void this.checkFlags(), 500);
    }
  }

  gameRoom(id: number): string {
    return `game:${id}`;
  }

  getActive(id: number): ActiveGame | undefined {
    return this.games.get(id);
  }

  /** Найти активную партию, где uid — участник */
  activeGameOf(uid: number): number | null {
    for (const g of this.games.values()) {
      if (g.status === 'active' && g.participants.some((p) => p.uid === uid)) return g.id;
    }
    return null;
  }

  // ---------------- Создание ----------------

  async createGame(opts: CreateGameOpts): Promise<number> {
    const team1 = opts.team1.slice(0, 2);
    const team2 = opts.team2.slice(0, 2);
    if (team1.length !== 2 || team2.length !== 2) throw new Error('Нужны команды по 2 игрока');

    const noClock = opts.timeControl.kind === 'none';
    const baseMs = opts.timeControl.baseMin * 60_000;
    const incMs = opts.timeControl.incSec * 1000;

    const participants = buildParticipants(opts.mode, team1, team2);
    const dbGame = await prisma.game.create({
      data: {
        mode: opts.mode,
        status: 'active',
        baseMin: opts.timeControl.baseMin,
        incSec: opts.timeControl.incSec,
        noClock,
        participants: {
          create: participants.map((p) => ({
            userId: p.uid,
            team: p.team,
            color: p.color,
            boardIndex: p.boardIndex,
            moveSlot: p.moveSlot,
            ratingBefore: p.ratingBefore,
          })),
        },
      },
    });

    const engine = opts.mode === 'bughouse' ? new BughouseGame() : new TeamGame();
    const clockCount = opts.mode === 'bughouse' ? 2 : 1;
    const clocks = Array.from({ length: clockCount }, () => initClock(baseMs, incMs));

    const game: ActiveGame = {
      id: dbGame.id,
      mode: opts.mode,
      timeControl: opts.timeControl,
      participants,
      engine,
      clocks,
      ply: 0,
      startedAt: Date.now(),
      status: 'active',
      result: '*',
      reason: null,
      disconnected: new Set(),
      chatIdSeq: 1,
    };
    this.games.set(game.id, game);
    this.io?.to('live').emit('live:new', this.liveInfo(game));
    return game.id;
  }

  // ---------------- Ходы ----------------

  async applyMove(
    gameId: number,
    uid: number,
    data: { boardIndex: 0 | 1; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType },
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    const g = this.games.get(gameId);
    if (!g || g.status !== 'active') return { ok: false, error: 'Партия не активна' };
    const p = g.participants.find((x) => x.uid === uid);
    if (!p) return { ok: false, error: 'Вы не участник' };

    const now = Date.now();
    let fen: string;
    let check = false;

    try {
      if (g.mode === 'bughouse') {
        const bg = g.engine as BughouseGame;
        const board = data.boardIndex as Board;
        if (board !== p.boardIndex) return { ok: false, error: 'Это не ваша доска' };
        const moverColor = TEAM_COLORS_BUGHOUSE[p.team][board];
        if (bg.turn(board) !== moverColor) return { ok: false, error: 'Сейчас не ваш ход' };
        const res = bg.apply(
          data.dropPiece
            ? { board, to: data.to, piece: data.dropPiece }
            : { board, from: data.from, to: data.to, ...(data.promotion ? { promotion: data.promotion } : {}) },
        );
        fen = res.fen;
        check = res.check;
      } else {
        const tg = g.engine as TeamGame;
        if (tg.turn() !== p.color) return { ok: false, error: 'Сейчас не ваш ход' };
        if (tg.currentSlot() !== p.moveSlot) return { ok: false, error: 'Сейчас ход вашего партнёра' };
        const res = tg.applyMove(p.color, p.moveSlot, data.from, data.to, data.promotion);
        fen = res.fen;
        check = res.check;
      }
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Недопустимый ход' };
    }

    // Часы
    let clocksAfter: [number, number] | null = null;
    if (g.timeControl.kind === 'clock') {
      const moverColor = g.mode === 'bughouse' ? TEAM_COLORS_BUGHOUSE[p.team][data.boardIndex as Board] : p.color;
      const r = clockOnMove(g.clocks[data.boardIndex], moverColor, now);
      g.clocks[data.boardIndex] = r.clock;
      if (r.flagged) {
        // флаг уже упал — завершаем (ход при этом засчитан)
        await this.persistMove(g, uid, data, fen, null);
        g.ply += 1;
        await this.finishByFlag(g, data.boardIndex as Board, r.flagged);
        return { ok: true };
      }
      const snap = clockSnapshot(g.clocks[data.boardIndex], now);
      clocksAfter = [snap.whiteMs, snap.blackMs];
    }

    g.ply += 1;
    await this.persistMove(g, uid, data, fen, clocksAfter);

    // Рассылка хода
    this.io?.to(this.gameRoom(g.id)).emit('game:move', {
      gameId: g.id,
      boardIndex: data.boardIndex,
      ply: g.ply,
      userId: uid,
      from: data.dropPiece ? '-' : data.from,
      to: data.to,
      ...(data.promotion ? { promotion: data.promotion } : {}),
      ...(data.dropPiece ? { dropPiece: data.dropPiece } : {}),
      clocksAfter,
    });
    this.io?.to('live').emit('live:update', this.liveInfo(g));

    await this.checkEndAfterMove(g, data.boardIndex as Board);
    return { ok: true };
  }

  private async persistMove(
    g: ActiveGame,
    uid: number,
    data: { boardIndex: 0 | 1; from: string; to: string; promotion?: PieceType; dropPiece?: PieceType },
    fen: string,
    clocksAfter: [number, number] | null,
  ): Promise<void> {
    await prisma.gameMove.create({
      data: {
        gameId: g.id,
        boardIndex: data.boardIndex,
        ply: g.ply + 1,
        userId: uid,
        from: data.dropPiece ? '-' : data.from,
        to: data.to,
        promotion: data.promotion ?? null,
        dropPiece: data.dropPiece ?? null,
        fenAfter: fen,
        clocksAfter: clocksAfter ? JSON.stringify(clocksAfter) : null,
      },
    });
  }

  /** Автоматические условия завершения после хода */
  private async checkEndAfterMove(g: ActiveGame, board: Board): Promise<void> {
    if (g.status !== 'active') return;
    if (g.mode === 'bughouse') {
      const bg = g.engine as BughouseGame;
      if (bg.isBughouseCheckmate(board)) {
        const loserColor = bg.turn(board);
        const loserTeam = teamOfBoardColor(board, loserColor);
        await this.finish(g, loserTeam === 1 ? '0-1' : '1-0', 'checkmate');
      } else if (bg.isBughouseStalemate(board)) {
        const loserColor = bg.turn(board);
        const loserTeam = teamOfBoardColor(board, loserColor);
        await this.finish(g, loserTeam === 1 ? '0-1' : '1-0', 'stalemate');
      }
      return;
    }
    const tg = g.engine as TeamGame;
    if (tg.isCheckmate()) {
      await this.finish(g, tg.turn() === 'w' ? '0-1' : '1-0', 'checkmate');
    } else if (tg.isStalemate()) {
      // Пат в командном 2v2 без ничьих: зажатая сторона проиграла
      await this.finish(g, tg.turn() === 'w' ? '0-1' : '1-0', 'stalemate');
    }
    // Троекратное повторение, 50 ходов и недостаток материала не завершают партию:
    // ничьих нет, игроки могут завершить сдачей или часами.
  }

  // ---------------- Часы ----------------

  async checkFlags(): Promise<void> {
    for (const g of [...this.games.values()]) {
      if (g.status !== 'active' || g.timeControl.kind !== 'clock') continue;
      const now = Date.now();
      for (let b = 0; b < g.clocks.length; b++) {
        const c = g.clocks[b];
        if (c.active === null) continue;
        const remaining = (c.active === 'w' ? c.whiteMs : c.blackMs) - (now - c.sinceMs);
        if (remaining <= 0) {
          await this.finishByFlag(g, b as Board, c.active);
          break;
        }
      }
    }
  }

  private async finishByFlag(g: ActiveGame, board: Board, flaggedColor: SideColor): Promise<void> {
    const flaggedTeam = teamOfBoardColor(board, flaggedColor);
    await this.finish(g, flaggedTeam === 1 ? '0-1' : '1-0', 'timeout');
  }

  // ---------------- Завершение / Elo ----------------

  async resign(gameId: number, uid: number): Promise<void> {
    const g = this.games.get(gameId);
    if (!g || g.status !== 'active') return;
    const p = g.participants.find((x) => x.uid === uid);
    if (!p) return;
    await this.finish(g, p.team === 1 ? '0-1' : '1-0', 'resign');
  }

  private async finish(g: ActiveGame, result: '1-0' | '0-1', reason: EndReason): Promise<void> {
    if (g.status !== 'active') return;
    g.status = 'finished';
    g.result = result;
    g.reason = reason;

    const winnerTeam: Team = result === '1-0' ? 1 : 2;
    const winners = g.participants.filter((p) => p.team === winnerTeam);
    const losers = g.participants.filter((p) => p.team !== winnerTeam);
    const avg = (arr: ActiveParticipant[]) => arr.reduce((s, p) => s + p.ratingBefore, 0) / arr.length;
    const avgWin = avg(winners);
    const avgLose = avg(losers);

    for (const p of g.participants) {
      const opponent = p.team === winnerTeam ? avgLose : avgWin;
      const score: 0 | 1 = p.team === winnerTeam ? 1 : 0;
      const delta = eloDelta(p.ratingBefore, opponent, score);
      const after = Math.max(100, p.ratingBefore + delta);
      p.ratingAfter = after;
      await prisma.gameParticipant.update({
        where: { gameId_userId: { gameId: g.id, userId: p.uid } },
        data: { ratingAfter: after },
      });
      await prisma.user.update({
        where: { id: p.uid },
        data: {
          rating: after,
          wins: { increment: p.team === winnerTeam ? 1 : 0 },
          losses: { increment: p.team !== winnerTeam ? 1 : 0 },
        },
      });
      await prisma.ratingHistory.create({
        data: { userId: p.uid, delta, value: after, gameId: g.id },
      });
    }

    await prisma.game.update({
      where: { id: g.id },
      data: { status: 'finished', result, reason, endedAt: new Date() },
    });

    this.io?.to(this.gameRoom(g.id)).emit('game:end', {
      gameId: g.id,
      result,
      reason,
      participants: g.participants.map(toParticipantInfo),
    });
    this.io?.to('live').emit('live:end', { gameId: g.id, result });

    setTimeout(() => this.games.delete(g.id), 30 * 60_000);
  }

  // ---------------- Отключения ----------------

  onPlayerDisconnect(gameId: number, uid: number): void {
    const g = this.games.get(gameId);
    if (!g || g.status !== 'active') return;
    if (!g.participants.some((p) => p.uid === uid)) return;
    if (presence.isOnline(uid)) return; // осталась другая вкладка
    g.disconnected.add(uid);
    this.broadcastDisconnected(g);
    if (g.disconnected.size >= 4) {
      void this.abandon(g);
    }
  }

  onPlayerReconnect(gameId: number, uid: number): void {
    const g = this.games.get(gameId);
    if (!g) return;
    if (g.disconnected.delete(uid)) {
      this.broadcastDisconnected(g);
      this.systemMessage(g, `${this.usernameOf(g, uid)} вернулся в партию`);
    }
  }

  private broadcastDisconnected(g: ActiveGame): void {
    this.io?.to(this.gameRoom(g.id)).emit('game:players-left', {
      gameId: g.id,
      left: g.participants
        .filter((p) => g.disconnected.has(p.uid))
        .map((p) => ({ userId: p.uid, username: p.username, reconnected: false, leftCount: g.disconnected.size })),
    });
  }

  private systemMessage(g: ActiveGame, text: string): void {
    this.io?.to(this.gameRoom(g.id)).emit('game:chat', {
      id: this.chatGlobalSeq++,
      userId: 0,
      username: 'system',
      text,
      at: Date.now(),
      system: true,
      gameId: g.id,
    } as ChatMessage & { gameId: number });
  }

  private usernameOf(g: ActiveGame, uid: number): string {
    return g.participants.find((p) => p.uid === uid)?.username ?? 'игрок';
  }

  private async abandon(g: ActiveGame): Promise<void> {
    if (g.status !== 'active') return;
    g.status = 'abandoned';
    g.reason = 'abandoned';
    await prisma.game.update({
      where: { id: g.id },
      data: { status: 'abandoned', reason: 'abandoned', endedAt: new Date() },
    });
    this.io?.to(this.gameRoom(g.id)).emit('game:end', {
      gameId: g.id,
      result: '*',
      reason: 'abandoned',
      participants: g.participants.map(toParticipantInfo),
    });
    this.io?.to('live').emit('live:end', { gameId: g.id, result: '*' });
    setTimeout(() => this.games.delete(g.id), 60_000);
  }

  async cleanupOnBoot(): Promise<void> {
    await prisma.game.updateMany({
      where: { status: 'active' },
      data: { status: 'abandoned', reason: 'abandoned', endedAt: new Date() },
    });
  }

  // ---------------- Чат ----------------

  chat(gameId: number, uid: number, text: string): void {
    const g = this.games.get(gameId);
    if (!g) return;
    const p = g.participants.find((x) => x.uid === uid);
    if (!p) return;
    const clean = text.trim().slice(0, 300);
    if (!clean) return;
    this.io?.to(this.gameRoom(gameId)).emit('game:chat', {
      id: this.chatGlobalSeq++,
      userId: uid,
      username: p.username,
      text: clean,
      at: Date.now(),
      gameId,
    });
  }

  // ---------------- Live ----------------

  liveInfo(g: ActiveGame): LiveGameInfo {
    const fens =
      g.mode === 'bughouse'
        ? [(g.engine as BughouseGame).fen(0), (g.engine as BughouseGame).fen(1)]
        : [(g.engine as TeamGame).fen()];
    return {
      gameId: g.id,
      mode: g.mode,
      players: g.participants.map((p) => ({
        userId: p.uid,
        username: p.username,
        rating: p.ratingBefore,
        team: p.team,
      })),
      fens,
      moveNumber: g.ply,
      startedAt: g.startedAt,
    };
  }

  liveSnapshot(): LiveGameInfo[] {
    return [...this.games.values()]
      .filter((g) => g.status === 'active')
      .map((g) => this.liveInfo(g));
  }

  // ---------------- Состояние ----------------

  toGameState(g: ActiveGame): GameState {
    const isBug = g.mode === 'bughouse';
    const now = Date.now();
    const fens = isBug
      ? [(g.engine as BughouseGame).fen(0), (g.engine as BughouseGame).fen(1)]
      : [(g.engine as TeamGame).fen()];
    const turns: ('w' | 'b')[] = isBug
      ? [(g.engine as BughouseGame).turn(0), (g.engine as BughouseGame).turn(1)]
      : [(g.engine as TeamGame).turn()];
    const clocks: [number, number][] = g.clocks.map((c) => {
      const s = clockSnapshot(c, now);
      return [s.whiteMs, s.blackMs];
    });
    const clocksActive: ('w' | 'b' | null)[] = g.clocks.map((c) => c.active);

    // Кто должен ходить на каждой доске
    const turnUserIds: number[] = [];
    if (g.status === 'active') {
      if (isBug) {
        for (const b of [0, 1] as Board[]) {
          const color = (g.engine as BughouseGame).turn(b);
          const team = teamOfBoardColor(b, color);
          const who = g.participants.find((p) => p.team === team && p.boardIndex === b);
          turnUserIds.push(who?.uid ?? 0);
        }
      } else {
        const tg = g.engine as TeamGame;
        const team: Team = tg.turn() === 'w' ? 1 : 2;
        const who = g.participants.find((p) => p.team === team && p.moveSlot === tg.currentSlot());
        turnUserIds.push(who?.uid ?? 0);
      }
    } else {
      turnUserIds.push(0);
    }

    // Карманы по участникам в порядке participants
    let pockets: Pocket[] | null = null;
    if (isBug) {
      const bg = g.engine as BughouseGame;
      pockets = g.participants.map((p) => bg.pocketOf(p.boardIndex, p.color));
    }

    return {
      gameId: g.id,
      mode: g.mode,
      status: g.status,
      result: g.result,
      reason: g.reason,
      timeControl: g.timeControl,
      participants: g.participants.map(toParticipantInfo),
      fens,
      pockets,
      moveNumber: g.ply,
      turns,
      turnUserIds,
      clocks,
      clocksActive,
      startedAt: g.startedAt,
    };
  }

  /** Данные игроков для реванша */
  async rematchPlayers(gameId: number): Promise<{ uid: number; username: string; rating: number }[]> {
    const parts = await prisma.gameParticipant.findMany({
      where: { gameId },
      include: { user: true },
    });
    return parts.map((p) => ({ uid: p.userId, username: p.user.username, rating: p.user.rating }));
  }
}

// ---------------- Вспомогательные ----------------

function teamOfBoardColor(board: Board, color: SideColor): Team {
  // Доска 0: w=team1, b=team2. Доска 1: w=team2, b=team1.
  if (board === 0) return color === 'w' ? 1 : 2;
  return color === 'w' ? 2 : 1;
}

function toParticipantInfo(p: ActiveParticipant): import('shared').GameParticipantInfo {
  return {
    userId: p.uid,
    username: p.username,
    team: p.team,
    color: p.color,
    boardIndex: p.boardIndex,
    moveSlot: p.moveSlot,
    ratingBefore: p.ratingBefore,
    ratingAfter: p.ratingAfter,
  };
}

function buildParticipants(mode: GameMode, team1: ParticipantSetup[], team2: ParticipantSetup[]): ActiveParticipant[] {
  const mk = (s: ParticipantSetup, team: Team, color: SideColor, boardIndex: 0 | 1, moveSlot: 0 | 1): ActiveParticipant => ({
    uid: s.uid,
    username: s.username,
    team,
    color,
    boardIndex,
    moveSlot,
    ratingBefore: s.rating,
    ratingAfter: null,
  });
  if (mode === 'bughouse') {
    return [
      mk(team1[0], 1, 'w', 0, 0), // доска 0, белые
      mk(team1[1], 1, 'b', 1, 0), // доска 1, чёрные
      mk(team2[0], 2, 'b', 0, 0), // доска 0, чёрные
      mk(team2[1], 2, 'w', 1, 0), // доска 1, белые
    ];
  }
  return [
    mk(team1[0], 1, 'w', 0, 0),
    mk(team1[1], 1, 'w', 0, 1),
    mk(team2[0], 2, 'b', 0, 0),
    mk(team2[1], 2, 'b', 0, 1),
  ];
}
