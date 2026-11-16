// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { MultiChess, type GameSummary, type MoveRecord, type MultiMode } from 'shared';
import { buildReplay } from '../src/game/replay';
import GameReplayer from '../src/components/GameReplayer.vue';

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
afterEach(() => { app?.unmount(); root?.remove(); });
describe('multiplayer replays', () => {
  it.each(['three-player', 'four-player', 'double'] as const)('shows every participant and a player-labelled chronological list in %s', async mode => {
    root = document.createElement('div'); document.body.append(root);
    app = createApp({ render: () => h(GameReplayer, { game: game(mode), moves: [record(mode)] }) });
    app.use(createPinia()).mount(root); await nextTick();
    expect(root.querySelectorAll('.rh-player')).toHaveLength(mode === 'three-player' ? 3 : 4);
    expect(root.querySelector('.rp-multi-move')?.textContent).toContain('Player 3');
    expect(root.querySelector('.rp-move-grid')).toBeNull();
    const select = root.querySelector<HTMLSelectElement>('.rp-viewer select')!;
    expect(select.options.length).toBe(mode === 'three-player' ? 3 : 4);
    select.value = '2'; select.dispatchEvent(new Event('change')); await nextTick();
    expect(select.value).toBe('2');
    if (mode === 'double') expect(Number((root.querySelector('.rp-board-stage') as HTMLElement).style.aspectRatio)).toBeGreaterThan(1.8);
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
});
