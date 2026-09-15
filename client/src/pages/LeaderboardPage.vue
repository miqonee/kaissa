<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { LeaderboardRow } from 'shared';
import { api } from '../api/rest';
import AppIcon from '../components/AppIcon.vue';

const router = useRouter();
const rows = ref<LeaderboardRow[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await api.get<{ leaderboard: LeaderboardRow[] }>('/api/users/leaderboard');
    rows.value = res.leaderboard;
  } finally {
    loading.value = false;
  }
});

function play2x2(): void {
  router.push({ path: '/', query: { action: 'quick' } });
}

function findPartner(): void {
  router.push({ path: '/', query: { action: 'lobbies' } });
}
</script>

<template>
  <div class="leaderboard-page">
    <div class="panel">
      <div class="panel-head">
        <h2>Рейтинг клуба</h2>
        <span class="hint">Elo, старт 1200 · K=32</span>
      </div>
      <div v-if="loading" class="empty">Загрузка…</div>
      <div v-else-if="!rows.length" class="empty">Пока никто не играл.</div>
      <table v-else class="club">
        <thead>
          <tr><th style="width: 50px;">#</th><th>Игрок</th><th>Рейтинг</th><th>В</th><th>П</th><th>Партий</th></tr>
        </thead>
        <tbody>
          <tr v-for="(r, i) in rows" :key="r.userId">
            <td class="mono dim">{{ i + 1 }}</td>
            <td><router-link :to="`/players/${r.username}`">{{ r.username }}</router-link></td>
            <td class="mono" style="font-weight: 600;">{{ r.rating }}</td>
            <td class="mono">{{ r.wins }}</td>
            <td class="mono">{{ r.losses }}</td>
            <td class="mono dim">{{ r.wins + r.losses + r.draws }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Блок стратегии и призыва к игре (перелинковка) -->
    <aside class="leaderboard-guide-panel panel" aria-label="Повышение рейтинга">
      <div class="panel-head">
        <h3>
          <AppIcon name="crown" :size="16" />
          Хотите войти в число лидеров клуба?
        </h3>
        <span class="hint">Тактика и правила</span>
      </div>
      <div class="panel-body leaderboard-guide-body">
        <p class="dim">
          Изучите победные приёмы и регламент клубных режимов перед стартом рейтинговой серии:
        </p>
        <div class="guide-quick-links">
          <router-link to="/rules/duo" class="guide-pill">
            <AppIcon name="book-open" :size="13" />
            Правила 2х2 на 1 доске (Duo Chess)
          </router-link>
          <router-link to="/rules/bughouse" class="guide-pill">
            <AppIcon name="bolt" :size="13" />
            Тактика дропов в Багхаусе
          </router-link>
          <router-link to="/about" class="guide-pill">
            <AppIcon name="crown" :size="13" />
            О клубе Каисса
          </router-link>
        </div>
        <div class="guide-cta-actions">
          <button type="button" class="primary small" @click="play2x2">
            <AppIcon name="bolt" :size="13" />
            Сыграть партию 2х2
          </button>
          <button type="button" class="brass small" @click="findPartner">
            <AppIcon name="plus" :size="13" />
            Найти напарника
          </button>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.leaderboard-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-l);
}

.leaderboard-guide-panel {
  border-color: color-mix(in srgb, var(--accent) 30%, var(--line));
}

.leaderboard-guide-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.guide-quick-links {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.guide-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--r-s);
  color: var(--ink);
  text-decoration: none;
  transition: all var(--t-fast);
}

.guide-pill:hover {
  background: var(--surface-inset);
  border-color: var(--accent-2);
  color: var(--accent);
}

.guide-cta-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--line);
}
</style>

