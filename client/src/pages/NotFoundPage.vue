<script setup lang="ts">
import { usePageSeo } from '../composables/useSeo';

usePageSeo({
  title: '404 — Страница не найдена | Каисса',
  description: 'Запрашиваемая страница не существует или была перемещена.',
  canonical: '/',
});
</script>

<template>
  <div class="not-found-page">
    <div class="not-found-card panel">
      <div class="error-code">404</div>
      <h1>Страница не найдена</h1>
      <p class="description">
        Запрашиваемая страница была перемещена, удалена или никогда не существовала.
      </p>
      <div class="actions">
        <router-link to="/" class="button primary">Вернуться на главную</router-link>
      </div>
      <div class="quick-links">
        <router-link to="/rules/duo">Правила 2х2</router-link>
        <span class="sep">•</span>
        <router-link to="/rules/bughouse">Багхаус</router-link>
        <span class="sep">•</span>
        <router-link to="/leaderboard">Рейтинг</router-link>
        <span class="sep">•</span>
        <router-link to="/about">О платформе</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 160px);
  padding: 40px 16px;
}

.not-found-card {
  max-width: 480px;
  width: 100%;
  padding: 48px 32px;
  text-align: center;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 12px;
}

.error-code {
  font-size: 72px;
  font-weight: 700;
  line-height: 1;
  color: var(--primary, #c9a86a);
  margin-bottom: 16px;
  letter-spacing: -2px;
}

h1 {
  font-size: 22px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--ink);
}

.description {
  font-size: 15px;
  line-height: 1.5;
  color: var(--muted, #a89f91);
  margin: 0 0 28px 0;
}

.actions {
  margin-bottom: 24px;
}

.quick-links {
  font-size: 13px;
  color: var(--muted, #a89f91);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.quick-links a {
  color: var(--muted, #a89f91);
  text-decoration: none;
}

.quick-links a:hover {
  color: var(--ink);
  text-decoration: underline;
}

.sep {
  opacity: 0.5;
}
</style>
