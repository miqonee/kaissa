<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { GAME_MODES, modeLabel, type GameMode, type LeaderboardRow } from "shared";
import { api } from "../api/rest";
import { usePageSeo } from "../composables/useSeo";
import { useI18n } from "../stores/i18n";

const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
usePageSeo({ canonical: '/leaderboard' });
const mode = ref<GameMode | "all">("all");
const rows = ref<LeaderboardRow[]>([]);
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
  <section class="panel">
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
            <th>#</th>
            <th>{{ en ? "Player" : "Игрок" }}</th>
            <th v-if="mode !== 'all'">Elo</th>
            <th>{{ en ? "Total games" : "Всего партий" }}</th>
            <th>{{ en ? "W" : "Победы" }}</th>
            <th>{{ en ? "D" : "Ничьи" }}</th>
            <th>{{ en ? "L" : "Поражения" }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(r, index) in rows" :key="r.userId">
            <td>{{ index + 1 }}</td>
            <td>
              <router-link :to="`/players/${r.username}?mode=${mode}`">{{
                r.username
              }}</router-link>
            </td>
            <td v-if="mode !== 'all'">
              <strong>{{ (r.hasRating || r.ratedGames) ? r.rating : "—" }}</strong>
              <span v-if="r.ratedGames && r.provisional" class="badge">{{
                en ? "Preliminary" : "Предварительный"
              }}</span>
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
.rating-tabs { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 16px 16px; }
h1 {
  font-size: 22px;
}
.rating-rules {
  padding: 0 16px 16px;
}
.rating-rules p {
  font-size: 14px;
}
.table-wrap {
  overflow-x: auto;
}
</style>
