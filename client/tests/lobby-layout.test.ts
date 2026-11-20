// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import LobbyPage from '../src/pages/LobbyPage.vue';
import { useI18nStore } from '../src/stores/i18n';
import { useAuthStore } from '../src/stores/auth';
const wire = vi.hoisted(() => ({ handlers: new Map<string, Function>(), emit: vi.fn() }));
vi.mock('../src/api/socket', () => {
  const socket = { on: (name: string, fn: Function) => wire.handlers.set(name, fn), off: vi.fn(), emit: wire.emit, timeout: () => socket };
  return { getSocket: () => socket, onSocketResync: () => () => {}, resetSocket: vi.fn() };
});
vi.mock('../src/api/rest', () => ({ api: { get: vi.fn().mockResolvedValue({}) } }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/utils/analytics', () => ({ trackGoal: vi.fn() }));
vi.mock('../src/audio/sounds', () => ({ playMoveSound: vi.fn() }));
vi.mock('../src/components/ModeBoardPreview.vue', () => ({ default: { props: ['mode'], render() { return h('div', { class: 'test-preview' }); } } }));
let app: App, root: HTMLElement;
const lobby = (extra = {}) => ({ id: 'sample', name: 'Test table', mode: 'double', code: 'ABC123', teamMode: 'auto', timeControl: { kind: 'clock', baseMin: 5, incSec: 3 }, players: [1, 2, 3, 4].map(id => ({ userId: id, username: `Player ${id}`, ready: true, online: true, host: id === 1, rating: 1500 })), ...extra });
async function setState(value: ReturnType<typeof lobby>) { wire.handlers.get('lobby:state')!(value); await nextTick(); }
beforeEach(async () => {
  wire.handlers.clear(); wire.emit.mockClear(); localStorage.clear();
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/lobby/:id', component: { render: () => null } }, { path: '/rules/:mode', component: { render: () => null } }] });
  await router.push('/lobby/sample'); await router.isReady();
  root = document.createElement('div'); document.body.appendChild(root);
  app = createApp({ render: () => h(LobbyPage) }); const pinia = createPinia(); app.use(pinia).use(router);
  useAuthStore(pinia).user = { id: 1, username: 'Player 1', isGuest: true } as any;
  app.mount(root); await setState(lobby());
});
afterEach(() => { app?.unmount(); root?.remove(); });
describe('lobby layout and controls', () => {
  it('keeps one preview and chat in secondary column and start with players', () => {
    expect(root.querySelectorAll('.test-preview')).toHaveLength(1);
    expect(root.querySelector('.lobby-secondary .preview-frame .test-preview')).not.toBeNull();
    expect(root.querySelector('.lobby-secondary .chat-panel')).not.toBeNull();
    expect(root.querySelector('.lobby-primary .start-section')).not.toBeNull();
    expect(root.querySelector('.lobby-primary .players-panel')).not.toBeNull();
  });
  it('preserves mode, time and ready/start actions', async () => {
    const mode = root.querySelector<HTMLSelectElement>('#lobby-mode')!;
    mode.value = 'three-player'; mode.dispatchEvent(new Event('change')); await nextTick();
    expect(wire.emit).toHaveBeenCalledWith('lobby:set-mode', 'three-player', expect.any(Function));
    root.querySelector<HTMLButtonElement>('.tc-pills button')!.click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:set-time-control', { kind: 'clock', baseMin: 1, incSec: 0 });
    root.querySelector<HTMLButtonElement>('.start-btns .primary')!.click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:start', expect.any(Function));
  });
  it('shows actual countdown next to start for normal tables and preserves cancel', async () => {
    wire.handlers.get('lobby:countdown')!({ lobbyId: 'sample', seconds: 4, paused: false }); await nextTick();
    expect(root.querySelector('.start-section .countdown-live-hint')?.textContent).toContain('4');
    root.querySelector<HTMLButtonElement>('.cancel-start-btn')!.click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:cancel-start', expect.any(Function));
  });
  it('keeps quick-table pause/countdown beside start and does not invent seconds', async () => {
    await setState(lobby({ isQuick: true }));
    expect(root.querySelector('.start-section .auto-lobby-banner')?.textContent).toContain('Ожидание автостарта');
    expect(root.querySelector('.players-panel .auto-lobby-banner')).toBeNull();
    wire.handlers.get('lobby:countdown')!({ lobbyId: 'sample', seconds: 3, paused: true, pausedCount: 1, neededCount: 2 }); await nextTick();
    expect(root.querySelector('.countdown-chip')?.textContent).toContain('Пауза');
    expect(root.querySelector('.pause-btn')).not.toBeNull();
  });
  it('keeps non-host authorization and chat submission', async () => {
    await setState(lobby({ players: lobby().players.map(p => ({ ...p, host: p.userId === 2 })) }));
    expect(root.querySelector<HTMLSelectElement>('#lobby-mode')!.disabled).toBe(true);
    expect(root.querySelector('.start-btns .primary')).toBeNull();
    const input = root.querySelector<HTMLInputElement>('.chat-input-row input')!;
    input.value = 'Hello'; input.dispatchEvent(new Event('input')); await nextTick();
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(wire.emit).toHaveBeenCalledWith('lobby:chat', 'Hello');
  });
  it('shows the same clock panel to a public-table non-host, without permitting edits', async () => {
    const ordinary = lobby({ mode: 'team', players: lobby().players.slice(0, 3).map(p => ({ ...p, host: p.userId === 2 })) });
    await setState(ordinary);
    const panel = root.querySelector<HTMLElement>('.time-control-panel')!;
    expect(panel.previousElementSibling?.classList.contains('mode-panel')).toBe(true);
    expect(panel.nextElementSibling?.classList.contains('players-panel')).toBe(true);
    expect(panel.getAttribute('aria-labelledby')).toBe('lobby-time-control');
    expect(panel.querySelector('.setting-label')?.textContent).toBe('Контроль времени');
    expect(panel.querySelectorAll('button')).toHaveLength(0);
    expect(panel.querySelector('.current-time-control')?.textContent).toBe('5+3');
    expect(root.querySelector('.hero-title-row')?.textContent).not.toContain('5+3');
    await setState({ ...ordinary, timeControl: { kind: 'clock', baseMin: 7, incSec: 4 } });
    expect(panel.querySelector('.current-time-control')?.textContent).toBe('7+4');
    await setState({ ...ordinary, timeControl: { kind: 'none', baseMin: 0, incSec: 0 } });
    expect(panel.querySelector('.current-time-control')?.textContent).toBe('Без часов');
    expect(wire.emit).not.toHaveBeenCalledWith('lobby:set-time-control', expect.anything());
  });
  it('keeps clock editing available to a non-host at a quick table', async () => {
    await setState(lobby({ isQuick: true, players: lobby().players.map(p => ({ ...p, host: p.userId === 2 })) }));
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('.time-control-panel button')];
    expect(buttons.every(button => !button.disabled)).toBe(true);
    buttons[0].click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:set-time-control', { kind: 'clock', baseMin: 1, incSec: 0 });
  });
  it('keeps a labeled native mode select with all seven options', () => {
    const select = root.querySelector<HTMLSelectElement>('#lobby-mode')!;
    expect(root.querySelector('label[for="lobby-mode"]')?.textContent).toContain('Режим игры');
    expect(select.options).toHaveLength(7);
    expect(root.querySelector('.mode-chevron')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelector('.mode-rules')?.getAttribute('href')).toBe('/rules/double');
  });
  it('distinguishes waiting, ready, countdown and paused presentation without changing start availability', async () => {
    expect(root.querySelector('.start-section')?.classList.contains('phase-ready')).toBe(true);
    expect(root.querySelector('#lobby-start-heading')?.textContent).toBe('Все готовы! Хост может запускать партию.');
    await setState(lobby({ players: lobby().players.map(p => ({ ...p, ready: false })) }));
    expect(root.querySelector('.start-section')?.classList.contains('phase-waiting')).toBe(true);
    expect(root.querySelector<HTMLButtonElement>('.start-game-btn')?.disabled).toBe(true);
    await setState(lobby());
    expect(root.querySelector<HTMLButtonElement>('.start-game-btn')?.disabled).toBe(false);
    wire.handlers.get('lobby:countdown')!({ lobbyId: 'sample', seconds: 3, paused: false }); await nextTick();
    expect(root.querySelector('.start-section')?.classList.contains('phase-countdown')).toBe(true);
    expect(root.querySelector('.start-game-btn')).toBeNull();
    expect(root.querySelector('.cancel-start-btn')).not.toBeNull();
    expect(root.querySelector('.start-detail')?.textContent).toContain('автоматически');
    wire.handlers.get('lobby:countdown')!({ lobbyId: 'sample', seconds: 3, paused: true }); await nextTick();
    expect(root.querySelector('.start-section')?.classList.contains('phase-paused')).toBe(true);
    expect(root.querySelector('.cancel-start-btn')).toBeNull();
  });
  it('keeps readiness a reversible action for a non-host', async () => {
    const players = lobby().players.map(p => ({ ...p, host: p.userId === 2, ready: false }));
    await setState(lobby({ players }));
    const button = root.querySelector<HTMLButtonElement>('.ready-toggle-btn')!;
    expect(button.classList.contains('ready-prominent')).toBe(true);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    button.click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:ready', true);
    await setState(lobby({ players: players.map(p => ({ ...p, ready: p.userId === 1 })) }));
    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.textContent).toContain('Отменить готовность');
    button.click();
    expect(wire.emit).toHaveBeenCalledWith('lobby:ready', false);
    expect(root.querySelector('.start-game-btn')).toBeNull();
  });

  it('uses the original ready wording once in both languages', async () => {
    expect(root.querySelector('#lobby-start-heading')?.textContent).toBe('Все готовы! Хост может запускать партию.');
    expect(root.querySelector('.phase-ready .start-detail')).toBeNull();
    expect(root.querySelector('.ready-toggle-btn')?.textContent).toContain('Отменить готовность');
    useI18nStore().setLocale('en', false); await nextTick();
    expect(root.querySelector('#lobby-start-heading')?.textContent).toBe('All ready! Host can start the game.');
    expect(root.querySelector('.phase-ready .start-detail')).toBeNull();
    expect(root.querySelector('.ready-toggle-btn')?.textContent).toContain('Cancel readiness');
  });
  it('keeps code and sharing controls as separate blocks with their original actions', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    expect(root.querySelector('.code-main .code-text')?.textContent).toBe('ABC123');
    expect(root.querySelector('.code-main .code-actions')).toBeNull();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.code-actions button');
    expect(buttons[0].textContent).toBe('Поделиться');
    expect(buttons[1].textContent).toContain('Скопировать ссылку');
    buttons[0].click(); await nextTick();
    expect(share).toHaveBeenCalledWith({ title: 'Каисса', url: `${location.origin}/lobby/sample` });
    buttons[1].click(); await nextTick();
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/lobby/sample`);
    root.querySelector<HTMLElement>('.code-display')!.click(); await nextTick();
    expect(writeText).toHaveBeenLastCalledWith('ABC123');
    Reflect.deleteProperty(navigator, 'clipboard');
    Reflect.deleteProperty(navigator, 'share');
  });

});
