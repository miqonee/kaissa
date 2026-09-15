<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <footer class="app-footer">
    <!-- Для неавторизованных гостей: компактное описание платформы (SEO) -->
    <div v-if="!auth.user" class="footer-inner">
      <div class="footer-brand-col">
        <router-link to="/" class="footer-brand">
          <svg class="brand-logo" width="22" height="22" viewBox="0 0 180 180" fill="none" aria-hidden="true">
            <rect class="logo-felt" x="24" y="42" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="86" y="36" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="24" y="98" width="46" height="46" rx="12" />
            <rect class="logo-felt" x="80" y="98" width="46" height="46" rx="12" />
          </svg>
          <span>Каисса</span>
        </router-link>
        <p class="footer-desc">
          Онлайн-платформа для командных шахмат 2×2 на одной доске и шведских шахмат (Багхаус).
        </p>
      </div>

      <div class="footer-tech-badges">
        <span class="badge tiny mono">Stockfish 18 WASM</span>
        <span class="badge tiny mono">WebSocket Realtime</span>
        <span class="badge tiny mono">Elo Rating</span>
      </div>
    </div>

    <!-- Нижняя полоса: правила и копирайт (всегда доступна) -->
    <div class="footer-bottom">
      <div class="footer-bottom-inner">
        <div class="footer-left">
          <span class="footer-copy">© 2026 «Каисса»</span>
          <span class="footer-sep">·</span>
          <span class="footer-tagline">Командные шахматы онлайн</span>
        </div>

        <nav class="footer-bottom-nav" aria-label="Правила и о платформе">
          <router-link to="/rules/duo" class="footer-link">Правила 2×2</router-link>
          <span class="footer-sep">·</span>
          <router-link to="/rules/bughouse" class="footer-link">Багхаус</router-link>
          <span class="footer-sep">·</span>
          <router-link to="/about" class="footer-link">О платформе</router-link>
        </nav>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  margin-top: auto;
  background: var(--surface-2);
  border-top: 1px solid var(--line);
  color: var(--ink-2);
}
.footer-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 16px var(--gap-m);
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  border-bottom: 1px solid var(--line);
}
@media (max-width: 600px) {
  .footer-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
    padding: 14px var(--gap-m);
  }
}
.footer-brand-col {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}
.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}
.footer-brand .logo-felt { fill: var(--felt); }
.footer-brand .logo-gold { fill: var(--accent-2); }
[data-theme='dark'] .footer-brand .logo-felt { fill: var(--felt-2); }
.footer-desc {
  font-size: 13px;
  color: var(--ink-3);
  margin: 0;
}
.footer-tech-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.footer-bottom {
  padding: 12px var(--gap-m);
  font-size: 12.5px;
  color: var(--ink-3);
}
.footer-bottom-inner {
  max-width: 1240px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
}
.footer-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.footer-copy {
  color: var(--ink-2);
  font-weight: 500;
}
.footer-tagline {
  color: var(--ink-3);
}
.footer-bottom-nav {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.footer-link {
  color: var(--ink-2);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--t-fast);
}
.footer-link:hover {
  color: var(--accent);
}
.footer-sep {
  color: var(--line-2);
  user-select: none;
}
</style>
