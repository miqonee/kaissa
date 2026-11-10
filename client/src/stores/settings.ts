import { defineStore } from 'pinia';
import { ref } from 'vue';

export type AnimationMode = 'normal' | 'fast' | 'off' | 'adaptive';

export interface ResolvedAnimation {
  enabled: boolean;
  duration: number;
}

export const ANIMATION_STORAGE_KEY = 'kaissa_move_animation';

export const useSettingsStore = defineStore('settings', () => {
  const initialMode: AnimationMode = (() => {
    if (typeof localStorage === 'undefined') return 'normal';
    const saved = localStorage.getItem(ANIMATION_STORAGE_KEY);
    if (saved === 'normal' || saved === 'fast' || saved === 'off' || saved === 'adaptive') {
      return saved;
    }
    return 'normal';
  })();

  const animationMode = ref<AnimationMode>(initialMode);

  function setAnimationMode(mode: AnimationMode): void {
    animationMode.value = mode;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ANIMATION_STORAGE_KEY, mode);
    }
  }

  /**
   * Вычисляет параметры анимации для доски с учетом режима и оставшегося времени на часах:
   * - normal: 200 мс (стандартная скорость)
   * - fast: 100 мс (в 2 раза быстрее)
   * - off: выключено (0 мс)
   * - adaptive: >2 мин — 200 мс, <=2 мин — 100 мс (в 2 раза быстрее), <=1 мин — выключено
   */
  function resolveAnimation(clockMs?: number | null): ResolvedAnimation {
    switch (animationMode.value) {
      case 'off':
        return { enabled: false, duration: 0 };
      case 'fast':
        return { enabled: true, duration: 100 };
      case 'adaptive':
        if (typeof clockMs === 'number' && Number.isFinite(clockMs)) {
          if (clockMs <= 60_000) {
            return { enabled: false, duration: 0 };
          }
          if (clockMs <= 120_000) {
            return { enabled: true, duration: 100 };
          }
        }
        return { enabled: true, duration: 200 };
      case 'normal':
      default:
        return { enabled: true, duration: 200 };
    }
  }

  return {
    animationMode,
    setAnimationMode,
    resolveAnimation,
  };
});
