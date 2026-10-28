<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { GAME_MODES, modeLabel, type GameMode, type LeaderboardRow } from "shared";
import { api } from "../api/rest";
import { usePageSeo } from "../composables/useSeo";
import { useI18n } from "../stores/i18n";

import SortableHeader from '../components/SortableHeader.vue';
import { useTableSort } from '../composables/useTableSort';

const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
usePageSeo({ canonical: '/leaderboard' });
const mode = ref<GameMode | "all">("all");
const rows = ref<LeaderboardRow[]>([]);
const rankedRows = computed(() => rows.value.map((row, index) => ({ ...row, rank: index + 1 })));
const { sortedRows, sortBy, sortDirection, key: sortKey, direction } = useTableSort(rankedRows, {
  rank: r => r.rank,
  username: r => r.username,
  rating: r => (r.hasRating || r.ratedGames) ? r.rating : null,
  totalGames: r => r.totalGames,
  wins: r => r.wins,
  draws: r => r.draws,
  losses: r => r.losses,
}, 'rank');
const columns = computed(() => [
  { key: 'rank', label: '#', numeric: true },
  { key: 'username', label: en.value ? 'Player' : 'Игрок', numeric: false },
  ...(mode.value === 'all' ? [] : [{ key: 'rating', label: 'Elo', numeric: true }]),
  { key: 'totalGames', label: en.value ? 'Games' : 'Партий', numeric: true },
  { key: 'wins', label: en.value ? 'W' : 'Победы', numeric: true },
  { key: 'draws', label: en.value ? 'D' : 'Ничьи', numeric: true },
  { key: 'losses', label: en.value ? 'L' : 'Поражения', numeric: true },
]);
watch(mode, () => { if (mode.value === 'all' && sortKey.value === 'rating') { sortKey.value = 'rank'; direction.value = 'ascending'; } });
const loading = ref(false);
const error = ref("");
let version = 0;
async function load() {
  const current = ++version;
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get<{ leaderboard: LeaderboardRow[] }>(
      `/api/users/leaderboard?mode=${mode.value}`,
    );
    if (current === version) rows.value = res.leaderboard;
  } catch (e) {
    if (current === version) error.value = String(e);
  } finally {
    if (current === version) loading.value = false;
  }
}
watch(mode, load, { immediate: true });
</script>
<template>
  <section class="panel leaderboard-panel">
    <div class="panel-head">
      <h1>{{ en ? "Player ratings" : "Рейтинг игроков" }}</h1>
    </div>
    <div class="rating-tabs" role="group" :aria-label="en ? 'Game mode' : 'Режим игры'">
      <button :aria-pressed="mode === 'all'" :class="{ primary: mode === 'all' }" @click="mode = 'all'">{{ en ? 'All games' : 'Все игры' }}</button>
      <button v-for="m in GAME_MODES" :key="m" :aria-pressed="mode === m" :class="{ primary: mode === m }" @click="mode = m">{{ modeLabel(m, i18n.locale) }}</button>
    </div>
    <div class="panel-body rating-rules">
      <p>{{ en ? 'Totals include all completed games. Choose a mode to see its Elo rating.' : 'В итогах учитываются все сыгранные партии. Выберите режим, чтобы посмотреть его рейтинг Elo.' }}</p>
    </div>
    <p v-if="loading" class="empty" role="status">
      {{ en ? "Loading…" : "Загрузка…" }}
    </p>
    <div v-else-if="error" class="empty" role="alert">
      <p>
        {{ en ? "Could not load ratings." : "Не удалось загрузить рейтинг." }}
      </p>
      <button @click="load">{{ en ? "Try again" : "Повторить" }}</button>
    </div>
    <p v-else-if="!rows.length" class="empty">
      {{
        en
          ? "No completed games in this mode yet."
          : "В этом режиме пока нет завершённых партий."
      }}
    </p>
    <div v-else class="table-wrap">
      <table class="club">
        <thead>
          <tr>
            <SortableHeader v-for="column in columns" :key="column.key" :numeric="column.numeric" :direction="sortDirection(column.key)" @sort="sortBy(column.key, column.numeric && column.key !== 'rank' ? 'descending' : 'ascending')">{{ column.label }}</SortableHeader>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in sortedRows" :key="r.userId">
            <td>{{ r.rank }}</td>
            <td>
              <router-link :to="`/players/${encodeURIComponent(r.username)}${mode === 'all' ? '' : `?mode=${mode}`}`">{{
                r.username
              }}</router-link>
            </td>
            <td v-if="mode !== 'all'" class="rating-cell">
              <strong>{{ (r.hasRating || r.ratedGames) ? r.rating : "—" }}</strong>
              <span v-if="r.ratedGames && r.provisional" class="provisional" :title="en ? 'Preliminary rating' : 'Предварительный рейтинг'" :aria-label="en ? 'Preliminary rating' : 'Предварительный рейтинг'">?</span>
            </td>
            <td><strong>{{ r.totalGames }}</strong></td>
            <td>{{ r.wins }}</td>
            <td>{{ r.draws }}</td>
            <td>{{ r.losses }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<style scoped>
.rating-tabs { display: flex; flex-wrap: wrap; gap: 8px; padding: 16px; }
.rating-tabs button { flex: 1 1 auto; }
h1 { font-size: 22px; }
.leaderboard-panel .rating-rules { padding: 0 16px 16px; }
.rating-rules p { margin: 0; font-size: 14px; color: var(--ink-2); }
.table-wrap { overflow-x: auto; }
table { min-width: 560px; }
td { text-align: right; font-variant-numeric: tabular-nums; }
td:nth-child(2) { text-align: left; overflow-wrap: anywhere; min-width: 140px; }
.rating-cell { white-space: nowrap; }
.provisional { margin-left: 4px; color: var(--ink-3); cursor: help; }
@media (max-width: 560px) { .rating-tabs { display: grid; grid-template-columns: 1fr 1fr; } .rating-tabs button:first-child { grid-column: 1 / -1; } }
</style>
