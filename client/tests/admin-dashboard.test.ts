// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { createPinia } from 'pinia';
import AdminPage from '../src/pages/AdminPage.vue';
import { useI18n } from '../src/stores/i18n';

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock('../src/api/rest', () => ({ api }));
vi.mock('../src/composables/useSeo', () => ({ usePageSeo: vi.fn() }));
vi.mock('../src/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 1, isAdmin: true } }) }));
const accounts = { registered: 20, guests: 30, bots: 7, online: 4 };
const metrics = { accounts, onlineUsers: 4, totalUsers: 50, totalGames: 100, totalMoves: 1000, avgGameDurationSec: 300, botMetrics: [], botMetricsVsHuman: [], botMetricsVsBot: [], personalityMetricsVsHuman: [], personalityMetricsVsBot: [] };
const user = { id: 2, username: 'Guest Finch', rating: 1250, games: 12, wins: 5, losses: 7, createdAt: '2026-11-01', lastSeenAt: '2026-11-20', online: true, isAdmin: false, isGuest: true, activeGameId: 155, modeRatings: [] };
const game = { id: 155, mode: 'double', status: 'active', result: '*', reason: null, ratingKind: 'training', baseMin: 5, incSec: 0, noClock: false, startedAt: '2026-11-20', endedAt: null, moves: 9, participants: [{ id: 2, username: user.username, online: false, isBot: false, isGuest: true, team: 1 }], diagnostics: { inMemory: true, paused: true, waitingForHuman: true, disconnectedUserIds: [2], pendingResult: false, warnings: ['offline_participant'] } };
let app: App;
let root: HTMLElement;
async function flush() { for (let i = 0; i < 6; i++) await nextTick(); }
function click(selector: string) { root.querySelector<HTMLButtonElement>(selector)!.click(); }
async function tab(id: string) { click(`[data-tab="${id}"]`); await flush(); }
async function filter(index: number, label: string) {
  root.querySelectorAll<HTMLButtonElement>('.admin-filters [role="combobox"]')[index].click();
  await flush();
  const option = [...document.querySelectorAll<HTMLElement>('[role="listbox"] [role="option"]')]
    .find(item => item.textContent?.trim() === label);
  expect(option).toBeDefined();
  option!.click();
  await flush();
}
beforeEach(async () => {
  vi.clearAllMocks();
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  api.get.mockImplementation(async (url: string) => {
    if (url.includes('/metrics')) return metrics;
    if (url.includes('/users/search')) return { users: [user], accounts, pageSize: 25, page: Number(new URL(url, 'http://test').searchParams.get('page')), totalPages: 2, total: 30 };
    if (url.includes('/games')) return { games: [game], page: 1, totalPages: 1, total: 1 };
    throw new Error('Unexpected request');
  });
  root = document.createElement('div'); document.body.append(root);
  app = createApp({ render: () => h(AdminPage) });
  app.component('RouterLink', { props: ['to'], template: '<a><slot /></a>' });
  app.use(createPinia()).mount(root); await flush();
});
afterEach(() => { app.unmount(); root.remove(); vi.restoreAllMocks(); });

describe('admin dashboard read workflows', () => {
  it('loads lightweight overview and lazy bot metrics without fetching all accounts', async () => {
    expect(api.get).toHaveBeenCalledWith('/api/admin/metrics?scope=overview&period=30');
    expect(api.get).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.platform-totals')?.textContent).toContain('100');
    await tab('bots');
    expect(api.get).toHaveBeenCalledWith('/api/admin/metrics');
    expect(root.querySelector('.bot-metrics-panel')).not.toBeNull();
    expect(api.post).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
  });
  it('searches all humans, resets pagination on guest/online filters, and exposes mobile cards', async () => {
    await tab('users');
    const next = [...root.querySelectorAll<HTMLButtonElement>('.admin-pagination button')].at(-1)!;
    next.click(); await flush();
    expect(api.get.mock.lastCall?.[0]).toContain('page=2');
    await filter(0, 'Гости');
    expect(api.get.mock.lastCall?.[0]).toContain('kind=guest');
    expect(api.get.mock.lastCall?.[0]).toContain('page=1');
    await filter(1, 'Онлайн');
    expect(api.get.mock.lastCall?.[0]).toContain('online=online');
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = 'Finch'; input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await flush();
    expect(api.get.mock.lastCall?.[0]).toContain('q=Finch');
    expect(root.querySelector('.mobile-user')?.textContent).toContain('Guest Finch');
  });
  it('keeps lifetime counts separate from matches and the visible page range', async () => {
    expect(root.querySelector('.account-counts .humans dd')?.textContent).toBe('50');
    expect(root.querySelector('.account-counts .registered dd')?.textContent).toBe('20');
    expect(root.querySelector('.account-counts .guests dd')?.textContent).toBe('30');
    expect(root.querySelector('.account-counts .bots dd')?.textContent).toBe('7');
    expect(root.querySelector('.account-counts .online dd')?.textContent).toBe('4');
    await tab('users');
    expect(root.querySelector('.user-result-count strong')?.textContent).toBe('Найдено: 30');
    click('.admin-pagination button:last-child'); await flush();
    expect(root.querySelector('.user-result-count')?.textContent).toContain('Показаны 26–26');
    expect(root.querySelector('.account-counts .humans dd')?.textContent).toBe('50');

    api.get.mockResolvedValueOnce({ users: [], accounts, pageSize: 25, page: 1, totalPages: 0, total: 0 });
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await flush();
    expect(root.querySelector('.user-result-count')?.textContent).toBe('Найдено: 0');
    expect(root.querySelector('.account-counts .humans dd')?.textContent).toBe('50');
    expect(root.querySelector('.admin-pagination')).toBeNull();
  });
  it('shows Guest in the desktop role, mobile card, and account details', async () => {
    await tab('users');
    expect(root.querySelector('.user-table .account-role')?.textContent).toBe('Гость');
    expect(root.querySelector('.mobile-user')?.textContent).toContain('#2 · Гость');
    click('.user-table tbody button'); await flush();
    expect(root.querySelector('.account-detail .account-role')?.textContent).toBe('Гость');
  });
  it('moves back to the final available page when the requested page disappears', async () => {
    await tab('users');
    api.get.mockResolvedValueOnce({ users: [], accounts, pageSize: 25, page: 2, totalPages: 1, total: 25 });
    api.get.mockResolvedValueOnce({ users: [user], accounts, pageSize: 25, page: 1, totalPages: 1, total: 25 });
    click('.admin-pagination button:last-child'); await flush();
    expect(api.get.mock.lastCall?.[0]).toContain('page=1');
    expect(root.querySelector('.user-result-count strong')?.textContent).toBe('Найдено: 25');
    expect(root.querySelector('.admin-pagination')).toBeNull();
  });
  it('localizes the account summary and guest role in English', async () => {
    useI18n().setLocale('en', false);
    await tab('users');
    expect(root.querySelector('.account-counts .registered dt')?.textContent).toBe('Registered');
    expect(root.querySelector('.user-result-count strong')?.textContent).toBe('Accounts found: 30');
    expect(root.querySelector('.user-table .account-role')?.textContent).toBe('Guest');
  });
  it('shows match diagnostics and submits ID and untimed filters read-only', async () => {
    await tab('games');
    const input = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    input.value = '155'; input.dispatchEvent(new Event('input'));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await flush();
    expect(api.get.mock.lastCall?.[0]).toContain('q=155');
    await filter(2, 'Без часов');
    expect(api.get.mock.lastCall?.[0]).toContain('clock=untimed');
    click('.match-footer button'); await flush();
    expect(root.querySelector('.diagnostics')?.textContent).toContain('Есть отключённый участник');
    expect(api.post).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
  });
  it('separates dangerous actions and cancel never mutates an account', async () => {
    await tab('users'); click('.user-table tbody button'); await flush();
    expect(root.querySelector('.danger-zone')).toBeNull();
    click('.danger-reveal'); await flush();
    const buttons = root.querySelectorAll<HTMLButtonElement>('.danger-zone button');
    buttons[0].click(); await flush();
    buttons[2].click(); await flush();
    expect(window.confirm).toHaveBeenCalledTimes(2);
    expect(buttons[1].disabled).toBe(true); // Guest cannot gain administrative access.
    expect(api.post).not.toHaveBeenCalled(); expect(api.delete).not.toHaveBeenCalled();
    await tab('games'); await tab('users');
    expect(root.querySelector('.danger-zone')).toBeNull();
  });
  it('discards a stale search response and permits refresh after error', async () => {
    await tab('users');
    let resolveOld!: (value: unknown) => void;
    api.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true })); await flush();
    await filter(0, 'Гости');
    resolveOld({ users: [{ ...user, username: 'Stale account' }], page: 1, totalPages: 1, total: 1 }); await flush();
    expect(root.textContent).not.toContain('Stale account');
    api.get.mockRejectedValueOnce(new Error('Fixture unavailable'));
    click('.admin-header button'); await flush();
    expect(root.querySelector('[role="alert"]')?.textContent).toBe('Fixture unavailable');
    click('.admin-header button'); await flush();
    expect(root.querySelector('[role="alert"]')).toBeNull();
  });
});
