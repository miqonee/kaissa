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

it('shows the chat and countdown inline, preserves drafts and clears only countdown messages', async () => {
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
    const chat = root.querySelector<HTMLElement>('.lobby-chat')!;
    expect(chat.getAttribute('aria-label')).toBe('Чат лобби');
    expect(chat.querySelector('.chat-toggle')).toBeNull();
    expect(chat.querySelector('[role="dialog"]')).toBeNull();
    const input = chat.querySelector('input')!;
    input.value = '  Мой ход  ';
    input.dispatchEvent(new Event('input'));
    const message: ChatMessage = { id: 1, userId: 2, username: 'Guest', text: 'Привет!', at: 0 };
    events.emit('lobby:chat', message);
    events.emit('lobby:chat', { ...message, id: 2, text: '3...', system: true, isCountdown: true });
    const tick = { lobbyId: 'table', seconds: 3, paused: false, pausedCount: 0, neededCount: 2 };
    events.emit('lobby:countdown', tick);
    await nextTick();
    expect(chat.querySelector('[role="log"]')?.textContent).toContain('3...');
    expect(chat.querySelector('[role="timer"]')?.textContent).toContain('3 с');
    events.emit('lobby:countdown', { ...tick, paused: true, pausedCount: 2 });
    await nextTick();
    expect(chat.querySelector('[role="timer"]')?.textContent).toContain('Пауза');
    events.emit('lobby:countdown', { ...tick, seconds: null });
    events.emit('lobby:chat:clear-countdown');
    await nextTick();
    expect(chat.querySelector('[role="timer"]')).toBeNull();
    expect(chat.querySelectorAll('.chat-message')).toHaveLength(1);
    expect(chat.querySelector('[role="log"]')?.textContent).toContain(message.text);
    expect(input.value).toBe('  Мой ход  ');
    chat.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await nextTick();
    expect(send).toHaveBeenCalledWith('lobby:chat', 'Мой ход');
    expect(input.value).toBe('');
  } finally {
    app.unmount();
    root.remove();
  }
});
