import { CROSS_TOPOLOGY } from './cross.js';
import { HEX_TOPOLOGY } from './hex.js';
import type { MultiVariant, Role, Topology } from './topology.js';

export interface MPiece {
  seat: number;
  role: Role;
  promoted?: boolean;
  dead?: boolean;
}

export type SeatStatus = 'active' | 'checkmated' | 'stalemated' | 'resigned' | 'timeout';

export type MultiEndReason = 'last-standing' | 'points-lead' | 'fifty' | 'repetition' | 'abandoned';

export interface MultiMoveLogItem {
  ply: number;
  seat: number;
  from: string;
  to: string;
  role: Role;
  captured?: { seat: number; role: Role; points: number };
  promoted?: boolean;
  checkedSeats?: number[];
  checkBonus?: number;
  eliminated?: { seat: number; status: SeatStatus; pointsTo?: number; points?: number }[];
}

export interface MultiSnapshot {
  variant: MultiVariant;
  board: Record<string, MPiece>;
  turn: number;
  status: SeatStatus[];
  scores: number[];
  eliminationOrder: number[];
  castling: [boolean, boolean][]; // [seat][0=k, 1=q]
  quietPlies: number;
  history: [string, number][];
  lastMove: { from: string; to: string; seat: number } | null;
  lastAttackerOfKing: (number | null)[];
  moveLog: MultiMoveLogItem[];
}

export interface MoveOutcome {
  from: string;
  to: string;
  seat: number;
  pointsAwarded: number;
  captured?: MPiece;
  promoted?: boolean;
  checkedSeats: number[];
  eliminated: { seat: number; status: SeatStatus; bySeat?: number; points: number }[];
  over: boolean;
  endReason?: MultiEndReason;
}

export function getTopology(variant: MultiVariant): Topology {
  return variant === 'four-player' ? CROSS_TOPOLOGY : HEX_TOPOLOGY;
}

export class MultiChessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MultiChessError';
  }
}

export class MultiChess {
  readonly topology: Topology;
  private board: Record<string, MPiece> = {};
  private _turn = 0;
  private status: SeatStatus[];
  private scores: number[];
  private eliminationOrder: number[] = [];
  private castlingRights: [boolean, boolean][];
  private quietPlies = 0;
  private repetitions = new Map<string, number>();
  private _lastMove: { from: string; to: string; seat: number } | null = null;
  private lastAttackerOfKing: (number | null)[];
  private moveLog: MultiMoveLogItem[] = [];

  constructor(readonly variant: MultiVariant, skipInit = false) {
    this.topology = getTopology(variant);
    const n = this.topology.seats;
    this.status = Array.from({ length: n }, () => 'active');
    this.scores = Array.from({ length: n }, () => 0);
    this.castlingRights = Array.from({ length: n }, () => [true, true]);
    this.lastAttackerOfKing = Array.from({ length: n }, () => null);

    if (!skipInit) {
      const setup = this.topology.initialSetup();
      for (const [sq, p] of Object.entries(setup)) {
        this.board[sq] = { seat: p.seat, role: p.role };
      }
      this.recordPosition();
    }
  }

  static create(variant: MultiVariant): MultiChess {
    return new MultiChess(variant);
  }

  static fromSnapshot(s: MultiSnapshot): MultiChess {
    const g = new MultiChess(s.variant, true);
    g.board = {};
    for (const [k, v] of Object.entries(s.board)) {
      g.board[k] = { ...v };
    }
    g._turn = s.turn;
    g.status = [...s.status];
    g.scores = [...s.scores];
    g.eliminationOrder = [...s.eliminationOrder];
    g.castlingRights = s.castling.map((c) => [c[0], c[1]]);
    g.quietPlies = s.quietPlies;
    g.repetitions = new Map(s.history);
    g._lastMove = s.lastMove ? { ...s.lastMove } : null;
    g.lastAttackerOfKing = [...(s.lastAttackerOfKing ?? Array.from({ length: g.topology.seats }, () => null))];
    g.moveLog = (s.moveLog ?? []).map((m) => ({ ...m }));
    return g;
  }

