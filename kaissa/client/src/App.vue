<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { onMounted } from 'vue';

const auth = useAuthStore();
const theme = useThemeStore();

onMounted(() => {
  theme.init();
});

function logout() {
  auth.logout();
}
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <router-link to="/" class="brand">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 2l3 5h-6l3-5z" fill="var(--brass)"/>
          <path d="M5 21h14M8 21v-4M16 21v-4M7 17h10l-1-4H8l-1 4z" stroke="var(--brass)" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
          <path d="M6 8h12" stroke="var(--brass)" stroke-width="1.6"/>
          <path d="M7 8v5h10V8" stroke="var(--brass)" stroke-width="1.6" fill="none"/>
        </svg>
        Каисса
      </router-link>
      <nav v-if="auth.user">
        <router-link to="/">Лобби</router-link>
        <router-link to="/history">Архив партий</router-link>
        <router-link to="/leaderboard">Рейтинг</router-link>
        <router-link v-if="auth.user.isAdmin" to="/admin" class="admin-link">
          <span class="badge admin">Админ</span>
        </router-link>
      </nav>

      <div class="topbar-right">
        <button
          class="theme-toggle"
          @click="theme.toggle"
          :title="theme.current === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
          aria-label="Переключить тему"
        >
          <span v-if="theme.current === 'dark'">☀️</span>
          <span v-else>🌙</span>
        </button>

        <div class="me" v-if="auth.user">
          <router-link :to="`/players/${auth.user.username}`" style="color: inherit; font-weight: 500;">
            {{ auth.user.username }}
          </router-link>
          <span class="rating-chip mono">{{ auth.user.rating }}</span>
          <button class="small ghost" @click="logout" title="Выйти">Выйти</button>
        </div>
      </div>
    </header>
    <main class="page">
      <router-view />
    </main>
  </div>
</template>

<style scoped>
.admin-link {
  padding: 4px 6px !important;
}
</style>
