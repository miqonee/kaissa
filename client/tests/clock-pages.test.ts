// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { MultiChess, type GameState } from 'shared';
import GamePage from '../src/pages/GamePage.vue';
import MultiGamePage from '../src/pages/MultiGamePage.vue';
import { useAuthStore } from '../src/stores/auth';
const wire = vi.hoisted(() => ({ handlers: new Map<string, Function>() }));
vi.mock('../src/api/socket', () => ({ getSocket: () => ({ emit: vi.fn(), on: (e: string, f: Function) => wire.handlers.set(e, f), off: vi.fn() }), onSocketResync: () => () => {}, resetSocket: vi.fn() }));
vi.mock('../src/api/rest', () => ({ api: { get: () => Promise.resolve({}) } }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/utils/analytics', () => ({ trackGoal: vi.fn() }));
vi.mock('../src/audio/sounds', () => ({ playMoveSound: vi.fn(), playCaptureSound: vi.fn(), playCheckSound: vi.fn(), playCastleSound: vi.fn(), playDropSound: vi.fn(), playQueenLossSound: vi.fn(), playGameEndSound: vi.fn() }));
vi.mock('../src/components/MultiBoard.vue', () => ({ default: { render: () => null } }));
vi.mock('../src/components/ChessBoard.vue', () => ({ default: { props: ['clockRemainingMs'], setup: (p: any) => () => h('i', { class: 'test-board', 'data-clock': p.clockRemainingMs }) } }));
let app: App, root: HTMLElement, hidden = false, pageUpdates = 0;
const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function game(mode: 'team' | 'double', ms = 300000): GameState {
  const count = mode === 'team' ? 2 : 4;
  return { gameId: 1, mode, status: 'active', result: '*', reason: null, moveNumber: 1, startedAt: Date.now(),
    timeControl: { kind: 'clock', baseMin: 5, incSec: 0 }, fens: [fen], pockets: null, chat: [], turns: ['w'], turnUserIds: [1],
    participants: Array.from({ length: count }, (_, seat) => ({ userId: seat + 1, username: `Player ${seat}`, color: seat % 2 ? 'b' : 'w', boardIndex: 0, seat, team: seat % 2 + 1, moveSlot: 0, ratingBefore: 1500, ratingAfter: null })),
    clocks: [[ms, ms]], clocksActive: ['w'],
    ...(mode === 'double' ? { multi: { snapshot: new MultiChess('double').snapshot(), clocksMs: Array(count).fill(ms), clockActiveSeat: 0, legalMoves: {} } } : {}),
  } as GameState;
}
async function mount(mode: 'team' | 'double', ms = 300000) {
  const Page = mode === 'team' ? GamePage : MultiGamePage;
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/game/:id', component: { render: () => null } }, { path: '/', component: { render: () => null } }] });
  await router.push('/game/1');
  app = createApp({ render: () => h(Page) });
  app.mixin({ updated() { if ((this.$options as any).__name === (mode === 'team' ? 'GamePage' : 'MultiGamePage')) pageUpdates++; } });
  app.use(createPinia()).use(router);
  useAuthStore().user = { id: 1, username: 'Player 0', isGuest: false } as any;
  app.mount(root); wire.handlers.get('game:state')!(game(mode, ms)); await nextTick(); await nextTick(); pageUpdates = 0;
}
async function advance(ms: number) { vi.advanceTimersByTime(ms); await nextTick(); }
function clocks(mode: string) { return Array.from(root.querySelectorAll(mode === 'team' ? '.clock-display' : '.seat-clock')).map(el => el.textContent?.trim()); }
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(100000); hidden = false; pageUpdates = 0; wire.handlers.clear(); localStorage.clear();
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); vi.stubGlobal('requestAnimationFrame', () => 0); vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  root = document.createElement('div'); document.body.appendChild(root);
});
afterEach(() => { app?.unmount(); root.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('page clock isolation and synchronization', () => {
  it.each(['team', 'double'] as const)('%s avoids page updates for 100 ticks while clocks count down', async mode => {
    await mount(mode);
    for (let i = 0; i < 100; i++) await advance(100);
    expect(clocks(mode)).toContain('4:50'); expect(clocks(mode)).toContain('5:00');
    console.log(`clock-page-counter ${mode}: ${pageUpdates} page updates / 100 ticks`);
    expect(pageUpdates).toBe(0);
  });
  it.each(['team', 'double'] as const)('%s catches up after background and uses new server anchors', async mode => {
    await mount(mode);
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); await advance(10000);
    expect(clocks(mode)).not.toContain('4:50');
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); await nextTick();
    expect(clocks(mode)).toContain('4:50');
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); await advance(10000);
    const resync = game(mode, 180000);
    resync.clocksActive = ['b']; if (resync.multi) resync.multi.clockActiveSeat = 1;
    wire.handlers.get('game:state')!(resync); await nextTick(); await advance(5000);
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); await nextTick();
    expect(clocks(mode)).toContain('2:55'); expect(clocks(mode)).toContain('3:00');
    expect(clocks(mode)[mode === 'team' ? 0 : 1]).toBe('2:55');
    expect(clocks(mode)[mode === 'team' ? 1 : 0]).toBe('3:00');
    const ended = game(mode, 120000); ended.status = 'mate'; wire.handlers.get('game:state')!(ended); await nextTick();
    await advance(5000); expect(clocks(mode)).not.toContain('1:55');
  });
  it('changes animation range exactly when a running clock crosses a threshold', async () => {
    await mount('team', 120100);
    expect(root.querySelector('.test-board')?.getAttribute('data-clock')).toBe('120001');
    await advance(100); expect(root.querySelector('.test-board')?.getAttribute('data-clock')).toBe('120000');
    wire.handlers.get('game:state')!(game('team', 60100)); await nextTick();
    await advance(100); expect(root.querySelector('.test-board')?.getAttribute('data-clock')).toBe('60000');
  });
});
