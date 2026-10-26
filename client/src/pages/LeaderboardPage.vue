<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PROVISIONAL_GAMES, type GameMode, type LeaderboardRow } from "shared";
import { api } from "../api/rest";
import { usePageSeo } from "../composables/useSeo";
import { useI18n } from "../stores/i18n";
import ModeTabs from "../components/ModeTabs.vue";
const i18n = useI18n();
const en = computed(() => i18n.locale === "en");
usePageSeo({ canonical: '/leaderboard' });
const mode = ref<GameMode>("team");
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
    <ModeTabs v-model="mode" />
    <div class="panel-body rating-rules">
      <p>
        {{
          en
            ? "Each mode has its own Elo, starting at 1200. Only finished games with registered humans on both teams change ratings. Bots may fill remaining seats; guest matches are training games."
            : "У каждого режима свой Elo со стартом 1200. Рейтинг меняют завершённые партии с зарегистрированными людьми в обеих командах. Боты могут занимать остальные места; матчи с гостями — тренировочные."
        }}
      </p>
      <p class="dim">
        {{
          en
            ? `Preliminary until ${PROVISIONAL_GAMES} rated games. Winning against stronger opponents earns more points; K = 32. New mode ratings start independently; old common ratings remain in the archive.`
            : `До ${PROVISIONAL_GAMES} рейтинговых партий оценка предварительная. За победу над сильными соперниками начисляется больше очков; K = 32. Новые рейтинги по режимам независимы, прежний общий рейтинг сохранён в архиве.`
        }}
      </p>
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
          ? "No rated games in this mode yet."
          : "В этом режиме пока нет рейтинговых партий."
      }}
    </p>
    <div v-else class="table-wrap">
      <table class="club">
        <thead>
          <tr>
            <th>#</th>
            <th>{{ en ? "Player" : "Игрок" }}</th>
            <th>Elo</th>
            <th>{{ en ? "W" : "Победы" }}</th>
            <th>{{ en ? "D" : "Ничьи" }}</th>
            <th>{{ en ? "L" : "Поражения" }}</th>
            <th>{{ en ? "Rated games" : "Рейтинговых партий" }}</th>
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
            <td>
              <strong>{{ r.rating }}</strong>
              <span v-if="r.provisional" class="badge">{{
                en ? "Preliminary" : "Предварительный"
              }}</span>
            </td>
            <td>{{ r.wins }}</td>
            <td>{{ r.draws }}</td>
            <td>{{ r.losses }}</td>
            <td>{{ r.wins + r.losses + r.draws }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
<style scoped>
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
