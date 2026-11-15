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
});
