// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, reactive, type App } from 'vue';
import { createPinia } from 'pinia';
import ChatWidget from '../src/components/ChatWidget.vue';
let app: App;
let root: HTMLElement;
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); });
async function mount(props: any) {
  app = createApp({ render: () => h(ChatWidget, props) });
  app.use(createPinia()).mount(root);
  root.querySelector<HTMLButtonElement>('.chat-fab')!.click(); await nextTick();
  (root.querySelectorAll('[role="tab"]')[1] as HTMLButtonElement).click(); await nextTick();
}
describe('move history window', () => {
  it('shows the actual total and absolute numbering past 60, including rolling updates', async () => {
    const props = reactive({ messages: [], moves: Array.from({ length: 60 }, (_, i) => `move ${i + 66}`), totalMoves: 125 });
    await mount(props);
    expect(root.querySelectorAll('.tab-count')[1].textContent).toBe('125');
    expect(root.querySelector('.history-window')?.textContent).toContain('60 из 125');
    expect(root.querySelector('.move-idx')?.textContent).toBe('66.');
    expect(root.querySelectorAll('.move-idx')[59].textContent).toBe('125.');
    // The array stays at 60 entries; a new server state must still advance the UI.
    props.moves = [...props.moves.slice(1), 'new move']; props.totalMoves = 126; await nextTick();
    expect(root.querySelectorAll('.tab-count')[1].textContent).toBe('126');
    expect(root.querySelector('.move-idx')?.textContent).toBe('67.');
    expect(root.querySelectorAll('.move-idx')[59].textContent).toBe('126.');
  });
  it('preserves full-history callers with no separate total', async () => {
    await mount({ messages: [], moves: ['e4', 'e5'] });
    expect(root.querySelectorAll('.tab-count')[1].textContent).toBe('2');
    expect(root.querySelector('.history-window')).toBeNull();
    expect(root.querySelector('.move-idx')?.textContent).toBe('1.');
  });
});
