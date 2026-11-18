// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { GameMode, LiveGameInfo } from 'shared';
import HomeLiveGames from '../src/components/HomeLiveGames.vue';

vi.mock('../src/components/ChessBoard.vue', () => ({ default: { props: ['fen'], template: '<div class="board-wrap" :data-fen="fen" />' } }));
vi.mock('../src/components/MultiBoard.vue', () => ({ default: { props: ['mode', 'fen', 'mini'], template: '<div class="multi-board-wrap" :data-mode="mode" :data-mini="mini" />' } }));
let app: App, root: HTMLElement;
const game = (mode: GameMode, gameId = 1): LiveGameInfo => ({
  gameId, mode, players: Array.from({ length: mode === 'three-player' ? 3 : 4 }, (_, n) => ({
    userId: n + 1, username: `Длинное_имя_участника_${n + 1}`, rating: 1200 + n, team: (n % 2 + 1) as 1 | 2,
  })), fens: mode === 'bughouse' ? ['position-a', 'position-b'] : ['position'], moveNumber: 1, startedAt: 1,
});
function mount(games: LiveGameInfo[]) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
  app = createApp({ render: () => h(HomeLiveGames, { games, liveLoaded: true }) });
  app.use(createPinia()).use(router).mount(root);
  return router;
}
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); });
describe('live game previews', () => {
  it('keeps Double as one rectangular miniature with all four named players', () => {
    mount([game('double')]);
    expect(root.querySelector('.live-boards.double')).not.toBeNull();
    expect(root.querySelectorAll('.multi-board-wrap')).toHaveLength(1);
    expect(root.querySelector('.multi-board-wrap')?.getAttribute('data-mini')).toBe('true');
    expect(root.querySelectorAll('.multi-player')).toHaveLength(4);
    expect(root.querySelectorAll('.multi-player[title]')).toHaveLength(4);
    expect(root.querySelector('.live-boards.two')).toBeNull();
  });
  it('keeps both bughouse boards and renders every irregular-mode participant', async () => {
    mount([game('bughouse'), game('three-player', 2), game('four-player', 3)]);
    expect(root.querySelectorAll('.multi-player')).toHaveLength(7);
    await vi.waitFor(() => {
      const positions = [...root.querySelectorAll('.live-boards.two .board-wrap')].map(board => board.getAttribute('data-fen'));
      expect(positions).toEqual(['position-a', 'position-b']);
    });
  });
  it('opens the selected game with keyboard without creating a game', async () => {
    const router = mount([game('double', 42)]);
    const push = vi.spyOn(router, 'push');
    root.querySelector('article')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await nextTick();
    expect(push).toHaveBeenCalledWith('/game/42');
  });
});
