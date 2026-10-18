import { BughouseGame, BughouseError, type AnyMove, type BughouseSnapshot, type PlayerRef, type SideColor } from './bughouse.js';

export interface CrazyhouseSnapshot extends BughouseSnapshot {
  alternating?: boolean;
  slots?: Record<SideColor, 0 | 1>;
  repetitions?: [string, number][];
}

/** One board, captures return to the capturing colour. In the club's 2×2
 * format partners share that colour's reserve and alternate every move. */
export class CrazyhouseGame extends BughouseGame {
  private slots: Record<SideColor, 0 | 1> = { w: 0, b: 0 };
  private repetitions = new Map<string, number>();
  constructor(readonly alternating = false, fen?: string) {
    super(fen ? [fen, fen] : undefined);
    this.recordPosition();
  }
  protected override captureRecipient(player: PlayerRef): PlayerRef { return player; }
  static override fromSnapshot(s: CrazyhouseSnapshot): CrazyhouseGame {
    const game = new CrazyhouseGame(s.alternating, s.fens[0]);
    const base = BughouseGame.fromSnapshot(s);
    game.pockets = base.pockets;
    game.promoted = base.promoted;
    game.slots = { ...(s.slots ?? { w: 0, b: 0 }) };
    game.repetitions = new Map(s.repetitions ?? []);
    return game;
  }
  override snapshot(): CrazyhouseSnapshot {
    return { ...super.snapshot(), alternating: this.alternating, slots: { ...this.slots }, repetitions: [...this.repetitions] };
  }
  currentSlot(): 0 | 1 { return this.nextSlotFor(this.turn(0)); }
  nextSlotFor(color: SideColor): 0 | 1 { return this.slots[color]; }
  private positionKey(): string {
    // Slot order is part of a team position; FEN includes pockets and provenance.
    return this.engineFen(0).split(' ').slice(0, 4).join(' ') + (this.alternating ? ` ${this.slots.w}${this.slots.b}` : '');
  }
  private recordPosition(): void {
    const key = this.positionKey();
    this.repetitions.set(key, (this.repetitions.get(key) ?? 0) + 1);
  }
  isThreefoldRepetition(): boolean { return (this.repetitions.get(this.positionKey()) ?? 0) >= 3; }
  override apply(move: AnyMove): ReturnType<BughouseGame['apply']> {
    if (move?.board !== 0) throw new BughouseError('В Crazyhouse одна доска');
    const color = this.turn(0);
    const result = super.apply(move);
    if (this.alternating) this.slots[color] = this.slots[color] === 0 ? 1 : 0;
    this.recordPosition();
    return result;
  }
}
