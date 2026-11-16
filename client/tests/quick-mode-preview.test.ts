// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, reactive, ref, type App } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { GAME_MODES, type GameMode, type LobbySummary } from 'shared';
import QuickPlayPanel from '../src/components/QuickPlayPanel.vue';
import { useI18n } from '../src/stores/i18n';
let app: App, root: HTMLElement;
const settle = async () => { await nextTick(); await nextTick(); };
const popup = () => document.querySelector('.quick-mode-preview');
function pointer(el: Element, type: string, pointerType = 'mouse') {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: pointerType });
  el.dispatchEvent(event);
}
function mount() {
  const mode = ref<GameMode>('team');
  const state = reactive({ busy: false, loading: false, lobby: { mode: 'team', timeControl: { kind: 'none' } } as LobbySummary });
  const play = vi.fn();
  app = createApp({ render: () => h(QuickPlayPanel, { ...state, modelValue: mode.value, 'onUpdate:modelValue': value => mode.value = value, onPlay: play }) });
  app.use(createPinia()).use(createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] })).mount(root);
  return { mode, state, play };
}
const choice = (mode: GameMode) => root.querySelector<HTMLInputElement>(`input[value="${mode}"]`)!.parentElement!;
beforeEach(() => {
  localStorage.clear(); vi.useFakeTimers();
  root = document.createElement('div'); document.body.appendChild(root);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 120, 40));
});
afterEach(() => { app?.unmount(); root.remove(); vi.restoreAllMocks(); vi.useRealTimers(); });
describe('quick-play board previews', () => {
  it('previews all modes on delayed mouse hover without selecting or playing', async () => {
    const { mode, play } = mount();
    expect(popup()).toBeNull();
    for (const name of GAME_MODES) {
      pointer(choice(name), 'pointerenter');
      await vi.advanceTimersByTimeAsync(200); await settle();
      expect(popup()?.querySelector(`.mode-preview.${name}`)).not.toBeNull();
      expect(mode.value).toBe('team'); expect(play).not.toHaveBeenCalled();
      pointer(choice(name), 'pointerleave');
      await vi.advanceTimersByTimeAsync(180); await settle();
      expect(popup()).toBeNull();
    }
  });
  it('cancels transient hover and permits pointer travel into the card', async () => {
    mount(); pointer(choice('double'), 'pointerenter'); pointer(choice('double'), 'pointerleave');
    await vi.advanceTimersByTimeAsync(500); expect(popup()).toBeNull();
    pointer(choice('double'), 'pointerenter'); await vi.advanceTimersByTimeAsync(200); await settle();
    pointer(choice('double'), 'pointerleave'); pointer(popup()!, 'pointerenter');
    await vi.advanceTimersByTimeAsync(500); expect(popup()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
    expect(popup()).toBeNull();
  });
  it('exposes a keyboard description and focus preview, closing on focus outside', async () => {
    mount(); const input = choice('bughouse').querySelector('input')!;
    input.focus(); await settle();
    expect(popup()?.textContent).toContain('Багхаус');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toContain('Две доски');
    root.querySelector<HTMLButtonElement>('.quick-action')!.focus(); await settle(); expect(popup()).toBeNull();
  });
  it('opens a dismissible touch preview without changing selection or playing', async () => {
    const { mode, play } = mount();
    pointer(choice('double'), 'pointerenter', 'touch'); await vi.advanceTimersByTimeAsync(300); expect(popup()).toBeNull();
    const button = root.querySelector<HTMLButtonElement>('.quick-preview-trigger')!;
    button.click(); await settle();
    expect(popup()?.getAttribute('role')).toBe('dialog');
    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(popup()?.querySelector('button'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await settle();
    expect(popup()).toBeNull(); expect(document.activeElement).toBe(button);
    button.click(); await settle(); popup()!.querySelector<HTMLButtonElement>('button')!.click(); await settle();
    expect(popup()).toBeNull(); expect(mode.value).toBe('team'); expect(play).not.toHaveBeenCalled();
  });
  it('uses the native select value and current locale, and closes on outside pointer or busy', async () => {
    const { mode, state } = mount(); const select = root.querySelector<HTMLSelectElement>('.mode-select')!;
    select.value = 'double'; select.dispatchEvent(new Event('change')); await settle();
    expect(mode.value).toBe('double'); useI18n().setLocale('en', false); await settle();
    const button = root.querySelector<HTMLButtonElement>('.quick-preview-trigger')!;
    button.click(); await settle(); expect(popup()?.textContent).toContain('Double Chess');
    pointer(document.body, 'pointerdown'); await settle(); expect(popup()).toBeNull();
    button.click(); await settle(); state.busy = true; await settle(); expect(popup()).toBeNull();
    expect(button.disabled).toBe(true);
    pointer(choice('team'), 'pointerenter'); await vi.advanceTimersByTimeAsync(300); expect(popup()).toBeNull();
  });
  it('keeps a keyboard preview on pointer leave and exits its nonmodal dialog in logical tab order', async () => {
    mount(); const input = choice('team').querySelector('input')!; input.focus(); await settle();
    pointer(choice('team'), 'pointerleave'); await vi.advanceTimersByTimeAsync(300); expect(popup()).not.toBeNull();
    expect(input.parentElement!.textContent).not.toContain('Одна доска');
    const eye = root.querySelector<HTMLButtonElement>('.quick-preview-trigger')!;
    eye.click(); await settle();
    popup()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })); await settle();
    expect(popup()).toBeNull(); expect(document.activeElement).toBe(root.querySelector('.quick-action'));
    eye.click(); await settle();
    popup()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })); await settle();
    expect(popup()).toBeNull(); expect(document.activeElement).toBe(eye);
  });
  it('clears pending timers on unmount', async () => {
    mount(); pointer(choice('team'), 'pointerenter'); app.unmount(); await vi.advanceTimersByTimeAsync(500); expect(popup()).toBeNull();
  });
});
