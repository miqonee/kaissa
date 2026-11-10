// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import { createPinia } from 'pinia';
import MaterialBalance from '../src/components/MaterialBalance.vue';
import MatchChat from '../src/components/MatchChat.vue';
import ChatWidget from '../src/components/ChatWidget.vue';

let app: App;
let root: HTMLElement;
beforeEach(() => { vi.stubGlobal('innerWidth', 390); localStorage.clear(); root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); vi.unstubAllGlobals(); });

describe('compact material details', () => {
  it('limits miniatures to three, discloses complete counts on tap and closes on a new position', async () => {
    const props = reactive({ fen: '4k3/8/8/8/8/8/QQQQRRPP/4K3 w - - 0 1', color: 'w' as const });
    app = createApp({ render: () => h(MaterialBalance, props) }); app.use(createPinia()).mount(root);
    expect(root.querySelectorAll('.material-miniatures img')).toHaveLength(3);
    const button = root.querySelector<HTMLButtonElement>('button')!;
    expect(button.getAttribute('aria-label')).toContain('Ферзь ×4');
    expect(root.textContent).toContain('+48');
    button.click(); await nextTick();
    expect(document.querySelector('[role="tooltip"]')?.textContent).toContain('×4');
    expect(document.querySelectorAll('.material-detail-piece')).toHaveLength(3);
    props.fen = '4k3/8/8/8/8/8/8/4K3 b - - 0 1'; await nextTick();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(root.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
  });
});

describe('mobile match chat', () => {
  it('reuses the FFA widget with hints above chat and optional move history', async () => {
    const props = reactive({ messages: [], showMoves: false });
    app = createApp({ render: () => h(ChatWidget, props, { default: () => h('details', [h('summary', 'Rules'), h('p', 'Hint')]) }) });
    app.use(createPinia()).mount(root);
    const notes = root.querySelector<HTMLDetailsElement>('details')!;
    notes.open = true;
    notes.dispatchEvent(new Event('toggle'));
    root.querySelector<HTMLButtonElement>('.chat-fab')!.click(); await nextTick();
    expect(notes.open).toBe(false);
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(1);
    props.showMoves = true; await nextTick();
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(2);
    notes.open = true;
    notes.dispatchEvent(new Event('toggle')); await nextTick();
    expect(root.querySelector('.chat-fab')?.getAttribute('aria-expanded')).toBe('false');
  });
  it('opens a nonmodal floating panel on desktop without locking the board', async () => {
    vi.stubGlobal('innerWidth', 1280);
    const props = reactive({ messages: [], modelValue: '', drawer: true, open: false, unread: 0 });
    app = createApp({ render: () => h(MatchChat, { ...props, onToggle: () => { props.open = true; } }) });
    app.use(createPinia()).mount(root);
    root.querySelector<HTMLButtonElement>('.chat-toggle')!.click(); await nextTick(); await nextTick();
    expect(document.querySelector('.match-chat-panel')?.getAttribute('aria-modal')).toBeNull();
    expect(document.querySelector('.match-chat-shade')).toBeNull();
    expect(document.body.style.position).toBe('');
    expect(document.body.style.overflow).toBe('');
  });
  it('opens over the game, traps focus and restores page scrolling on close', async () => {
    const props = reactive({ messages: [], modelValue: '', drawer: true, open: false, unread: 2 });
    app = createApp({ render: () => h(MatchChat, { ...props, onToggle: () => { props.open = !props.open; }, onClose: () => { props.open = false; } }) });
    app.use(createPinia()).mount(root);
    root.querySelector<HTMLButtonElement>('.chat-toggle')!.click(); await nextTick(); await nextTick();
    expect(document.querySelector('.match-chat-panel')?.getAttribute('role')).toBe('dialog');
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.activeElement?.tagName).toBe('INPUT');
    const send = document.querySelector<HTMLButtonElement>('.match-chat-input button')!;
    send.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }); document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Свернуть чат');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await nextTick(); await nextTick();
    expect(props.open).toBe(false);
    expect(document.body.style.overflow).toBe('');
    expect(document.activeElement).toBe(root.querySelector('.chat-toggle'));
  });
});
