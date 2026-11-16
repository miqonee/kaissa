import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, ref } from 'vue';
import { Chess } from 'chess.js';
import { createPositionAnalysis } from '../src/game/positionAnalysis';

afterEach(() => vi.restoreAllMocks());
const start = new Chess().fen();
function expected(fen: string) {
  const c = new Chess(fen);
  const dests: Record<string, string[]> = {};
  for (const m of c.moves({ verbose: true })) (dests[m.from] ??= []).push(m.to);
  return { dests, check: c.isCheck() ? String(c.findPiece({ type: 'k', color: c.turn() })[0]) : null };
}
describe('position analysis', () => {
  it('matches chess.js through legal positions, including en passant and castling', () => {
    const c = new Chess();
    for (const san of ['e4', 'a6', 'e5', 'd5', 'exd6', 'exd6', 'Nf3', 'Nf6', 'Be2', 'Be7', 'O-O']) {
      c.move(san);
      const analysis = createPositionAnalysis(c.fen());
      const reference = expected(c.fen());
      expect(analysis.destinations()).toEqual(reference.dests);
      expect(analysis.checkedKing()).toBe(reference.check);
    }
  });
  it('handles check, promotion and invalid FEN without stale data', () => {
    for (const fen of ['4k3/8/8/8/8/8/4R3/4K3 b - - 0 1', '7k/P7/8/8/8/8/8/7K w - - 0 1']) {
      const reference = expected(fen), analysis = createPositionAnalysis(fen);
      expect(analysis.destinations()).toEqual(reference.dests);
      expect(analysis.checkedKing()).toBe(reference.check);
    }
    expect(createPositionAnalysis('invalid').destinations()).toEqual({});
    expect(createPositionAnalysis('').checkedKing()).toBeNull();
  });
  it('does not generate moves for check-only spectators and computes once per FEN', () => {
    const moves = vi.spyOn(Chess.prototype, 'moves');
    const checks = vi.spyOn(Chess.prototype, 'isCheck');
    const analysis = createPositionAnalysis(start);
    analysis.checkedKing(); analysis.checkedKing();
    expect(moves).toHaveBeenCalledTimes(0);
    expect(checks).toHaveBeenCalledTimes(1);
    expect(analysis.destinations()).toBe(analysis.destinations());
    expect(moves).toHaveBeenCalledTimes(1);
  });
  it('survives 100 full-state clock replacements and invalidates only the changed board', () => {
    const state = ref({ fens: [start, start], clock: 1000, canMove: true });
    const builds = vi.fn(createPositionAnalysis);
    const fens = [computed(() => state.value.fens[0]), computed(() => state.value.fens[1])];
    const boards = fens.map(fen => computed(() => builds(fen.value)));
    const dests = computed(() => state.value.canMove ? boards[0].value.destinations() : {});
    const first = dests.value;
    boards[1].value.checkedKing();
    for (let i = 0; i < 100; i++) {
      state.value = { ...state.value, fens: [...state.value.fens], clock: i };
      expect(dests.value).toBe(first);
      boards[0].value.checkedKing(); boards[1].value.checkedKing();
    }
    expect(builds).toHaveBeenCalledTimes(2);
    state.value.canMove = false;
    expect(dests.value).toEqual({}); // Permissions must not be cached with FEN.
    state.value.canMove = true;
    expect(dests.value).toBe(first);
    const c = new Chess(); c.move('e4'); state.value.fens[1] = c.fen();
    boards[1].value.checkedKing();
    expect(builds).toHaveBeenCalledTimes(3);
    expect(dests.value).toBe(first);
  });
});
