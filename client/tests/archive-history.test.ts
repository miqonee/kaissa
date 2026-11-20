// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';
import HistoryPage from '../src/pages/HistoryPage.vue';
import { ApiError } from '../src/api/rest';

const mock = vi.hoisted(() => ({ get: vi.fn(), user: { id: 1, isGuest: false } }));
vi.mock('../src/api/rest', async importOriginal => ({ ...(await importOriginal<object>()), api: { get: mock.get } }));
vi.mock('../src/stores/auth', () => ({ useAuthStore: () => mock }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
let root: HTMLElement;
let app: App;
const router = () => createRouter({ history: createMemoryHistory(), routes: [
  { path: '/history', name: 'history', component: HistoryPage },
  { path: '/login', name: 'login', component: { template: '<p>Login</p>' } },
] });
async function flush() { for (let i = 0; i < 15; i++) await nextTick(); }
async function mount(url: string) {
  const r = router();
  await r.push(url);
  root = document.createElement('div'); document.body.append(root);
  app = createApp({ render: () => h(HistoryPage) });
  app.use(r).use(createPinia()).mount(root);
  await flush();
  return r;
}
beforeEach(() => {
  mock.get.mockReset().mockResolvedValue({ games: [], nextCursor: null });
  mock.user.isGuest = false;
  localStorage.clear();
});
afterEach(() => { app?.unmount(); root?.remove(); });

describe('archive URL filters and error states', () => {
  it('loads filtered deep links and preserves scope, date and clock across cursor pagination', async () => {
    mock.get.mockResolvedValueOnce({ games: [], nextCursor: 42 });
    await mount('/history?tab=all&mode=double&status=finished&clock=5%2B0&from=2026-11-01&to=2026-11-20&gameId=155');
    const url = new URL(mock.get.mock.calls[0][0], 'https://fixture.local');
    expect(url.pathname).toBe('/api/games/archive');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ gameId: '155', clock: '5+0', from: '2026-11-01', to: '2026-11-20', mode: 'double', status: 'finished' });
    root.querySelector<HTMLButtonElement>('.empty button')!.click(); await flush();
    const next = new URL(mock.get.mock.calls[1][0], 'https://fixture.local');
    expect(next.searchParams.get('cursor')).toBe('42');
    expect(next.searchParams.get('gameId')).toBe('155');
  });
  it('writes search to URL and replaces a profile exact-player link when participant input changes', async () => {
    const r = await mount('/history?tab=all&mode=double&player=Previous&playerId=51');
    const input = root.querySelector<HTMLInputElement>('input[type=search]')!;
    input.value = 'Finch'; input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await vi.waitFor(() => expect(r.currentRoute.value.query.player).toBe('Finch'));
    expect(r.currentRoute.value.query.playerId).toBeUndefined();
    expect(r.currentRoute.value.query.mode).toBe('double');
    expect(mock.get.mock.lastCall?.[0]).toContain('player=Finch');
    r.back();
    await vi.waitFor(() => expect(r.currentRoute.value.query.playerId).toBe('51'));
    expect(mock.get.mock.lastCall?.[0]).toContain('playerId=51');
  });
  it.each([401, 403])('preserves exact destination in auth recovery for %i', async status => {
    mock.user.isGuest = status === 403;
    mock.get.mockRejectedValueOnce(new ApiError('Denied', status));
    const path = '/history?tab=all&gameId=155';
    await mount(path);
    const link = root.querySelector<HTMLAnchorElement>('[role=alert] a')!;
    const url = new URL(link.href, 'https://fixture.local');
    expect(url.pathname).toBe('/login');
    expect(url.searchParams.get('redirect')).toBe(path);
    expect(url.searchParams.get('claim')).toBe(status === 403 ? '1' : null);
    expect(root.textContent).not.toContain('Проверьте соединение');
  });
});
