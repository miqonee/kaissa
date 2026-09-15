import { prisma } from '../prisma.js';
import { env } from '../env.js';

export type ChangeFreq = 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';

export const VALID_CHANGEFREQS: ReadonlySet<ChangeFreq> = new Set([
  'always',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'yearly',
  'never',
]);

export interface SitemapUrlEntry {
  loc: string;
  lastmod?: string; // W3C format: YYYY-MM-DD
  changefreq?: ChangeFreq;
  priority?: number; // 0.0 - 1.0
}

export interface GenerateSitemapOptions {
  baseUrl?: string;
  activeOnly?: boolean;
  limit?: number;
}

/** Экранирование спецсимволов для XML согласно стандарту sitemaps.org */
export function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/** Форматирование даты в формат W3C Datetime (YYYY-MM-DD) */
export function formatW3CDate(d: Date | string | number | null | undefined): string {
  if (!d) return new Date().toISOString().split('T')[0];
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) {
    return new Date().toISOString().split('T')[0];
  }
  return date.toISOString().split('T')[0];
}

/**
 * Рендеринг одного элемента <url> в XML.
 * По стандарту XML Schema sitemaps.org 0.9 элементы внутри <url> должны
 * строго следовать порядку (xsd:sequence): loc -> lastmod -> changefreq -> priority.
 */
export function formatUrlXml(entry: SitemapUrlEntry): string {
  const parts: string[] = ['  <url>'];
  parts.push(`    <loc>${escapeXml(entry.loc)}</loc>`);
  if (entry.lastmod) {
    parts.push(`    <lastmod>${escapeXml(entry.lastmod)}</lastmod>`);
  }
  if (entry.changefreq) {
    parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  }
  if (entry.priority !== undefined) {
    parts.push(`    <priority>${entry.priority.toFixed(1)}</priority>`);
  }
  parts.push('  </url>');
  return parts.join('\n');
}

/**
 * Получение активных пользователей для sitemap.
 * Активными считаются реальные пользователи (isBot: false),
 * которые участвовали хотя бы в одной партии или имеют зафиксированные исходы партий.
 */
