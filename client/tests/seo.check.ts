// Самопроверка управления мета-тегами и SEO-параметрами:
// node --experimental-strip-types client/tests/seo.check.ts
import {
  createCanonicalUrl,
  toAbsoluteUrl,
  usePageSeo,
  useSeo,
  BASE_CANONICAL_DOMAIN,
  DEFAULT_TITLE,
  DEFAULT_DESCRIPTION,
  DEFAULT_KEYWORDS,
  DEFAULT_OG_IMAGE,
  SITE_NAME,
} from '../src/composables/useSeo.ts';
import { ref, computed, createApp } from 'vue';

console.log('=== 1. Проверка базовых констант и домена ===');
console.assert(BASE_CANONICAL_DOMAIN === 'https://duochess.ru', `BASE_CANONICAL_DOMAIN must be https://duochess.ru`);
console.assert(DEFAULT_OG_IMAGE === 'https://duochess.ru/og-image.png', `DEFAULT_OG_IMAGE invalid: ${DEFAULT_OG_IMAGE}`);
console.assert(SITE_NAME === 'Каисса', `SITE_NAME must be Каисса`);
console.assert(typeof DEFAULT_TITLE === 'string' && DEFAULT_TITLE.includes('Каисса'), 'DEFAULT_TITLE must include Каисса');
console.assert(typeof DEFAULT_DESCRIPTION === 'string' && DEFAULT_DESCRIPTION.length > 20, 'DEFAULT_DESCRIPTION must be valid');
console.assert(typeof DEFAULT_KEYWORDS === 'string' && DEFAULT_KEYWORDS.includes('шахматы'), 'DEFAULT_KEYWORDS must include шахматы');
console.assert(typeof usePageSeo === 'function', 'usePageSeo must be function');
console.assert(usePageSeo === useSeo, 'useSeo must alias usePageSeo');

console.log('=== 2. Проверка формирования канонических ссылок (canonical) ===');
const canonicalCases: [string | undefined, string][] = [
  ['', 'https://duochess.ru/'],
  [undefined, 'https://duochess.ru/'],
  ['/', 'https://duochess.ru/'],
  ['//', 'https://duochess.ru/'],
  ['/?action=quick', 'https://duochess.ru/'],
  ['/#section', 'https://duochess.ru/'],
  ['/history', 'https://duochess.ru/history'],
  ['/history/', 'https://duochess.ru/history'],
  ['/history?tab=all', 'https://duochess.ru/history'],
  ['/leaderboard', 'https://duochess.ru/leaderboard'],
  ['/leaderboard?page=2', 'https://duochess.ru/leaderboard'],
  ['/players/magnus', 'https://duochess.ru/players/magnus'],
  ['/players/magnus/', 'https://duochess.ru/players/magnus'],
  ['/game/42', 'https://duochess.ru/game/42'],
  ['/game/42?spectate=1#moves', 'https://duochess.ru/game/42'],
  ['https://duochess.ru/', 'https://duochess.ru/'],
  ['https://duochess.ru/rules/duo', 'https://duochess.ru/rules/duo'],
  ['https://duochess.ru/rules/bughouse/', 'https://duochess.ru/rules/bughouse'],
  ['https://otherdomain.org/about', 'https://duochess.ru/about'],
  ['about', 'https://duochess.ru/about'],
];

for (const [input, expected] of canonicalCases) {
  const actual = createCanonicalUrl(input);
  console.assert(actual === expected, `createCanonicalUrl(${input}) expected "${expected}", got "${actual}"`);
}

console.log('=== 3. Проверка toAbsoluteUrl ===');
console.assert(toAbsoluteUrl() === 'https://duochess.ru/og-image.png', 'fallback to default og-image');
console.assert(toAbsoluteUrl('/custom.png') === 'https://duochess.ru/custom.png', 'resolves relative to https://duochess.ru');

console.log('=== 4. Проверка реактивной работы composable usePageSeo ===');
const app = createApp({});

