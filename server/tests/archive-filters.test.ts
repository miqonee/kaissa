import { describe, expect, it } from 'vitest';
import { archiveFilters } from '../src/users/archiveFilters.js';

describe('archive filters', () => {
  it('combines an exact ID, match state, custom clock and an inclusive UTC start date range', () => {
    expect(archiveFilters({ gameId: '155', status: 'finished', clock: '5+0', from: '2026-11-19', to: '2026-11-20' })).toEqual([
      { id: 155 }, { status: 'finished' },
      { startedAt: { gte: new Date('2026-11-19'), lt: new Date('2026-11-21') } },
      { noClock: false, baseMin: 5, incSec: 0 },
    ]);
  });
  it('supports either date bound, valid leap day, and clocks with no time control', () => {
    expect(archiveFilters({ from: '2028-02-29', clock: 'untimed' })).toEqual([
      { startedAt: { gte: new Date('2028-02-29') } }, { noClock: true },
    ]);
    expect(archiveFilters({ clock: 'timed' })).toEqual([{ noClock: false }]);
  });
  it('ignores malformed and repeated parameters instead of coercing them', () => {
    expect(archiveFilters({ gameId: '2147483648', from: '2026-02-29', to: ['2026-12-01'], status: 'pending', clock: '5+oops' })).toEqual([]);
  });
  it('uses explicit composition without assuming team numbers in FFA', () => {
    expect(archiveFilters({ opponents: 'all-human' })).toEqual([{ participants: { some: { user: { isBot: false } }, none: { user: { isBot: true } } } }]);
    expect(archiveFilters({ opponents: 'with-bots' })).toEqual([{ participants: { some: { user: { isBot: true } } } }]);
  });
});
