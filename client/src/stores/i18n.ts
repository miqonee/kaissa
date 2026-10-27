// client/src/stores/i18n.ts
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Locale, TranslationSchema } from '../i18n/types';
import { ru } from '../i18n/ru';
import { en } from '../i18n/en';

const DICTIONARIES: Record<Locale, TranslationSchema> = { ru, en };

export const useI18nStore = defineStore('i18n', () => {
  function detectInitialLocale(): Locale {
    if (typeof window === 'undefined') return 'ru';
    // 1. Проверяем явный URL-параметр ?lang=en или ?lang=ru
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlLang = searchParams.get('lang')?.toLowerCase();
      if (urlLang === 'en' || urlLang === 'ru') {
        localStorage.setItem('kaissa_lang', urlLang);
        return urlLang;
      }
    } catch {}

    // Bare URLs are always Russian, matching the prerendered HTML and canonical.
    return 'ru';
  }

  const locale = ref<Locale>(detectInitialLocale());

  const t = computed<TranslationSchema>(() => DICTIONARIES[locale.value] || DICTIONARIES.ru);

  function setLocale(newLocale: Locale, updateUrl = true): void {
    locale.value = newLocale;
    if (typeof window !== 'undefined') {
      localStorage.setItem('kaissa_lang', newLocale);
      document.documentElement.setAttribute('lang', newLocale);

      if (updateUrl && window.history?.replaceState) {
        try {
          const url = new URL(window.location.href);
          if (newLocale === 'en') {
            url.searchParams.set('lang', 'en');
          } else {
            url.searchParams.delete('lang');
          }
          const newSearch = url.searchParams.toString();
          const newPath = url.pathname + (newSearch ? `?${newSearch}` : '') + url.hash;
          window.history.replaceState(null, '', newPath);
        } catch {}
      }
    }
  }

  function toggle(): void {
    setLocale(locale.value === 'ru' ? 'en' : 'ru');
  }

  function init(): void {
    setLocale(locale.value, false);
  }

  return {
    locale,
    t,
    setLocale,
    toggle,
    init,
  };
});

export function useI18n() {
  return useI18nStore();
}
