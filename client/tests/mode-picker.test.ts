// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { type GameMode } from 'shared';
import ModePicker from '../src/components/ModePicker.vue';
import CreateLobbyModal from '../src/components/CreateLobbyModal.vue';
import { useI18n } from '../src/stores/i18n';

let app: App, root: HTMLElement;
beforeEach(() => { localStorage.clear(); root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); });
const router = () => createRouter({ history: createMemoryHistory(), routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }] });

describe('mode selection with real board previews', () => {
  it('switches from a standard board to Double Chess and updates the rules link in both languages', async () => {
    const mode = ref<GameMode>('team');
    app = createApp({ render: () => h(ModePicker, { modelValue: mode.value, 'onUpdate:modelValue': value => mode.value = value }) });
    app.use(createPinia()).use(router()).mount(root);
    expect(root.querySelectorAll('.standard-boards rect')).toHaveLength(64);
    root.querySelector<HTMLInputElement>('input[value="double"]')!.click();
    await nextTick();
    expect(mode.value).toBe('double');
    expect(root.querySelectorAll('[data-cell]')).toHaveLength(128);
    expect(root.querySelector('.mode-detail a')?.getAttribute('href')).toBe('/rules/double');
    expect(root.querySelector('.mode-detail')?.textContent).toContain('4 цвета · две команды');
    useI18n().setLocale('en', false); await nextTick();
    expect(root.querySelector('.mode-detail')?.textContent).toContain('Double Chess');
    expect(root.querySelector('.mode-detail')?.textContent).toContain('4 colours · two teams');
  });

  it('submits Double Chess settings and isolates modal radios from the home picker', async () => {
    const homeMode = ref<GameMode>('team');
    let created: { mode: GameMode; timeControl: { kind: string } } | undefined;
    app = createApp({ render: () => h('div', [
      h(ModePicker, { modelValue: homeMode.value, 'onUpdate:modelValue': value => homeMode.value = value }),
      h(CreateLobbyModal, { onCreate: value => { created = value; } }),
    ]) });
    app.use(createPinia()).use(router()).mount(root);
    await nextTick();
    const modal = root.querySelector('.create-modal')!;
    const homeRadio = root.querySelector<HTMLInputElement>('input[value="team"]')!;
    const doubleRadio = modal.querySelector<HTMLInputElement>('input[value="double"]')!;
    expect(homeRadio.name).not.toBe(doubleRadio.name);
    doubleRadio.click(); await nextTick();
    expect(homeRadio.checked).toBe(true);
    modal.querySelector<HTMLButtonElement>('.modal-foot .primary')!.click();
    expect(created).toMatchObject({ mode: 'double', timeControl: { kind: 'none' } });
  });
});
