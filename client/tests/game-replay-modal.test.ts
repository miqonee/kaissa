// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createPinia } from 'pinia';
import type { GameSummary } from 'shared';
import GameReplayModal from '../src/components/GameReplayModal.vue';
import { api } from '../src/api/rest';

vi.mock('../src/api/rest', () => ({ api: { get: vi.fn() } }));
vi.mock('../src/components/GameReplayer.vue', () => ({
  default: { props: ['game'], template: '<div class="loaded-game">{{ game.id }}</div>' },
}));

let app: App | undefined;
let root: HTMLElement | undefined;
afterEach(() => { app?.unmount(); root?.remove(); vi.mocked(api.get).mockReset(); });

it.each(['success', 'error'])('keeps the newest replay and facts when an earlier %s arrives late', async (outcome) => {
  let staleSuccess!: (result: unknown) => void;
  let staleFailure!: (error: Error) => void;
  vi.mocked(api.get).mockImplementationOnce(() => new Promise((resolve, reject) => {
    staleSuccess = resolve; staleFailure = reject;
  }));
  const summary: GameSummary = { id: 22, mode: 'team', status: 'finished', reason: 'resign', result: '0-1',
    timeControl: { kind: 'clock', baseMin: 3, incSec: 2 }, startedAt: '', endedAt: '', participants: [] };
  vi.mocked(api.get).mockResolvedValueOnce({ game: summary, moves: [] });
  const gameId = ref(11);
  root = document.createElement('div'); document.body.append(root);
  app = createApp({ render: () => h(GameReplayModal, { gameId: gameId.value }) });
  app.use(createPinia()).mount(root);
  gameId.value = 22;
  await nextTick(); await Promise.resolve(); await nextTick();
  if (outcome === 'success') staleSuccess({ game: { ...summary, id: 11 }, moves: [] });
  else staleFailure(new Error('stale request'));
  await Promise.resolve(); await nextTick();
  expect(root.querySelector('.loaded-game')?.textContent).toBe('22');
  expect(root.querySelector('.modal-head')?.textContent).toContain('3+2');
  expect(root.querySelector('.modal-head')?.textContent).toContain('#22');
  expect(root.querySelector('[role=alert]')).toBeNull();
});
