<script setup lang="ts">
import { useRouter } from 'vue-router';
import AppIcon from './AppIcon.vue';

const router = useRouter();

function play2x2(): void {
  router.push({ path: '/', query: { action: 'quick' } });
}

function findPartner(): void {
  router.push({ path: '/', query: { action: 'lobbies' } });
}
</script>

<template>
  <footer class="app-footer">
    <div class="footer-inner">
      <!-- Блок бренда и миссии -->
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
          Первая специализированная онлайн-платформа для командных шахмат 2×2 на одной доске и шведских шахмат (Багхаус).
          Играйте парами, координируйте атаки и побеждайте в реальном времени.
        </p>
        <div class="footer-tech-badges">
          <span class="badge tiny mono">Stockfish 18 WASM</span>
          <span class="badge tiny mono">WebSocket Realtime</span>
          <span class="badge tiny mono">Elo Rating</span>
        </div>
      </div>

      <!-- Раздел: Правила и обучение -->
      <nav class="footer-nav-col" aria-label="База знаний и правила">
        <h4 class="footer-col-title">Правила и тактика</h4>
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

      <!-- Раздел: Навигация -->
      <nav class="footer-nav-col" aria-label="Навигация">
        <h4 class="footer-col-title">Навигация</h4>
        <ul class="footer-links">
          <li>
            <router-link to="/">Лобби</router-link>
          </li>
          <li>
            <router-link to="/leaderboard">Рейтинг игроков</router-link>
          </li>
          <li>
            <router-link to="/history">Архив партий</router-link>
          </li>
          <li>
            <router-link to="/login">Вход и регистрация</router-link>
          </li>
        </ul>
      </nav>

      <!-- Раздел: Быстрый старт -->
      <div class="footer-cta-col">
        <h4 class="footer-col-title">Быстрый старт</h4>
        <p class="footer-cta-hint">Займите место за быстрым столом или соберите команду:</p>
        <div class="footer-cta-buttons">
          <button type="button" class="primary small block" @click="play2x2">
            <AppIcon name="bolt" :size="14" />
            Сыграть партию 2х2
          </button>
          <button type="button" class="brass small block" @click="findPartner">
            <AppIcon name="plus" :size="14" />
            Найти напарника
          </button>
        </div>
      </div>
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
  padding: 32px var(--gap-m) 24px;
  display: grid;
  grid-template-columns: 2fr 1.3fr 1.1fr 1.3fr;
  gap: 28px;
}
@media (max-width: 960px) {
  .footer-inner { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 600px) {
  .footer-inner { grid-template-columns: 1fr; padding: 20px var(--gap-m); }
}
.footer-brand-col { display: flex; flex-direction: column; gap: 10px; }
.footer-brand {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: var(--font-display); font-size: 20px; font-weight: 700;
  color: var(--ink); text-decoration: none;
}
.footer-brand .logo-felt { fill: var(--felt); }
.footer-brand .logo-gold { fill: var(--accent-2); }
[data-theme='dark'] .footer-brand .logo-felt { fill: var(--felt-2); }
.footer-desc { font-size: 13.5px; line-height: 1.55; color: var(--ink-3); margin: 0; max-width: 380px; }
.footer-tech-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.footer-col-title {
  font-size: 13.5px; font-weight: 600; color: var(--ink);
  text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 10px;
}
.footer-links { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.footer-links a { font-size: 13.5px; color: var(--ink-2); text-decoration: none; }
.footer-links a:hover { color: var(--accent); }
.footer-cta-col { display: flex; flex-direction: column; gap: 8px; }
.footer-cta-hint { font-size: 13px; color: var(--ink-3); margin: 0; }
.footer-cta-buttons { display: flex; flex-direction: column; gap: 8px; }
.footer-bottom { border-top: 1px solid var(--line); background: var(--surface-2); padding: 12px var(--gap-m); font-size: 12.5px; color: var(--ink-3); }
.footer-bottom-inner {
  max-width: 1240px; margin: 0 auto; display: flex;
  align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;
}
.footer-bottom-links { display: inline-flex; align-items: center; gap: 8px; }
</style>