export async function getActivePlayers(options?: { activeOnly?: boolean; limit?: number }) {
  if (typeof prisma.user?.findMany !== 'function') {
    return [];
  }

  const activeOnly = options?.activeOnly ?? true;
  const limit = options?.limit ?? 45_000;

  const where: any = { isBot: false };
  if (activeOnly) {
    where.OR = [
      { participations: { some: {} } },
      { wins: { gt: 0 } },
      { losses: { gt: 0 } },
      { draws: { gt: 0 } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: {
      username: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: [
      { rating: 'desc' },
      { updatedAt: 'desc' },
    ],
    take: limit,
  });
}

/**
 * Генерация sitemap.xml
 * Включает:
 * - Основные статические страницы: /, /leaderboard, /history, /login
 * - Публичные профили активных игроков: /players/:username
 * - Корректные атрибуты lastmod, changefreq, priority для всех страниц
 */
export async function generateSitemapXml(options: GenerateSitemapOptions = {}): Promise<string> {
  const baseUrl = (options.baseUrl || env.siteUrl || 'https://duochess.ru').replace(/\/+$/, '');
  const today = formatW3CDate(new Date());

  // Получаем динамические даты и список активных игроков параллельно
  const [latestGame, latestRating, activePlayers] = await Promise.all([
    typeof prisma.game?.findFirst === 'function'
      ? prisma.game
          .findFirst({
            where: { status: { in: ['finished', 'abandoned'] } },
            orderBy: { endedAt: 'desc' },
            select: { endedAt: true, startedAt: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    typeof prisma.ratingHistory?.findFirst === 'function'
      ? prisma.ratingHistory
          .findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          })
          .catch(() => null)
      : Promise.resolve(null),
    typeof prisma.user?.findMany === 'function'
      ? getActivePlayers(options).catch(() => [])
      : Promise.resolve([]),
  ]);

  const historyLastmod = formatW3CDate(latestGame?.endedAt || latestGame?.startedAt || today);
  const leaderboardLastmod = formatW3CDate(latestRating?.createdAt || today);

  const entries: SitemapUrlEntry[] = [
    // Главная страница: наивысший приоритет, ежедневное обновление
    {
      loc: `${baseUrl}/`,
      lastmod: today,
      changefreq: 'daily',
      priority: 1.0,
    },
    // Таблица лидеров: частые обновления рейтинга
    {
      loc: `${baseUrl}/leaderboard`,
      lastmod: leaderboardLastmod,
      changefreq: 'hourly',
      priority: 0.8,
    },
    // Архив партий: ежедневные обновления
    {
      loc: `${baseUrl}/history`,
      lastmod: historyLastmod,
      changefreq: 'daily',
      priority: 0.7,
    },
    // Правила и информация о платформе
    {
      loc: `${baseUrl}/rules/duo`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.6,
    },
    {
      loc: `${baseUrl}/rules/bughouse`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.6,
    },
    {
      loc: `${baseUrl}/about`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.5,
    },
    // Вход и регистрация: статичная служебная страница
    {
      loc: `${baseUrl}/login`,
      lastmod: today,
      changefreq: 'monthly',
      priority: 0.5,
    },
  ];

  // Динамические профили активных игроков
  for (const player of activePlayers) {
    entries.push({
      loc: `${baseUrl}/players/${encodeURIComponent(player.username)}`,
      lastmod: formatW3CDate(player.updatedAt || player.createdAt || today),
      changefreq: 'weekly',
      priority: 0.6,
    });
  }

  const urlsXml = entries.map(formatUrlXml).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
}

/**
 * Генерация robots.txt согласно требованиям поисковых систем:
 * - Разрешить публичные маршруты
 * - Запретить приватные (/admin) и временные/игровые сессии (/lobby/*, /api/)
 * - Указать директивы Host и Sitemap
 */
export function generateRobotsTxt(options: { baseUrl?: string; host?: string } = {}): string {
  const host = options.host || env.siteHost || 'duochess.ru';
  const baseUrl = (options.baseUrl || env.siteUrl || `https://${host}`).replace(/\/+$/, '');

  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /lobby/',
    'Disallow: /lobby/*',
    'Disallow: /api/',
    '',
    `Host: ${host}`,
    `Sitemap: ${baseUrl}/sitemap.xml`,
    '',
  ].join('\n');
}

// In-memory кеш для снижения нагрузки на БД при частых запросах поисковых роботов
let sitemapCache: { xml: string; generatedAt: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 минут

export async function getCachedSitemapXml(
  options: GenerateSitemapOptions = {},
  forceRefresh = false,
): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && sitemapCache && now - sitemapCache.generatedAt < CACHE_TTL_MS) {
    return sitemapCache.xml;
  }
  const xml = await generateSitemapXml(options);
  sitemapCache = { xml, generatedAt: now };
  return xml;
}

export function clearSitemapCache(): void {
  sitemapCache = null;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
/**
 * Проверка валидности XML sitemap согласно официальному стандарту sitemaps.org (версия 0.9):
 * 1. XML-декларация <?xml version="1.0" encoding="UTF-8"?>
 * 2. Корневой элемент <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
 * 3. Не более 50 000 URL и размер не более 50 МБ
 * 4. Каждый <url> содержит обязательный <loc> (валидный URI до 2048 символов)
 * 5. Необязательный <lastmod> в формате W3C Datetime (YYYY-MM-DD или ISO 8601)
 * 6. Необязательный <changefreq> из списка: always, hourly, daily, weekly, monthly, yearly, never
 * 7. Необязательный <priority> от 0.0 до 1.0
 * 8. Строгий порядок следования тегов (xsd:sequence): loc -> lastmod -> changefreq -> priority
 * 9. Отсутствие недопустимых тегов и неэкранированных спецсимволов
 */
export function validateSitemapXml(xml: string): ValidationResult {
  const errors: string[] = [];

  // Проверка размера (макс. 50 МБ)
  const byteLength = Buffer.byteLength(xml, 'utf8');
  if (byteLength > 50 * 1024 * 1024) {
    errors.push(`Sitemap size exceeds 50MB limit (${byteLength} bytes)`);
  }

  // XML декларация
  const trimmed = xml.trim();
  if (!trimmed.startsWith('<?xml version="1.0" encoding="UTF-8"?>')) {
    errors.push('Missing or invalid XML declaration: expected <?xml version="1.0" encoding="UTF-8"?>');
  }

  // Корневой элемент и namespace
  const rootMatch = trimmed.match(/<urlset\s+xmlns="([^"]+)">/);
  if (!rootMatch) {
    errors.push('Missing <urlset> root element');
  } else if (rootMatch[1] !== 'http://www.sitemaps.org/schemas/sitemap/0.9') {
    errors.push(`Invalid namespace: expected "http://www.sitemaps.org/schemas/sitemap/0.9", got "${rootMatch[1]}"`);
  }

  if (!trimmed.endsWith('</urlset>')) {
    errors.push('Missing closing </urlset> tag at the end of sitemap');
  }

  // Поиск всех блоков <url>...</url>
  const urlBlockRegex = /<url>([\s\S]*?)<\/url>/g;
  let urlCount = 0;
  let match: RegExpExecArray | null;

  while ((match = urlBlockRegex.exec(trimmed)) !== null) {
    urlCount++;
    const urlContent = match[1];

    // Извлечение тегов и их порядка
    const tagMatches = [...urlContent.matchAll(/<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>/g)];
    const tagsPresent = tagMatches.map((m) => m[1]);

    // Проверка допустимых тегов
    const allowedTags = new Set(['loc', 'lastmod', 'changefreq', 'priority']);
    for (const tag of tagsPresent) {
      if (!allowedTags.has(tag)) {
        errors.push(`Unknown element <${tag}> inside <url> #${urlCount}`);
      }
    }

    // Проверка xsd:sequence порядка: loc -> lastmod -> changefreq -> priority
    const tagOrder = ['loc', 'lastmod', 'changefreq', 'priority'];
    let lastOrderIdx = -1;
    for (const tag of tagsPresent) {
      const orderIdx = tagOrder.indexOf(tag);
      if (orderIdx !== -1) {
        if (orderIdx < lastOrderIdx) {
          errors.push(
            `Element <${tag}> is out of sequence inside <url> #${urlCount}. Sequence must be loc -> lastmod -> changefreq -> priority`,
          );
        }
        lastOrderIdx = orderIdx;
      }
    }

    // Проверка <loc>
    const locMatch = urlContent.match(/<loc>([\s\S]*?)<\/loc>/);
    if (!locMatch) {
      errors.push(`Missing required <loc> element inside <url> #${urlCount}`);
    } else {
      const loc = locMatch[1].trim();
      if (loc.length === 0) {
        errors.push(`<loc> is empty inside <url> #${urlCount}`);
      } else if (loc.length > 2048) {
        errors.push(`<loc> exceeds 2048 characters limit inside <url> #${urlCount}`);
      } else if (!/^https?:\/\//i.test(loc)) {
        errors.push(`<loc> must start with http:// or https:// inside <url> #${urlCount}: "${loc}"`);
      }
      // Проверка на неэкранированные спецсимволы в loc
      if (/[<>]/.test(loc) || /&(?!amp;|lt;|gt;|quot;|apos;)/.test(loc)) {
        errors.push(`<loc> contains unescaped XML characters inside <url> #${urlCount}: "${loc}"`);
      }
    }

    // Проверка <lastmod>
    const lastmodMatch = urlContent.match(/<lastmod>([\s\S]*?)<\/lastmod>/);
    if (lastmodMatch) {
      const lastmod = lastmodMatch[1].trim();
      const w3cRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;
      if (!w3cRegex.test(lastmod)) {
        errors.push(`Invalid W3C datetime format in <lastmod> inside <url> #${urlCount}: "${lastmod}"`);
      }
    }

    // Проверка <changefreq>
    const changefreqMatch = urlContent.match(/<changefreq>([\s\S]*?)<\/changefreq>/);
    if (changefreqMatch) {
      const cf = changefreqMatch[1].trim() as ChangeFreq;
      if (!VALID_CHANGEFREQS.has(cf)) {
        errors.push(
          `Invalid <changefreq> value inside <url> #${urlCount}: "${cf}". Must be one of: always, hourly, daily, weekly, monthly, yearly, never`,
        );
      }
    }

    // Проверка <priority>
    const priorityMatch = urlContent.match(/<priority>([\s\S]*?)<\/priority>/);
    if (priorityMatch) {
      const prioStr = priorityMatch[1].trim();
      const prioNum = parseFloat(prioStr);
      if (isNaN(prioNum) || prioNum < 0.0 || prioNum > 1.0) {
        errors.push(`Invalid <priority> value inside <url> #${urlCount}: "${prioStr}". Must be between 0.0 and 1.0`);
      }
    }
  }

  // Проверка лимита количества URL (макс. 50 000)
  if (urlCount === 0) {
    errors.push('Sitemap contains no <url> entries');
  } else if (urlCount > 50_000) {
    errors.push(`Sitemap exceeds maximum limit of 50,000 URLs: found ${urlCount}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

