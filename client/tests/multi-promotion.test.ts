// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp, h, nextTick, type App } from 'vue';
import { MultiChess } from 'shared';
import MultiBoard from '../src/components/MultiBoard.vue';

let app: App, root: HTMLElement;
beforeEach(() => { root = document.createElement('div'); document.body.appendChild(root); });
afterEach(() => { app?.unmount(); root.remove(); });
function mountPromotion(onMove: (move: { from: string; to: string; promotion?: string }) => void) {
  const snapshot = new MultiChess('double').snapshot();
  snapshot.board = { a1: { seat: 0, role: 'k' }, p8: { seat: 1, role: 'k' }, h1: { seat: 2, role: 'k' }, a8: { seat: 3, role: 'k' }, h7: { seat: 0, role: 'p' } };
  app = createApp({ render: () => h(MultiBoard, { mode: 'double', snapshot, myTurn: true, dests: { h7: ['h8'] }, onMove }) });
  app.mount(root);
}
async function openPromotion() {
  root.querySelector('[data-cell="h7"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); await nextTick();
  root.querySelector('[data-cell="h8"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); await nextTick(); await nextTick();
}

describe('Double Chess pawn promotion', () => {
  it('waits for the chosen piece and emits an underpromotion once', async () => {
    const moves: unknown[] = [];
    mountPromotion(move => moves.push(move));
    await openPromotion();
    expect(moves).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(document.body.style.overflow).toBe('hidden');
    document.querySelector<HTMLButtonElement>('button[aria-label="Конь"]')!.click(); await nextTick();
    expect(moves).toEqual([{ from: 'h7', to: 'h8', promotion: 'n' }]);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });

  it('cancels with Escape without sending a move', async () => {
    const moves: unknown[] = [];
    mountPromotion(move => moves.push(move));
    await openPromotion();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); await nextTick();
    expect(moves).toHaveLength(0);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
