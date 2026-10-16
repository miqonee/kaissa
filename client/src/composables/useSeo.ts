import { computed, toValue, watchEffect, type ComputedRef, type MaybeRefOrGetter } from 'vue';
import { useRoute } from 'vue-router';

export const SITE_NAME = 'Каисса';
export const SITE_NAME_EN = 'Kaissa';
export const BASE_CANONICAL_DOMAIN = 'https://duochess.ru';
export const DEFAULT_OG_IMAGE = `${BASE_CANONICAL_DOMAIN}/og-image.png`;
export const DEFAULT_TITLE = 'Шахматы на двоих онлайн: играть 2 на 2 и в Багхаус | Каисса';
export const DEFAULT_TITLE_EN = 'Team Chess Online: 2v2 and Bughouse | Kaissa';
export const DEFAULT_DESCRIPTION =
  'Играйте в шахматы на двоих онлайн бесплатно. Командные шахматы 2х2 на одной доске и шведские шахматы (багхаус) с фигурами из резерва. Игра с друзьями и ботами.';
export const DEFAULT_DESCRIPTION_EN =
  'Play team chess online in pairs on one board or Bughouse with live piece drops and Stockfish AI bots.';
export const DEFAULT_KEYWORDS =
  'шахматы на двоих, шахматы на двоих онлайн, играть в шахматы на двоих, шахматы 2 на 2, командные шахматы, шахматы 2х2, багхаус, шведские шахматы, шахматы вдвоем, каисса';
export const DEFAULT_KEYWORDS_EN =
  'team chess, 2v2 chess, bughouse, duo chess, play chess in pairs, chess online, kaissa';

function getCurrentLocale(): 'ru' | 'en' {
  if (typeof window !== 'undefined') {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlLang = searchParams.get('lang')?.toLowerCase();
      if (urlLang === 'en' || urlLang === 'ru') return urlLang;
      const docLang = document.documentElement.getAttribute('lang')?.toLowerCase();
      if (docLang === 'en' || docLang === 'ru') return docLang;
      const saved = localStorage.getItem('kaissa_lang');
      if (saved === 'en' || saved === 'ru') return saved;
    } catch {}
  }
  return 'ru';
}

/**
 * Нормализует путь или URL к абсолютному каноническому URL с доменом https://duochess.ru/.
 * - Для корня возвращает строго https://duochess.ru/
 * - Очищает от query-параметров и хэшей
 * - Убирает дублирующие и завершающие слеши в подпутях (напр. /history/ -> https://duochess.ru/history)
 */
