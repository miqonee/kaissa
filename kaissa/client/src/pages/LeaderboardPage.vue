<script setup lang="ts">
import { onMounted, ref } from 'vue';
import type { LeaderboardRow } from 'shared';
import { api } from '../api/rest';

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
  <div>
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
  </div>
</template>
