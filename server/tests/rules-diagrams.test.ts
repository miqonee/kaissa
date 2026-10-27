import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { BughouseGame } from 'shared/bughouse';

// Exercise the actual diagrams against the same engine used by live games.
const page = readFileSync(new URL('../../client/src/pages/BughouseRulesPage.vue', import.meta.url), 'utf8');
const diagrams = [...page.matchAll(/\sfen="([^"]+)"\s+interactive-fen="([^"]+)"\s+:pocket-white="\[\{ type: '([np])', count: 1 \}\]"/g)];
describe('Bughouse rule examples in both languages', () => {
  it('contains four examples', () => expect(diagrams).toHaveLength(4));
  it.each(diagrams.map((m, i) => [i, m] as const))('example %s is a legal drop with the stated result', (_i, m) => {
    const piece = m[3] as 'n' | 'p';
    const to = piece === 'n' ? 'f7' : 'd6';
    const game = new BughouseGame([m[1], new BughouseGame().fen(1)]);
    game.pocketOf(0, 'w')[piece] = 1;
    expect(game.boards[0].get(to)).toBeUndefined();
    game.apply({ board: 0, to, piece });
    expect(game.fen(0)).toBe(m[2]);
    expect(game.pocketOf(0, 'w')[piece]).toBe(0);
    if (piece === 'n') expect(game.isBughouseCheckmate(0)).toBe(true);
    else {
      expect(game.boards[0].get('e7')?.type).toBe('q');
      expect(game.boards[0].attackers('e7', 'w')).toContain('d6');
    }
  });
});
