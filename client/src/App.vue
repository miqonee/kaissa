<script setup lang="ts">
import BrandMark from './components/BrandMark.vue';
import GuestNotice from './components/GuestNotice.vue';
import { computed, onMounted } from 'vue';
import { useAuthStore } from './stores/auth';
import { useThemeStore } from './stores/theme';
import { useConnectionStore } from './stores/connection';
import { useI18nStore } from './stores/i18n';
import { useToast } from './stores/toast';
import { getSocket } from './api/socket';
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

async function logout(): Promise<void> {
  if (auth.user?.isGuest && !confirm(i18n.locale === 'en' ? 'This guest has no password. Signing out removes access to these games. Save your account first to keep access. Sign out anyway?' : 'У гостя нет пароля. После выхода доступ к его партиям будет потерян. Чтобы сохранить доступ, сначала сохраните аккаунт. Всё равно выйти?')) return;
  try { await auth.logout(); }
  catch { toast.show(i18n.locale === 'en' ? 'Could not sign out. Try again.' : 'Не удалось выйти. Попробуйте ещё раз.'); }
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
        <router-link to="/" class="brand" :aria-label="i18n.t.nav.brand">
          <BrandMark />
          <span class="brand-name">{{ i18n.t.nav.brand }}</span>
        </router-link>

        <nav :aria-label="i18n.locale === 'en' ? 'Main navigation' : 'Основная навигация'">
          <router-link to="/" class="header-control header-nav-link">{{ i18n.t.nav.lobbies }}</router-link>
          <router-link to="/leaderboard" class="header-control header-nav-link">{{ i18n.t.nav.leaderboard }}</router-link>
          <router-link v-if="auth.user && !auth.user.isGuest" to="/history" class="header-control header-nav-link">{{ i18n.t.nav.history }}</router-link>
          <router-link
            v-if="auth.user?.isAdmin"
            to="/admin"
            class="header-control header-nav-link"
            :title="i18n.t.admin.title"
          >
            <AppIcon name="crown" :size="18" />
            <span>{{ i18n.t.nav.admin }}</span>
          </router-link>
        </nav>

        <div class="topbar-right">
          <button
            class="header-control lang-btn"
            @click="i18n.toggle"
            :title="i18n.t.nav.switchLang"
            :aria-label="i18n.t.nav.switchLang"
          >
            <span class="lang-opt" :class="{ active: i18n.locale === 'ru' }">RU</span>
            <span class="lang-divider">/</span>
            <span class="lang-opt" :class="{ active: i18n.locale === 'en' }">EN</span>
          </button>

          <button class="header-control header-icon" @click="theme.toggle" :title="themeTitle" :aria-label="themeTitle">
            <AppIcon :name="theme.current === 'dark' ? 'sun' : 'moon'" :size="18" />
          </button>

          <template v-if="auth.user">
            <router-link :to="`/players/${auth.user.username}`" class="header-control me-link" :title="`${auth.user.username} · ${connLabel}`" :aria-label="`${i18n.locale === 'en' ? 'Profile' : 'Профиль'}: ${auth.user.username}`">
              <AppIcon name="user" :size="18" />
              <span class="me-name">{{ auth.user.username }}</span>
              <span v-if="auth.user.isGuest" class="profile-label">{{ i18n.locale === 'en' ? 'Guest' : 'Гость' }}</span>
              <span class="conn-indicator" :class="conn.state" role="status" :aria-label="connLabel"><span class="conn-dot"></span></span>
            </router-link>
            <button class="header-control header-icon logout-btn" @click="logout" :title="i18n.t.nav.logout" :aria-label="i18n.t.nav.logout">
              <AppIcon name="log-out" :size="18" />
            </button>
          </template>
          <span v-else-if="auth.checking" class="header-control" role="status" :aria-label="i18n.locale === 'en' ? 'Checking session' : 'Проверка сессии'">…</span>
          <template v-else>
            <router-link to="/login" class="header-control login-header-btn"><span class="login-full">{{ i18n.locale === 'ru' ? 'Войти / Регистрация' : 'Sign In / Register' }}</span><span class="login-short">{{ i18n.locale === 'ru' ? 'Войти' : 'Sign in' }}</span></router-link>
          </template>
        </div>
      </div>
    </header>

    <main class="page">
      <GuestNotice v-if="$route.name !== 'login' && $route.name !== 'game'" compact />
      <router-view :key="$route.fullPath" />
    </main>

    <AppFooter />

    <div v-if="toast.toastText.value" class="toast" role="status">
      <span>{{ toast.toastText.value }}</span>
    </div>
  </div>
</template>

<style scoped>
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
