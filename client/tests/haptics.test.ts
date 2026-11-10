import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { vibrateMove } from '../src/utils/haptics';

describe('mobile move haptics', () => {
  const vibrate = vi.fn();
  beforeEach(() => {
    vibrate.mockReset();
    vi.stubGlobal('navigator', { vibrate });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('document', { visibilityState: 'visible' });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('gives one short pulse for a confirmed move', () => {
    vibrateMove(true);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(12);
  });
  it('honours the disabled setting, desktop pointer, and background tab', () => {
    vibrateMove(false);
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    vibrateMove(true);
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    vi.stubGlobal('document', { visibilityState: 'hidden' });
    vibrateMove(true);
    expect(vibrate).not.toHaveBeenCalled();
  });
  it('silently handles missing APIs and device policy rejection', () => {
    vi.stubGlobal('navigator', {});
    expect(() => vibrateMove(true)).not.toThrow();
    vi.stubGlobal('navigator', { vibrate: () => { throw new Error('blocked'); } });
    expect(() => vibrateMove(true)).not.toThrow();
  });
});
