// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import AdminSelect from '../src/components/AdminSelect.vue';

const options = [
  { value: 'all', label: 'Игроки и гости' },
  { value: 'registered', label: 'Зарегистрированные' },
  { value: 'guest', label: 'Гости' },
  { value: 'admin', label: 'Администраторы' },
];
let host: HTMLDivElement;
let form: HTMLFormElement;
let outside: HTMLInputElement;
let app: App | undefined;
const changed = vi.fn();
const submitted = vi.fn();
const selected = ref('all');

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  selected.value = 'all';
  changed.mockClear();
  submitted.mockClear();
  app = createApp({
    render: () => h('form', { onSubmit: submitted }, [
      h(AdminSelect, {
        modelValue: selected.value,
        'onUpdate:modelValue': value => { selected.value = value; },
        onChange: changed,
        label: 'Тип аккаунта',
        options,
      }),
      h('input', { 'aria-label': 'Search' }),
    ]),
  });
  app.mount(host);
  form = host.querySelector('form')!;
  outside = form.querySelector('input')!;
});

afterEach(() => {
  app?.unmount();
  host.remove();
  vi.restoreAllMocks();
});

const control = () => host.querySelector<HTMLButtonElement>('[role="combobox"]')!;
const menu = () => document.querySelector<HTMLUListElement>('[role="listbox"]');
const rows = () => [...menu()!.querySelectorAll<HTMLElement>('[role="option"]')];
async function key(key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  control().dispatchEvent(event);
  await nextTick();
  return event;
}

describe('Admin select', () => {
  it('exposes the selected option and keeps focus on the labelled combobox while navigating', async () => {
    const trigger = control();
    expect(trigger.type).toBe('button');
    expect(document.getElementById(trigger.getAttribute('aria-labelledby')!)?.textContent).toBe('Тип аккаунта');
    trigger.focus();
    await key('Enter');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('aria-controls')).toBe(menu()!.id);
    expect(trigger.getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    expect(rows()[0].getAttribute('aria-selected')).toBe('true');
    await key('ArrowDown');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(rows()[1].id);
    expect(rows()[1].getAttribute('aria-selected')).toBe('false');
    expect(document.activeElement).toBe(trigger);
    expect(changed).not.toHaveBeenCalled();

    expect((await key('Enter')).defaultPrevented).toBe(true);
    expect(selected.value).toBe('registered');
    expect(changed.mock.calls).toEqual([['registered']]);
    expect(submitted).not.toHaveBeenCalled();
    expect(menu()).toBeNull();
    expect(trigger.textContent).toContain('Зарегистрированные');
  });

  it('supports Home, End, localized typeahead, Escape and Tab without changing on cancellation', async () => {
    const trigger = control();
    trigger.focus();
    await key('End');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(rows()[3].id);
    await key('Home');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(rows()[0].id);
    await key('г');
    expect(trigger.getAttribute('aria-activedescendant')).toBe(rows()[2].id);
    await key('Escape');
    expect(selected.value).toBe('all');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(changed).not.toHaveBeenCalled();

    await key('г');
    expect((await key('Tab')).defaultPrevented).toBe(false);
    expect(selected.value).toBe('guest');
    expect(changed.mock.calls).toEqual([['guest']]);
    expect(menu()).toBeNull();
  });

  it('allows pointer selection and dismisses on outside clicks, focus changes or unmount', async () => {
    const trigger = control();
    trigger.focus();
    trigger.click();
    await nextTick();
    rows()[3].click();
    await nextTick();
    expect(selected.value).toBe('admin');
    expect(changed.mock.calls).toEqual([['admin']]);
    expect(menu()).toBeNull();

    trigger.click();
    await nextTick();
    expect(menu()).not.toBeNull();
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await nextTick();
    expect(menu()).toBeNull();

    trigger.click();
    await nextTick();
    outside.focus();
    await nextTick();
    expect(menu()).toBeNull();
    expect(changed).toHaveBeenCalledTimes(1);

    trigger.click();
    await nextTick();
    expect(menu()).not.toBeNull();
    app?.unmount();
    app = undefined;
    expect(menu()).toBeNull();
  });

  it('fits the menu to the viewport and opens above a field near the bottom', async () => {
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(360);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(150);
    vi.spyOn(control(), 'getBoundingClientRect').mockReturnValue(new DOMRect(223, 577, 126, 40));
    control().click();
    await vi.waitFor(() => expect(menu()?.style.top).toBe('420px'));
    expect(menu()?.style.left).toBe('172px');
    expect(menu()?.style.width).toBe('180px');
  });
});
