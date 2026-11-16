// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { MultiChess } from 'shared';
import MultiBoard from '../src/components/MultiBoard.vue';

let app: App, root: HTMLElement;
beforeEach(() => {
  root = document.createElement('div');
  document.body.appendChild(root);
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { app?.unmount(); root.remove(); vi.unstubAllGlobals(); });

describe('compact Double Chess input', () => {
  it.each([
    { seat: 0, from: 'i2', to: 'i3', x: 438.75 },
    { seat: 1, from: 'i7', to: 'i6', x: 401.25 },
  ])('drags a pawn from $from to $to with coordinate margins removed', async ({ seat, from, to, x }) => {
    const snapshot = new MultiChess('double').snapshot();
    snapshot.board = { [from]: { seat, role: 'p' } };
    const moves: unknown[] = [];
    app = createApp({ render: () => h(MultiBoard, {
      mode: 'double', snapshot, viewerSeat: seat, myTurn: true,
      dests: { [from]: [to] }, onMove: move => moves.push(move),
    }) });
    app.mount(root);
    await nextTick();
    const svg = root.querySelector('svg')!;
    expect(svg.getAttribute('viewBox')).toBe('24 24 960 480');
    expect(root.querySelector('.double-coordinates')).toBeNull();
    // A wide landscape viewport leaves empty space on either side of the board.
    svg.getBoundingClientRect = () => new DOMRect(0, 0, 840, 300);
    root.querySelector(`[data-cell="${from}"]`)!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: x, clientY: 243.75 }));
    svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: x, clientY: 206.25 }));
    svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: x, clientY: 206.25 }));
    expect(moves).toEqual([{ from, to }]);
  });
  it('batches pointer layout reads once per frame and cancels queued work', async () => {
    const frames = new Map<number, FrameRequestCallback>();
    let frameId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const snapshot = new MultiChess('double').snapshot();
    snapshot.board = { i2: { seat: 0, role: 'p' } };
    const moves = vi.fn();
    app = createApp({ render: () => h(MultiBoard, {
      mode: 'double', snapshot, viewerSeat: 0, myTurn: true,
      dests: { i2: ['i3'] }, onMove: moves,
    }) });
    app.mount(root);
    await nextTick();
    const svg = root.querySelector('svg')!;
    const bounds = vi.fn(() => new DOMRect(0, 0, 840, 300));
    svg.getBoundingClientRect = bounds;
    root.querySelector('[data-cell="i2"]')!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 438.75, clientY: 243.75 }));
    await nextTick();
    bounds.mockClear();
    for (let i = 0; i < 20; i++) svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 438.75, clientY: 220 - i }));
    expect(frames.size).toBe(1);
    expect(bounds).not.toHaveBeenCalled();
    const queued = [...frames.entries()][0]!;
    frames.delete(queued[0]); queued[1](0);
    await nextTick();
    expect(bounds).toHaveBeenCalledTimes(1);
    expect(root.querySelector('.multi-drag-piece')!.getAttribute('visibility')).toBe('visible');
    const transform = root.querySelector('.multi-drag-piece')!.getAttribute('transform');
    expect(transform).toContain('translate(');
    svg.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 438.75, clientY: 206.25 }));
    svg.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    await nextTick();
    expect(frames.size).toBe(0);
    expect(root.querySelector('.multi-drag-piece')).toBeNull();
    svg.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 438.75, clientY: 206.25 }));
    expect(moves).not.toHaveBeenCalled();
  });

});
