import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ANIMATION_STORAGE_KEY, useSettingsStore } from '../src/stores/settings.js';

describe('Settings store - Move animation', () => {
  const storeData: Record<string, string> = {};

  beforeEach(() => {
    setActivePinia(createPinia());
    for (const key of Object.keys(storeData)) {
      delete storeData[key];
    }
    const mockStorage = {
      getItem: (key: string) => storeData[key] ?? null,
      setItem: (key: string, val: string) => {
        storeData[key] = String(val);
      },
      removeItem: (key: string) => {
        delete storeData[key];
      },
      clear: () => {
        for (const k of Object.keys(storeData)) delete storeData[k];
      },
    };
    (globalThis as unknown as { localStorage: typeof mockStorage }).localStorage = mockStorage;
  });

  it('defaults to normal mode (200ms duration, enabled)', () => {
    const settings = useSettingsStore();
    expect(settings.animationMode).toBe('normal');
    expect(settings.resolveAnimation(null)).toEqual({ enabled: true, duration: 200 });
    expect(settings.resolveAnimation(30_000)).toEqual({ enabled: true, duration: 200 });
  });

  it('switches to fast mode (100ms duration, enabled)', () => {
    const settings = useSettingsStore();
    settings.setAnimationMode('fast');
    expect(settings.animationMode).toBe('fast');
    expect(storeData[ANIMATION_STORAGE_KEY]).toBe('fast');
    expect(settings.resolveAnimation(null)).toEqual({ enabled: true, duration: 100 });
    expect(settings.resolveAnimation(30_000)).toEqual({ enabled: true, duration: 100 });
  });

  it('switches to off mode (disabled)', () => {
    const settings = useSettingsStore();
    settings.setAnimationMode('off');
    expect(settings.animationMode).toBe('off');
    expect(storeData[ANIMATION_STORAGE_KEY]).toBe('off');
    expect(settings.resolveAnimation(null)).toEqual({ enabled: false, duration: 0 });
    expect(settings.resolveAnimation(300_000)).toEqual({ enabled: false, duration: 0 });
  });

  it('resolves adaptive mode based on remaining clock time', () => {
    const settings = useSettingsStore();
    settings.setAnimationMode('adaptive');
    expect(settings.animationMode).toBe('adaptive');
    expect(storeData[ANIMATION_STORAGE_KEY]).toBe('adaptive');

    // Без часов или время неизвестно -> нормальная скорость
    expect(settings.resolveAnimation(null)).toEqual({ enabled: true, duration: 200 });
    expect(settings.resolveAnimation(undefined)).toEqual({ enabled: true, duration: 200 });

    // Больше 2 минут (> 120 000 мс) -> нормальная скорость 200 мс
    expect(settings.resolveAnimation(180_000)).toEqual({ enabled: true, duration: 200 });
    expect(settings.resolveAnimation(120_001)).toEqual({ enabled: true, duration: 200 });

    // От 2 минут до 1 минуты (<= 120 000 мс и > 60 000 мс) -> ускорение в 2 раза (100 мс)
    expect(settings.resolveAnimation(120_000)).toEqual({ enabled: true, duration: 100 });
    expect(settings.resolveAnimation(90_000)).toEqual({ enabled: true, duration: 100 });
    expect(settings.resolveAnimation(60_001)).toEqual({ enabled: true, duration: 100 });

    // 1 минута и меньше (<= 60 000 мс) -> полное отключение анимации
    expect(settings.resolveAnimation(60_000)).toEqual({ enabled: false, duration: 0 });
    expect(settings.resolveAnimation(30_000)).toEqual({ enabled: false, duration: 0 });
    expect(settings.resolveAnimation(0)).toEqual({ enabled: false, duration: 0 });
  });

  it('initializes from saved localStorage setting', () => {
    storeData[ANIMATION_STORAGE_KEY] = 'adaptive';
    const settings = useSettingsStore();
    expect(settings.animationMode).toBe('adaptive');
  });
});
