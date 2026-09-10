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
      path: '/leaderboard',
      name: 'leaderboard',
      component: () => import('./pages/LeaderboardPage.vue'),
      meta: { title: 'Таблица лидеров' },
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
});
