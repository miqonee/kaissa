import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Theme = 'dark' | 'light';

export const useThemeStore = defineStore('theme', () => {
  const current = ref<Theme>(
    (localStorage.getItem('kaissa_theme') as Theme) || 'dark'
  );

  function applyTheme(t: Theme) {
    current.value = t;
    localStorage.setItem('kaissa_theme', t);
    document.documentElement.setAttribute('data-theme', t);
  }

  function toggle() {
    applyTheme(current.value === 'dark' ? 'light' : 'dark');
  }

  function init() {
    applyTheme(current.value);
  }

  return { current, toggle, init, applyTheme };
});
