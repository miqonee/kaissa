// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { GameState } from 'shared';
import GamePage from '../src/pages/GamePage.vue';
import source from '../src/pages/GamePage.vue?raw';
import { useAuthStore } from '../src/stores/auth';
const wire = vi.hoisted(() => ({ handlers: new Map<string, Function>() }));
vi.mock('../src/api/socket', () => ({ getSocket: () => ({ emit: vi.fn(), on: (e: string, f: Function) => wire.handlers.set(e, f), off: vi.fn() }), onSocketResync: () => () => {}, resetSocket: vi.fn() }));
vi.mock('../src/api/rest', () => ({ api: { get: () => Promise.resolve({}) } }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/components/ChessBoard.vue', () => ({ default: { props: ['myTurn'], setup: (p: any) => () => h('div', { class: 'test-board', 'data-can-move': String(p.myTurn) }) } }));
let app: App, root: HTMLElement;
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
async function mount(mode: GameState['mode'], id = 99) {
 const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/game/:id', component: { render: () => null } }, { path: '/', component: { render: () => null } }] });
 await router.push('/game/1');
 app = createApp({ render: () => h(GamePage) }); app.use(createPinia()).use(router);
 useAuthStore().user = { id, username: 'Viewer', isGuest: true } as any;
 app.mount(root);
 const count = mode === 'crazyhouse' || mode === 'team' ? 2 : 4;
 wire.handlers.get('game:state')!({ gameId: 1, mode, status: 'active', result: '*', reason: null,
 timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
 participants: Array.from({length: count}, (_, i) => ({userId: i + 1, username: 'Long player name '.repeat(5), team: i % 2 + 1, color: i % 2 ? 'b' : 'w', boardIndex: mode === 'bughouse' ? Math.floor(i / 2) : 0, moveSlot: Math.floor(i / 2), ratingBefore: 1500, ratingAfter: null})),
 fens: mode === 'bughouse' ? [fen, fen] : [fen], pockets: Array.from({length: count}, () => ({p: 2, n: 1, b: 0, r: 0, q: 0})),
 moveNumber: 1, turns: ['w', 'w'], turnUserIds: [1, 3], clocks: [[0,0],[0,0]], clocksActive: [null, null], startedAt: Date.now(),
 } as GameState);
 await nextTick(); await nextTick();
}
beforeEach(() => {
 wire.handlers.clear(); localStorage.clear();
 vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
 vi.stubGlobal('requestAnimationFrame', () => 0); vi.stubGlobal('cancelAnimationFrame', vi.fn());
 vi.stubGlobal('matchMedia', () => ({matches: false, addEventListener() {}, removeEventListener() {}}));
 root = document.createElement('div'); document.body.appendChild(root);
});
afterEach(() => {app?.unmount(); root.remove(); vi.unstubAllGlobals();});
describe('live watch layout', () => {
 it.each(['crazyhouse', 'crazyhouse-team', 'team', 'bughouse'] as const)('%s keeps viewing non-interactive with board and reserves together', async mode => {
  await mount(mode);
  expect(root.querySelector('.game-page.watch-layout')).not.toBeNull();
  const columns = root.querySelectorAll('[data-board-column]');
  expect(columns).toHaveLength(mode === 'bughouse' ? 2 : 1);
  columns.forEach(col => {
   expect(col.querySelector('.board-frame .test-board')).not.toBeNull();
   col.querySelectorAll<HTMLButtonElement>('.pocket button').forEach(button => expect(button.disabled).toBe(true));
  });
  if (mode.startsWith('crazyhouse')) expect(root.querySelectorAll('.team-board-wrapper > .single-pocket')).toHaveLength(2);
  expect(root.querySelector('.game-topbar-actions .danger')).toBeNull();
 });
 it('splits Bughouse facts by board without classical engine evaluation', async () => {
  await mount('bughouse');
  const facts = root.querySelectorAll('.watch-board-fact');
  expect(facts).toHaveLength(2);
  expect(facts[0].getAttribute('data-watch-board')).toBe('0');
  expect(facts[1].getAttribute('data-watch-board')).toBe('1');
  facts.forEach(fact => { expect(fact.textContent).toContain('×2'); expect(fact.textContent).toContain('×1'); });
  expect(root.querySelector('.watch-facts-note')?.textContent).toContain('не оценка движка');
  expect(root.querySelector('.eval-pill')).toBeNull();
 });
 it('does not apply spectator overrides to an active participant', async () => {
  await mount('crazyhouse', 1);
  expect(root.querySelector('.game-page.watch-layout')).toBeNull();
  expect(root.querySelector('.game-topbar-actions .danger')).not.toBeNull();
 });
 it('uses one fitted width, not the mobile wrapper floor, with reserve-aware landscape columns', () => {
  // Geometry needs browser QA; these contracts guard the conflicting CSS rules.
  const overrides = source.slice(source.indexOf('/* A spectator board'));
  expect(overrides).toContain('width: min(100%, var(--board-size, 600px));');
  expect(overrides).toContain('margin-inline: auto;');
  expect(overrides).toContain('grid-template-columns: 48px minmax(0, 1fr) 48px;');
  expect(overrides).toContain('--board-side-space: 108px;');
  expect(overrides).toContain('--board-side-space: 0px;');
 });
});