  snapshot(): MultiSnapshot {
    const boardCopy: Record<string, MPiece> = {};
    for (const [k, v] of Object.entries(this.board)) {
      boardCopy[k] = { ...v };
    }
    return {
      variant: this.variant,
      board: boardCopy,
      turn: this._turn,
      status: [...this.status],
      scores: [...this.scores],
      eliminationOrder: [...this.eliminationOrder],
      castling: this.castlingRights.map((c) => [c[0], c[1]]),
      quietPlies: this.quietPlies,
      history: [...this.repetitions.entries()],
      lastMove: this._lastMove ? { ...this._lastMove } : null,
      lastAttackerOfKing: [...this.lastAttackerOfKing],
      moveLog: this.moveLog.slice(-60),
    };
  }

  turn(): number {
    return this._turn;
  }

  seatStatus(seat: number): SeatStatus {
    return this.status[seat];
  }

  scoreOf(seat: number): number {
    return this.scores[seat] ?? 0;
  }

  scoresList(): number[] {
    return [...this.scores];
  }

  statusesList(): SeatStatus[] {
    return [...this.status];
  }

  pieceAt(sq: string): MPiece | undefined {
    return this.board[sq];
  }

  activeSeats(): number[] {
    const out: number[] = [];
    for (let s = 0; s < this.topology.seats; s++) {
      if (this.status[s] === 'active') out.push(s);
    }
    return out;
  }

  findKing(seat: number): string | null {
    for (const [sq, p] of Object.entries(this.board)) {
      if (p.seat === seat && p.role === 'k') return sq;
    }
    return null;
  }

  /**
   * Returns all active opponent seats that currently attack `targetSq` on `boardState`.
   */
  attackersOfSquare(
    targetSq: string,
    defenderSeat: number,
    boardState: Record<string, MPiece> = this.board,
  ): { seat: number; from: string; role: Role }[] {
    const attackers: { seat: number; from: string; role: Role }[] = [];
    for (const [sq, p] of Object.entries(boardState)) {
      if (p.dead || p.seat === defenderSeat || this.status[p.seat] !== 'active') continue;
      if (this.pieceAttacksSquare(sq, p, targetSq, boardState)) {
        attackers.push({ seat: p.seat, from: sq, role: p.role });
      }
    }
    return attackers;
  }

  isSquareAttacked(
    targetSq: string,
    defenderSeat: number,
    boardState: Record<string, MPiece> = this.board,
  ): boolean {
    for (const [sq, p] of Object.entries(boardState)) {
      if (p.dead || p.seat === defenderSeat || this.status[p.seat] !== 'active') continue;
      if (this.pieceAttacksSquare(sq, p, targetSq, boardState)) return true;
    }
    return false;
  }

  private pieceAttacksSquare(
    from: string,
    piece: MPiece,
    targetSq: string,
    boardState: Record<string, MPiece>,
  ): boolean {
    const t = this.topology;
    switch (piece.role) {
      case 'p':
        return t.pawnCaptures(from, piece.seat).includes(targetSq);
      case 'n':
        return t.knightTargets(from).includes(targetSq);
      case 'k':
        return t.kingTargets(from).includes(targetSq);
      case 'r':
        return this.rayHits(t.orthRays(from), targetSq, boardState);
      case 'b':
        return this.rayHits(t.diagRays(from), targetSq, boardState);
      case 'q':
        return (
          this.rayHits(t.orthRays(from), targetSq, boardState) ||
          this.rayHits(t.diagRays(from), targetSq, boardState)
        );
    }
  }

  private rayHits(rays: string[][], targetSq: string, boardState: Record<string, MPiece>): boolean {
    for (const ray of rays) {
      for (const sq of ray) {
        if (sq === targetSq) return true;
        if (boardState[sq]) break;
      }
    }
    return false;
  }

