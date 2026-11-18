// @vitest-environment jsdom
import { EventEmitter } from 'node:events';
import { createApp, nextTick } from 'vue';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import { expect, it, vi } from 'vitest';
import type { ChatMessage, LobbySummary } from 'shared';
import LobbyPage from '../src/pages/LobbyPage.vue';

const events = new EventEmitter();
const send = vi.fn();
vi.mock('../src/api/socket', () => ({
  getSocket: () => ({
    on: events.on.bind(events),
    off: (name: string) => events.removeAllListeners(name),
    emit: send,
    timeout: () => ({ emit: vi.fn() }),
  }),
  onSocketResync: () => () => {},
}));
vi.mock('../src/stores/auth', () => ({ useAuthStore: () => ({ user: { id: 1 } }) }));

it('keeps lobby messages and drafts while collapsed and counts only other players as unread', async () => {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/lobby/:id', component: LobbyPage }] });
  await router.push('/lobby/table');
  const root = document.createElement('div');
  document.body.appendChild(root);
  const app = createApp(LobbyPage).use(createPinia()).use(router);
  app.mount(root);
  try {
    events.emit('lobby:state', {
      id: 'table', name: 'Table', code: 'ABC123', mode: 'team', players: [],
      started: false, timeControl: { kind: 'none', baseMin: 0, incSec: 0 },
    } satisfies LobbySummary);
    await nextTick();
    const toggle = root.querySelector<HTMLButtonElement>('.chat-toggle')!;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    const message: ChatMessage = { id: 1, userId: 2, username: 'Guest', text: 'Привет!', at: 0 };
    events.emit('lobby:chat', message);
    events.emit('lobby:chat', { ...message, id: 2, userId: 1 });
    events.emit('lobby:chat', { ...message, id: 3, system: true, isCountdown: true });
    events.emit('lobby:chat:clear-countdown');
    await nextTick();
    expect(toggle.querySelector('.unread')?.textContent).toBe('1');

    toggle.click();
    await nextTick();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(dialog.getAttribute('aria-label')).toBe('Чат лобби');
    expect(dialog.querySelectorAll('.chat-message')).toHaveLength(2);
    const input = dialog.querySelector('input')!;
    input.value = '  Мой ход  ';
    input.dispatchEvent(new Event('input'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.querySelector('.unread')).toBeNull();
    toggle.click();
    await nextTick();
    expect(input.value).toBe('  Мой ход  ');
    dialog.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();
    expect(send).toHaveBeenCalledWith('lobby:chat', 'Мой ход');
    expect(input.value).toBe('');
  } finally {
    app.unmount();
    root.remove();
  }
});
