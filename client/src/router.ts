import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

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
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.check();
  const requiresAuth = to.name === 'lobby' || to.name === 'admin';
  if (requiresAuth && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'admin' && !auth.user?.isAdmin) {
    return { name: 'home' };
  }
});

router.afterEach(() => {
  // Скролл вверх при переходах между страницами
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
});

