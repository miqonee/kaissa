// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, ref, type App } from 'vue';
import ClockDisplay from '../src/components/ClockDisplay.vue';
import { animationClockRange, formatGameClock } from '../src/game/clockDisplay';
import { useVisualClockTicker } from '../src/composables/useVisualClockTicker';
let app: App | undefined, root: HTMLElement | undefined;
afterEach(() => { app?.unmount(); root?.remove(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('isolated clock display', () => {
  it('keeps exact formatting around thresholds and zero', () => {
    expect([null, 0, -1, 19_901, 20_000, 60_000].map(formatGameClock)).toEqual(['—', '0.0', '0.0', '20.0', '0:20', '1:00']);
  });
  it('keeps exact adaptive animation boundaries', () => {
    expect([null, 0, 60_000, 60_001, 120_000, 120_001].map(animationClockRange)).toEqual([null, 60_000, 60_000, 120_000, 120_000, 120_001]);
  });
  it('updates only displayed seconds without rerendering the parent', async () => {
    const remaining = ref(300_000); let parentRenders = 0, displayUpdates = 0;
    root = document.createElement('div'); document.body.appendChild(root);
    app = createApp({ setup() { return () => { parentRenders++; return h(ClockDisplay, { read: () => remaining.value, onVnodeUpdated: () => displayUpdates++ }); }; } });
    app.mount(root);
    for (let i = 0; i < 100; i++) { remaining.value -= 100; await nextTick(); }
    expect(parentRenders).toBe(1);
    expect(displayUpdates).toBe(10);
    expect(root.textContent).toBe('4:50');
  });
  it('updates tenths and low warning without changing parent', async () => {
    const remaining = ref(20_000); let parentRenders = 0;
    root = document.createElement('div'); document.body.appendChild(root);
    app = createApp({ setup() { return () => { parentRenders++; return h(ClockDisplay, { read: () => remaining.value, warnLow: true }); }; } });
    app.mount(root); remaining.value = 19_900; await nextTick();
    expect(root.textContent).toBe('19.9'); expect(root.firstElementChild?.classList.contains('low')).toBe(true);
    expect(parentRenders).toBe(1);
  });
  it('pauses visual ticks while hidden, catches elapsed time on return, and cleans up', async () => {
    vi.useFakeTimers(); vi.setSystemTime(0);
    let hidden = false; vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);
    const tick = vi.fn();
    root = document.createElement('div');
    app = createApp({ setup() { useVisualClockTicker(tick); return () => h('div'); } }); app.mount(root);
    expect(tick).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(100); expect(tick).toHaveBeenCalledTimes(2);
    hidden = true; document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(10000);
    expect(tick).toHaveBeenCalledTimes(2);
    hidden = false; document.dispatchEvent(new Event('visibilitychange')); expect(tick).toHaveBeenCalledTimes(3);
    app.unmount(); app = undefined; vi.advanceTimersByTime(1000); document.dispatchEvent(new Event('visibilitychange'));
    expect(tick).toHaveBeenCalledTimes(3);
  });
});
