<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { LeaderboardRow } from 'shared';
import { api } from '../api/rest';
import { usePageSeo } from '../composables/useSeo';
import { useI18n } from '../stores/i18n';

const i18n = useI18n();

usePageSeo({
  title: computed(() => (i18n.locale === 'en' ? `Leaderboard: Player Ratings | ${i18n.t.nav.brand}` : 'Таблица лидеров: рейтинг игроков в шахматы 2 на 2 и Багхаус | Каисса')),
  description: computed(() => (i18n.locale === 'en' ? 'Player rankings and club leaderboard on Kaissa. Elo ratings, win/loss stats in 2v2 chess and Bughouse.' : 'Рейтинг игроков и таблица лидеров шахматной платформы Каисса. Рейтинг Elo, статистика побед и поражений в командных шахматах 2х2 и шведских шахматах.')),
  keywords: [
    'таблица лидеров',
    'рейтинг игроков',
    'топ шахматистов',
    'elo рейтинг шахматы',
    'leaderboard',
    'chess rating',
    'kaissa',
  ],
  canonical: '/leaderboard',
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
        <h1 id="leaderboard-heading" class="panel-title">{{ i18n.t.leaderboard.title }}</h1>
        <span class="hint">Elo, start 1200 · K=32</span>
      </div>
      <div v-if="loading" class="empty">{{ i18n.locale === 'en' ? 'Loading…' : 'Загрузка…' }}</div>
      <div v-else-if="!rows.length" class="empty">{{ i18n.t.leaderboard.emptyText }}</div>
      <div v-else class="table-wrap">
        <table class="club">
          <thead>
            <tr>
              <th style="width: 50px;">#</th>
              <th>{{ i18n.t.leaderboard.colPlayer }}</th>
              <th>{{ i18n.t.leaderboard.colRating }}</th>
              <th>{{ i18n.locale === 'en' ? 'W' : 'В' }}</th>
              <th>{{ i18n.locale === 'en' ? 'L' : 'П' }}</th>
              <th>{{ i18n.t.leaderboard.colGames }}</th>
            </tr>
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
