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
      meta: { title: 'Архив партий' },
    },
    { path: '/replay/:id', redirect: '/history' },
    {
      path: '/players/:username',
      name: 'profile',
      component: () => import('./pages/ProfilePage.vue'),
      meta: { title: (to: any) => `Профиль ${to.params.username}` },
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
        title: 'Таблица лидеров',
        description: 'Таблица лидеров шахматного клуба Каисса: рейтинг игроков Elo, статистика побед, поражений и партий в командных шахматах 2х2 и багхаусе.',
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

router.afterEach((to) => {
  const baseTitle = 'Каисса — командные шахматы 2×2 и Багхаус онлайн';
  if (to.meta?.title) {
    if (typeof to.meta.title === 'function') {
      document.title = `${to.meta.title(to)} — Каисса`;
    } else if (to.path === '/') {
      document.title = to.meta.title as string;
    } else {
      document.title = `${to.meta.title} — Каисса`;
    }
  } else {
    document.title = baseTitle;
  }

  // Обновление SEO-тегов в DOM
  const desc = to.meta?.description as string | undefined;
  if (desc) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', desc);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', desc);

    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', desc);
  }

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) ogTitle.setAttribute('content', document.title);

  const twTitle = document.querySelector('meta[name="twitter:title"]');
  if (twTitle) twTitle.setAttribute('content', document.title);

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) {
    canonical.setAttribute('href', `https://duochess.ru${to.path}`);
  }

  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) {
    ogUrl.setAttribute('content', `https://duochess.ru${to.path}`);
  }

  // Скролл вверх при переходах между страницами
  if (typeof window !== 'undefined') {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
});
