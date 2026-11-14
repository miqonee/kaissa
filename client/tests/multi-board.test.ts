import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { MultiChess } from 'shared';
import MultiBoard from '../src/components/MultiBoard.vue';

describe('MultiBoard SVG component', () => {
  it('renders Double Chess in a rectangular viewbox and rotates about its centre', async () => {
    const app = createSSRApp({ render: () => h(MultiBoard, { mode: 'double', viewerSeat: 1 }) });
    const html = await renderToString(app);
    expect(html.match(/data-cell="/g)).toHaveLength(128);
    expect(html).toContain('viewBox="0 0 1008 528"');
    expect(html).toContain('rotate(180 504 264)');
    for (const color of ['yellow', 'green', 'red', 'blue']) expect(html).toContain(`/pieces/multi/${color}K.svg`);
  });
  it('renders 160 cells for four-player and legal destination indicators when myTurn=true', async () => {
    const engine = MultiChess.create('four-player');
    const app = createSSRApp({
      render: () =>
        h(MultiBoard, {
          mode: 'four-player',
          snapshot: engine.snapshot(),
          viewerSeat: 0,
          myTurn: true,
          dests: engine.legalMovesRecord(0),
        }),
    });
    const html = await renderToString(app);
    const cellMatches = html.match(/data-cell="/g) ?? [];
    expect(cellMatches).toHaveLength(160);
    expect(html).toContain('data-cell="e2"');
    expect(html).toContain('data-cell="e4"');
  });

  it('renders 96 cells for three-player and rotates board for viewerSeat=1', async () => {
    const engine = MultiChess.create('three-player');
    const app = createSSRApp({
      render: () =>
        h(MultiBoard, {
          mode: 'three-player',
          snapshot: engine.snapshot(),
          viewerSeat: 1,
          myTurn: false,
        }),
    });
    const html = await renderToString(app);
    const cellMatches = html.match(/data-cell="/g) ?? [];
    expect(cellMatches).toHaveLength(96);
    expect(html).toContain('rotate(120');
  });
});
