// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { MultiChess, type GameState, type MultiMode } from 'shared';
import MultiGamePage from '../src/pages/MultiGamePage.vue';
import { useAuthStore } from '../src/stores/auth';
const wire = vi.hoisted(() => ({ emit: vi.fn() }));
vi.mock('../src/api/socket', () => ({ getSocket: () => ({ emit: wire.emit, on: vi.fn(), off: vi.fn() }), onSocketResync: () => () => {}, resetSocket: vi.fn() }));
vi.mock('../src/api/rest', () => ({ api: { get: vi.fn().mockResolvedValue({}) } }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/utils/analytics', () => ({ trackGoal: vi.fn() }));
vi.mock('../src/components/MultiBoard.vue', async () => {
 const { h } = await import('vue');
 return { default: { props: ['viewerSeat', 'myTurn'], setup: (p: any) => () => h('div', { class: 'test-board', 'data-seat': p.viewerSeat, 'data-can-move': p.myTurn }) } };
});
let app: App, root: HTMLElement;
async function mount(mode: MultiMode, id = 99) {
 const count = mode === 'three-player' ? 3 : 4;
 const state = { gameId: 1, mode, status: 'active', moveNumber: 0, startedAt: Date.now(), timeControl: { initialMs: 300000, incrementMs: 0 }, fens: [], chat: [],
 participants: Array.from({ length: count }, (_, seat) => ({ userId: seat + 1, username: `Player ${seat}`, seat, boardIndex: seat, team: seat % 2 + 1, ratingBefore: 1500 })),
 multi: { snapshot: new MultiChess(mode).snapshot(), clocksMs: Array(count).fill(300000), clockActiveSeat: 0, legalMoves: {} },
 } as unknown as GameState;
 const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/game/:id', component: { render: () => null } }] });
 await router.push('/game/1');
 app = createApp({ render: () => h(MultiGamePage, { initialState: state }) });
 const pinia = createPinia(); app.use(pinia).use(router);
 useAuthStore(pinia).user = { id, username: 'User', isGuest: true } as any;
 app.mount(root); await nextTick();
}
beforeEach(() => { wire.emit.mockClear(); root = document.createElement('div'); document.body.appendChild(root); vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', vi.fn()); });
afterEach(() => { app?.unmount(); root.remove(); vi.unstubAllGlobals(); });
describe('multiplayer layout controls', () => {
 it.each(['double', 'three-player', 'four-player'] as MultiMode[])('spectator can select each seat in %s without game actions', async mode => {
  await mount(mode);
  const select = root.querySelector<HTMLSelectElement>('.spectator-view select')!;
  expect(select.options.length).toBe(mode === 'three-player' ? 3 : 4);
  for (let seat = 0; seat < select.options.length; seat++) {
   select.value = String(seat); select.dispatchEvent(new Event('change')); await nextTick();
   expect(root.querySelector('.test-board')?.getAttribute('data-seat')).toBe(String(seat));
   expect(root.querySelector('.test-board')?.getAttribute('data-can-move')).toBe('false');
  }
  expect(root.querySelector('.seat-actions')).toBeNull();
  expect(root.querySelector('.topbar-right .danger')).toBeNull();
 });
 it.each([1, 2, 3, 4])('surrender is in player %s own card and needs confirmation', async id => {
  await mount('double', id);
  expect(root.querySelector('.spectator-view')).toBeNull();
  expect(root.querySelectorAll('.seat-actions')).toHaveLength(1);
  expect(root.querySelector('.seat-actions')?.closest('.seat-card')?.textContent).toContain(`Player ${id - 1}`);
  expect(root.querySelector('.topbar-right .danger')).toBeNull();
  const button = root.querySelector<HTMLButtonElement>('.seat-actions .danger')!;
  button.click(); await nextTick();
  expect(wire.emit.mock.calls.some(call => call[0] === 'game:resign')).toBe(false);
  button.click(); await nextTick();
  expect(wire.emit).toHaveBeenCalledWith('game:resign', 1);
 });
 it('cancelling confirmation needs two clicks again', async () => {
  await mount('double', 1);
  root.querySelector<HTMLButtonElement>('.seat-actions .danger')!.click(); await nextTick();
  root.querySelector<HTMLButtonElement>('.seat-actions .ghost')!.click(); await nextTick();
  root.querySelector<HTMLButtonElement>('.seat-actions .danger')!.click(); await nextTick();
  expect(wire.emit.mock.calls.some(call => call[0] === 'game:resign')).toBe(false);
 });
});
