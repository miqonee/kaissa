import { defineStore } from 'pinia';
import type { PublicUser } from 'shared';
import { api } from '../api/rest';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as PublicUser | null,
    checked: false,
  }),
  actions: {
    async check() {
      try {
        const res = await api.get<{ user: PublicUser }>('/api/auth/me');
        this.user = res.user;
      } catch {
        this.user = null;
      }
      this.checked = true;
    },
    async login(username: string, password: string) {
      const res = await api.post<{ user: PublicUser }>('/api/auth/login', { username, password });
      this.user = res.user;
    },
    async register(username: string, password: string) {
      const res = await api.post<{ user: PublicUser }>('/api/auth/register', { username, password });
      this.user = res.user;
    },
    async logout() {
      try {
        await api.post('/api/auth/logout', {});
      } finally {
        this.user = null;
        location.href = '/login';
      }
    },
  },
});