  isSeatInCheck(seat: number, boardState: Record<string, MPiece> = this.board): boolean {
    if (this.status[seat] !== 'active') return false;
    const kSq = this.findKingInBoard(seat, boardState);
    if (!kSq) return false;
    return this.isSquareAttacked(kSq, seat, boardState);
  }

  checkedKings(): string[] {
    const out: string[] = [];
    for (let s = 0; s < this.topology.seats; s++) {
      if (this.status[s] !== 'active') continue;
      const kSq = this.findKing(s);
      if (kSq && this.isSquareAttacked(kSq, s)) out.push(kSq);
    }
    return out;
  }

  private findKingInBoard(seat: number, boardState: Record<string, MPiece>): string | null {
    for (const [sq, p] of Object.entries(boardState)) {
      if (p.seat === seat && p.role === 'k') return sq;
    }
    return null;
  }

  /**
   * Pseudo-legal target squares for a piece at `from` belonging to `seat`.
   */
  private pseudoTargets(from: string, piece: MPiece): string[] {
    const t = this.topology;
    const out: string[] = [];
    const canLand = (sq: string): boolean => {
      const occ = this.board[sq];
      if (!occ) return true;
      if (occ.seat === piece.seat) return false;
      // Cannot capture dead kings (keep king on board or allow capturing dead pieces except dead king? Dead pieces including dead king can be captured for 0 pts, except let's allow capturing any non-own piece!)
      return true;
    };

    switch (piece.role) {
      case 'p': {
        const fwd1 = t.pawnForward(from, piece.seat);
        if (fwd1 && !this.board[fwd1]) {
          out.push(fwd1);
          if (t.isPawnStart(from, piece.seat)) {
            const fwd2 = t.pawnForward(fwd1, piece.seat);
            if (fwd2 && !this.board[fwd2]) out.push(fwd2);
          }
        }
        for (const cap of t.pawnCaptures(from, piece.seat)) {
          const occ = this.board[cap];
          if (occ && occ.seat !== piece.seat) out.push(cap);
        }
        break;
      }
      case 'n': {
        for (const sq of t.knightTargets(from)) {
          if (canLand(sq)) out.push(sq);
        }
        break;
      }
      case 'k': {
        for (const sq of t.kingTargets(from)) {
          if (canLand(sq)) out.push(sq);
        }
        // Castling
        const rights = this.castlingRights[piece.seat];
        const defs = t.castling(piece.seat);
        for (const def of defs) {
          const rIdx = def.side === 'k' ? 0 : 1;
          if (!rights?.[rIdx]) continue;
          if (from !== def.king) continue;
          const rookPiece = this.board[def.rook];
          if (!rookPiece || rookPiece.seat !== piece.seat || rookPiece.role !== 'r' || rookPiece.dead) continue;
          if (def.between.some((sq) => Boolean(this.board[sq]))) continue;
          if (def.pass.some((sq) => this.isSquareAttacked(sq, piece.seat))) continue;
          out.push(def.kingTo);
        }
        break;
      }
      case 'r':
        this.collectRayMoves(t.orthRays(from), piece.seat, out);
        break;
      case 'b':
        this.collectRayMoves(t.diagRays(from), piece.seat, out);
        break;
      case 'q':
        this.collectRayMoves(t.orthRays(from), piece.seat, out);
        this.collectRayMoves(t.diagRays(from), piece.seat, out);
        break;
    }
    return out;
  }

  private collectRayMoves(rays: string[][], seat: number, out: string[]): void {
    for (const ray of rays) {
      for (const sq of ray) {
        const occ = this.board[sq];
        if (!occ) {
          out.push(sq);
        } else {
          if (occ.seat !== seat) out.push(sq);
          break;
        }
      }
    }
  }

