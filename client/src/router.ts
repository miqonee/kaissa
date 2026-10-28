import { createRouter, createWebHistory } from 'vue-router';
import { nextTick } from 'vue';
import { useI18n } from './stores/i18n';
import { useAuthStore } from './stores/auth';

export const YANDEX_METRIKA_ID = 113120948;

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/HomePage.vue'),
      meta: { title: 'Шахматы на двоих онлайн: играть 2 на 2 и в Багхаус | Каисса' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./pages/LoginPage.vue'),
      meta: { title: 'Вход и регистрация в шахматном клубе | Каисса' },
    },
    {
      path: '/lobby/:id',
      name: 'lobby',
      component: () => import('./pages/LobbyPage.vue'),
      meta: { title: 'Лобби матча | Каисса' },
    },
    {
      path: '/game/:id',
      name: 'game',
      component: () => import('./pages/GamePage.vue'),
      meta: { title: (to: any) => `Партия #${to.params.id} | Каисса` },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('./pages/HistoryPage.vue'),
      meta: {
        title: 'Архив партий: реплеи командных шахмат 2 на 2 и Багхауса | Каисса',
        description: 'Архив сыгранных матчей на платформе Каисса. Интерактивный просмотр реплеев игр 2х2 и шведских шахмат, история ходов и анализ партий.',
      },
    },
    { path: '/replay/:id', redirect: '/history' },
    {
      path: '/players/:username',
      name: 'profile',
      component: () => import('./pages/ProfilePage.vue'),
      meta: { title: (to: any) => `Профиль игрока ${to.params.username}: рейтинг и статистика | Каисса` },
    },
    {
      path: '/rules/bughouse',
      name: 'rules-bughouse',
      component: () => import('./pages/BughouseRulesPage.vue'),
      meta: {
        title: 'Правила шведских шахмат (Багхаус) онлайн: тактика и дропы | Каисса',
        description:
          'Подробные правила шведских шахмат (багхаус) онлайн. Как передавать сбитые фигуры партнёру, правила дропа на доску, разжалование пешек и тактика победы в паре.',
      },
    },
    {
      path: '/rules/crazyhouse', name: 'rules-crazyhouse',
      component: () => import('./pages/CrazyhouseRulesPage.vue'),
      meta: { title: 'Crazyhouse онлайн: правила 1×1 и 2×2 | Каисса', description: 'Резерв, дропы и превращения в Crazyhouse. Играйте 1×1 или командой 2×2 с людьми и ботами.' },
    },
    {
      path: '/rules/duo',
      name: 'rules-duo',
      component: () => import('./pages/DuoRulesPage.vue'),
      meta: {
        title: 'Командные шахматы 2 на 2 на одной доске: правила игры | Каисса',
        description:
          'Официальные правила командных шахмат 2 на 2 на одной доске. Поочерёдные ходы напарников, командные часы, тактика игры в паре на платформе Каисса.',
      },
    },
    { path: '/rules', redirect: '/rules/duo' },
    {
      path: '/about',
      name: 'about',
      component: () => import('./pages/AboutPage.vue'),
      meta: {
        title: 'О платформе Каисса: командные шахматы 2 на 2 и Багхаус онлайн',
        description:
          'Платформа Каисса — современный шахматный клуб для командных шахмат 2х2 и багхауса в реальном времени. Рейтинг Elo, боты на базе Stockfish WASM, открытый код.',
      },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: () => import('./pages/LeaderboardPage.vue'),
      meta: {
        title: 'Таблица лидеров: рейтинг игроков в шахматы 2 на 2 и Багхаус | Каисса',
        description: 'Рейтинг игроков и таблица лидеров шахматной платформы Каисса. Рейтинг Elo, статистика побед и поражений в командных шахматах 2х2 и шведских шахматах.',
      },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./pages/AdminPage.vue'),
      meta: { title: 'Панель администратора | Каисса' },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('./pages/NotFoundPage.vue'),
      meta: { title: '404 — Страница не найдена | Каисса' },
    },
  ],
});

router.beforeEach(async (to, from) => {
  const i18n = useI18n();
  if (from.name && i18n.locale === 'en' && !to.query.lang) return { path: to.path, query: { ...to.query, lang: 'en' }, hash: to.hash, replace: true };
  i18n.setLocale(to.query.lang === 'en' ? 'en' : 'ru', false);
  const auth = useAuthStore();
  const needsSession = ['lobby', 'history', 'admin', 'login'].includes(String(to.name));
  if (!auth.checked) {
    if (needsSession) await auth.check();
    else void auth.check();
  }
  if (to.name === 'lobby' && !auth.user) {
    try { await auth.ensureGuest(); }
    catch { return { name: 'login', query: { redirect: to.fullPath, guestError: '1' } }; }
  }
  if (to.name === 'history' && (!auth.user || auth.user.isGuest)) return { name: 'login', query: { redirect: to.fullPath, ...(auth.user?.isGuest ? { claim: '1' } : {}) } };
  const requiresAuth = to.name === 'lobby' || to.name === 'admin';
  if (requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'admin' && !auth.user?.isAdmin) {
    return { name: 'home' };
  }
});

router.afterEach((to, from) => {
  // Скролл вверх при переходах между страницами
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Отправка хита в Яндекс.Метрику для SPA-переходов
    nextTick(() => {
      const ym = (window as any).ym;
      if (typeof ym === 'function') {
        const url = `${window.location.origin}${to.fullPath}`;
        const options: Record<string, any> = {
          title: document.title,
        };
        if (from?.fullPath) {
          options.referer = `${window.location.origin}${from.fullPath}`;
        }
        ym(YANDEX_METRIKA_ID, 'hit', url, options);
      }
    });
  }
});

