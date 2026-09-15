<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { LeaderboardRow } from 'shared';
import { api } from '../api/rest';
import { usePageSeo } from '../composables/useSeo';

usePageSeo({
  title: 'Таблица лидеров — рейтинг игроков — Каисса',
  description:
    'Таблица лидеров и рейтинг игроков платформы Каисса. Актуальный рейтинг Elo, статистика побед, поражений и партий.',
  keywords: [
    'таблица лидеров',
    'рейтинг игроков',
    'топ шахматистов',
    'elo рейтинг шахматы',
    'сильнейшие игроки',
    'каисса рейтинг',
    'командные шахматы',
  ],
  canonical: '/leaderboard',
  ogTitle: 'Таблица лидеров — рейтинг игроков — Каисса',
  ogDescription:
    'Таблица лидеров и рейтинг игроков платформы Каисса. Актуальный рейтинг Elo, статистика побед, поражений и партий.',
  ogImage: 'https://duochess.ru/og-image.png',
  twitterCard: 'summary_large_image',
});

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
</script>

<template>
  <div class="leaderboard-page">
    <section class="panel leaderboard-panel" aria-labelledby="leaderboard-heading">
      <div class="panel-head">
        <h1 id="leaderboard-heading" class="panel-title">Рейтинг игроков</h1>
        <span class="hint">Elo, старт 1200 · K=32</span>
      </div>
      <div v-if="loading" class="empty">Загрузка…</div>
      <div v-else-if="!rows.length" class="empty">Пока никто не играл.</div>
      <div v-else class="table-wrap">
        <table class="club">
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
    </section>
  </div>
</template>

<style scoped>
.panel-title {
  font-size: 18px;
  margin: 0;
}

.table-wrap {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.leaderboard-page {
  display: flex;
  flex-direction: column;
  gap: var(--gap-l);
}
</style>