  legalMoves(seat = this._turn): Map<string, string[]> {
    const res = new Map<string, string[]>();
    if (this.status[seat] !== 'active') return res;

    for (const [from, piece] of Object.entries(this.board)) {
      if (piece.seat !== seat || piece.dead) continue;
      const targets = this.pseudoTargets(from, piece);
      const legal: string[] = [];
      for (const to of targets) {
        const nextBoard = this.simulateBoardAfterMove(seat, from, to);
        if (!this.isSeatInCheck(seat, nextBoard)) {
          legal.push(to);
        }
      }
      if (legal.length > 0) res.set(from, legal);
    }
    return res;
  }

  legalMovesRecord(seat = this._turn): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const [from, tos] of this.legalMoves(seat).entries()) {
      out[from] = tos;
    }
    return out;
  }

  private simulateBoardAfterMove(seat: number, from: string, to: string): Record<string, MPiece> {
    const next: Record<string, MPiece> = {};
    for (const [k, v] of Object.entries(this.board)) next[k] = { ...v };
    const moving = next[from];
    if (!moving) return next;
    delete next[from];

    // Check castling rook move
    if (moving.role === 'k') {
      const def = this.topology.castling(seat).find((d) => d.king === from && d.kingTo === to);
      if (def && next[def.rook]) {
        next[def.rookTo] = next[def.rook];
        delete next[def.rook];
      }
    }

    const promoted = moving.role === 'p' && this.topology.isPromotion(to, seat);
    next[to] = {
      seat,
      role: promoted ? 'q' : moving.role,
      ...(promoted || moving.promoted ? { promoted: true } : {}),
    };
    return next;
  }

  move(seat: number, from: string, to: string): MoveOutcome {
    if (seat !== this._turn) throw new MultiChessError('Сейчас ход другого игрока');
    if (this.status[seat] !== 'active') throw new MultiChessError('Вы уже выбыли из партии');
    const legal = this.legalMoves(seat).get(from);
    if (!legal || !legal.includes(to)) throw new MultiChessError('Недопустимый ход');

    const moving = this.board[from]!;
    const captured = this.board[to];
    delete this.board[from];

    // Update castling rights
    if (moving.role === 'k') {
      this.castlingRights[seat] = [false, false];
      const def = this.topology.castling(seat).find((d) => d.king === from && d.kingTo === to);
      if (def && this.board[def.rook]) {
        this.board[def.rookTo] = this.board[def.rook];
        delete this.board[def.rook];
      }
    }
    if (moving.role === 'r') {
      for (const def of this.topology.castling(seat)) {
        if (from === def.rook) {
          this.castlingRights[seat][def.side === 'k' ? 0 : 1] = false;
        }
      }
    }
    if (captured && captured.role === 'r' && !captured.dead) {
      for (const def of this.topology.castling(captured.seat)) {
        if (to === def.rook) {
          this.castlingRights[captured.seat][def.side === 'k' ? 0 : 1] = false;
        }
      }
    }

    const promoted = moving.role === 'p' && this.topology.isPromotion(to, seat);
    const placed: MPiece = {
      seat,
      role: promoted ? 'q' : moving.role,
      ...(promoted || moving.promoted ? { promoted: true } : {}),
    };
    this.board[to] = placed;

    // Points for capture
    let pointsAwarded = 0;
    let capLog: MultiMoveLogItem['captured'];
    if (captured) {
      if (!captured.dead) {
        const vals = this.topology.pieceValues();
        const capPoints = captured.role === 'q' && captured.promoted ? 1 : vals[captured.role];
        pointsAwarded += capPoints;
        capLog = { seat: captured.seat, role: captured.role, points: capPoints };
      } else {
        capLog = { seat: captured.seat, role: captured.role, points: 0 };
      }
    }

    if (captured || moving.role === 'p') {
      this.quietPlies = 0;
    } else {
      this.quietPlies += 1;
    }

    // Check which opponents are now in check & track last attacker of each king
    const checkedSeats: number[] = [];
    for (let s = 0; s < this.topology.seats; s++) {
      if (s === seat || this.status[s] !== 'active') continue;
      const kSq = this.findKing(s);
      if (!kSq) continue;
      const attackers = this.attackersOfSquare(kSq, s);
      if (attackers.length > 0) {
        checkedSeats.push(s);
        if (attackers.some((a) => a.seat === seat)) {
          this.lastAttackerOfKing[s] = seat;
        }
      } else {
        this.lastAttackerOfKing[s] = null;
      }
    }

    // Multi-check bonus (simultaneous check on 2 or 3 enemy kings by the mover)
    let checkBonus = 0;
    if (checkedSeats.length >= 2) {
      if (placed.role === 'q') {
        checkBonus = checkedSeats.length >= 3 ? 5 : 1;
      } else {
        checkBonus = checkedSeats.length >= 3 ? 20 : 5;
      }
      pointsAwarded += checkBonus;
    }

    this.scores[seat] += pointsAwarded;
    this._lastMove = { from, to, seat };

    const logItem: MultiMoveLogItem = {
      ply: (this.moveLog.at(-1)?.ply ?? 0) + 1,
      seat,
      from,
      to,
      role: moving.role,
      ...(capLog ? { captured: capLog } : {}),
      ...(promoted ? { promoted: true } : {}),
      ...(checkedSeats.length > 0 ? { checkedSeats } : {}),
      ...(checkBonus > 0 ? { checkBonus } : {}),
    };

    // Advance turn and check for checkmate / stalemate at the start of the next player's turn
    const eliminated = this.advanceTurnAndResolveEliminations();
    if (eliminated.length > 0) {
      logItem.eliminated = eliminated.map((e) => ({
        seat: e.seat,
        status: e.status,
        pointsTo: e.bySeat,
        points: e.points,
      }));
    }
    this.moveLog.push(logItem);
    if (this.moveLog.length > 80) this.moveLog.shift();

    this.recordPosition();
    const overInfo = this.isOver();

    return {
      from,
      to,
      seat,
      pointsAwarded,
      ...(captured ? { captured } : {}),
      ...(promoted ? { promoted: true } : {}),
      checkedSeats,
      eliminated,
      over: overInfo.over,
      endReason: overInfo.reason,
    };
  }

  /**
   * Eliminate a player due to resignation or flag timeout.
   * Their pieces become grey (dead = true) and stay on the board.
   */
  eliminate(seat: number, reason: 'resigned' | 'timeout'): MoveOutcome {
    if (this.status[seat] !== 'active') {
      const overInfo = this.isOver();
      return {
        from: '-',
        to: '-',
        seat,
        pointsAwarded: 0,
        checkedSeats: [],
        eliminated: [],
        over: overInfo.over,
        endReason: overInfo.reason,
      };
    }

    this.markSeatDead(seat, reason);
    const eliminated: { seat: number; status: SeatStatus; bySeat?: number; points: number }[] = [
      { seat, status: reason, points: 0 },
    ];

    if (this._turn === seat) {
      const cascade = this.advanceTurnAndResolveEliminations();
      eliminated.push(...cascade);
    } else {
      // Even if it wasn't `seat`'s turn, greying out `seat`'s pieces might affect the current turn player,
      // or leave only 1 active player.
      if (this.activeSeats().length > 1 && this.legalMoves(this._turn).size === 0) {
        const cascade = this.resolveCurrentTurnIfNoMoves();
        eliminated.push(...cascade);
      }
    }

    const overInfo = this.isOver();
    return {
      from: '-',
      to: '-',
      seat,
      pointsAwarded: 0,
      checkedSeats: [],
      eliminated,
      over: overInfo.over,
      endReason: overInfo.reason,
    };
  }

  private markSeatDead(seat: number, status: SeatStatus): void {
    this.status[seat] = status;
    if (!this.eliminationOrder.includes(seat)) {
      this.eliminationOrder.push(seat);
    }
    this.castlingRights[seat] = [false, false];
    for (const p of Object.values(this.board)) {
      if (p.seat === seat) p.dead = true;
    }
  }

  private advanceTurnAndResolveEliminations(): {
    seat: number;
    status: SeatStatus;
    bySeat?: number;
    points: number;
  }[] {
    const n = this.topology.seats;
    const eliminated: { seat: number; status: SeatStatus; bySeat?: number; points: number }[] = [];

    for (let step = 0; step < n; step++) {
      if (this.activeSeats().length <= 1) break;
      this._turn = (this._turn + 1) % n;
      if (this.status[this._turn] !== 'active') continue;

      if (this.legalMoves(this._turn).size > 0) {
        break;
      }

      // Current player has no legal moves -> checkmate or stalemate!
      const victim = this._turn;
      if (this.isSeatInCheck(victim)) {
        const kSq = this.findKing(victim);
        const attackers = kSq ? this.attackersOfSquare(kSq, victim) : [];
        let killer = this.lastAttackerOfKing[victim];
        if (killer === null || !attackers.some((a) => a.seat === killer)) {
          killer = attackers[0]?.seat ?? null;
        }
        this.markSeatDead(victim, 'checkmated');
        if (killer !== null && this.status[killer] === 'active') {
          this.scores[killer] += 20;
          eliminated.push({ seat: victim, status: 'checkmated', bySeat: killer, points: 20 });
        } else {
          eliminated.push({ seat: victim, status: 'checkmated', points: 0 });
        }
      } else {
        // Stalemate: victim gets +20 points (chess.com FFA rule)
        this.markSeatDead(victim, 'stalemated');
        this.scores[victim] += 20;
        eliminated.push({ seat: victim, status: 'stalemated', bySeat: victim, points: 20 });
      }
    }

    return eliminated;
  }

  private resolveCurrentTurnIfNoMoves(): {
    seat: number;
    status: SeatStatus;
    bySeat?: number;
    points: number;
  }[] {
    if (this.status[this._turn] !== 'active' || this.legalMoves(this._turn).size > 0) return [];
    // Step back by 1 and call advanceTurnAndResolveEliminations so it checks current _turn
    this._turn = (this._turn + this.topology.seats - 1) % this.topology.seats;
    return this.advanceTurnAndResolveEliminations();
  }

  isOver(): { over: boolean; reason?: MultiEndReason } {
    const active = this.activeSeats();
    if (active.length <= 1) {
      return { over: true, reason: 'last-standing' };
    }
    if (active.length === 2) {
      const [s1, s2] = active;
      const maxOther = Math.max(
        ...this.scores.filter((_, idx) => idx !== s1 && idx !== s2),
        -Infinity,
      );
      const leader = this.scores[s1] >= this.scores[s2] ? s1 : s2;
      const runnerUp = leader === s1 ? s2 : s1;
      // If one of the 2 remaining active players leads the other active player by >= 21 points
      // and no remaining active pieces exist for the opponent other than King (or raw lead >= 21 when only kings / minimal material or per rule >= 21 lead with no opponent field pieces):
      const opponentMaterial = Object.values(this.board)
        .filter((p) => !p.dead && p.role !== 'k' && p.seat !== leader)
        .reduce((sum, p) => sum + (p.role === 'q' && p.promoted ? 1 : this.topology.pieceValues()[p.role]), 0);
      if (this.scores[leader] - Math.max(this.scores[runnerUp], maxOther) >= 21 + opponentMaterial) {
        return { over: true, reason: 'points-lead' };
      }
    }
    // 50 full rounds without pawn move or capture
    if (this.quietPlies >= this.topology.seats * 50) {
      return { over: true, reason: 'fifty' };
    }
    if ((this.repetitions.get(this.positionKey()) ?? 0) >= 3) {
      return { over: true, reason: 'repetition' };
    }
    return { over: false };
  }

  /**
   * Returns 1-based placement (1 = 1st place, etc.) for each seat index.
   * Ranked by score descending; tie-breaker: active players beat eliminated players,
   * and later elimination beats earlier elimination.
   */
  placements(): number[] {
    const n = this.topology.seats;
    const indices = Array.from({ length: n }, (_, i) => i);
    const survivalRank = (seat: number): number => {
      const idx = this.eliminationOrder.indexOf(seat);
      return idx === -1 ? 999 : idx;
    };
    indices.sort((a, b) => {
      if (this.scores[b] !== this.scores[a]) return this.scores[b] - this.scores[a];
      return survivalRank(b) - survivalRank(a);
    });
    const places = Array.from({ length: n }, () => 1);
    for (let i = 0; i < indices.length; i++) {
      places[indices[i]] = i + 1;
    }
    return places;
  }

  private positionKey(): string {
    const entries = Object.entries(this.board)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sq, p]) => `${sq}:${p.seat}${p.role}${p.dead ? 'd' : ''}`)
      .join(',');
    return `${this.variant}|${this._turn}|${this.status.join(',')}|${entries}`;
  }

  private recordPosition(): void {
    const key = this.positionKey();
    this.repetitions.set(key, (this.repetitions.get(key) ?? 0) + 1);
  }

  /**
   * Compact serialized string stored in `GameMove.fenAfter` and `GameState.fens[0]`.
   */
  serialize(): string {
    const pieces = Object.entries(this.board)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([sq, p]) => `${sq}:${p.seat}${p.role}${p.promoted ? 'p' : ''}${p.dead ? 'd' : ''}`)
      .join(',');
    return `multi:${this.variant}|t:${this._turn}|s:${this.scores.join(',')}|st:${this.status.join(',')}|lm:${
      this._lastMove ? `${this._lastMove.from}-${this._lastMove.to}-${this._lastMove.seat}` : '-'
    }|b:${pieces}`;
  }

  static deserializeBoard(serialized: string): {
    variant: MultiVariant;
    turn: number;
    scores: number[];
    status: SeatStatus[];
    lastMove: { from: string; to: string; seat: number } | null;
    board: Record<string, MPiece>;
  } | null {
    if (!serialized.startsWith('multi:')) return null;
    const parts = serialized.slice('multi:'.length).split('|');
    const variant = parts[0] as MultiVariant;
    if (variant !== 'four-player' && variant !== 'three-player') return null;
    let turn = 0;
    let scores: number[] = [];
    let status: SeatStatus[] = [];
    let lastMove: { from: string; to: string; seat: number } | null = null;
    const board: Record<string, MPiece> = {};

    for (const part of parts.slice(1)) {
      if (part.startsWith('t:')) turn = Number(part.slice(2));
      else if (part.startsWith('s:')) scores = part.slice(2).split(',').map(Number);
      else if (part.startsWith('st:')) status = part.slice(3).split(',') as SeatStatus[];
      else if (part.startsWith('lm:')) {
        const lm = part.slice(3);
        if (lm !== '-') {
          const [from, to, s] = lm.split('-');
          lastMove = { from, to, seat: Number(s) };
        }
      } else if (part.startsWith('b:')) {
        const bStr = part.slice(2);
        if (bStr) {
          for (const item of bStr.split(',')) {
            const [sq, code] = item.split(':');
            if (!sq || !code) continue;
            const seat = Number(code[0]);
            const role = code[1] as Role;
            const flags = code.slice(2);
            const promoted = flags.includes('p');
            const dead = flags.includes('d');
            board[sq] = {
              seat,
              role,
              ...(promoted ? { promoted: true } : {}),
              ...(dead ? { dead: true } : {}),
            };
          }
        }
      }
    }
    return { variant, turn, scores, status, lastMove, board };
  }
}
