<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useConnectionStore } from './stores/connection';
import { useToast } from './stores/toast';
import { isMuted, toggleSound } from './audio/sounds';
import { getSocket, resetSocket } from './api/socket';
import AppIcon from './components/AppIcon.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const conn = useConnectionStore();
const toast = useToast();

onMounted(async () => {
  theme.init();
  if (!auth.checked) {
    await auth.check();
  }
  if (auth.user) {
    getSocket();
  }
});

watch(
  () => auth.user,
  (user) => {
    if (user) {
      getSocket();
    } else {
      resetSocket();
    }
  },
);

function logout(): void {
  auth.logout();
}

const themeTitle = computed(() =>
  theme.current === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему',
);

const soundTitle = computed(() =>
  isMuted.value ? 'Включить звуки игры' : 'Выключить звуки игры',
);

const connLabel = computed(() => {
  switch (conn.state) {
    case 'connected':
      return 'Связь установлена';
    case 'reconnecting':
      return 'Переподключение…';
    case 'offline':
      return 'Нет связи';
    default:
      return 'Подключение…';
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 2l3 5h-6l3-5z" fill="var(--accent-2)" />
            <path
              d="M5 21h14M8 21v-4M16 21v-4M7 17h10l-1-4H8l-1 4z"
              stroke="var(--accent-2)"
              stroke-width="1.6"
              fill="none"
              stroke-linejoin="round"
            />
            <path d="M6 8h12" stroke="var(--accent-2)" stroke-width="1.6" />
            <path d="M7 8v5h10V8" stroke="var(--accent-2)" stroke-width="1.6" fill="none" />
          </svg>
          Каисса
        </router-link>

        <nav v-if="auth.user">
          <router-link to="/">Лобби</router-link>
          <router-link to="/history">Архив партий</router-link>
          <router-link to="/leaderboard">Рейтинг</router-link>
        </nav>

        <div class="topbar-right">
          <span
            v-if="auth.user"
            class="conn-indicator"
            :class="conn.state"
            :title="connLabel"
            role="status"
            :aria-label="connLabel"
          >
            <span class="conn-dot"></span>
            <span class="conn-text" v-if="conn.state !== 'connected'">{{ connLabel }}</span>
          </span>

          <button class="icon-btn" @click="toggleSound" :title="soundTitle" :aria-label="soundTitle">
            <AppIcon :name="isMuted ? 'volume-x' : 'volume'" :size="16" />
          </button>

          <button class="icon-btn" @click="theme.toggle" :title="themeTitle" :aria-label="themeTitle">
            <AppIcon :name="theme.current === 'dark' ? 'sun' : 'moon'" :size="16" />
          </button>

          <template v-if="auth.user">
            <router-link
              v-if="auth.user.isAdmin"
              to="/admin"
              class="admin-header-btn"
              title="Панель администратора"
            >
              <AppIcon name="crown" :size="14" />
              <span>Админка</span>
            </router-link>

            <router-link :to="`/players/${auth.user.username}`" class="me-link">
              <span class="me-name">{{ auth.user.username }}</span>
              <span class="rating-chip mono">{{ auth.user.rating }}</span>
            </router-link>
            <button class="logout-btn" @click="logout" title="Выйти из аккаунта">Выйти</button>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <router-view />
    </main>

    <div v-if="toast.toastText.value" class="toast" role="status">
      <span>{{ toast.toastText.value }}</span>
    </div>
  </div>
</template>

<style scoped>
.admin-header-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--r-s);
  background: color-mix(in srgb, var(--accent-1) 12%, transparent);
  color: var(--accent-1);
  border: 1px solid color-mix(in srgb, var(--accent-1) 35%, transparent);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.admin-header-btn:hover {
  background: var(--accent-1);
  color: var(--surface-1);
  border-color: var(--accent-1);
}

.conn-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--ink-2);
  padding: 0 10px;
  border-radius: var(--r-s);
  border: 1px solid var(--line);
  background: var(--surface-2);
  white-space: nowrap;
  box-sizing: border-box;
}

.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ok);
  box-shadow: 0 0 5px var(--ok);
  flex: none;
}

.conn-indicator.reconnecting,
.conn-indicator.connecting {
  background: var(--warn-soft);
  border-color: color-mix(in srgb, var(--warn) 40%, transparent);
  color: var(--warn);
}

.conn-indicator.reconnecting .conn-dot,
.conn-indicator.connecting .conn-dot {
  background: var(--warn);
  box-shadow: 0 0 6px var(--warn);
  animation: conn-blink 1s ease-in-out infinite;
}

.conn-indicator.offline {
  background: var(--bad-soft);
  border-color: color-mix(in srgb, var(--bad) 40%, transparent);
  color: var(--bad);
}

.conn-indicator.offline .conn-dot {
  background: var(--bad);
  box-shadow: 0 0 6px var(--bad);
}

.conn-indicator.connected .conn-text {
  display: none;
}

@keyframes conn-blink {
  0%,
  100% {
    opacity: 0.4;
  }
  50% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .conn-dot {
    animation: none !important;
  }
}
</style>
