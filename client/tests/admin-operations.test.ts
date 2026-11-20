// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, type App } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';
import AdminPage from '../src/pages/AdminPage.vue';
import { api } from '../src/api/rest';

vi.mock('../src/api/rest', () => ({ api: { get: vi.fn() } }));

let root: HTMLElement;
let app: App | undefined;
const get = vi.mocked(api.get);
const metrics = (period: string) => ({
  totalGames: 128, totalMoves: 7102, totalUsers: 80, onlineUsers: 2, avgGameDurationSec: 100,
  activity: { period, started: period === '7' ? 5 : 52, finished: 3, abandoned: 1, active: 1,
    distinctHumanMovers: period === '7' ? 4 : 17, abandonedWithoutMoves: 0, abandonedWithMoves: 1, recordedMoves: 81 },
});
async function mount() {
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/admin', component: AdminPage },
    { path: '/game/:id', component: { render: () => null } },
  ] });
  await router.push('/admin');
  app = createApp({ render: () => h(RouterView) });
  app.use(createPinia()).use(router).mount(root);
  await vi.waitFor(() => expect(root.querySelector('.activity-panel')).not.toBeNull());
}
const button = (label: string, area = root) => [...area.querySelectorAll('button')].find(b => b.textContent?.trim().startsWith(label))!;

beforeEach(() => {
  localStorage.clear();
  root = document.createElement('div'); document.body.appendChild(root);
  get.mockReset().mockImplementation(async path => path.includes('/api/admin/metrics') ? metrics(new URL(path, 'http://local').searchParams.get('period') ?? 'all') : ({
    games: [{ id: 155, mode: 'bughouse', status: 'active', result: '*', reason: null, ratingKind: 'guest', noClock: true, startedAt: '2026-11-19T19:56Z', moves: 2,
      participants: [{ id: 1, username: 'Finch', isGuest: true, isBot: false, online: false }],
      diagnostics: { inMemory: true, paused: true, waitingForHuman: true, disconnectedUserIds: [1], offlineUserIds: [1], lastMove: { ply: 2, boardIndex: 1, userId: 1 }, warnings: ['paused_with_bots', 'offline_participant'] } }],
    page: 1, totalPages: 1, total: 1,
  }) as never);
});
afterEach(() => { app?.unmount(); root.remove(); });

describe('Admin operations overview', () => {
  it('changes activity period without relabeling platform totals', async () => {
    await mount();
    expect(get).toHaveBeenCalledWith('/api/admin/metrics?scope=overview&period=30');
    button('7 дней').click();
    await vi.waitFor(() => expect(root.querySelector('.activity-main')?.textContent).toContain('Люди, сделавшие ход4'));
    expect(get).toHaveBeenCalledWith('/api/admin/metrics?scope=overview&period=7');
    expect(root.querySelector('.platform-totals')?.textContent).toContain('128');
    expect(root.querySelector('.interrupted-split')?.textContent).toContain('1 с записанными ходами');
  });

  it('opens active match diagnosis and shows actual recorded ply, not a fabricated timestamp', async () => {
    await mount();
    button('Активны', root.querySelector<HTMLElement>('.activity-legend')!).click();
    await vi.waitFor(() => expect(root.querySelector('.admin-match')).not.toBeNull());
    expect(get).toHaveBeenCalledWith(expect.stringContaining('status=active'));
    button('Диагностика').click();
    await vi.waitFor(() => expect(root.querySelector('.diagnostics')?.textContent).toContain('Партия на паузе'));
    expect(root.querySelector('.diagnostics')?.textContent).toContain('Участники вне сетиFinch');
    expect(root.querySelector('.diagnostics')?.textContent).toContain('#2 · Finch · доска 2');
    expect(root.querySelector('.diagnostics')?.textContent).toContain('Только чтение');
  });
});
