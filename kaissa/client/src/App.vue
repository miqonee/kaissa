<script setup lang="ts">
import { useAuthStore } from './stores/auth';
import { onMounted } from 'vue';

const auth = useAuthStore();

onMounted(() => {
  // Разрешение на браузерные уведомления — просим после логина (мягко)
  if ('Notification' in window && Notification.permission === 'default') {
    // не спамим запросом сразу: пользователь увидит кнопку в лобби
  }
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
          <path d="M12 2l3 5h-6l3-5z" fill="#d6bd7e"/>
          <path d="M5 21h14M8 21v-4M16 21v-4M7 17h10l-1-4H8l-1 4z" stroke="#d6bd7e" stroke-width="1.6" fill="none" stroke-linejoin="round"/>
          <path d="M6 8h12" stroke="#d6bd7e" stroke-width="1.6"/>
          <path d="M7 8v5h10V8" stroke="#d6bd7e" stroke-width="1.6" fill="none"/>
        </svg>
        Каисса
      </router-link>
      <nav v-if="auth.user">
        <router-link to="/">Лобби</router-link>
        <router-link to="/history">История</router-link>
        <router-link to="/leaderboard">Рейтинг</router-link>
      </nav>
      <div class="me" v-if="auth.user">
        <router-link :to="`/players/${auth.user.username}`" style="color: inherit;">
          {{ auth.user.username }}
        </router-link>
        <span class="rating-chip mono">{{ auth.user.rating }}</span>
        <button class="small" @click="logout">Выйти</button>
      </div>
    </header>
    <main class="page">
      <router-view />
    </main>
  </div>
</template>
