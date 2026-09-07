import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from './stores/auth';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('./pages/HomePage.vue') },
    { path: '/login', name: 'login', component: () => import('./pages/LoginPage.vue') },
    { path: '/lobby/:id', name: 'lobby', component: () => import('./pages/LobbyPage.vue') },
    { path: '/game/:id', name: 'game', component: () => import('./pages/GamePage.vue') },
    { path: '/history', name: 'history', component: () => import('./pages/HistoryPage.vue') },
    { path: '/replay/:id', redirect: '/history' },
    { path: '/players/:username', name: 'profile', component: () => import('./pages/ProfilePage.vue') },
    { path: '/leaderboard', name: 'leaderboard', component: () => import('./pages/LeaderboardPage.vue') },
    { path: '/admin', name: 'admin', component: () => import('./pages/AdminPage.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.check();
  if (to.name !== 'login' && !auth.user) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.name === 'admin' && !auth.user?.isAdmin) {
    return { name: 'home' };
  }
});