export function createCanonicalUrl(pathOrUrl?: string): string {
  if (!pathOrUrl || pathOrUrl === '/') {
    return `${BASE_CANONICAL_DOMAIN}/`;
  }

  // Если передан полный URL с протоколом
  if (/^https?:\/\//i.test(pathOrUrl)) {
    try {
      const parsed = new URL(pathOrUrl);
      const cleanPath = parsed.pathname.replace(/\/+$/, '') || '/';
      return cleanPath === '/'
        ? `${BASE_CANONICAL_DOMAIN}/`
        : `${BASE_CANONICAL_DOMAIN}${cleanPath}`;
    } catch {
      // Игнорируем и продолжаем парсинг как строку
    }
  }

  // Отрезаем query-параметры и hash
  const withoutQueryOrHash = pathOrUrl.split(/[?#]/)[0].trim();
  const clean = withoutQueryOrHash.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!clean) {
    return `${BASE_CANONICAL_DOMAIN}/`;
  }
  return `${BASE_CANONICAL_DOMAIN}/${clean}`;
}

/**
 * Преобразует относительный URL изображения к абсолютному на домене duochess.ru
 */
export function toAbsoluteUrl(pathOrUrl?: string): string {
  if (!pathOrUrl) return DEFAULT_OG_IMAGE;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const clean = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${BASE_CANONICAL_DOMAIN}${clean}`;
}

export interface PageSeoOptions {
  title?: MaybeRefOrGetter<string | undefined>;
  description?: MaybeRefOrGetter<string | undefined>;
  keywords?: MaybeRefOrGetter<string | string[] | undefined>;
  canonical?: MaybeRefOrGetter<string | undefined>;
  path?: MaybeRefOrGetter<string | undefined>;
  ogTitle?: MaybeRefOrGetter<string | undefined>;
  ogDescription?: MaybeRefOrGetter<string | undefined>;
  ogImage?: MaybeRefOrGetter<string | undefined>;
  ogUrl?: MaybeRefOrGetter<string | undefined>;
  twitterCard?: MaybeRefOrGetter<'summary' | 'summary_large_image' | 'app' | 'player' | undefined>;
  twitterTitle?: MaybeRefOrGetter<string | undefined>;
  twitterDescription?: MaybeRefOrGetter<string | undefined>;
  twitterImage?: MaybeRefOrGetter<string | undefined>;
  noindex?: MaybeRefOrGetter<boolean | undefined>;
}

export interface ResolvedSeoMeta {
  title: ComputedRef<string>;
  description: ComputedRef<string>;
  keywords: ComputedRef<string>;
  canonical: ComputedRef<string>;
  ogTitle: ComputedRef<string>;
  ogDescription: ComputedRef<string>;
  ogImage: ComputedRef<string>;
  ogUrl: ComputedRef<string>;
  twitterCard: ComputedRef<'summary' | 'summary_large_image' | 'app' | 'player'>;
  twitterTitle: ComputedRef<string>;
  twitterDescription: ComputedRef<string>;
  twitterImage: ComputedRef<string>;
}

/**
 * Composable для динамического реактивного управления мета-тегами SPA.
 * Управляет: title, meta description, keywords, canonical URL, og:title, og:description,
 * og:image, og:url, twitter:card, twitter:title, twitter:description, twitter:image, robots.
 */
export function usePageSeo(options: PageSeoOptions = {}): ResolvedSeoMeta {
  let route: ReturnType<typeof useRoute> | null = null;
  try {
    route = useRoute();
  } catch {
    // Вне контекста vue-router
  }

  const resolvedTitle = computed(() => {
    const val = toValue(options.title);
    if (val?.trim()) return val.trim();
    return getCurrentLocale() === 'en' ? DEFAULT_TITLE_EN : DEFAULT_TITLE;
  });

  const resolvedDescription = computed(() => {
    const val = toValue(options.description);
    if (val?.trim()) return val.trim();
    return getCurrentLocale() === 'en' ? DEFAULT_DESCRIPTION_EN : DEFAULT_DESCRIPTION;
  });

  const resolvedKeywords = computed(() => {
    const val = toValue(options.keywords);
    if (Array.isArray(val)) {
      return val.filter(Boolean).join(', ');
    }
    if (val?.trim()) return val.trim();
    return getCurrentLocale() === 'en' ? DEFAULT_KEYWORDS_EN : DEFAULT_KEYWORDS;
  });

  const resolvedCanonical = computed(() => {
    const explicitCanonical = toValue(options.canonical);
    if (explicitCanonical) {
      return createCanonicalUrl(explicitCanonical);
    }
    const explicitPath = toValue(options.path);
    if (explicitPath) {
      return createCanonicalUrl(explicitPath);
    }
    if (route?.path) {
      return createCanonicalUrl(route.path);
    }
    if (typeof window !== 'undefined' && window.location?.pathname) {
      return createCanonicalUrl(window.location.pathname);
    }
    return `${BASE_CANONICAL_DOMAIN}/`;
  });

  const resolvedOgTitle = computed(() => {
    const val = toValue(options.ogTitle);
    return val?.trim() || resolvedTitle.value;
  });

  const resolvedOgDescription = computed(() => {
    const val = toValue(options.ogDescription);
    return val?.trim() || resolvedDescription.value;
  });

  const resolvedOgImage = computed(() => {
    const val = toValue(options.ogImage);
    return toAbsoluteUrl(val);
  });

  const resolvedOgUrl = computed(() => {
    const val = toValue(options.ogUrl);
    if (val) {
      return createCanonicalUrl(val);
    }
    return resolvedCanonical.value;
  });

  const resolvedTwitterCard = computed(() => {
    const val = toValue(options.twitterCard);
    return val || 'summary_large_image';
  });

  const resolvedTwitterTitle = computed(() => {
    const val = toValue(options.twitterTitle);
    return val?.trim() || resolvedOgTitle.value;
  });

  const resolvedTwitterDescription = computed(() => {
    const val = toValue(options.twitterDescription);
    return val?.trim() || resolvedOgDescription.value;
  });

  const resolvedTwitterImage = computed(() => {
    const val = toValue(options.twitterImage);
    return val ? toAbsoluteUrl(val) : resolvedOgImage.value;
  });

  const resolvedRobots = computed(() => {
    return toValue(options.noindex) ? 'noindex, nofollow' : undefined;
  });

  function setMetaTag(attrName: 'name' | 'property', attrValue: string, content?: string | null) {
    if (typeof document === 'undefined') return;
    let el = document.querySelector(`meta[${attrName}="${attrValue}"]`);
    if (!content) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrValue);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  }

  function setCanonicalTag(href?: string | null) {
    if (typeof document === 'undefined') return;
    let el = document.querySelector('link[rel="canonical"]');
    if (!href) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'canonical');
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  function setHreflangTag(hreflang: string, href?: string | null) {
    if (typeof document === 'undefined') return;
    let el = document.querySelector(`link[rel="alternate"][hreflang="${hreflang}"]`);
    if (!href) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('link');
      el.setAttribute('rel', 'alternate');
      el.setAttribute('hreflang', hreflang);
      document.head.appendChild(el);
    }
    el.setAttribute('href', href);
  }

  if (typeof window !== 'undefined') {
    watchEffect(() => {
      document.title = resolvedTitle.value;
      setMetaTag('name', 'description', resolvedDescription.value);
      setMetaTag('name', 'keywords', resolvedKeywords.value);
      const canonicalUrl = resolvedCanonical.value;
      setCanonicalTag(canonicalUrl);

      // Мультиязычные теги hreflang согласно стандарту Google & Yandex
      const ruHref = canonicalUrl;
      const enHref = canonicalUrl.includes('?') ? `${canonicalUrl}&lang=en` : `${canonicalUrl}?lang=en`;
      setHreflangTag('ru', ruHref);
      setHreflangTag('en', enHref);
      setHreflangTag('x-default', ruHref);

      const locale = getCurrentLocale();
      const isEn = locale === 'en';

      setMetaTag('property', 'og:title', resolvedOgTitle.value);
      setMetaTag('property', 'og:description', resolvedOgDescription.value);
      setMetaTag('property', 'og:image', resolvedOgImage.value);
      setMetaTag('property', 'og:url', resolvedOgUrl.value);
      setMetaTag('property', 'og:site_name', isEn ? SITE_NAME_EN : SITE_NAME);
      setMetaTag('property', 'og:type', 'website');
      setMetaTag('property', 'og:locale', isEn ? 'en_US' : 'ru_RU');
      setMetaTag('property', 'og:locale:alternate', isEn ? 'ru_RU' : 'en_US');

      setMetaTag('name', 'twitter:card', resolvedTwitterCard.value);
      setMetaTag('name', 'twitter:title', resolvedTwitterTitle.value);
      setMetaTag('name', 'twitter:description', resolvedTwitterDescription.value);
      setMetaTag('name', 'twitter:image', resolvedTwitterImage.value);
      setMetaTag('name', 'robots', resolvedRobots.value);
    });
  }

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    keywords: resolvedKeywords,
    canonical: resolvedCanonical,
    ogTitle: resolvedOgTitle,
    ogDescription: resolvedOgDescription,
    ogImage: resolvedOgImage,
    ogUrl: resolvedOgUrl,
    twitterCard: resolvedTwitterCard,
    twitterTitle: resolvedTwitterTitle,
    twitterDescription: resolvedTwitterDescription,
    twitterImage: resolvedTwitterImage,
  };
}

export { usePageSeo as useSeo };

