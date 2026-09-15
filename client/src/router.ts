import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./pages/HomePage.vue'),
      meta: { title: 'Каисса — командные шахматы 2×2 и Багхаус онлайн' },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('./pages/LoginPage.vue'),
      meta: { title: 'Вход и регистрация' },
    },
    {
      path: '/lobby/:id',
      name: 'lobby',
      component: () => import('./pages/LobbyPage.vue'),
      meta: { title: 'Лобби матча' },
    },
    {
      path: '/game/:id',
      name: 'game',
      component: () => import('./pages/GamePage.vue'),
      meta: { title: (to: any) => `Партия #${to.params.id}` },
    },
    {
      path: '/history',
      name: 'history',
      component: () => import('./pages/HistoryPage.vue'),
      meta: {
        title: 'Архив партий — база сыгранных матчей — Каисса',
        description: 'Архив и база сыгранных партий шахматного клуба Каисса. Просмотр реплеев игр 2х2 на одной доске и багхауса, разбор ходов и экспорт в PGN.',
      },
    },
    { path: '/replay/:id', redirect: '/history' },
    {
      path: '/players/:username',
      name: 'profile',
      component: () => import('./pages/ProfilePage.vue'),
      meta: { title: (to: any) => `Профиль игрока ${to.params.username} — рейтинг, статистика в Каиссе` },
    },
    {
      path: '/rules/bughouse',
      name: 'rules-bughouse',
      component: () => import('./pages/BughouseRulesPage.vue'),
      meta: {
        title: 'Правила шведских шахмат (Багхаус) онлайн: дропы, тактика, особенности',
        description:
          'Полные правила шведских шахмат (Bughouse Chess) онлайн: дропы фигур из кармана, передача сбитых фигур партнеру, разжалование пешек, тактика мата дропом и стратегии игры парами в клубе Каисса.',
      },
    },
    {
      path: '/rules/duo',
      name: 'rules-duo',
      component: () => import('./pages/DuoRulesPage.vue'),
      meta: {
        title: 'Командные шахматы 2 на 2 на одной доске: правила чередования ходов',
        description:
          'Правила игры в командные шахматы 2 на 2 (Duo Chess) на одной доске: регламент чередования ходов, правило победы при пате, командный тайм-контроль и тактика взаимодействия с напарником в клубе Каисса.',
      },
    },
    { path: '/rules', redirect: '/rules/duo' },
    {
      path: '/about',
      name: 'about',
      component: () => import('./pages/AboutPage.vue'),
      meta: {
        title: 'О шахматном клубе Каисса',
        description:
          'О шахматном клубе Каисса: первая платформа для командных шахмат 2х2 на одной доске и шведских шахмат (Багхаус) онлайн. Stockfish WASM боты, адаптивный рейтинг Elo и живое сообщество.',
      },
    },
    {
      path: '/leaderboard',
      name: 'leaderboard',
      component: () => import('./pages/LeaderboardPage.vue'),
      meta: {
        title: 'Таблица лидеров — рейтинг игроков клуба — Каисса',
        description: 'Таблица лидеров и актуальный рейтинг игроков шахматного клуба Каисса: рейтинг Elo, статистика побед, поражений и партий в командных шахматах 2х2 и багхаусе.',
      },
    },
    {
      path: '/admin',
      name: 'admin',
      component: () => import('./pages/AdminPage.vue'),
      meta: { title: 'Панель администратора' },
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

