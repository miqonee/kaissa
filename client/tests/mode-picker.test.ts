// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { type GameMode } from 'shared';
import ModePicker from '../src/components/ModePicker.vue';
import CreateLobbyModal from '../src/components/CreateLobbyModal.vue';
import { useI18n } from '../src/stores/i18n';

let app: App, root: HTMLElement;
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); vi.unstubAllGlobals(); });
const router = () => createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });
const settle = async () => { await nextTick(); await nextTick(); };
function mountPicker() {
  const mode = ref<GameMode>('team');
  app = createApp({ render: () => h(ModePicker, { modelValue: mode.value, 'onUpdate:modelValue': value => mode.value = value }) });
  app.use(createPinia()).use(router()).mount(root);
  return mode;
}
async function openPicker(scope: Element = root) {
  scope.querySelector<HTMLButtonElement>('.mode-trigger')!.click();
  await settle();
}

describe('compact mode selection and on-demand board previews', () => {
  it('keeps the board hidden until focus, without changing the selected mode', async () => {
    const mode = mountPicker();
    expect(root.querySelector('.mode-preview')).toBeNull();
    root.querySelector<HTMLButtonElement>('.mode-trigger')!.focus();
    await settle();
    expect(root.querySelectorAll('.standard-boards rect')).toHaveLength(64);
    expect(mode.value).toBe('team');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(root.querySelector('.mode-popup')).toBeNull();
  });
  it('filters modes, previews them on focus and commits only after selection', async () => {
    const mode = mountPicker();
    await openPicker();
    const search = root.querySelector<HTMLInputElement>('input[type="search"]')!;
    search.value = 'Двойные'; search.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(root.querySelectorAll('.mode-option')).toHaveLength(1);
    const option = root.querySelector<HTMLButtonElement>('[data-mode="double"]')!;
    option.focus(); await settle();
    expect(root.querySelectorAll('[data-cell]')).toHaveLength(128);
    expect(mode.value).toBe('team');
    expect(root.querySelector('.mode-detail a')?.getAttribute('href')).toBe('/rules/double');
    useI18n().setLocale('en', false); await settle();
    expect(root.querySelector('.mode-detail')?.textContent).toContain('Double Chess');
    option.click(); await settle();
    expect(mode.value).toBe('double');
    expect(root.querySelector('.mode-popup')).toBeNull();
    expect(document.activeElement).toBe(root.querySelector('.mode-trigger'));
  });
  it('navigates with arrows and cancels without applying the focused mode', async () => {
    const mode = mountPicker();
    await openPicker();
    const key = (name: string) => document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
    key('ArrowDown'); key('ArrowDown'); await settle();
    expect(document.activeElement?.getAttribute('data-mode')).toBe('double');
    key('Escape'); await settle();
    expect(mode.value).toBe('team');
    expect(root.querySelector('.mode-popup')).toBeNull();
  });
  it('lets touch users inspect a mode before choosing it', async () => {
    vi.stubGlobal('innerWidth', 390);
    const mode = mountPicker();
    await openPicker();
    root.querySelector('[data-mode="double"]')!.parentElement!.querySelector<HTMLButtonElement>('.mode-info')!.click();
    await settle();
    expect(root.querySelector('.mode-popup.mobile-preview')).not.toBeNull();
    expect(root.querySelectorAll('[data-cell]')).toHaveLength(128);
    expect(mode.value).toBe('team');
    root.querySelector<HTMLButtonElement>('.mobile-select')!.click(); await settle();
    expect(mode.value).toBe('double');
    expect(root.querySelector('.mode-popup')).toBeNull();
  });
  it('submits modal settings without changing the homepage selection', async () => {
    const homeMode = ref<GameMode>('team');
    let created: { mode: GameMode; timeControl: { kind: string } } | undefined;
    app = createApp({ render: () => h('div', [
      h(ModePicker, { modelValue: homeMode.value, 'onUpdate:modelValue': value => homeMode.value = value }),
      h(CreateLobbyModal, { onCreate: value => { created = value; } }),
    ]) });
    app.use(createPinia()).use(router()).mount(root); await settle();
    const modal = root.querySelector('.create-modal')!;
    await openPicker(modal);
    modal.querySelector<HTMLButtonElement>('[data-mode="double"]')!.click(); await settle();
    modal.querySelector<HTMLButtonElement>('.modal-foot .primary')!.click();
    expect(homeMode.value).toBe('team');
    expect(created).toMatchObject({ mode: 'double', timeControl: { kind: 'none' } });
  });
  it('dismisses the nested picker before the creation dialog on Escape', async () => {
    let closes = 0;
    app = createApp({ render: () => h(CreateLobbyModal, { onClose: () => closes++ }) });
    app.use(createPinia()).use(router()).mount(root); await settle();
    await openPicker();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await settle();
    expect(closes).toBe(0);
    expect(root.querySelector('.mode-popup')).toBeNull();
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(closes).toBe(1);
  });
});
