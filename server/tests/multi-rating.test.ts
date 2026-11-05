import { describe, expect, it } from 'vitest';
import { multiplayerEloDelta, ratingKind } from '../src/ratings/service.js';

describe('Multiplayer FFA Elo rating calculation', () => {
  it('computes pairwise Elo deltas ordered by placement and sums to ~0 for equal ratings', () => {
    const players = [
      { uid: 1, ratingBefore: 1200, place: 1 },
      { uid: 2, ratingBefore: 1200, place: 2 },
      { uid: 3, ratingBefore: 1200, place: 3 },
      { uid: 4, ratingBefore: 1200, place: 4 },
    ];
    const deltas = players.map((p) => multiplayerEloDelta(p, players));
    // 1st beats 3 opponents (+16), 2nd beats 2 and loses 1 (+5), 3rd beats 1 and loses 2 (-5), 4th loses 3 (-16)
    expect(deltas).toEqual([16, 5, -5, -16]);
    expect(deltas.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('determines ratingKind for multiplayer based on >=2 humans and no guests', () => {
    expect(
      ratingKind(
        [
          { team: 1, isBot: false },
          { team: 2, isBot: false },
          { team: 3, isBot: true },
        ],
        'three-player',
      ),
    ).toBe('rated');

    expect(
      ratingKind(
        [
          { team: 1, isBot: false },
          { team: 2, isBot: true },
          { team: 3, isBot: true },
        ],
        'three-player',
      ),
    ).toBe('bots');

    expect(
      ratingKind(
        [
          { team: 1, isBot: false, isGuest: true },
          { team: 2, isBot: false },
          { team: 3, isBot: false },
        ],
        'three-player',
      ),
    ).toBe('guest');
  });
});
