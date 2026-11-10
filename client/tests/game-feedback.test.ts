// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { GameState } from 'shared';
import { vibrateMove } from '../src/utils/haptics';
import GamePage from '../src/pages/GamePage.vue';
import { useAuthStore } from '../src/stores/auth';

const wire = vi.hoisted(() => ({ handlers: new Map<string, Function>(), ack: null as Function | null, payload: null as any }));
vi.mock('../src/api/socket', () => {
  const socket = {
    connected: true, on: (event: string, fn: Function) => wire.handlers.set(event, fn), off: vi.fn(),
    timeout: () => socket,
    emit: (event: string, payload: unknown, ack?: Function) => {
      if (event === 'game:move') { wire.payload = payload; wire.ack = ack ?? null; }
    },
  };
  return { getSocket: () => socket, onSocketResync: () => () => {}, resetSocket: vi.fn() };
});
vi.mock('../src/api/rest', () => ({ api: { get: vi.fn().mockResolvedValue({}) } }));
vi.mock('../src/utils/haptics', () => ({ vibrateMove: vi.fn() }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/audio/sounds', () => ({ playMoveSound: vi.fn(), playCaptureSound: vi.fn(), playCheckSound: vi.fn(), playCastleSound: vi.fn(), playDropSound: vi.fn(), playQueenLossSound: vi.fn(), playGameEndSound: vi.fn() }));
vi.mock('../src/components/ChessBoard.vue', async () => {
  const { h } = await import('vue');
  return { default: { emits: ['move', 'drop'], setup(_: unknown, { emit, expose }: any) {
    expose({ resetView: vi.fn() });
    return () => h('div', [
      h('button', { class: 'test-move', onClick: () => emit('move', { from: 'e2', to: 'e4' }) }, 'move'),
      h('button', { class: 'test-drop', onClick: () => emit('drop', { piece: 'p', to: 'e4' }) }, 'drop'),
      h('button', { class: 'test-premove', onClick: () => emit('move', { from: 'e2', to: 'e4', premove: true }) }, 'premove'),
    ]);
  } } };
});

let app: App;
let root: HTMLElement;
const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
function state(): GameState {
  return {
    gameId: 1, mode: 'team', status: 'active', result: '*', reason: null,
    timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
    participants: [
      { userId: 1, username: 'White', team: 1, color: 'w', boardIndex: 0, moveSlot: 0, ratingBefore: 1500, ratingAfter: null },
      { userId: 2, username: 'Black', team: 2, color: 'b', boardIndex: 0, moveSlot: 0, ratingBefore: 1500, ratingAfter: null },
    ], fens: [startFen], pockets: null, moveNumber: 1, turns: ['w'], turnUserIds: [1],
    clocks: [[0, 0]], clocksActive: [null], startedAt: Date.now(),
  };
}
beforeEach(async () => {
  vi.clearAllMocks(); wire.handlers.clear(); wire.ack = null; wire.payload = null;
  localStorage.clear();
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/game/:id', component: GamePage }, { path: '/', component: { render: () => null } }] });
  await router.push('/game/1'); await router.isReady();
  root = document.createElement('div'); document.body.appendChild(root);
  app = createApp({ render: () => h(GamePage) }); app.use(createPinia()).use(router);
  useAuthStore().user = { id: 1, username: 'White', rating: 1500, wins: 0, losses: 0, draws: 0, createdAt: '', isAdmin: false };
  app.mount(root);
  wire.handlers.get('game:state')!(state()); await nextTick();
});
afterEach(() => { app?.unmount(); root?.remove(); vi.unstubAllGlobals(); });

describe('confirmed move feedback', () => {
  it('keeps desktop one-board chat open and folds it for two boards', async () => {
    expect(root.querySelector('.match-chat.drawer')).toBeNull();
    const bughouse = { ...state(), mode: 'bughouse' as const, fens: [startFen, startFen], turns: ['w', 'w'] as ('w' | 'b')[], turnUserIds: [1, 2] };
    wire.handlers.get('game:state')!(bughouse);
    await nextTick();
    expect(root.querySelector('.match-chat')).toBeNull();
    expect(root.querySelector('.chat-widget-root')).not.toBeNull();
    expect(root.querySelector('.game-notes')?.closest('.chat-widget-root')).not.toBeNull();
  });
  it.each(['move', 'drop', 'premove'])('vibrates once after the %s ack, never on a replayed socket update', async (kind) => {
    root.querySelector<HTMLButtonElement>(`.test-${kind}`)!.click();
    expect(vibrateMove).not.toHaveBeenCalled();
    wire.ack!(null, { ok: true });
    expect(vibrateMove).toHaveBeenCalledTimes(1);
    expect(vibrateMove).toHaveBeenCalledWith(true);
    wire.handlers.get('game:state')!(state());
    wire.handlers.get('game:move')!({ gameId: 1, userId: 1, boardIndex: 0, from: 'e2', to: 'e4', ply: 1, fenAfter: startFen.replace(' w ', ' b '), clocksAfter: null });
    await nextTick();
    expect(vibrateMove).toHaveBeenCalledTimes(1);
  });

  it('does not vibrate for rejected or timed-out moves', () => {
    root.querySelector<HTMLButtonElement>('.test-move')!.click();
    wire.ack!(null, { ok: false, error: 'rejected' });
    root.querySelector<HTMLButtonElement>('.test-move')!.click();
    wire.ack!(new Error('timeout'));
    expect(vibrateMove).not.toHaveBeenCalled();
  });
});