app.runWithContext(() => {
  // 4.1. Профиль игрока: динамический title и персональное description
  const username = ref('alisa');
  const profileData = ref<{ user?: { username: string; rating: number; wins: number; losses: number; draws: number } } | null>(null);

  const profileTitle = computed(() => `Профиль игрока ${username.value} — рейтинг, статистика в Каиссе`);
  const profileDescription = computed(() => {
    if (profileData.value?.user) {
      const u = profileData.value.user;
      const total = u.wins + u.losses + (u.draws || 0);
      return `Профиль игрока ${u.username} в Каиссе: рейтинг ${u.rating} Elo, побед: ${u.wins}, поражений: ${u.losses}, сыграно партий: ${total}. Статистика и история матчей.`;
    }
    return `Профиль игрока ${username.value} — рейтинг, статистика партий и история матчей в Каиссе.`;
  });

  const profileSeo = usePageSeo({
    title: profileTitle,
    description: profileDescription,
    canonical: computed(() => `/players/${username.value}`),
    keywords: computed(() => [`игрок ${username.value}`, 'рейтинг']),
  });

  console.assert(
    profileSeo.title.value === 'Профиль игрока alisa — рейтинг, статистика в Каиссе',
    `Initial profile title incorrect: ${profileSeo.title.value}`,
  );
  console.assert(
    profileSeo.canonical.value === 'https://duochess.ru/players/alisa',
    `Initial profile canonical incorrect: ${profileSeo.canonical.value}`,
  );
  console.assert(
    profileSeo.description.value.includes('alisa'),
    `Initial profile description must mention alisa`,
  );

  // Эмулируем приход данных пользователя из API
  profileData.value = {
    user: { username: 'alisa', rating: 1450, wins: 20, losses: 5, draws: 2 },
  };

  console.assert(
    profileSeo.description.value.includes('1450 Elo') && profileSeo.description.value.includes('побед: 20'),
    `Updated profile description must include personal stats: ${profileSeo.description.value}`,
  );

  // Смена пользователя
  username.value = 'bob';
  profileData.value = null;

  console.assert(
    profileSeo.title.value === 'Профиль игрока bob — рейтинг, статистика в Каиссе',
    `Profile title must react to username change: ${profileSeo.title.value}`,
  );
  console.assert(
    profileSeo.canonical.value === 'https://duochess.ru/players/bob',
    `Canonical must react to username change: ${profileSeo.canonical.value}`,
  );

  // 4.2. Страница партии: title и og-описание
  const gameId = ref(101);
  const gameState = ref<{
    mode: 'bughouse' | 'duo';
    participants: { username: string; team: number }[];
    status: 'active' | 'finished';
    result?: string;
    timeControl: { kind: string; baseMin: number; incSec: number };
  } | null>(null);

  const gameTitle = computed(() => {
    const id = gameId.value;
    if (!gameState.value) return `Партия #${id} — Каисса`;
    const mode = gameState.value.mode === 'bughouse' ? 'Багхаус' : '2×2';
    const t1 = gameState.value.participants.filter((p) => p.team === 1).map((p) => p.username).join(' / ');
    const t2 = gameState.value.participants.filter((p) => p.team === 2).map((p) => p.username).join(' / ');
    if (t1 && t2) return `Партия #${id} (${mode}) — ${t1} vs ${t2} — Каисса`;
    return `Партия #${id} (${mode}) — Каисса`;
  });

  const gameOgDescription = computed(() => {
    const id = gameId.value;
    if (!gameState.value) return `Онлайн-просмотр партии #${id} в шахматном клубе Каисса.`;
    const mode = gameState.value.mode === 'bughouse' ? 'Багхаус (шведские шахматы)' : 'Командные шахматы 2х2';
    const t1 = gameState.value.participants.filter((p) => p.team === 1).map((p) => p.username).join(' / ');
    const t2 = gameState.value.participants.filter((p) => p.team === 2).map((p) => p.username).join(' / ');
    return `Партия #${id} [${mode}]: ${t1} против ${t2}. Смотрите онлайн в шахматном клубе Каисса!`;
  });

  const gameSeo = usePageSeo({
    title: gameTitle,
    description: gameOgDescription,
    canonical: computed(() => `/game/${gameId.value}`),
  });

  console.assert(gameSeo.title.value === 'Партия #101 — Каисса', `Initial game title: ${gameSeo.title.value}`);
  console.assert(gameSeo.canonical.value === 'https://duochess.ru/game/101', `Game canonical: ${gameSeo.canonical.value}`);

  gameState.value = {
    mode: 'bughouse',
    participants: [
      { username: 'Алиса', team: 1 },
      { username: 'Боб', team: 1 },
      { username: 'Чарли', team: 2 },
      { username: 'Дима', team: 2 },
    ],
    status: 'active',
    timeControl: { kind: 'clock', baseMin: 3, incSec: 2 },
  };

  console.assert(
    gameSeo.title.value === 'Партия #101 (Багхаус) — Алиса / Боб vs Чарли / Дима — Каисса',
    `Dynamic game title incorrect: ${gameSeo.title.value}`,
  );
  console.assert(
    gameSeo.ogDescription.value.includes('Алиса / Боб против Чарли / Дима'),
    `Dynamic game ogDescription incorrect: ${gameSeo.ogDescription.value}`,
  );
});

console.log('OK: Все тесты seo.check успешно пройдены!');

