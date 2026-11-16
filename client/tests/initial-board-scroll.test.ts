// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { useInitialBoardScroll } from '../src/composables/useInitialBoardScroll';
let app: App;
let root: HTMLElement;
let focusBoard: () => void;
let frames: FrameRequestCallback[];
const scrollTo = vi.fn();
beforeEach(() => {
  frames = [];
  scrollTo.mockClear();
  vi.stubGlobal('scrollTo', scrollTo);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => frames.push(fn));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  root = document.createElement('div'); document.body.appendChild(root);
  app = createApp({ setup() {
    focusBoard = useInitialBoardScroll(() => root);
    return () => h('div');
  } });
  app.mount(root);
  root.getBoundingClientRect = () => ({ top: 300, bottom: 1100 } as DOMRect);
});
afterEach(() => { app.unmount(); root.remove(); vi.unstubAllGlobals(); });
async function renderFrames() { await nextTick(); while (frames.length) frames.shift()!(0); }
describe('initial board focus', () => {
  it('scrolls once after layout and ignores reconnects', async () => {
    focusBoard(); await renderFrames(); focusBoard(); await renderFrames();
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 292, behavior: 'instant' });
  });
  it('does not move an already fully visible board', async () => {
    root.getBoundingClientRect = () => ({ top: 100, bottom: 400 } as DOMRect);
    focusBoard(); await renderFrames(); expect(scrollTo).not.toHaveBeenCalled();
  });
  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('does not override %s input while loading', async event => {
    focusBoard(); window.dispatchEvent(new Event(event)); await renderFrames();
    expect(scrollTo).not.toHaveBeenCalled();
  });
  it('does not scroll after navigation away', async () => {
    focusBoard(); app.unmount(); await renderFrames(); expect(scrollTo).not.toHaveBeenCalled();
  });
});
