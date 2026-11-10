import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AnimationMode = 'normal' | 'fast' | 'off' | 'adaptive';

export interface ResolvedAnimation {
  enabled: boolean;
  duration: number;
}

export const ANIMATION_STORAGE_KEY = 'kaissa_move_animation';
export const HAPTICS_STORAGE_KEY = 'kaissa_move_haptics';

function savedSetting(key: string): string | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage.getItem(key); } catch { return null; }
}

function saveSetting(key: string, value: string): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, value); } catch { /* Storage can be blocked. */ }
}

export const useSettingsStore = defineStore('settings', () => {
  const initialMode: AnimationMode = (() => {
    const saved = savedSetting(ANIMATION_STORAGE_KEY);
    if (saved === 'normal' || saved === 'fast' || saved === 'off' || saved === 'adaptive') {
      return saved;
    }
    return 'normal';
  })();

  const animationMode = ref<AnimationMode>(initialMode);
  const hapticsEnabled = ref(savedSetting(HAPTICS_STORAGE_KEY) !== 'off');

  function setHapticsEnabled(enabled: boolean): void {
    hapticsEnabled.value = enabled;
    saveSetting(HAPTICS_STORAGE_KEY, enabled ? 'on' : 'off');
  }

  function setAnimationMode(mode: AnimationMode): void {
    animationMode.value = mode;
    saveSetting(ANIMATION_STORAGE_KEY, mode);
  }

  /**
   * Вычисляет параметры анимации для доски с учетом режима и оставшегося времени на часах:
   * - normal: 170 мс (стандартная скорость)
   * - fast: 90 мс (примерно в 2 раза быстрее)
   * - off: выключено (0 мс)
   * - adaptive: >2 мин — 170 мс, <=2 мин — 90 мс, <=1 мин — выключено
   */
  function resolveAnimation(clockMs?: number | null): ResolvedAnimation {
    switch (animationMode.value) {
      case 'off':
        return { enabled: false, duration: 0 };
      case 'fast':
        return { enabled: true, duration: 90 };
      case 'adaptive':
        if (typeof clockMs === 'number' && Number.isFinite(clockMs)) {
          if (clockMs <= 60_000) {
            return { enabled: false, duration: 0 };
          }
          if (clockMs <= 120_000) {
            return { enabled: true, duration: 90 };
          }
        }
        return { enabled: true, duration: 170 };
      case 'normal':
      default:
        return { enabled: true, duration: 170 };
    }
  }

  return {
    animationMode,
    setAnimationMode,
    resolveAnimation,
    hapticsEnabled,
    setHapticsEnabled,
  };
});
