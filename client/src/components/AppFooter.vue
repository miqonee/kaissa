<script setup lang="ts">
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <footer class="app-footer">
    <!-- Для авторизованных игроков скрываем объемный блок ссылок, оставляя только нижнюю полосу -->
    <div v-if="!auth.user" class="footer-inner">
      <!-- Блок бренда и описания платформы -->
      <div class="footer-brand-col">
        <router-link to="/" class="footer-brand">
          <svg class="brand-logo" width="24" height="24" viewBox="0 0 180 180" fill="none" aria-hidden="true">
            <rect class="logo-felt" x="24" y="42" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="86" y="36" width="46" height="46" rx="12" />
            <rect class="logo-gold" x="24" y="98" width="46" height="46" rx="12" />
            <rect class="logo-felt" x="80" y="98" width="46" height="46" rx="12" />
          </svg>
          <span>Каисса</span>
        </router-link>
        <p class="footer-desc">
          Онлайн-платформа для командных шахмат 2×2 на одной доске и шведских шахмат (Багхаус).
          Играйте парами в реальном времени.
        </p>
        <div class="footer-tech-badges">
          <span class="badge tiny mono">Stockfish 18 WASM</span>
          <span class="badge tiny mono">WebSocket Realtime</span>
          <span class="badge tiny mono">Elo Rating</span>
        </div>
      </div>

      <!-- Раздел: Правила и о платформе -->
      <nav class="footer-nav-col" aria-label="Правила и о платформе">
        <h4 class="footer-col-title">Правила и о платформе</h4>
        <ul class="footer-links">
          <li>
            <router-link to="/rules/duo">Командные шахматы 2 на 2</router-link>
          </li>
          <li>
            <router-link to="/rules/bughouse">Шведские шахматы (Багхаус)</router-link>
          </li>
          <li>
            <router-link to="/about">О платформе</router-link>
          </li>
        </ul>
      </nav>
    </div>

    <!-- Нижняя полоса копирайта и условий -->
    <div class="footer-bottom">
      <div class="footer-bottom-inner">
        <span>© 2026 «Каисса». Все права защищены.</span>
        <span class="footer-bottom-links">
          <span>Принципы Fair Play</span>
          <span>·</span>
          <span>Командные шахматы онлайн</span>
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.app-footer {
  margin-top: auto;
  background: var(--surface);
  border-top: 1px solid var(--line);
  color: var(--ink-2);
}
.footer-inner {
  max-width: 1240px;
  margin: 0 auto;
  padding: 28px var(--gap-m) 22px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 32px;
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .footer-inner {
    flex-direction: column;
    gap: 20px;
    padding: 20px var(--gap-m);
  }
}
.footer-brand-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 440px;
}
.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
}
.footer-brand .logo-felt { fill: var(--felt); }
.footer-brand .logo-gold { fill: var(--accent-2); }
[data-theme='dark'] .footer-brand .logo-felt { fill: var(--felt-2); }
.footer-desc {
  font-size: 13.5px;
  line-height: 1.55;
  color: var(--ink-3);
  margin: 0;
}
.footer-tech-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.footer-col-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0 0 10px;
}
.footer-links {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.footer-links a {
  font-size: 13.5px;
  color: var(--ink-2);
  text-decoration: none;
  transition: color 0.12s ease;
}
.footer-links a:hover {
  color: var(--accent);
}
.footer-bottom {
  border-top: 1px solid var(--line);
  background: var(--surface-2);
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
  gap: 8px;
}
.footer-bottom-links {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>
