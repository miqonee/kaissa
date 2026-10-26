<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useConnectionStore } from './stores/connection';
import { useI18nStore } from './stores/i18n';
import { useToast } from './stores/toast';
import { getSocket, resetSocket } from './api/socket';
import AppIcon from './components/AppIcon.vue';
import AppFooter from './components/AppFooter.vue';

const auth = useAuthStore();
const theme = useThemeStore();
const conn = useConnectionStore();
const toast = useToast();
const i18n = useI18nStore();

onMounted(async () => {
  theme.init();
  i18n.init();
  if (!auth.checked) {
    await auth.check();
  }
  getSocket();
});

watch(
  () => auth.user?.id,
  (newId, oldId) => {
    // Сбрасываем сокет только при реальной смене аккаунта, а не при стартовой проверке null -> user
    if (oldId && newId && oldId !== newId) {
      resetSocket();
      getSocket();
    }
  },
);

function logout(): void {
  auth.logout();
}

const themeTitle = computed(() =>
  theme.current === 'dark' ? i18n.t.nav.themeLight : i18n.t.nav.themeDark,
);

const connLabel = computed(() => {
  switch (conn.state) {
    case 'connected':
      return i18n.t.nav.connConnected;
    case 'reconnecting':
      return i18n.t.nav.connReconnecting;
    case 'offline':
      return i18n.t.nav.connOffline;
    default:
      return i18n.t.nav.connConnecting;
  }
});
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <div class="topbar-inner">
        <router-link to="/" class="brand">
          <svg class="brand-logo" width="26" height="26" viewBox="0 0 180 180" fill="none" aria-hidden="true">
            <rect class="logo-felt" x="24" y="42" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="86" y="36" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="24" y="98" width="46" height="46" rx="12" />
            <rect class="logo-felt" x="80" y="98" width="46" height="46" rx="12" />
          </svg>
          {{ i18n.t.nav.brand }}
        </router-link>

        <nav aria-label="Основная навигация">
          <router-link to="/">{{ i18n.t.nav.lobbies }}</router-link>
          <router-link to="/leaderboard">{{ i18n.t.nav.leaderboard }}</router-link>
          <router-link to="/history">{{ i18n.t.nav.history }}</router-link>
        </nav>

        <div class="topbar-right">
          <button
            class="lang-btn"
            @click="i18n.toggle"
            :title="i18n.t.nav.switchLang"
            :aria-label="i18n.t.nav.switchLang"
          >
            <span class="lang-opt" :class="{ active: i18n.locale === 'ru' }">RU</span>
            <span class="lang-divider">/</span>
            <span class="lang-opt" :class="{ active: i18n.locale === 'en' }">EN</span>
          </button>

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

          <button class="icon-btn" @click="theme.toggle" :title="themeTitle" :aria-label="themeTitle">
            <AppIcon :name="theme.current === 'dark' ? 'sun' : 'moon'" :size="16" />
          </button>

          <template v-if="auth.user">
            <router-link
              v-if="auth.user.isAdmin"
              to="/admin"
              class="admin-header-btn"
              :title="i18n.t.admin.title"
            >
              <AppIcon name="crown" :size="14" />
              <span>{{ i18n.t.nav.admin }}</span>
            </router-link>

            <router-link :to="`/players/${auth.user.username}`" class="me-link">
              <span class="me-name">{{ auth.user.username }}</span>
              <span class="rating-chip mono">{{ auth.user.rating }}</span>
            </router-link>
            <button class="logout-btn" @click="logout" :title="i18n.t.nav.logout" :aria-label="i18n.t.nav.logout">
              <AppIcon name="log-out" :size="14" />
              <span class="logout-text">{{ i18n.t.nav.logout }}</span>
            </button>
          </template>
          <template v-else>
            <router-link to="/login" class="login-header-btn">{{ i18n.locale === 'ru' ? 'Войти / Регистрация' : 'Sign In / Register' }}</router-link>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <router-view :key="$route.fullPath" />
    </main>

    <AppFooter />

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
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  text-decoration: none;
  cursor: pointer;
  transition: all 0.15s ease;
}

.admin-header-btn:hover {
  background: var(--accent);
  color: var(--surface);
  border-color: var(--accent);
}

.login-header-btn {
  display: inline-flex;
  align-items: center;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--r-s);
  background: var(--felt);
  color: var(--felt-ink);
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.login-header-btn:hover {
  opacity: 0.9;
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

.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  height: 32px;
  padding: 0 8px;
  font-size: 12px;
  font-weight: 600;
  border-radius: var(--r-s);
  background: var(--surface-2);
  color: var(--ink-2);
  border: 1px solid var(--line);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.lang-btn:hover {
  border-color: var(--line-active);
  color: var(--ink);
}

.lang-opt {
  transition: color 0.15s ease;
}

.lang-opt.active {
  color: var(--accent);
  font-weight: 700;
}

.lang-divider {
  opacity: 0.35;
  font-size: 11px;
}

@media (max-width: 720px) {
  .lang-btn {
    height: 30px;
    padding: 0 6px;
    font-size: 11px;
  }

  .admin-header-btn {
    height: 30px;
    padding: 0 6px;
    font-size: 11px;
    gap: 3px;
    flex-shrink: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .conn-dot {
    animation: none !important;
  }
}

/* ================= Подвал сайта (семантический footer) ================= */
.site-footer {
  margin-top: auto;
  border-top: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink-2);
  width: 100%;
}

.footer-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 32px var(--gap-m) 24px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  flex-wrap: wrap;
}

.footer-brand {
  max-width: 380px;
}

.footer-brand-link {
  margin-bottom: 8px;
}

.footer-desc {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
}

.footer-nav {
  display: flex;
  gap: 48px;
  flex-wrap: wrap;
}

.footer-nav-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.footer-heading {
  font-size: 13px;
  font-weight: 700;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.footer-nav-col a {
  font-size: 13.5px;
  color: var(--ink-2);
  border-bottom: 1px solid transparent;
  transition: color var(--t-fast), border-color var(--t-fast);
}

.footer-nav-col a:hover {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.footer-item {
  font-size: 13px;
}

.footer-bottom {
  border-top: 1px solid var(--line);
  padding: 14px var(--gap-m);
  background: var(--surface-2);
}

.footer-bottom-inner {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  flex-wrap: wrap;
  gap: 8px;
}

@media (max-width: 640px) {
  .footer-inner {
    padding: 24px var(--gap-s) 20px;
    gap: 20px;
  }
  .footer-nav {
    gap: 28px;
  }
}
</style>
