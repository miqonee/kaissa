// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import { createPinia } from 'pinia';
import { MultiChess, type GameSummary, type MoveRecord, type MultiMode } from 'shared';
import { buildReplay } from '../src/game/replay';
import GameReplayer from '../src/components/GameReplayer.vue';

vi.mock('../src/audio/sounds', () => ({ playMoveSound: vi.fn(), playCaptureSound: vi.fn(), playCheckSound: vi.fn(), playCastleSound: vi.fn(), playDropSound: vi.fn() }));
vi.mock('../src/composables/useReplayLayout', async () => { const { ref } = await import('vue'); return { useReplayLayout: () => ({ replayRoot: ref(null) }) }; });
function game(mode: MultiMode): GameSummary {
  return { id: 1, mode, status: 'finished', result: '1-0', reason: 'checkmate',
    timeControl: { kind: 'clock', baseMin: 5, incSec: 0 }, startedAt: '', endedAt: '',
    participants: Array.from({ length: mode === 'three-player' ? 3 : 4 }, (_, seat) => ({ userId: seat + 1, username: `Player ${seat + 1}`, team: (seat + 1) as 1, color: 'w', boardIndex: 0, moveSlot: 0, ratingBefore: 1200, ratingAfter: 1200, seat })) };
}
function record(mode: MultiMode): MoveRecord {
  return { boardIndex: 0, ply: 1, userId: 3, from: 'a2', to: 'a3', fenAfter: new MultiChess(mode).serialize(), clocksAfter: null };
}
let app: App | undefined;
let root: HTMLElement | undefined;
afterEach(() => { app?.unmount(); root?.remove(); vi.useRealTimers(); });
describe('multiplayer replays', () => {
  it.each(['three-player', 'four-player', 'double'] as const)('shows every participant and a player-labelled chronological list in %s', async mode => {
    root = document.createElement('div'); document.body.append(root);
    app = createApp({ render: () => h(GameReplayer, { game: game(mode), moves: [record(mode)] }) });
    app.use(createPinia()).mount(root); await nextTick();
    expect(root.querySelectorAll('.rh-player')).toHaveLength(mode === 'three-player' ? 3 : 4);
    expect(root.querySelector('.rp-multi-move')?.textContent).toContain('Player 3');
    expect(root.querySelector('.rp-move-grid')).toBeNull();
    const radios = root.querySelectorAll<HTMLInputElement>('.rh-player input[type=radio]');
    expect(radios).toHaveLength(mode === 'three-player' ? 3 : 4);
    radios[2].click(); await nextTick();
    expect(radios[2].checked).toBe(true);
    expect(radios[0].checked).toBe(false);
    if (mode === 'double') expect(Number((root.querySelector('.rp-board-stage') as HTMLElement).style.aspectRatio)).toBeGreaterThan(1.8);
  });
  it('flips the classic board without resetting the replay cursor', async () => {
    root = document.createElement('div'); document.body.append(root);
    const classic: GameSummary = { ...game('double'), mode: 'team' };
    const move = { ...record('double'), from: 'e2', to: 'e4', fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1' };
    const props = reactive({ game: classic, moves: [move] });
    app = createApp({ render: () => h(GameReplayer, props) });
    app.use(createPinia()).mount(root); await nextTick();
    const button = root.querySelector<HTMLButtonElement>('.rh-matchup > .rh-flip')!;
    const range = root.querySelector<HTMLInputElement>('.rp-range')!;
    expect(button.previousElementSibling?.classList.contains('rh-teams')).toBe(true);
    expect(root.querySelector('.rp-board-head button')).toBeNull();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(range.value).toBe('1');
    const before = root.querySelector('.rp-seat')?.textContent;
    button.click(); await nextTick();
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.rp-seat')?.textContent).not.toBe(before);
    expect(range.value).toBe('1');
    props.game = { ...classic, id: 2 }; await nextTick();
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
  it('marks missing and mismatched snapshots instead of claiming reconstructed positions', () => {
    const g = game('double');
    const replay = buildReplay(g, [{ ...record('double'), fenAfter: '' }, { ...record('four-player'), ply: 2 }]);
    expect(replay.moves.every(m => !m.ok)).toBe(true);
    expect(replay.frames[2].boards[0].fen).toBe(replay.frames[0].boards[0].fen);
    expect(replay.frames[2].boards[0].lastMove).toEqual([null, null]);
  });
  it('keeps recorded promotions without inventing check or capture notation', () => {
    const replay = buildReplay(game('double'), [{ ...record('double'), promotion: 'q' }]);
    expect(replay.moves[0].san).toBe('a2–a3=Q');
    expect(replay.frames[1].boards[0].check).toBeNull();
  });
  it('keeps wide replay navigation, orientation and keyboard controls on one cursor', async () => {
    root = document.createElement('div'); document.body.append(root);
    const props = reactive({ game: game('double'), moves: [record('double'), { ...record('double'), ply: 2, userId: 4 }] });
    app = createApp({ render: () => h(GameReplayer, props) });
    app.use(createPinia()).mount(root); await nextTick();
    expect(root.querySelector('.double-replay')).not.toBeNull();
    expect(root.querySelectorAll('.rp-transport')).toHaveLength(1);
    const range = root.querySelector<HTMLInputElement>('.rp-range')!;
    expect(range.value).toBe('2');
    const side = root.querySelector<HTMLInputElement>('.rh-player input[value="2"]')!;
    side.click(); await nextTick();
    expect(side.checked).toBe(true);
    expect(range.value).toBe('2');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' })); await nextTick();
    expect(range.value).toBe('0');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' })); await nextTick();
    expect(range.value).toBe('1');
    range.value = '2'; range.dispatchEvent(new Event('input')); await nextTick();
    expect(root.querySelector('.rp-multi-move.active')?.textContent).toContain('Player 4');
    root.querySelector<HTMLButtonElement>('.rp-multi-move')!.click(); await nextTick();
    expect(range.value).toBe('1');
    side.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true })); await nextTick();
    expect(range.value).toBe('1');
    props.game = { ...game('double'), id: 2 }; await nextTick();
    expect(range.value).toBe('2');
    expect(root.querySelector<HTMLInputElement>('.rh-player input[value="0"]')?.checked).toBe(true);
    props.game = { ...game('four-player'), id: 3 }; await nextTick();
    expect(root.querySelector('.double-replay')).toBeNull();
  });
  it('preserves autoplay speed, pause and empty-game controls in the wide layout', async () => {
    vi.useFakeTimers();
    root = document.createElement('div'); document.body.append(root);
    const props = reactive({ game: game('double'), moves: [record('double'), { ...record('double'), ply: 2 }] });
    app = createApp({ render: () => h(GameReplayer, props) });
    app.use(createPinia()).mount(root); await nextTick();
    const range = root.querySelector<HTMLInputElement>('.rp-range')!;
    root.querySelector<HTMLButtonElement>('.rp-play')!.click(); await nextTick();
    expect(range.value).toBe('0');
    root.querySelectorAll<HTMLButtonElement>('.rp-speed')[2].click(); await nextTick();
    await vi.advanceTimersByTimeAsync(450); await nextTick();
    expect(range.value).toBe('1');
    root.querySelector<HTMLButtonElement>('.rp-play')!.click(); await nextTick();
    await vi.advanceTimersByTimeAsync(900); await nextTick();
    expect(range.value).toBe('1');
    props.moves = []; await nextTick();
    expect(range.value).toBe('0');
    expect(range.disabled).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.rp-play')!.disabled).toBe(true);
  });

  it.each(['crazyhouse', 'crazyhouse-team', 'bughouse'] as const)('%s keeps reserve geometry mounted through capture and rewind', async mode => {
    root = document.createElement('div'); document.body.append(root);
    const g: GameSummary = { ...game('double'), mode, rulesVersion: 2 };
    const moves: MoveRecord[] = [
      { boardIndex: 0, ply: 1, userId: 1, from: 'e2', to: 'e4', fenAfter: '' },
      { boardIndex: 0, ply: 2, userId: 2, from: 'd7', to: 'd5', fenAfter: '' },
      { boardIndex: 0, ply: 3, userId: 1, from: 'e4', to: 'd5', fenAfter: '' },
    ];
    app = createApp({ render: () => h(GameReplayer, { game: g, moves, compact: true }) });
    app.use(createPinia()).mount(root); await nextTick();
    const boards = mode === 'bughouse' ? 2 : 1;
    const slots = [...root.querySelectorAll('.rp-pocket .slot')];
    expect(root.querySelectorAll('.rp-board-stage')).toHaveLength(boards);
    expect(slots).toHaveLength(boards * 10);
    expect(root.querySelectorAll('.rp-pocket .count')).toHaveLength(1);
    expect(root.querySelector('.rp-analysis-card')).toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' })); await nextTick();
    expect(root.querySelectorAll('.rp-pocket .count')).toHaveLength(0);
    expect([...root.querySelectorAll('.rp-pocket .slot')]).toEqual(slots);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' })); await nextTick();
    expect(root.querySelectorAll('.rp-pocket .count')).toHaveLength(1);
    expect([...root.querySelectorAll('.rp-pocket .slot')]).toEqual(slots);
    expect(root.querySelectorAll('.rp-transport')).toHaveLength(1);
  });

});
